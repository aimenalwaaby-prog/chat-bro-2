import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Device from "expo-device";
import { Platform } from "react-native";

export type LocalModelDefinition = {
  id: string;
  name: string;
  fileName: string;
  url: string;
  sizeBytes: number;
  paramsB: number;
  quant: string;
  description: string;
  recommendedMaxRamGb: number;
  minRamGb: number;
};

export type InstalledLocalModel = LocalModelDefinition & { path: string; downloadedAt: string };

const STORAGE_KEY = "chatbro:local-models:v2";
const modelDir = `${FileSystem.documentDirectory ?? ""}chatbro-models/`;

// Conservative defaults for phones. The app may allow a heavier model after a warning,
// but it never silently recommends a model that is likely to exhaust memory.
export const LOCAL_MODELS: LocalModelDefinition[] = [
  {
    id: "qwen3-0.6b-q4km",
    name: "Qwen3 0.6B · Q4_K_M",
    fileName: "Qwen3-0.6B-Q4_K_M.gguf",
    url: "https://huggingface.co/ggml-org/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_K_M.gguf?download=true",
    sizeBytes: 520_000_000,
    paramsB: 0.6,
    quant: "Q4_K_M",
    description: "أفضل نقطة بداية للأجهزة ذات الذاكرة المحدودة.",
    recommendedMaxRamGb: 8,
    minRamGb: 2,
  },
  {
    id: "smollm2-135m-q4km",
    name: "SmolLM2 135M · Q4_K_M",
    fileName: "SmolLM2-135M-Q4_K_M.gguf",
    url: "https://huggingface.co/tensorblock/SmolLM2-135M-GGUF/resolve/main/SmolLM2-135M-Q4_K_M.gguf?download=true",
    sizeBytes: 110_000_000,
    paramsB: 0.135,
    quant: "Q4_K_M",
    description: "الأخف والأسرع، لكن قدرته أقل من Qwen3.",
    recommendedMaxRamGb: 4,
    minRamGb: 1,
  },
  {
    id: "qwen3-1.7b-q4km",
    name: "Qwen3 1.7B · Q4_K_M",
    fileName: "Qwen3-1.7B-Q4_K_M.gguf",
    url: "https://huggingface.co/ggml-org/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf?download=true",
    sizeBytes: 1_280_000_000,
    paramsB: 1.7,
    quant: "Q4_K_M",
    description: "أقوى، لكنه ثقيل نسبيًا على هاتف بذاكرة 4GB.",
    recommendedMaxRamGb: 12,
    minRamGb: 4,
  },
  {
    id: "qwen25-1.5b-q4km",
    name: "Qwen2.5 1.5B Instruct · Q4_K_M",
    fileName: "qwen2.5-1.5b-instruct-q4_k_m.gguf",
    url: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf?download=true",
    sizeBytes: 1_120_000_000,
    paramsB: 1.5,
    quant: "Q4_K_M",
    description: "خيار متوسط جيد للمحادثة، لكنه يحتاج ذاكرة إضافية أثناء التشغيل.",
    recommendedMaxRamGb: 12,
    minRamGb: 4,
  },
];

let contexts = new Map<string, any>();

async function getLlamaModule() {
  if (Platform.OS === "web") throw new Error("النماذج المحلية تعمل على Android فقط.");
  return import("llama.rn");
}

export function getDeviceProfile() {
  const totalMemoryGb = Device.totalMemory ? Device.totalMemory / 1024 ** 3 : 4;
  const is64BitAndroid = true; // The shipped Android target is arm64; runtime performs final native compatibility checks.
  return {
    totalMemoryGb,
    is64BitAndroid,
    manufacturer: Device.manufacturer ?? "Unknown",
    modelName: Device.modelName ?? "Unknown",
  };
}

