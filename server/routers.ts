import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM, type Message } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { processFile } from "./fileProcessing";
import { storagePut } from "./storage";
import { generateImage } from "./_core/imageGeneration";
import { transcribeAudio } from "./_core/voiceTranscription";
import * as db from "./db";
import { z } from "zod";

type SimpleMessage = { role: string; content: unknown };
const publicApiBase = () => (process.env.PUBLIC_API_BASE_URL ?? "https://chatbro-api.onrender.com").replace(/\/$/, "");
const errorForClient = (error: unknown) => {
  const text = error instanceof Error ? error.message : "تعذر تنفيذ الطلب";
  if (/key|configured|authentication/i.test(text)) return "مزود الذكاء الاصطناعي يحتاج إعداد مفتاح على الخادم.";
  if (/quota|rate|429|limit/i.test(text)) return "تم الوصول إلى حد الاستخدام أو معدل الطلبات لهذا المزود.";
  if (/timeout|abort|timed out/i.test(text)) return "انتهت مهلة المزود. حاول مرة أخرى.";
  return text.length < 180 ? text : "تعذر تنفيذ الطلب على الخادم.";
};
async function completeWithOpenRouter(model: string, messages: SimpleMessage[], useWebSearch = false) {
  const apiKey = process.env.OPENROUTER_API_KEY;
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
      ...(useWebSearch ? { plugins: [{ id: "web", max_results: 5 }] } : {}),
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

async function completeWithAnthropic(model: string, messages: SimpleMessage[]) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  const system = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
  const userMessages = messages.filter((message) => message.role !== "system").map((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: message.content,
  }));
  const response = await fetch(process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com", {
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

async function completeWithGateway(model: string, messages: SimpleMessage[]) {
  const [, gatewayId, ...modelParts] = model.split(":");
  let gateways: Record<string, { baseUrl: string; apiKey?: string }> = {};
  try {
    gateways = JSON.parse(process.env.MODEL_GATEWAYS_JSON ?? "{}");
  } catch {}
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
        }),
      )
      .mutation(async ({ input }) => {
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
          if (input.model?.startsWith("openrouter:")) return completeWithOpenRouter(input.model, simple, input.useWebSearch);
          if (input.model?.startsWith("anthropic:")) return completeWithAnthropic(input.model, simple);
          if (input.model?.startsWith("gateway:")) return completeWithGateway(input.model, simple);
          if ((process.env.OPENROUTER_API_KEY || process.env.MODEL_GATEWAY_API_KEY) && !input.model) return completeWithOpenRouter("", simple, input.useWebSearch);
          const response = await invokeLLM({ model: input.model, messages, maxTokens: 1200 });
          const content = response.choices[0]?.message?.content;
          return { content: typeof content === "string" ? content : JSON.stringify(content ?? ""), model: response.model, usage: response.usage ?? null };
        } catch (error) {
          throw new TRPCError({ code: "BAD_GATEWAY", message: errorForClient(error) });
        }
      }),
  }),
  attachments: router({
    upload: publicProcedure.input(z.object({ name: z.string().min(1).max(255), mimeType: z.string().max(160), base64: z.string().min(1), conversationId: z.number().int().positive().optional() })).mutation(async ({ input, ctx }) => {
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
    generate: publicProcedure.input(z.object({ prompt: z.string().min(3).max(4000), model: z.string().max(120).optional(), quality: z.enum(["medium", "high"]).optional() })).mutation(async ({ input }) => {
      try { return await generateImage(input); } catch (error) { throw new TRPCError({ code: "BAD_GATEWAY", message: errorForClient(error) }); }
    }),
  }),
  voice: router({
    transcribe: publicProcedure.input(z.object({ audioUrl: z.string().url(), language: z.string().max(12).optional(), prompt: z.string().max(500).optional() })).mutation(async ({ input }) => {
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
