import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM, listLLMModels, type Message } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { processFile } from "./fileProcessing";
import { storagePut } from "./storage";
import { generateImage, listImageModels } from "./_core/imageGeneration";
import { transcribeAudio } from "./_core/voiceTranscription";
import * as db from "./db";
import { z } from "zod";
import { getProviderKey, getProviderKeyCandidates } from "./_core/provider-pool";
import { enforceUsage, getSubscriptionConfig, getUsagePolicy } from "./_core/usage-policy";

async function generateImageViaMediaService(input: Parameters<typeof generateImage>[0]) {
  const baseUrl = process.env.IMAGE_SERVICE_URL?.replace(/\/$/, "");
  const token = process.env.IMAGE_SERVICE_TOKEN;
  if (!baseUrl || !token) return generateImage(input);
  const response = await fetch(`${baseUrl}/internal/images/generate`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(150_000),
  });
  if (!response.ok) throw new Error(`خدمة الصور الثانوية لم تستجب (${response.status}).`);
  return (await response.json()) as Awaited<ReturnType<typeof generateImage>>;
}

type SimpleMessage = { role: string; content: unknown };
const publicApiBase = () => (process.env.PUBLIC_API_BASE_URL ?? "https://chatbro-api.onrender.com").replace(/\/$/, "");
const errorForClient = (error: unknown) => {
  const text = error instanceof Error ? error.message : "تعذر تنفيذ الطلب";
  if (/key|configured|authentication/i.test(text)) return "مزود الذكاء الاصطناعي يحتاج إعداد مفتاح على الخادم.";
  if (/quota|rate|429|limit/i.test(text)) return "تم الوصول إلى حد الاستخدام أو معدل الطلبات لهذا المزود.";
  if (/timeout|abort|timed out/i.test(text)) return "انتهت مهلة المزود. حاول مرة أخرى.";
  return text.length < 180 ? text : "تعذر تنفيذ الطلب على الخادم.";
};
async function completeWithOpenRouter(model: string, messages: SimpleMessage[], useWebSearch = false, deepThinking = false) {
  const apiKey = getProviderKey("openrouter", process.env.OPENROUTER_API_KEY);
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");
  const requestedModel = model.replace(/^openrouter:/, "");
  const aliases: Record<string, string> = {
    "": process.env.OPENROUTER_DEFAULT_MODEL ?? "openai/gpt-4o-mini",
    "gpt-5-nano": "openai/gpt-5-nano",
    "gpt-5-mini": "openai/gpt-5-mini",
    "gpt-5": "openai/gpt-5",
    "gpt-5.5": "openai/gpt-5.5",
    "gemini-3-flash-preview": "google/gemini-3-flash-preview",
    "gemini-3.1-pro-preview": "google/gemini-3.1-pro-preview",
  };
  const selectedModel = aliases[requestedModel] ?? requestedModel;
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://chatbro.app",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "Chat Bro",
    },
    body: JSON.stringify({
      model: selectedModel,
      messages,
      max_tokens: 1200,
      ...(deepThinking ? { reasoning: { effort: "high" } } : {}),
      ...(useWebSearch ? {
        tools: [{ type: "openrouter:web_search", parameters: { engine: "auto", search_context_size: "low", max_total_results: 5, max_uses: 1 } }],
        max_tool_calls: 1,
      } : {}),
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenRouter request failed: ${response.status}${detail ? ` - ${detail.slice(0, 300)}` : ""}`);
  }
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }>; model?: string; usage?: unknown };
  return {
    content: payload.choices?.[0]?.message?.content ?? "تعذر قراءة رد OpenRouter.",
    model: payload.model ?? selectedModel,
    usage: payload.usage ?? null,
  };
}

function latestSearchQuery(messages: SimpleMessage[]) {
  const latest = [...messages].reverse().find((message) => message.role === "user")?.content;
  if (typeof latest === "string") return latest.trim().slice(0, 3000);
  if (Array.isArray(latest)) {
    return latest.flatMap((part) => {
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") return [part.text];
      return [];
    }).join("\n").trim().slice(0, 3000);
  }
  return "";
}

async function collectWebSearchContext(messages: SimpleMessage[]) {
  const apiKey = getProviderKey("openrouter", process.env.OPENROUTER_API_KEY);
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required for web search");
  const query = latestSearchQuery(messages);
  if (!query) throw new Error("A text search query is required");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://chatbro.app",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "Chat Bro",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_WEB_SEARCH_MODEL ?? "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: "أنت مساعد بحث ويب. استخدم أداة البحث مرة واحدة فقط، ثم أعد ملخصًا موجزًا باللغة العربية يعتمد على نتائج حديثة، مع ذكر العناوين وروابط المصادر حرفيًا. لا تخمّن أي معلومة غير موجودة في النتائج." },
        { role: "user", content: `ابحث في الويب عن معلومات حديثة حول هذا السؤال:\n${query}` },
      ],
      max_tokens: 700,
      tools: [{ type: "openrouter:web_search", parameters: { engine: "auto", search_context_size: "low", max_total_results: 5, max_uses: 1 } }],
      max_tool_calls: 1,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenRouter web search failed: ${response.status}${detail ? ` - ${detail.slice(0, 250)}` : ""}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }>; annotations?: Array<{ url_citation?: { url?: string; title?: string } }> } }>;
  };
  const message = payload.choices?.[0]?.message;
  const content = typeof message?.content === "string"
    ? message.content
    : Array.isArray(message?.content)
      ? message.content.map((part) => part.text ?? "").join("\n")
      : "";
  const citations = (message?.annotations ?? []).flatMap((annotation) => {
    const citation = annotation.url_citation;
    return citation?.url ? [`- ${citation.title ?? citation.url}: ${citation.url}`] : [];
  });
  const sources = citations.length ? `\n\nروابط مصادر البحث:\n${citations.join("\n")}` : "";
  if (!content && !sources) throw new Error("Web search returned no usable results");
  return `نتائج بحث الويب الحديثة؛ استخدمها للإجابة وأدرج روابط المصادر عند الحاجة:\n${content}${sources}`;
}


function providerMessagesToOpenAI(messages: SimpleMessage[]) {
  return messages.map((message) => ({ role: message.role, content: message.content }));
}

async function completeWithOpenAICompatible(
  provider: string,
  model: string,
  messages: SimpleMessage[],
  baseUrl: string,
  apiKey: string,
) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: model.replace(new RegExp(`^${provider}:`), ""), messages: providerMessagesToOpenAI(messages), max_tokens: 1200 }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${provider} request failed: ${response.status}${detail ? ` - ${detail.slice(0, 300)}` : ""}`);
  }
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }>; model?: string; usage?: unknown };
  return {
    content: payload.choices?.[0]?.message?.content ?? `تعذر قراءة رد ${provider}.`,
    model: payload.model ?? model,
    usage: payload.usage ?? null,
  };
}

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

