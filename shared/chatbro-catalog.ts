export type ModelTone = "full" | "limited" | "trial" | "paid";
export type ModelRuntime = "ollama" | "llama.cpp" | "cloud" | "gateway";
export type ChatBroModel = {
  name: string;
  modelId: string;
  provider: string;
  icon: string;
  tone: ModelTone;
  status: string;
  limit: string;
  category: string;
  requiresKey: boolean;
  localOnly: boolean;
  runtime?: ModelRuntime;
  sourceUrl?: string;
  installCommand?: string;
  supportsVision?: boolean;
  verified?: boolean;
  providerKey?: "chatbro" | "builtIn" | "openrouter" | "anthropic" | "gemini" | "groq" | "cloudflare" | "gateway" | "mistral" | "huggingface" | "deepinfra" | "nvidia" | "replicate" | "fal" | "local";
  inputModalities?: string[];
  outputModalities?: string[];
  types?: string[];
};

const cloud = (
  name: string,
  id: string,
  provider: string,
  category: string,
  icon: string,
  tone: ModelTone = "limited",
  supportsVision = false,
): ChatBroModel => ({
  name,
  modelId: id,
  provider,
  icon,
  tone,
  status: "متاح عبر الخادم",
  limit: "حسب إعداد الخادم",
  category,
  requiresKey: false,
  localOnly: false,
  runtime: "cloud",
  supportsVision,
  verified: true,
  providerKey: "chatbro",
  inputModalities: ["text"],
  outputModalities: ["text"],
  types: ["محادثة"],
});
// Provider model IDs are loaded from live, authenticated catalogs; keep only the default route static.
export const chatBroModels: ChatBroModel[] = [
  cloud(
    "المساعد العام",
    "",
    "Chat Bro · خادم مدمج",
    "محادثة",
    "auto-awesome",
    "full",
  ),
  ...[
    ["Gemini 2.5 Flash · قريبًا", "planned:gemini-2.5-flash", "Google Gemini", "auto-awesome"],
    ["Claude Sonnet · قريبًا", "planned:anthropic-claude-sonnet", "Anthropic", "auto-awesome"],
    ["Llama 3.3 · قريبًا", "planned:groq-llama-3.3", "Groq", "speed"],
    ["Llama 3.1 · قريبًا", "planned:cloudflare-llama-3.1", "Cloudflare Workers AI", "cloud"],
    ["Qwen Coder · قريبًا", "planned:gateway-qwen-coder", "بوابة خارجية", "hub"],
    ["GPT Image · قريبًا", "planned:image-gpt", "إنشاء الصور", "image"],
    ["Flux · قريبًا", "planned:image-flux", "إنشاء الصور", "image"],
    ["Stable Diffusion · قريبًا", "planned:image-stable-diffusion", "إنشاء الصور", "image"],
  ].map(([name, modelId, provider, icon]) => ({
    name, modelId, provider, icon, tone: "trial" as const, status: "قريبًا", limit: "يتطلب تفعيل مفتاح المزود", category: provider === "إنشاء الصور" ? "إنشاء الصور" : "محادثة", requiresKey: true, localOnly: false, runtime: "gateway" as const, providerKey: provider === "Google Gemini" ? "gemini" as const : provider === "Anthropic" ? "anthropic" as const : provider === "Groq" ? "groq" as const : provider === "Cloudflare Workers AI" ? "cloudflare" as const : "gateway" as const, inputModalities: ["text"], outputModalities: provider === "إنشاء الصور" ? ["image"] : ["text"], types: provider === "إنشاء الصور" ? ["إنشاء الصور"] : ["محادثة"], verified: false,
  })),
];

export function filterModels(
  models: ChatBroModel[],
  category: string,
  query: string,
) {
  const normalized = query.trim().toLocaleLowerCase();
  return models.filter((model) => {
    const inCategory = category === "الكل" || getModelTypeTags(model).includes(category);
    const searchable =
      `${model.name} ${model.provider} ${model.category} ${model.modelId}`.toLocaleLowerCase();
    return inCategory && (!normalized || searchable.includes(normalized));
  });
}

export function getModelTypeTags(model: ChatBroModel) {
  const tags = new Set(model.types ?? []);
  const input = model.inputModalities ?? [];
  const output = model.outputModalities ?? [];
  if (output.includes("text") || output.length === 0) tags.add("محادثة");
  if (input.includes("image")) tags.add("فهم الصور");
  if (output.includes("image")) tags.add("إنشاء الصور");
  if (input.includes("audio") || output.includes("audio")) tags.add("صوت");
  if (input.includes("video") || output.includes("video")) tags.add("فيديو");
  if (/code|coder|program/i.test(`${model.name} ${model.modelId}`)) tags.add("برمجة");
  return [...tags];
}

export function getModelByName(name?: string) {
  return chatBroModels.find((model) => model.name === name);
}

export function isLocalModelId(modelId?: string) {
  return Boolean(modelId && /^(ollama|llama):/.test(modelId));
}

export function isPlannedModel(modelId?: string) {
  return Boolean(modelId?.startsWith("planned:"));
}

export function isModelAvailableToSelect(
  model: ChatBroModel,
  capabilities?: Record<string, boolean> | null,
) {
  if (isPlannedModel(model.modelId)) return true;
  if (model.localOnly || isLocalModelId(model.modelId) || !capabilities) return false;
  if (model.modelId.startsWith("openrouter:")) return Boolean(capabilities.openrouter);
  if (model.modelId.startsWith("anthropic:")) return Boolean(capabilities.anthropic);
  if (model.modelId.startsWith("gateway:")) return Boolean(capabilities.gateway);
  if (model.modelId.startsWith("builtin:")) return Boolean(capabilities.builtInLLM);
  if (model.runtime === "gateway") return Boolean(capabilities.gateway);
  if (!model.modelId) return Boolean(capabilities.builtInLLM || capabilities.openrouter);
  return Boolean(capabilities.builtInLLM);
}

export function modelSupportsVision(name?: string) {
  return Boolean(getModelByName(name)?.supportsVision);
}

export function modelSupportsFiles(name?: string) {
  return Boolean(name);
}

export const catalogSourceNote =
  "النماذج السحابية تُحمّل من كتالوج المزود المهيأ؛ النماذج المحلية تُنزّل وتُتحقق من ملفات GGUF ثم تعمل على الجهاز عبر llama.cpp.";
