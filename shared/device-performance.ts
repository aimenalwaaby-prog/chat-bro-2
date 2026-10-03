export type DeviceTier = "low" | "balanced" | "high";

export type LocalRuntimeTuning = {
  nCtx: number;
  nBatch: number;
  nUBatch: number;
  nThreads: number;
  nPredict: number;
  maxHistoryMessages: number;
  maxPromptCharacters: number;
  cacheType: "q8_0";
};

/** Prefer a conservative low-memory profile when Android cannot report physical RAM. */
export function normalizePhysicalRamGb(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 2;
  return Math.round(value * 10) / 10;
}

/** Older device-year classes are more likely to have slower CPUs and higher OS memory pressure. */
export function getEffectiveRamGb(totalRamGb: number | null | undefined, deviceYearClass?: number | null): number {
  const ram = normalizePhysicalRamGb(totalRamGb);
  if (typeof deviceYearClass === "number" && deviceYearClass > 0) {
    if (deviceYearClass <= 2017) return Math.min(ram, 3.5);
    if (deviceYearClass <= 2019) return Math.min(ram, 6);
  }
  return ram;
}

export function getDeviceTier(totalRamGb: number | null | undefined, deviceYearClass?: number | null): DeviceTier {
  const ram = getEffectiveRamGb(totalRamGb, deviceYearClass);
  if (ram < 4) return "low";
  if (ram < 8) return "balanced";
  return "high";
}

/**
 * Bounded CPU inference settings. Smaller batches, quantized KV cache, bounded context,
 * and less retained history reduce native-memory spikes on entry-level phones.
 */
export function getLocalRuntimeTuning(totalRamGb: number | null | undefined, deviceYearClass?: number | null): LocalRuntimeTuning {
  const ram = getEffectiveRamGb(totalRamGb, deviceYearClass);
  if (ram < 2) return { nCtx: 512, nBatch: 32, nUBatch: 32, nThreads: 2, nPredict: 64, maxHistoryMessages: 2, maxPromptCharacters: 320, cacheType: "q8_0" };
  if (ram < 3) return { nCtx: 512, nBatch: 48, nUBatch: 32, nThreads: 2, nPredict: 96, maxHistoryMessages: 4, maxPromptCharacters: 480, cacheType: "q8_0" };
  if (ram < 6) return { nCtx: 768, nBatch: 96, nUBatch: 48, nThreads: 3, nPredict: 160, maxHistoryMessages: 6, maxPromptCharacters: 900, cacheType: "q8_0" };
  if (ram < 10) return { nCtx: 1024, nBatch: 128, nUBatch: 64, nThreads: 4, nPredict: 256, maxHistoryMessages: 8, maxPromptCharacters: 1400, cacheType: "q8_0" };
  if (ram < 12) return { nCtx: 1536, nBatch: 160, nUBatch: 64, nThreads: 4, nPredict: 320, maxHistoryMessages: 10, maxPromptCharacters: 2200, cacheType: "q8_0" };
  return { nCtx: 2048, nBatch: 192, nUBatch: 64, nThreads: 6, nPredict: 512, maxHistoryMessages: 12, maxPromptCharacters: 3200, cacheType: "q8_0" };
}