function geminiParts(content: unknown): GeminiPart[] {
  if (typeof content === "string") return [{ text: content }];
  if (!Array.isArray(content)) return [{ text: String(content ?? "") }];
  return content.reduce<GeminiPart[]>((parts, raw) => {
    if (!raw || typeof raw !== "object") return parts;
    const part = raw as { type?: string; text?: string; image_url?: { url?: string } };
    if (part.type === "text" && part.text) {
      parts.push({ text: part.text });
      return parts;
    }
    if (part.type === "image_url" && part.image_url?.url) {
      const match = part.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
    }
    return parts;
  }, []);
}

async function completeWithGemini(model: string, messages: SimpleMessage[]) {
  const apiKeys = getProviderKeyCandidates("gemini", process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY);
  if (!apiKeys.length) throw new Error("GEMINI_API_KEY is not configured");
  const modelId = model.replace(/^gemini:/, "").replace(/^models\//, "");
  const system = messages.filter((m) => m.role === "system").flatMap((m) => geminiParts(m.content));
  const contents = messages.filter((m) => m.role !== "system").map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: geminiParts(m.content),
  }));
  for (const apiKey of apiKeys) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ ...(system.length ? { system_instruction: { parts: system } } : {}), contents, generationConfig: { maxOutputTokens: 1200 } }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const error = new Error(`Gemini request failed: ${response.status}${detail ? ` - ${detail.slice(0, 300)}` : ""}`);
      if (response.status === 400 || response.status === 401 || response.status === 403) continue;
      throw error;
    }
    const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; modelVersion?: string; usageMetadata?: unknown };
    const content = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return { content: content || "تعذر قراءة رد Gemini.", model: payload.modelVersion ?? modelId, usage: payload.usageMetadata ?? null };
  }
  throw new Error("Gemini rejected all configured API keys (401/403).");
}

