/**
 * Image generation helper using internal ImageService
 *
 * Example usage:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "A serene landscape with mountains"
 *   });
 *
 * For editing:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "Add a rainbow to this landscape",
 *     originalImages: [{
 *       url: "https://example.com/original.jpg",
 *       mimeType: "image/jpeg"
 *     }]
 *   });
 */
import { storagePut } from "../storage";
import { ENV } from "./env";

// Default model for generated sites. "MODEL_GPT_IMAGE_2" is the forge images.v1
// enum for GPT Image 2 (id: gpt-image-2). If omitted, forge falls back to Gemini 2.5 Flash.
const DEFAULT_IMAGE_MODEL = "MODEL_GPT_IMAGE_2";
const DEFAULT_IMAGE_QUALITY = "medium";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
  /** Forge image model enum, e.g. "MODEL_GPT_IMAGE_2". Defaults to GPT Image 2. */
  model?: string;
  /** Generation quality, e.g. "medium" | "high". Defaults to "medium" for GPT Image 2. */
  quality?: string;
};

export type GenerateImageResponse = {
  url?: string;
};

export async function generateImage(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  if (!ENV.forgeApiKey && process.env.OPENROUTER_API_KEY) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://chatbro.app",
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "Chat Bro",
      },
      body: JSON.stringify({
        model: options.model ?? process.env.OPENROUTER_IMAGE_MODEL ?? "google/gemini-2.5-flash-image",
        modalities: ["text", "image"],
        messages: [{ role: "user", content: options.prompt }],
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`OpenRouter image request failed (${response.status} ${response.statusText})${detail ? `: ${detail.slice(0, 500)}` : ""}`);
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }>; content?: string | Array<{ type?: string; image_url?: { url?: string } }> } }>;
    };
    const message = payload.choices?.[0]?.message;
    const content = Array.isArray(message?.content) ? message.content : [];
    const imageUrl = message?.images?.[0]?.image_url?.url ?? content.find((part) => part.type === "image_url")?.image_url?.url;
    if (!imageUrl) throw new Error("OpenRouter لم يُرجع صورة لهذا النموذج. اختر نموذجًا يدعم إخراج الصور.");
    if (/^https?:\/\//.test(imageUrl)) return { url: imageUrl };
    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("صيغة الصورة الناتجة من OpenRouter غير مدعومة.");
    const stored = await storagePut(`generated/${Date.now()}.png`, Buffer.from(match[2], "base64"), match[1]);
    const publicBase = (process.env.PUBLIC_API_BASE_URL ?? "https://chatbro-api.onrender.com").replace(/\/$/, "");
    return { url: `${publicBase}${stored.url}` };
  }
  if (!ENV.forgeApiUrl) {
    throw new Error("BUILT_IN_FORGE_API_URL is not configured");
  }
  if (!ENV.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }

  // Build the full URL by appending the service path to the base URL
  const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL("images.v1.ImageService/GenerateImage", baseUrl).toString();

  const model = options.model ?? DEFAULT_IMAGE_MODEL;
  const quality = options.quality ?? (model === DEFAULT_IMAGE_MODEL ? DEFAULT_IMAGE_QUALITY : undefined);

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify({
      prompt: options.prompt,
      original_images: options.originalImages || [],
      model,
      ...(quality ? { quality } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Image generation request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`,
    );
  }

  const result = (await response.json()) as {
    image: {
      b64Json: string;
      mimeType: string;
    };
  };
  const base64Data = result.image.b64Json;
  const buffer = Buffer.from(base64Data, "base64");

  // Save to S3
  const stored = await storagePut(`generated/${Date.now()}.png`, buffer, result.image.mimeType);
  const publicBase = (process.env.PUBLIC_API_BASE_URL ?? "https://chatbro-api.onrender.com").replace(/\/$/, "");
  return {
    url: `${publicBase}${stored.url}`,
  };
}

export type ImageModelInfo = {
  /** Forge model enum, e.g. "MODEL_GPT_IMAGE_2". Pass into generateImage({ model }). */
  model?: string;
  /** Stable model id, e.g. "gpt-image-2". */
  id?: string;
};

export type ListImageModelsResponse = {
  models: ImageModelInfo[];
};

/**
 * List the image models the internal ImageService currently supports.
 * Feed a returned `model` value into generateImage({ model }).
 */
export async function listImageModels(): Promise<ListImageModelsResponse> {
  if (!ENV.forgeApiUrl) {
    throw new Error("BUILT_IN_FORGE_API_URL is not configured");
  }
  if (!ENV.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }

  const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL("images.v1.ImageService/ListModels", baseUrl).toString();

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: "{}",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `List image models failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`,
    );
  }

  const result = (await response.json()) as { models?: ImageModelInfo[] };
  return { models: result.models ?? [] };
}
