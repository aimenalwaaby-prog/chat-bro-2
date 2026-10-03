import { describe, expect, it } from "vitest";
import { getDeviceTier, getEffectiveRamGb, getLocalRuntimeTuning, normalizePhysicalRamGb } from "../shared/device-performance";

describe("device-aware local runtime", () => {
  it("uses a conservative profile when physical RAM is unavailable", () => {
    expect(normalizePhysicalRamGb(null)).toBe(2);
    expect(normalizePhysicalRamGb(Number.NaN)).toBe(2);
    expect(getDeviceTier(null)).toBe("low");
    expect(getLocalRuntimeTuning(null).nPredict).toBeLessThanOrEqual(96);
  });

  it("caps CPU/context work on entry-level devices", () => {
    const low = getLocalRuntimeTuning(2.5);
    const mid = getLocalRuntimeTuning(4);
    expect(low.nCtx).toBe(512);
    expect(low.nThreads).toBe(2);
    expect(low.nBatch).toBeLessThan(mid.nBatch);
    expect(low.nPredict).toBeLessThan(mid.nPredict);
    expect(low.cacheType).toBe("q8_0");
  });

  it("scales context and output gradually for medium and high RAM devices", () => {
    const medium = getLocalRuntimeTuning(6.5);
    const high = getLocalRuntimeTuning(12);
    expect(medium.nCtx).toBe(1024);
    expect(high.nCtx).toBeGreaterThan(medium.nCtx);
    expect(high.nPredict).toBeGreaterThan(medium.nPredict);
    expect(getDeviceTier(6.5)).toBe("balanced");
    expect(getDeviceTier(12)).toBe("high");
  });

  it("limits older device-year classes even when advertised RAM is high", () => {
    expect(getEffectiveRamGb(12, 2017)).toBe(3.5);
    expect(getEffectiveRamGb(12, 2019)).toBe(6);
    expect(getLocalRuntimeTuning(12, 2017).nCtx).toBe(768);
  });
});