async function completeWithGroq(model: string, messages: SimpleMessage[]) {
  const apiKey = getProviderKey("groq", process.env.GROQ_API_KEY);
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");
  return completeWithOpenAICompatible("groq", model, messages, "https://api.groq.com/openai/v1", apiKey);
}

async function completeWithCloudflare(model: string, messages: SimpleMessage[]) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiKey = getProviderKey("cloudflare", process.env.CLOUDFLARE_API_TOKEN ?? process.env.CLOUDFLARE_API_KEY);
  if (!accountId || !apiKey) throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are not configured");
  const modelId = model.replace(/^cloudflare:/, "");
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${modelId}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ messages: providerMessagesToOpenAI(messages) }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Cloudflare Workers AI request failed: ${response.status}${detail ? ` - ${detail.slice(0, 300)}` : ""}`);
  }
  const payload = (await response.json()) as { result?: { response?: string; text?: string } };
  return { content: payload.result?.response ?? payload.result?.text ?? "تعذر قراءة رد Cloudflare.", model: modelId, usage: null };
}

async function completeWithAnthropic(model: string, messages: SimpleMessage[]) {
  const apiKey = getProviderKey("anthropic", process.env.ANTHROPIC_API_KEY);
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  const system = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
  const toAnthropicContent = (content: unknown) => {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return String(content ?? "");
    const blocks: Array<Record<string, unknown>> = [];
    for (const raw of content) {
      if (!raw || typeof raw !== "object") continue;
      const part = raw as { type?: string; text?: string; image_url?: { url?: string } };
      if (part.type === "text" && typeof part.text === "string") blocks.push({ type: "text", text: part.text });
      if (part.type === "image_url" && typeof part.image_url?.url === "string") {
        const url = part.image_url.url;
        const base64 = url.match(/^data:([^;]+);base64,(.+)$/);
        blocks.push(base64
          ? { type: "image", source: { type: "base64", media_type: base64[1], data: base64[2] } }
          : { type: "image", source: { type: "url", url } });
      }
    }
    return blocks.length ? blocks : [{ type: "text", text: "" }];
  };
  const userMessages = messages.filter((message) => message.role !== "system").map((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: toAnthropicContent(message.content),
  }));
  const anthropicBase = (process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com").replace(/\/$/, "");
  const messagesUrl = anthropicBase.endsWith("/v1") ? `${anthropicBase}/messages` : `${anthropicBase}/v1/messages`;
  const response = await fetch(messagesUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: model.replace(/^anthropic:/, ""), max_tokens: 1200, ...(system ? { system } : {}), messages: userMessages }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Anthropic request failed: ${response.status}${detail ? ` - ${detail.slice(0, 300)}` : ""}`);
  }
  const payload = (await response.json()) as { content?: Array<{ type?: string; text?: string }>; model?: string; usage?: unknown };
  return {
    content: payload.content?.filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n") || "تعذر قراءة رد Claude.",
    model: payload.model ?? model,
    usage: payload.usage ?? null,
  };
}

