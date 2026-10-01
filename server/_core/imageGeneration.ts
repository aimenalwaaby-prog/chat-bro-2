/**
 * Server-side image generation through the configured Forge ImageService or
 * OpenRouter. The mobile app sends only a prompt and optional public model ID;
 * provider credentials remain server-side.
 */
import { storagePut } from "../storage";

const DEFAULT_IMAGE_MODEL = "MODEL_GPT_IMAGE_2";
const DEFAULT_IMAGE_QUALITY = "medium";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
  /** OpenRouter IDs use the `openrouter:` prefix; Forge IDs are its ImageService enum. */
  model?: string;
  quality?: string;
};

export type GenerateImageResponse = {
  url?: string;
};

export async function generateImage(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  const pollinationsKey = process.env.POLLINATIONS_API_KEY;
  const selectedPollinationsModel = options.model?.startsWith("pollinations:") ? options.model.slice("pollinations:".length) : undefined;
  if (selectedPollinationsModel || (!process.env.OPENROUTER_API_KEY && pollinationsKey && !process.env.BUILT_IN_FORGE_API_KEY)) {
    if (!pollinationsKey) throw new Error("POLLINATIONS_API_KEY غير مهيأ على الخادم.");
    const model = selectedPollinationsModel || process.env.POLLINATIONS_IMAGE_MODEL || "flux";
    const url = new URL(`https://gen.pollinations.ai/image/${encodeURIComponent(options.prompt)}`);
    url.searchParams.set("model", model);
    url.searchParams.set("nologo", "true");
    const response = await fetch(url, { headers: { authorization: `Bearer ${pollinationsKey}` }, signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Pollinations image request failed: ${response.status}`);
    const mimeType = response.headers.get("content-type") || "image/png";
    const stored = await storagePut(`generated/${Date.now()}.png`, Buffer.from(await response.arrayBuffer()), mimeType);
    const publicBase = (process.env.PUBLIC_API_BASE_URL ?? "https://chatbro-api.onrender.com").replace(/\/$/, "");
    return { url: `${publicBase}${stored.url}` };
  }
  const forgeApiKey = process.env.BUILT_IN_FORGE_API_KEY;
  const forgeApiUrl = process.env.BUILT_IN_FORGE_API_URL;
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  const forgeImagesConfigured = Boolean(forgeApiKey && forgeApiUrl);
  const selectedOpenRouterModel = options.model?.startsWith("openrouter:")
    ? options.model.slice("openrouter:".length)
    : undefined;

  if (selectedOpenRouterModel || !forgeImagesConfigured) {
    if (options.model && !selectedOpenRouterModel && !forgeImagesConfigured) {
      throw new Error("The selected image model requires the configured Forge image service.");
    }
    if (!openRouterApiKey) {
      throw new Error("Image generation requires a configured Forge image service or OPENROUTER_API_KEY.");
    }
    const selectedModel = selectedOpenRouterModel ?? process.env.OPENROUTER_IMAGE_MODEL ?? "openai/gpt-5-image";
    const response = await fetch("https://openrouter.ai/api/v1/images", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${openRouterApiKey}`,
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://chatbro.app",
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "Chat Bro",
      },
      body: JSON.stringify({
        model: selectedModel,
        prompt: options.prompt,
        ...(options.originalImages?.length ? { input_references: options.originalImages.map((item) => item.url ?? (item.b64Json ? `data:${item.mimeType ?? "image/png"};base64,${item.b64Json}` : "")).filter(Boolean) } : {}),
        ...(options.quality ? { quality: options.quality } : {}),
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`OpenRouter image request failed (${response.status} ${response.statusText})${detail ? `: ${detail.slice(0, 500)}` : ""}`);
    }
    const payload = (await response.json()) as { data?: Array<{ b64_json?: string; url?: string; media_type?: string }> };
    const image = payload.data?.[0];
    if (image?.url) return { url: image.url };
    if (!image?.b64_json) throw new Error("OpenRouter لم يُرجع بيانات الصورة.");
    const mimeType = image.media_type ?? "image/png";
    const stored = await storagePut(`generated/${Date.now()}.png`, Buffer.from(image.b64_json, "base64"), mimeType);
    const publicBase = (process.env.PUBLIC_API_BASE_URL ?? "https://chatbro-api.onrender.com").replace(/\/$/, "");
    return { url: `${publicBase}${stored.url}` };
  }

  if (!forgeApiUrl || !forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY and BUILT_IN_FORGE_API_URL are required for Forge image generation.");
  }
  const baseUrl = forgeApiUrl.endsWith("/") ? forgeApiUrl : `${forgeApiUrl}/`;
  const fullUrl = new URL("images.v1.ImageService/GenerateImage", baseUrl).toString();
  const model = options.model ?? DEFAULT_IMAGE_MODEL;
  const quality = options.quality ?? (model === DEFAULT_IMAGE_MODEL ? DEFAULT_IMAGE_QUALITY : undefined);
  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${forgeApiKey}`,
    },
    body: JSON.stringify({ prompt: options.prompt, original_images: options.originalImages || [], model, ...(quality ? { quality } : {}) }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Image generation request failed (${response.status} ${response.statusText})${detail ? `: ${detail.slice(0, 500)}` : ""}`);
  }
  const result = (await response.json()) as { image: { b64Json: string; mimeType: string } };
  const stored = await storagePut(`generated/${Date.now()}.png`, Buffer.from(result.image.b64Json, "base64"), result.image.mimeType);
  const publicBase = (process.env.PUBLIC_API_BASE_URL ?? "https://chatbro-api.onrender.com").replace(/\/$/, "");
  return { url: `${publicBase}${stored.url}` };
}

