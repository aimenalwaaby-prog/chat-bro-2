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
});
const local = (
  name: string,
  modelId: string,
  category: string,
  icon = "smart-toy",
  supportsVision = false,
): ChatBroModel => ({
  name,
  modelId: `ollama:${modelId}`,
  provider: "Ollama · تشغيل محلي",
  icon,
  tone: "full",
  status: "بلا مفتاح",
  limit: "حسب جهازك",
  category,
  requiresKey: false,
  localOnly: true,
  runtime: "ollama",
  supportsVision,
  verified: true,
});

const gateway = (
  name: string,
  id: string,
  provider: string,
  category: string,
  icon = "hub",
  supportsVision = false,
): ChatBroModel => ({
  name,
  modelId: `openrouter:${id}`,
  provider,
  icon,
  tone: "full",
  status: "مجاني · يتطلب مفتاحًا",
  limit: "حسب حدود OpenRouter والنموذج",
  category,
  requiresKey: true,
  localOnly: false,
  runtime: "gateway",
  supportsVision,
  verified: true,
  sourceUrl: "https://openrouter.ai/collections/free-models",
});

const anthropic = (
  name: string,
  id: string,
  category: string,
  icon = "auto-awesome",
): ChatBroModel => ({
  name,
  modelId: `anthropic:${id}`,
  provider: "Anthropic · خادم Chat Bro",
  icon,
  tone: "paid",
  status: "يتطلب ANTHROPIC_API_KEY على الخادم",
  limit: "حسب حساب Anthropic",
  category,
  requiresKey: true,
  localOnly: false,
  runtime: "gateway",
  supportsVision: true,
  verified: true,
  sourceUrl: "https://docs.anthropic.com/en/docs/about-claude/models",
});

const planned = (name: string, provider: string, category: string, icon = "schedule"): ChatBroModel => ({
  name,
  modelId: `planned:${name}`,
  provider,
  icon,
  tone: "trial",
  status: "قريبًا",
  limit: "سيُفعّل بعد التحقق من المزود",
  category,
  requiresKey: false,
  localOnly: false,
  runtime: "cloud",
  verified: false,
});

