import { afterEach, describe, expect, it, vi } from "vitest";
import { listImageModels } from "../server/_core/imageGeneration";

describe("image model readiness", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("does not label a catalog entry as a tested, ready generator", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("IMAGE_SERVICE_URL", "");
    vi.stubEnv("IMAGE_SERVICE_TOKEN", "");
    vi.stubEnv("SERVICE_ROLE", "api");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: "test/provider-image", name: "Test Image Model" }],
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await listImageModels();
    expect(result.models).toHaveLength(1);
    expect(result.models[0]).toMatchObject({
      id: "test/provider-image",
      status: "متاح في الكتالوج — لم يُختبر",
      ready: false,
    });
  });
});
