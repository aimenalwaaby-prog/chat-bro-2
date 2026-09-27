import { describe, expect, it } from "vitest";
import { resolveLlmProvider } from "../server/_core/llmConfig";

describe("LLM provider resolution", () => {
  it("routes a direct OpenAI key to OpenAI even when Forge is configured", () => {
    const provider = resolveLlmProvider({
      OPENAI_API_KEY: "openai-test-key",
      OPENAI_API_BASE: "https://api.openai.com/v1/",
      BUILT_IN_FORGE_API_KEY: "forge-test-key",
      BUILT_IN_FORGE_API_URL: "https://forge.manus.ai",
    });

    expect(provider).toEqual({
      provider: "openai",
      baseUrl: "https://api.openai.com",
      apiKey: "openai-test-key",
    });
  });

  it("uses a custom OpenAI-compatible API base when explicitly configured", () => {
    const provider = resolveLlmProvider({
      OPENAI_API_KEY: "openai-test-key",
      OPENAI_API_BASE: "https://llm.example.test/custom/v1",
    });

    expect(provider).toEqual({
      provider: "openai",
      baseUrl: "https://llm.example.test/custom",
      apiKey: "openai-test-key",
    });
  });

  it("retains Forge routing when only a Forge key is configured", () => {
    const provider = resolveLlmProvider({
      BUILT_IN_FORGE_API_KEY: "forge-test-key",
      BUILT_IN_FORGE_API_URL: "https://forge.manus.ai/",
      OPENAI_API_BASE: "https://api.openai.com/v1",
    });

    expect(provider).toEqual({
      provider: "forge",
      baseUrl: "https://forge.manus.ai",
      apiKey: "forge-test-key",
    });
  });

  it("returns no provider when no server-side key is configured", () => {
    expect(resolveLlmProvider({})).toBeNull();
  });
});
