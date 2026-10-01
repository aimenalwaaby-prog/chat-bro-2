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
const MINIMUM_COMPLETE_FILE_RATIO = 0.98;

// These are genuine GGUF files fetched from Hugging Face and loaded by llama.cpp on Android.
export const LOCAL_MODELS: LocalModelDefinition[] = [
  {
    id: "qwen3-0.6b-q4km",
    name: "Qwen3 0.6B · Q4_K_M",
    fileName: "Qwen3-0.6B-Q4_K_M.gguf",
    url: "https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_K_M.gguf?download=true",
    sizeBytes: 396_705_472,
    paramsB: 0.6,
    quant: "Q4_K_M",
    description: "أفضل نقطة بداية للأجهزة ذات الذاكرة المحدودة.",
    recommendedMaxRamGb: 8,
    minRamGb: 2,
  },
  {
    id: "smollm2-135m-q4km",
    name: "SmolLM2 135M · Q4_K_M",
    fileName: "SmolLM2-135M.Q4_K_M.gguf",
    url: "https://huggingface.co/QuantFactory/SmolLM2-135M-GGUF/resolve/main/SmolLM2-135M.Q4_K_M.gguf?download=true",
    sizeBytes: 105_453_536,
    paramsB: 0.135,
    quant: "Q4_K_M",
    description: "الأخف والأسرع؛ تدريبه إنجليزي غالبًا وقد تكون إجاباته العربية أضعف.",
    recommendedMaxRamGb: 4,
    minRamGb: 1,
  },
  {
    id: "qwen3-1.7b-q4km",
    name: "Qwen3 1.7B · Q4_K_M",
    fileName: "Qwen3-1.7B-Q4_K_M.gguf",
    url: "https://huggingface.co/ggml-org/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf?download=true",
    sizeBytes: 1_282_439_264,
    paramsB: 1.7,
    quant: "Q4_K_M",
    description: "أقوى، لكنه ثقيل نسبيًا على هاتف بذاكرة 4GB.",
    recommendedMaxRamGb: 12,
    minRamGb: 4,
  },
  {
    id: "gemma3-1b-q4km",
    name: "Gemma 3 1B · Q4_K_M",
    fileName: "google_gemma-3-1b-it-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/google_gemma-3-1b-it-GGUF/resolve/main/google_gemma-3-1b-it-Q4_K_M.gguf?download=true",
    sizeBytes: 0,
    paramsB: 1.0,
    quant: "Q4_K_M",
    description: "نموذج خفيف نسبيًا ومناسب للتجارب المحلية على أجهزة Android.",
    recommendedMaxRamGb: 8,
    minRamGb: 3,
  },
  {
    id: "llama32-1b-q4km",
    name: "Llama 3.2 1B Instruct · Q4_K_M",
    fileName: "Llama-3.2-1B-Instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf?download=true",
    sizeBytes: 0,
    paramsB: 1.0,
    quant: "Q4_K_M",
    description: "خيار صغير للمحادثة المحلية مع استهلاك أقل من النماذج الأكبر.",
    recommendedMaxRamGb: 8,
    minRamGb: 3,
  },
  {
    id: "phi35-mini-q4km",
    name: "Phi-3.5 Mini Instruct · Q4_K_M",
    fileName: "Phi-3.5-mini-instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf?download=true",
    sizeBytes: 0,
    paramsB: 3.8,
    quant: "Q4_K_M",
    description: "أقوى محليًا لكنه ثقيل؛ يفضّل للأجهزة ذات الذاكرة الأعلى.",
    recommendedMaxRamGb: 12,
    minRamGb: 6,
  },
  {
    id: "qwen3-4b-q4km",
    name: "Qwen3 4B · Q4_K_M",
    fileName: "Qwen3-4B-Q4_K_M.gguf",
    url: "https://huggingface.co/unsloth/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf?download=true",
    sizeBytes: 0,
    paramsB: 4.0,
    quant: "Q4_K_M",
    description: "نسخة أقوى للمحادثة والبرمجة؛ تحتاج ذاكرة كبيرة ويفضل 8GB فأكثر.",
    recommendedMaxRamGb: 16,
    minRamGb: 6,
  },
  {
    id: "qwen25-1.5b-q4km",
    name: "Qwen2.5 1.5B Instruct · Q4_K_M",
    fileName: "qwen2.5-1.5b-instruct-q4_k_m.gguf",
    url: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf?download=true",
    sizeBytes: 1_117_320_736,
    paramsB: 1.5,
    quant: "Q4_K_M",
    description: "خيار متوسط جيد للمحادثة، لكنه يحتاج ذاكرة إضافية أثناء التشغيل.",
    recommendedMaxRamGb: 12,
    minRamGb: 4,
  },
];

let contexts = new Map<string, any>();