export type ImageModelInfo = {
  /** Forge model enum, e.g. "MODEL_GPT_IMAGE_2". */
  model?: string;
  /** Stable model ID, e.g. "gpt-image-2". */
  id?: string;
  provider?: string;
  pricing?: { prompt?: string; completion?: string; image?: string };
  access?: "مجاني" | "مدفوع" | "غير محدد" | "حسب الخادم";
  dailyLimit?: string;
};

export type ListImageModelsResponse = {
  models: ImageModelInfo[];
};

export async function listImageModels(): Promise<ListImageModelsResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (apiKey) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/images/models", {
        headers: { authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(20_000),
      });
      if (response.ok) {
        const payload = (await response.json()) as { data?: Array<{ id?: string; name?: string; pricing?: { prompt?: string; completion?: string; image?: string } }> };
        return { models: (payload.data ?? []).filter((m) => m.id).map((m) => {
          const pricing = m.pricing;
          const free = pricing && [pricing.prompt, pricing.completion, pricing.image].some((value) => value === "0");
          return { id: m.id, model: m.id, provider: "OpenRouter", pricing, access: free ? "مجاني" as const : pricing ? "مدفوع" as const : "غير محدد" as const, dailyLimit: free ? "حسب الحصة المجانية للمزود" : "حسب رصيد ومعدل المزود" };
        }) };
      }
      const catalogResponse = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(20_000),
      });
      if (catalogResponse.ok) {
        const payload = (await catalogResponse.json()) as { data?: Array<{ id?: string; name?: string; architecture?: { output_modalities?: string[] }; pricing?: { prompt?: string; completion?: string; image?: string } }> };
        return { models: (payload.data ?? []).filter((m) => m.id && m.architecture?.output_modalities?.includes("image")).map((m) => {
          const pricing = m.pricing;
          const free = pricing && [pricing.prompt, pricing.completion, pricing.image].some((value) => value === "0");
          return { id: m.id, model: m.id, provider: "OpenRouter", pricing, access: free ? "مجاني" as const : pricing ? "مدفوع" as const : "غير محدد" as const, dailyLimit: free ? "حسب الحصة المجانية للمزود" : "حسب رصيد ومعدل المزود" };
        }) };
      }
    } catch {}
  }
  const forgeApiKey = process.env.BUILT_IN_FORGE_API_KEY;
  const forgeApiUrl = process.env.BUILT_IN_FORGE_API_URL;
  if (!apiKey && (!forgeApiUrl || !forgeApiKey)) throw new Error("No image provider is configured.");
  if (forgeApiUrl && forgeApiKey) {
    const baseUrl = forgeApiUrl.endsWith("/") ? forgeApiUrl : `${forgeApiUrl}/`;
    const fullUrl = new URL("images.v1.ImageService/ListModels", baseUrl).toString();
    const response = await fetch(fullUrl, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "connect-protocol-version": "1", authorization: `Bearer ${forgeApiKey}` },
      body: "{}",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Forge image model listing failed: ${response.status}`);
    const payload = (await response.json()) as { models?: ImageModelInfo[] };
    return { models: (payload.models ?? []).map((model) => ({ ...model, provider: model.provider ?? "Forge", access: model.access ?? "حسب الخادم", dailyLimit: model.dailyLimit ?? "حسب إعداد الخادم" })) };
  }
  return { models: [] };
}