function getConfiguredGateways() {
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(process.env.MODEL_GATEWAYS_JSON ?? "{}");
  } catch {}
  const gateways: Record<string, { baseUrl: string; apiKey?: string }> = {};
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    for (const [id, value] of Object.entries(parsed)) {
      if (!/^[A-Za-z0-9_-]{1,48}$/.test(id) || !value || typeof value !== "object") continue;
      const entry = value as { baseUrl?: unknown; apiKey?: unknown };
      if (typeof entry.baseUrl !== "string" || !/^https:\/\//i.test(entry.baseUrl)) continue;
      gateways[id] = {
        baseUrl: entry.baseUrl,
        apiKey: typeof entry.apiKey === "string" && entry.apiKey ? entry.apiKey : process.env.MODEL_GATEWAY_API_KEY,
      };
    }
  }
  if (process.env.MODEL_GATEWAY_BASE_URL) {
    gateways.default ??= {
      baseUrl: process.env.MODEL_GATEWAY_BASE_URL,
      apiKey: process.env.MODEL_GATEWAY_API_KEY,
    };
  }
  if (process.env.POLLINATIONS_API_KEY) {
    gateways.pollinations ??= { baseUrl: "https://gen.pollinations.ai/v1", apiKey: process.env.POLLINATIONS_API_KEY };
  }
  if (process.env.COMFYUI_BASE_URL) {
    gateways.comfyui ??= { baseUrl: process.env.COMFYUI_BASE_URL, apiKey: process.env.COMFYUI_API_KEY };
  }
  const directProviders: Array<[string, string, string]> = [
    ["huggingface", "HF_TOKEN", "https://router.huggingface.co/v1"],
    ["mistral", "MISTRAL_API_KEY", "https://api.mistral.ai/v1"],
    ["deepinfra", "DEEPINFRA_API_KEY", "https://api.deepinfra.com/v1/openai"],
    ["nvidia", "NVIDIA_API_KEY", "https://integrate.api.nvidia.com/v1"],
    ["fireworks", "FIREWORKS_API_KEY", "https://api.fireworks.ai/inference/v1"],
  ];
  for (const [id, keyName, baseUrl] of directProviders) {
    const apiKey = process.env[keyName];
    if (apiKey) gateways[id] ??= { baseUrl, apiKey };
  }
  return gateways;
}

