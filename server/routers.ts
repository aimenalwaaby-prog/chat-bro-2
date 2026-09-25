import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM, type Message } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";

type SimpleMessage = { role: string; content: string };
const ollamaBase = () =>
  (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
const llamaBase = () =>
  (process.env.LLAMA_CPP_BASE_URL ?? "http://127.0.0.1:8080").replace(
    /\/$/,
    "",
  );
async function completeWithOllama(model: string, messages: SimpleMessage[]) {
  const response = await fetch(`${ollamaBase()}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: model.replace(/^ollama:/, ""),
      messages,
      stream: false,
      options: { num_predict: 1200, temperature: 0.35, repeat_penalty: 1.18 },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok)
    throw new Error(`Ollama request failed: ${response.status}`);
  const payload = (await response.json()) as {
    message?: { content?: string };
    model?: string;
  };
  return {
    content: payload.message?.content ?? "تعذر قراءة رد النموذج المحلي.",
    model: payload.model ?? model,
    usage: null,
  };
}
async function completeWithLlamaCpp(model: string, messages: SimpleMessage[]) {
  const response = await fetch(`${llamaBase()}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: model.replace(/^llama:/, ""),
      messages,
      max_tokens: 1200,
      temperature: 0.35,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok)
    throw new Error(`llama.cpp request failed: ${response.status}`);
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
  };
  return {
    content:
      payload.choices?.[0]?.message?.content ?? "تعذر قراءة رد llama.cpp.",
    model: payload.model ?? model,
    usage: null,
  };
}
async function pullOllamaModel(model: string) {
  const response = await fetch(`${ollamaBase()}/api/pull`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: model.replace(/^ollama:/, ""),
      stream: false,
    }),
    signal: AbortSignal.timeout(20 * 60_000),
  });
  if (!response.ok)
    throw new Error(`Ollama download failed: ${response.status}`);
  return { success: true as const, model };
}
async function listOllamaModels() {
  const response = await fetch(`${ollamaBase()}/api/tags`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Ollama tags failed: ${response.status}`);
  const payload = (await response.json()) as {
    models?: Array<{
      name: string;
      size?: number;
      digest?: string;
      modified_at?: string;
    }>;
  };
  return { available: true as const, models: payload.models ?? [] };
}

async function completeWithOpenRouter(model: string, messages: SimpleMessage[]) {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.MODEL_GATEWAY_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://chatbro.app",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "Chat Bro",
    },
    body: JSON.stringify({
      model: model.replace(/^openrouter:/, ""),
      messages,
      max_tokens: 1200,
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
          content:
            typeof message.content === "string"
              ? message.content
              : JSON.stringify(message.content),
        }));
        if (input.model?.startsWith("ollama:"))
          return completeWithOllama(input.model, simple);
        if (input.model?.startsWith("llama:"))
          return completeWithLlamaCpp(input.model, simple);
        if (input.model?.startsWith("openrouter:"))
          return completeWithOpenRouter(input.model, simple);
        if (input.model?.startsWith("gateway:"))
          return completeWithGateway(input.model, simple);
        const response = await invokeLLM({
          model: input.model,
          messages,
          maxTokens: 1200,
        });
        const content = response.choices[0]?.message?.content;
        return {
          content:
            typeof content === "string" ? content : "تعذر قراءة رد النموذج.",
          model: response.model,
          usage: response.usage ?? null,
        };
      }),
  }),
  models: router({
    localStatus: publicProcedure.query(() =>
      listOllamaModels().catch(() => ({
        available: false as const,
        models: [],
      })),
    ),
    llamaStatus: publicProcedure.query(async () => {
      try {
        const response = await fetch(`${llamaBase()}/v1/models`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return { available: false as const, models: [] };
        const payload = (await response.json()) as {
          data?: Array<{ id: string }>;
        };
        return { available: true as const, models: payload.data ?? [] };
      } catch {
        return { available: false as const, models: [] };
      }
    }),
    pull: publicProcedure
      .input(z.object({ model: z.string().startsWith("ollama:") }))
      .mutation(({ input }) => pullOllamaModel(input.model)),
  }),
});
export type AppRouter = typeof appRouter;