// Cloud IDs are loaded from the live Manus model catalog (not guessed provider aliases).
export const chatBroModels: ChatBroModel[] = [
  cloud(
    "المساعد العام",
    "",
    "Chat Bro · خادم مدمج",
    "محادثة",
    "auto-awesome",
    "full",
  ),
  cloud(
    "GPT-5 Nano",
    "gpt-5-nano",
    "OpenAI · خادم مدمج",
    "محادثة",
    "auto-awesome",
    "trial",
  ),
  cloud(
    "GPT-5 Mini",
    "gpt-5-mini",
    "OpenAI · خادم مدمج",
    "محادثة",
    "auto-awesome",
  ),
  cloud("GPT-5", "gpt-5", "OpenAI · خادم مدمج", "برمجة", "code", "paid"),
  cloud("GPT-5.5", "gpt-5.5", "OpenAI · خادم مدمج", "برمجة", "code", "paid"),
  cloud(
    "Gemini 3 Flash",
    "gemini-3-flash-preview",
    "Google · خادم مدمج",
    "صور",
    "bolt",
    "limited",
    true,
  ),
  cloud(
    "Gemini 3.1 Pro",
    "gemini-3.1-pro-preview",
    "Google · خادم مدمج",
    "صور",
    "bolt",
    "paid",
    true,
  ),
  anthropic("Claude 3.7 Sonnet", "claude-3-7-sonnet-latest", "محادثة"),
  anthropic("Claude 3.5 Haiku", "claude-3-5-haiku-latest", "محادثة", "bolt"),
  anthropic("Claude 3 Opus", "claude-3-opus-latest", "برمجة", "code"),
  local("Qwen 3 · 0.6B", "qwen3:0.6b", "محادثة"),
  local("Qwen 3 · 4B", "qwen3:4b", "محادثة"),
  local("Qwen 3 · 8B", "qwen3:8b", "محادثة"),
  local("Qwen 3.5 · 9B", "qwen3.5:9b", "محادثة"),
  local("Gemma 3 · 4B", "gemma3:4b", "محادثة"),
  local("Gemma 3 · 12B", "gemma3:12b", "محادثة"),
  local("Llama 3.2 · 3B", "llama3.2:3b", "محادثة"),
  local("Llama 3.1 · 8B", "llama3.1:8b", "محادثة"),
  local("Mistral · 7B", "mistral:7b", "محادثة"),
  local("Phi-4", "phi4:14b", "محادثة"),
  local("DeepSeek R1 · 7B", "deepseek-r1:7b", "بحث", "psychology"),
  local("Qwen 3 Coder", "qwen3-coder:30b", "برمجة", "code"),
  local("Qwen Coder · 7B", "qwen2.5-coder:7b", "برمجة", "code"),
  local("Qwen Coder · 14B", "qwen2.5-coder:14b", "برمجة", "code"),
  local("DeepSeek Coder", "deepseek-coder-v2", "برمجة", "code"),
  local("Code Llama", "codellama:7b", "برمجة", "code"),
  local("Llava Vision", "llava:7b", "صور", "visibility", true),
  local("Qwen 2.5 VL", "qwen2.5vl:7b", "صور", "visibility", true),
  local("Moondream", "moondream:latest", "صور", "visibility", true),
  local("SmolLM2 · 135M", "smollm2:135m", "محادثة"),
  local("Qwen 2.5 · 3B", "qwen2.5:3b", "محادثة"),
  local("Llama 3.2 · 1B", "llama3.2:1b", "محادثة"),
  local("Granite 4 · 3B", "granite4:3b", "محادثة"),
  local("Nemotron Mini", "nemotron-mini:4b", "محادثة"),
  local("Aya Expanse", "aya-expanse:8b", "محادثة"),

  // استعادة نماذج OpenRouter المجانية التي كانت ضمن سجل Chat Bro السابق.
  // لا نحذف النماذج المحلية/السحابية الموجودة أعلاه. هذه النماذج تتطلب مفتاح OpenRouter على الخادم.
  gateway("Nemotron 3 Ultra", "nvidia/nemotron-3-ultra-550b-a55b:free", "NVIDIA · OpenRouter", "محادثة", "psychology"),
  gateway("Space Bunny Alpha", "stealth/space-bunny-alpha", "OpenRouter · Stealth", "محادثة", "auto-awesome"),
  gateway("Ling 3.0 Flash Fin", "inclusionai/ling-3.0-flash-fin:free", "InclusionAI · OpenRouter", "بحث", "psychology"),
  gateway("Laguna S 2.1", "poolside/laguna-s-2.1:free", "Poolside · OpenRouter", "برمجة", "code"),
  gateway("Dots3-Note Preview", "dots-studio/dots-3-note-preview:free", "Dots Studio · OpenRouter", "بحث", "psychology"),
  gateway("Nemotron 3.5 Lightning", "nvidia/nemotron-3.5-lightning:free", "NVIDIA · OpenRouter", "محادثة", "bolt"),
  gateway("Nex-N2.5-Pro", "nex-agi/nex-n2.5-pro:free", "Nex AGI · OpenRouter", "برمجة", "code"),
  gateway("Inkling", "thinking-machines/inkling:free", "Thinking Machines · OpenRouter", "محادثة", "psychology", true),
  gateway("Nemotron 3 Super", "nvidia/nemotron-3-super:free", "NVIDIA · OpenRouter", "محادثة", "psychology"),
  gateway("Ling 3.0 Flash Sante", "inclusionai/ling-3.0-flash-sante:free", "InclusionAI · OpenRouter", "بحث", "psychology"),
  gateway("Nex-N2.5-Mini", "nex-agi/nex-n2.5-mini:free", "Nex AGI · OpenRouter", "برمجة", "code"),
  gateway("Inkling Small", "thinking-machines/inkling-small:free", "Thinking Machines · OpenRouter", "محادثة", "psychology", true),
  gateway("North Mini Code", "cohere/north-mini-code:free", "Cohere · OpenRouter", "برمجة", "code"),
  gateway("Laguna XS 2.1", "poolside/laguna-xs-2.1:free", "Poolside · OpenRouter", "برمجة", "code"),
  gateway("Qwen 3.8 27B", "qwen/qwen3.8-27b:free", "Qwen · OpenRouter", "برمجة", "code", true),
  gateway("OpenRouter Free Router", "openrouter/free", "OpenRouter · Free Router", "محادثة", "shuffle"),
  // نماذج مستهدفة مستقبلًا: تظهر للمستخدم بوضوح ولا تُرسل طلبات قبل اعتماد معرفاتها ومفاتيحها.
  planned("Claude 4 Sonnet", "Anthropic", "محادثة", "auto-awesome"),
  planned("Claude 4 Opus", "Anthropic", "برمجة", "code"),
  planned("Gemini Pro Next", "Google", "محادثة", "bolt"),
  planned("Grok Next", "xAI", "محادثة", "psychology"),
  planned("Llama Next", "Meta", "محادثة", "hub"),
  planned("DeepSeek Next", "DeepSeek", "بحث", "psychology"),
  planned("Qwen Next", "Qwen", "برمجة", "code"),
  planned("Mistral Next", "Mistral AI", "محادثة", "auto-awesome"),
];

export function filterModels(
  models: ChatBroModel[],
  category: string,
  query: string,
) {
  const normalized = query.trim().toLocaleLowerCase();
  return models.filter((model) => {
    const inCategory = category === "الكل" || model.category === category;
    const searchable =
      `${model.name} ${model.provider} ${model.category} ${model.modelId}`.toLocaleLowerCase();
    return inCategory && (!normalized || searchable.includes(normalized));
  });
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

export function modelSupportsVision(name?: string) {
  return Boolean(getModelByName(name)?.supportsVision);
}

export function modelSupportsFiles(name?: string) {
  return Boolean(name);
}

export const catalogSourceNote =
  "النماذج السحابية الظاهرة هنا هي IDs متحققة من كتالوج الخادم؛ النماذج المحلية تُفحص من Ollama وقت التشغيل.";