async function getLlamaModule() {
  if (Platform.OS !== "android") throw new Error("النماذج المحلية تعمل على Android فقط.");
  return import("llama.rn");
}

function asFileUri(path: string) {
  return path.startsWith("file://") ? path : `file://${path}`;
}

function isCompleteFile(size: number | undefined, expectedBytes: number) {
  return typeof size === "number" && size > 0 && (expectedBytes <= 0 || size >= Math.floor(expectedBytes * MINIMUM_COMPLETE_FILE_RATIO));
}

async function deleteModelFile(path: string) {
  await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined);
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
  if (Platform.OS !== "android" || !FileSystem.documentDirectory) return [];

  let stored: unknown;
  try {
    stored = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? "[]");
  } catch {
    await AsyncStorage.setItem(STORAGE_KEY, "[]");
    return [];
  }

  const candidates = Array.isArray(stored) ? stored : [];
  const valid: InstalledLocalModel[] = [];
  for (const item of candidates) {
    if (!item || typeof item !== "object" || typeof item.id !== "string") continue;
    const model = LOCAL_MODELS.find((known) => known.id === item.id);
    if (!model) continue;

    const path = `${modelDir}${model.fileName}`;
    try {
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists && isCompleteFile(info.size, model.sizeBytes)) {
        try {
          await inspectLocalModel(path);
          valid.push({
            ...model,
            path,
            downloadedAt: typeof item.downloadedAt === "string" ? item.downloadedAt : new Date().toISOString(),
          });
        } catch {
          await deleteModelFile(path);
        }
      } else if (info.exists) {
        await deleteModelFile(path);
      }
    } catch {
      // A damaged or inaccessible file is not treated as installed.
    }
  }

  if (JSON.stringify(valid) !== JSON.stringify(candidates)) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
  }
  return valid;
}

async function persist(model: InstalledLocalModel) {
  const current = await listInstalledLocalModels();
  const next = [...current.filter((item) => item.id !== model.id), model];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function downloadLocalModel(model: LocalModelDefinition, onProgress?: (percent: number) => void) {
  if (Platform.OS !== "android" || !FileSystem.documentDirectory) {
    throw new Error("تنزيل وتشغيل النماذج المحلية متاح في تطبيق Android فقط.");
  }

  const knownModel = LOCAL_MODELS.find((item) => item.id === model.id);
  if (!knownModel) throw new Error("هذا النموذج غير موجود في قائمة التنزيلات الموثوقة.");

  const compatibilityResult = compatibility(knownModel);
  if (compatibilityResult.level === "blocked") throw new Error(compatibilityResult.reason);

  await FileSystem.makeDirectoryAsync(modelDir, { intermediates: true });
  const path = `${modelDir}${knownModel.fileName}`;
  const existing = await FileSystem.getInfoAsync(path);
  if (existing.exists && isCompleteFile(existing.size, knownModel.sizeBytes)) {
    try {
      await inspectLocalModel(path);
      const installed = { ...knownModel, path, downloadedAt: new Date().toISOString() };
      await persist(installed);
      onProgress?.(100);
      return installed;
    } catch {
      await deleteModelFile(path);
    }
  } else if (existing.exists) {
    await deleteModelFile(path);
  }

  const task = FileSystem.createDownloadResumable(knownModel.url, path, {}, (progress) => {
    if (progress.totalBytesExpectedToWrite > 0) {
      const percent = Math.round((progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100);
      onProgress?.(Math.min(percent, 99));
    }
  });

  try {
    const result = await task.downloadAsync();
    if (!result) throw new Error("أُوقف تنزيل النموذج قبل اكتماله.");
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`تعذر تنزيل النموذج من المصدر (HTTP ${result.status}).`);
    }

    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists || !isCompleteFile(info.size, knownModel.sizeBytes)) {
      throw new Error("حجم الملف المستلم أقل من المتوقع؛ لم يُسجّل النموذج على أنه مثبت.");
    }

    // Native llama.cpp parses the GGUF metadata; an HTML page or corrupt partial file is rejected.
    await inspectLocalModel(path);

    const installed = { ...knownModel, path, downloadedAt: new Date().toISOString() };
    await persist(installed);
    onProgress?.(100);
    return installed;
  } catch (error) {
    await deleteModelFile(path);
    throw error instanceof Error ? error : new Error("فشل تنزيل النموذج أو التحقق من ملف GGUF.");
  }
}

export async function removeLocalModel(model: InstalledLocalModel) {
  contexts.get(model.id)?.release?.();
  contexts.delete(model.id);
  const definition = LOCAL_MODELS.find((item) => item.id === model.id);
  if (definition) await deleteModelFile(`${modelDir}${definition.fileName}`);
  const remaining = (await listInstalledLocalModels()).filter((item) => item.id !== model.id);
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
    model: asFileUri(model.path),
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
  return loadLlamaModelInfo(asFileUri(path));
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
