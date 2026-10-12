import { describe, expect, it } from "vitest";
import { featuredModelRepositories, modelSourceKinds, normalizeModelSource } from "../shared/model-sources";

describe("model source templates", () => {
  it("supports a fixed list of known platforms", () => {
    expect(modelSourceKinds.length).toBeGreaterThan(10);
    expect(modelSourceKinds).toContain("gitlab");
    expect(modelSourceKinds).toContain("civitai");
    expect(modelSourceKinds).toContain("nvidia-ngc");
  });

  it("keeps the official 30-source catalog with HTTPS URLs", () => {
    expect(featuredModelRepositories).toHaveLength(30);
    expect(featuredModelRepositories.every((item) => item.url.startsWith("https://"))).toBe(true);
    expect(new Set(featuredModelRepositories.map((item) => item.id)).size).toBe(30);
  });

  it("normalizes GitHub owner/repository", () => {
    expect(normalizeModelSource("github", "openai/whisper").url).toBe("https://github.com/openai/whisper");
  });

  it("normalizes hosted model registries", () => {
    expect(normalizeModelSource("huggingface", "Qwen/Qwen2.5-7B-Instruct").modelId).toBe("Qwen/Qwen2.5-7B-Instruct");
    expect(normalizeModelSource("ollama", "qwen2.5:7b").install).toBe("ollama pull qwen2.5:7b");
    expect(normalizeModelSource("civitai", "12345").url).toBe("https://civitai.com/models/12345");
  });

  it("rejects insecure custom endpoints", () => {
    expect(() => normalizeModelSource("openai-compatible", "http://localhost:8000/v1")).toThrow();
  });
});