export function compatibility(model: LocalModelDefinition) {
  const ram = getDeviceProfile().totalMemoryGb;
  if (ram < model.minRamGb) return { level: "blocked" as const, label: "غير موصى به", reason: "ذاكرة الجهاز أقل من الحد الأدنى التقريبي لهذا النموذج." };
  if (ram > model.recommendedMaxRamGb) return { level: "recommended" as const, label: "مناسب", reason: "مناسب ضمن تقدير الذاكرة المتاح." };
  if (model.paramsB <= 0.7) return { level: "recommended" as const, label: "مناسب", reason: "حجم صغير ومناسب غالبًا للأجهزة محدودة الذاكرة." };
  return { level: "warning" as const, label: "ثقيل", reason: "قد يعمل ببطء أو يتوقف بسبب ضغط الذاكرة." };
}

export async function listInstalledLocalModels(): Promise<InstalledLocalModel[]> {
  const stored = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? "[]") as InstalledLocalModel[];
  const valid: InstalledLocalModel[] = [];
  for (const item of stored) {
    const info = await FileSystem.getInfoAsync(item.path);
    if (info.exists) valid.push(item);
  }
  if (valid.length !== stored.length) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
  return valid;
}

async function persist(model: InstalledLocalModel) {
  const current = await listInstalledLocalModels();
  const next = [...current.filter((m) => m.id !== model.id), model];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function downloadLocalModel(model: LocalModelDefinition, onProgress?: (percent: number) => void) {
  const compatibilityResult = compatibility(model);
  if (compatibilityResult.level === "blocked") throw new Error(compatibilityResult.reason);
  await FileSystem.makeDirectoryAsync(modelDir, { intermediates: true });
  const path = `${modelDir}${model.fileName}`;
  const existing = await FileSystem.getInfoAsync(path);
  if (existing.exists && (existing.size ?? 0) >= Math.floor(model.sizeBytes * 0.98)) {
    const installed = { ...model, path, downloadedAt: new Date().toISOString() };
    await persist(installed);
    return installed;
  }
  const task = FileSystem.createDownloadResumable(model.url, path, {}, (progress) => {
    if (progress.totalBytesExpectedToWrite > 0) onProgress?.(Math.round((progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100));
  });
  await task.downloadAsync();
  const installed = { ...model, path, downloadedAt: new Date().toISOString() };
  await persist(installed);
  return installed;
}

export async function removeLocalModel(model: InstalledLocalModel) {
  contexts.get(model.id)?.release?.();
  contexts.delete(model.id);
  await FileSystem.deleteAsync(model.path, { idempotent: true });
  const remaining = (await listInstalledLocalModels()).filter((m) => m.id !== model.id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
}

async function getContext(model: InstalledLocalModel) {
  for (const [id, ctx] of contexts) {
    if (id !== model.id) { ctx?.release?.(); contexts.delete(id); }
  }
  const existing = contexts.get(model.id);
  if (existing) return existing;
  const ram = getDeviceProfile().totalMemoryGb;
  const nCtx = ram <= 4 ? 1024 : ram <= 6 ? 1536 : 2048;
  const { initLlama } = await getLlamaModule();
  const context = await initLlama({
    model: `file://${model.path}`,
    use_mlock: false,
    n_ctx: nCtx,
    n_batch: 256,
    n_gpu_layers: 0,
  });
  contexts.set(model.id, context);
  return context;
}

export async function inspectLocalModel(path: string) {
  const { loadLlamaModelInfo } = await getLlamaModule();
  return loadLlamaModelInfo(`file://${path}`);
}

export async function completeLocal(model: InstalledLocalModel, messages: Array<{ role: "system" | "user" | "assistant"; content: string }>, onToken?: (token: string) => void) {
  const context = await getContext(model);
  const result = await context.completion(
    {
      messages,
      n_predict: getDeviceProfile().totalMemoryGb <= 4 ? 384 : 768,
      temperature: 0.35,
      top_p: 0.9,
    },
    (data: { token?: string }) => onToken?.(data.token ?? ""),
  );
  return result.text as string;
}