async function completeWithGateway(model: string, messages: SimpleMessage[]) {
  const [, gatewayId, ...modelParts] = model.split(":");
  const gateways = getConfiguredGateways();
  const gateway = gateways[gatewayId] ?? {
    baseUrl: process.env.MODEL_GATEWAY_BASE_URL ?? "",
    apiKey: process.env.MODEL_GATEWAY_API_KEY,
  };
  if (!gateway.baseUrl)
    throw new Error("MODEL_GATEWAY_BASE_URL is not configured");
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (gateway.apiKey) headers.authorization = `Bearer ${gateway.apiKey}`;
  const response = await fetch(
    `${gateway.baseUrl.replace(/\/$/, "")}/chat/completions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelParts.join(":"),
        messages,
        max_tokens: 1200,
      }),
      signal: AbortSignal.timeout(45_000),
    },
  );
  if (!response.ok)
    throw new Error(`Model gateway request failed: ${response.status}`);
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
  };
  return {
    content:
      payload.choices?.[0]?.message?.content ??
      "تعذر قراءة رد البوابة الخارجية.",
    model: payload.model ?? model,
    usage: null,
  };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  subscription: router({
    config: publicProcedure.query(() => ({ ...getSubscriptionConfig(), limits: getUsagePolicy() })),
    me: protectedProcedure.query(async ({ ctx }) => {
      await db.ensureFreeSubscription(ctx.user.id);
      const subscription = await db.getUserSubscription(ctx.user.id);
      return { ...subscription, featureEnabled: getSubscriptionConfig().enabled };
    }),
    adminPolicy: adminProcedure.query(() => ({ config: getSubscriptionConfig(), limits: getUsagePolicy() })),
  }),
  chat: router({
    complete: publicProcedure
      .input(
        z.object({
          messages: z
            .array(
              z.object({
                role: z.enum(["user", "assistant", "system"]),
                content: z.union([
                  z.string().min(1).max(12000),
                  z.array(
                    z.object({
                      type: z.enum(["text", "image_url", "file_url"]),
                      text: z.string().optional(),
                      image_url: z
                        .object({
                          url: z.string(),
                          detail: z.enum(["auto", "low", "high"]).optional(),
                        })
                        .optional(),
                      file_url: z
                        .object({
                          url: z.string(),
                          mime_type: z.string().optional(),
                        })
                        .optional(),
                    }),
                  ),
                ]),
              }),
            )
            .min(1)
            .max(30),
          model: z.string().min(1).max(160).optional(),
          useWebSearch: z.boolean().optional(),
          deepThinking: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        enforceUsage({ req: ctx.req, user: ctx.user, kind: input.useWebSearch ? "search" : "chat", model: input.model });
        const record = async <T extends { model?: string | null; usage?: unknown }>(result: T) => {
          if (ctx.user) await db.recordUsage({ userId: ctx.user.id, model: result.model ?? input.model, provider: input.model?.split(":")[0] ?? "builtin", requestKind: input.useWebSearch ? "search" : "chat" });
          return result;
        };
        const messages: Message[] = [
          {
            role: "system",
            content:
              "أنت مساعد Chat Bro. أجب بالعربية الواضحة ما لم يطلب المستخدم لغة أخرى. كن عمليًا ومختصرًا، واذكر حدود معرفتك بدل اختلاق مصادر.",
          },
          ...(input.messages as Message[]),
        ];
        const simple = messages.map((message) => ({
          role: message.role,
          content: message.content,
        }));
        try {
          if (input.model?.startsWith("ollama:") || input.model?.startsWith("llama:")) throw new Error("النماذج المحلية تعمل داخل التطبيق فقط.");
          const openRouterRoute = input.model?.startsWith("openrouter:") || (!input.model && Boolean(process.env.OPENROUTER_API_KEY));
          const shouldSearchFirst = Boolean(input.useWebSearch && !openRouterRoute);
          let routedMessages = messages;
          let routedSimple = simple;
          if (shouldSearchFirst) {
            const searchContext = await collectWebSearchContext(simple);
            const searchSystemMessage: Message = { role: "system", content: searchContext };
            routedMessages = [searchSystemMessage, ...messages];
            routedSimple = [{ role: searchSystemMessage.role, content: searchSystemMessage.content }, ...simple];
          }
          if (input.model?.startsWith("openrouter:")) return record(await completeWithOpenRouter(input.model, simple, input.useWebSearch, input.deepThinking));
          if (input.model?.startsWith("gemini:")) return record(await completeWithGemini(input.model, routedSimple));
          if (input.model?.startsWith("groq:")) return record(await completeWithGroq(input.model, routedSimple));
          if (input.model?.startsWith("cloudflare:")) return record(await completeWithCloudflare(input.model, routedSimple));
          if (input.model?.startsWith("anthropic:")) return record(await completeWithAnthropic(input.model, routedSimple));
          if (input.model?.startsWith("gateway:")) return record(await completeWithGateway(input.model, routedSimple));
          if (input.model?.startsWith("builtin:")) {
            const response = await invokeLLM({ model: input.model.slice("builtin:".length), messages: routedMessages, maxTokens: 1200 });
            const content = response.choices[0]?.message?.content;
            return record({ content: typeof content === "string" ? content : JSON.stringify(content ?? ""), model: response.model, usage: response.usage ?? null });
          }
          if (process.env.OPENROUTER_API_KEY && !input.model) return record(await completeWithOpenRouter("", simple, input.useWebSearch, input.deepThinking));
          const response = await invokeLLM({ model: input.model, messages: routedMessages, maxTokens: 1200, ...(input.deepThinking ? { reasoning: { effort: "high" } } : {}) });
          const content = response.choices[0]?.message?.content;
          return record({ content: typeof content === "string" ? content : JSON.stringify(content ?? ""), model: response.model, usage: response.usage ?? null });
        } catch (error) {
          if (ctx.user) await db.recordUsage({ userId: ctx.user.id, model: input.model, provider: input.model?.split(":")[0] ?? "builtin", requestKind: input.useWebSearch ? "search" : "chat", outcome: "error", errorCode: error instanceof Error ? error.name : "UNKNOWN" }).catch(() => undefined);
          throw new TRPCError({ code: "BAD_GATEWAY", message: errorForClient(error) });
        }
      }),
  }),
  attachments: router({
    upload: publicProcedure.input(z.object({ name: z.string().min(1).max(255), mimeType: z.string().max(160), base64: z.string().min(1), conversationId: z.number().int().positive().optional() })).mutation(async ({ input, ctx }) => {
      enforceUsage({ req: ctx.req, user: ctx.user, kind: "file" });
      try {
        const file = await processFile(input);
        const saved = await storagePut(`uploads/${Date.now()}-${file.safeName}`, file.buffer, file.mimeType);
        const url = `${publicApiBase()}${saved.url}`;
        const attachmentId = ctx.user ? await db.createAttachment({ userId: ctx.user.id, conversationId: input.conversationId, fileName: file.safeName, mimeType: file.mimeType, storageKey: saved.key, sizeBytes: file.buffer.length, status: "ready", extractedText: file.extractedText }) : undefined;
        return { attachmentId, name: file.safeName, mimeType: file.mimeType, sizeBytes: file.buffer.length, url, kind: file.kind, extractedText: file.extractedText ?? null };
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: errorForClient(error) });
      }
    }),
  }),
  images: router({
    models: publicProcedure.query(async () => {
      try {
        const result = await listImageModels();
        return { available: result.models.length > 0, models: result.models };
      } catch {
        return { available: false, models: [] };
      }
    }),
    generate: publicProcedure.input(z.object({ prompt: z.string().min(3).max(4000), model: z.string().max(120).optional(), quality: z.enum(["medium", "high"]).optional() })).mutation(async ({ input, ctx }) => {
      enforceUsage({ req: ctx.req, user: ctx.user, kind: "image", model: input.model });
      try {
        const result = await (process.env.IMAGE_SERVICE_URL && process.env.SERVICE_ROLE !== "media" ? generateImageViaMediaService(input) : generateImage(input));
        if (ctx.user) await db.recordUsage({ userId: ctx.user.id, model: input.model, provider: input.model?.split(":")[0] ?? "image", requestKind: "image" });
        return result;
      } catch (error) { if (ctx.user) await db.recordUsage({ userId: ctx.user.id, model: input.model, provider: input.model?.split(":")[0] ?? "image", requestKind: "image", outcome: "error", errorCode: error instanceof Error ? error.name : "UNKNOWN" }).catch(() => undefined); throw new TRPCError({ code: "BAD_GATEWAY", message: errorForClient(error) }); }
    }),
  }),
  voice: router({
    transcribe: publicProcedure.input(z.object({ audioUrl: z.string().url(), language: z.string().max(12).optional(), prompt: z.string().max(500).optional() })).mutation(async ({ input, ctx }) => {
      enforceUsage({ req: ctx.req, user: ctx.user, kind: "voice" });
      const result = await transcribeAudio(input);
      if ("error" in result) throw new TRPCError({ code: "BAD_GATEWAY", message: result.error });
      return result;
    }),
  }),
  conversations: router({
    list: protectedProcedure.query(({ ctx }) => db.listUserConversations(ctx.user.id)),
    messages: protectedProcedure.input(z.object({ conversationId: z.number().int().positive() })).query(({ ctx, input }) => db.listConversationMessages(ctx.user.id, input.conversationId)),
    create: protectedProcedure.input(z.object({ title: z.string().max(255).optional(), model: z.string().max(160).optional() })).mutation(({ ctx, input }) => db.createConversation(ctx.user.id, input.title, input.model)),
  }),
  models: router({
    builtIn: publicProcedure.query(async () => {
      if (!process.env.BUILT_IN_FORGE_API_KEY && !process.env.OPENAI_API_KEY) return { available: false as const, models: [] as Array<{ id: string; name: string; provider: string }> };
      try {
        const catalog = await listLLMModels();
        return { available: true as const, models: catalog.data.map((model) => ({ id: model.id, name: model.id, provider: model.owned_by })) };
      } catch {
        return { available: false as const, models: [] };
      }
    }),
    openRouter: publicProcedure.query(async () => {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) return { available: false as const, models: [] as Array<{ id: string; name: string; contextLength?: number; prompt?: string; completion?: string; architecture?: string; inputModalities?: string[]; outputModalities?: string[] }> };
      try {
        const response = await fetch("https://openrouter.ai/api/v1/models", {
          headers: { authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok) return { available: false as const, models: [] };
        const payload = (await response.json()) as { data?: Array<{ id: string; name?: string; context_length?: number; architecture?: { modality?: string; input_modalities?: string[]; output_modalities?: string[] }; pricing?: { prompt?: string; completion?: string } }> };
        return {
          available: true as const,
          models: (payload.data ?? []).map((model) => ({
            id: model.id,
            name: model.name ?? model.id,
            architecture: model.architecture?.modality,
            inputModalities: model.architecture?.input_modalities,
            outputModalities: model.architecture?.output_modalities,
            contextLength: model.context_length,
            prompt: model.pricing?.prompt,
            completion: model.pricing?.completion,
          })),
        };
      } catch {
        return { available: false as const, models: [] };
      }
    }),

    gemini: publicProcedure.query(async () => {
      const apiKeys = getProviderKeyCandidates("gemini", process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY);
      if (!apiKeys.length) return { available: false as const, models: [] as Array<{ id: string; name: string; supportsVision: boolean; contextLength?: number }> };
      let lastStatus: number | undefined;
      for (const apiKey of apiKeys) {
        try {
          const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(15_000) });
          if (!response.ok) { lastStatus = response.status; continue; }
          const payload = (await response.json()) as { models?: Array<{ name: string; displayName?: string; supportedGenerationMethods?: string[]; inputTokenLimit?: number; outputTokenLimit?: number }> };
          const models = (payload.models ?? []).filter((m) => m.supportedGenerationMethods?.includes("generateContent")).map((m) => ({
            id: m.name.replace(/^models\//, ""),
            name: m.displayName ?? m.name.replace(/^models\//, ""),
            supportsVision: /vision|gemini/i.test(`${m.name} ${m.displayName ?? ""}`),
            contextLength: m.inputTokenLimit,
          }));
          return { available: models.length > 0, models };
        } catch { /* Try the next key; do not log or expose credential material. */ }
      }
      console.warn(`[provider] Gemini model catalog unavailable${lastStatus ? ` (HTTP ${lastStatus})` : " (network error)"}`);
      return { available: false as const, models: [] };
    }),
    groq: publicProcedure.query(async () => {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) return { available: false as const, models: [] as Array<{ id: string; name: string; contextLength?: number }> };
      try {
        const response = await fetch("https://api.groq.com/openai/v1/models", { headers: { authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15_000) });
        if (!response.ok) return { available: false as const, models: [] };
        const payload = (await response.json()) as { data?: Array<{ id: string; owned_by?: string; context_window?: number; active?: boolean }> };
        return { available: true as const, models: (payload.data ?? []).filter((m) => m.active !== false).map((m) => ({ id: m.id, name: m.id, contextLength: m.context_window })) };
      } catch { return { available: false as const, models: [] }; }
    }),
    cloudflare: publicProcedure.query(async () => {
      if (!process.env.CLOUDFLARE_ACCOUNT_ID || !(process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_KEY)) return { available: false as const, models: [] as Array<{ id: string; name: string }> };
      const configured = (process.env.CLOUDFLARE_MODELS ?? "").split(",").map((v: string) => v.trim()).filter(Boolean);
      const fallback = ["@cf/meta/llama-3.1-8b-instruct", "@cf/qwen/qwen1.5-7b-chat-awq", "@cf/mistral/mistral-7b-instruct-v0.2-lora"];
      const ids: string[] = configured.length ? configured : fallback;
      return { available: true as const, models: ids.map((id) => ({ id, name: id.replace(/^@cf\//, "") })) };
    }),
    anthropic: publicProcedure.query(async () => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return { available: false as const, models: [] as Array<{ id: string; name: string; contextLength?: number; supportsVision: boolean }> };
      const base = (process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com").replace(/\/$/, "");
      const modelsBase = base.endsWith("/v1") ? base : `${base}/v1`;
      const models: Array<{ id: string; name: string; contextLength?: number; supportsVision: boolean }> = [];
      let afterId: string | undefined;
      try {
        for (let page = 0; page < 5; page += 1) {
          const url = new URL(`${modelsBase}/models`);
          url.searchParams.set("limit", "100");
          if (afterId) url.searchParams.set("after_id", afterId);
          const response = await fetch(url, {
            headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
            signal: AbortSignal.timeout(12_000),
          });
          if (!response.ok) return { available: false as const, models: [] };
          const payload = (await response.json()) as {
            data?: Array<{ id: string; display_name?: string; max_input_tokens?: number; capabilities?: { image_input?: { supported?: boolean } } }>;
            has_more?: boolean;
            last_id?: string | null;
          };
          models.push(...(payload.data ?? []).filter((model) => typeof model.id === "string").map((model) => ({
            id: model.id,
            name: model.display_name ?? model.id,
            contextLength: model.max_input_tokens,
            supportsVision: Boolean(model.capabilities?.image_input?.supported),
          })));
          if (!payload.has_more || !payload.last_id) break;
          afterId = payload.last_id;
        }
        return { available: models.length > 0, models };
      } catch {
        return { available: false as const, models: [] };
      }
    }),
    gateways: publicProcedure.query(async () => {
      const gateways = Object.entries(getConfiguredGateways()).filter(([id, gateway]) =>
        /^[A-Za-z0-9_-]{1,48}$/.test(id) && typeof gateway.baseUrl === "string" && /^https:\/\//i.test(gateway.baseUrl),
      ).slice(0, 8);
      const results = await Promise.all(gateways.map(async ([gatewayId, gateway]) => {
        try {
          const base = gateway.baseUrl.replace(/\/$/, "");
          const requestModels = (withAuth: boolean) => fetch(`${base}/models`, {
            headers: withAuth && gateway.apiKey ? { authorization: `Bearer ${gateway.apiKey}` } : {},
            signal: AbortSignal.timeout(10_000),
          });
          let response = await requestModels(true);
          if (!response.ok) response = await requestModels(false);
          if (!response.ok) return [];
          type GatewayModelEntry = { id?: string; name?: string; context_length?: number; architecture?: { input_modalities?: string[]; output_modalities?: string[] } };
          let payload = (await response.json()) as { data?: GatewayModelEntry[]; models?: GatewayModelEntry[] };
          let rows = payload.data ?? payload.models ?? [];
          if (!rows.length && gateway.apiKey) {
            response = await requestModels(false);
            if (response.ok) {
              payload = (await response.json()) as { data?: GatewayModelEntry[]; models?: GatewayModelEntry[] };
              rows = payload.data ?? payload.models ?? [];
            }
          }
          const providerLabels: Record<string, string> = { huggingface: "Hugging Face", mistral: "Mistral", deepinfra: "DeepInfra", nvidia: "NVIDIA NIM", fireworks: "Fireworks AI", pollinations: "Pollinations" };
          return rows.filter((item) => typeof item.id === "string" && item.id.length > 0).slice(0, 200).map((item) => ({
            id: `gateway:${gatewayId}:${item.id}`,
            name: item.name ?? item.id!,
            provider: providerLabels[gatewayId.toLowerCase()] ?? gatewayId,
            contextLength: item.context_length,
            inputModalities: item.architecture?.input_modalities,
            outputModalities: item.architecture?.output_modalities ?? ["text"],
          }));
        } catch {
          return [];
        }
      }));
      const models = results.flat();
      return { available: models.length > 0, models };
    }),
    verifyOpenRouterModel: publicProcedure
      .input(z.object({ modelId: z.string().min(1).max(160) }))
      .query(async ({ input }) => {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) return { available: false as const, reason: "مفتاح OpenRouter غير مفعّل على الخادم." };
        try {
          const response = await fetch("https://openrouter.ai/api/v1/models", {
            headers: { authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(10_000),
          });
          if (!response.ok) return { available: false as const, reason: "تعذر قراءة كتالوج OpenRouter." };
          const payload = (await response.json()) as { data?: Array<{ id?: string }> };
          const found = (payload.data ?? []).some((item) => item.id === input.modelId);
          return { available: found, reason: found ? "النموذج ظاهر في كتالوج OpenRouter." : "النموذج غير ظاهر حاليًا في الكتالوج." };
        } catch {
          return { available: false as const, reason: "تعذر التحقق من النموذج الآن." };
        }
      }),
  }),
});
export type AppRouter = typeof appRouter;
