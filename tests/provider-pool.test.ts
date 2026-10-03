import { afterEach, describe, expect, it } from "vitest";
import { getProviderKeyCandidates, resetProviderPoolForTests } from "../server/_core/provider-pool";

const originalPool = process.env.PROVIDER_API_KEYS_JSON;

afterEach(() => {
  resetProviderPoolForTests();
  if (originalPool === undefined) delete process.env.PROVIDER_API_KEYS_JSON;
  else process.env.PROVIDER_API_KEYS_JSON = originalPool;
});

describe("provider key candidates", () => {
  it("keeps the direct key as a fallback after configured rotation keys", () => {
    process.env.PROVIDER_API_KEYS_JSON = JSON.stringify({ gemini: ["pool-a", "pool-b"] });
    expect(getProviderKeyCandidates("gemini", "direct-current")).toEqual(["pool-a", "pool-b", "direct-current"]);
  });

  it("deduplicates the direct key when it is already in the pool", () => {
    process.env.PROVIDER_API_KEYS_JSON = JSON.stringify({ gemini: ["pool-a", "direct-current"] });
    expect(getProviderKeyCandidates("gemini", "direct-current")).toEqual(["pool-a", "direct-current"]);
  });

  it("uses a direct key when no rotation pool exists", () => {
    process.env.PROVIDER_API_KEYS_JSON = "{}";
    expect(getProviderKeyCandidates("gemini", "direct-current")).toEqual(["direct-current"]);
  });
});
