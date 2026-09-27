export type LlmProviderConfig = {
  provider: "openai" | "forge";
  baseUrl: string;
  apiKey: string;
};

type LlmEnvironment = {
  OPENAI_API_KEY?: string;
  OPENAI_API_BASE?: string;
  BUILT_IN_FORGE_API_KEY?: string;
  BUILT_IN_FORGE_API_URL?: string;
};

const normalizeBaseUrl = (value: string) =>
  value.trim().replace(/\/+$/, "").replace(/\/v1$/i, "");

/**
 * Resolve LLM credentials on the server only. A direct OpenAI key always uses
 * the OpenAI-compatible base URL and never inherits BUILT_IN_FORGE_API_URL.
 */
export function resolveLlmProvider(
  env: LlmEnvironment = process.env as LlmEnvironment,
): LlmProviderConfig | null {
  const openAiKey = env.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    return {
      provider: "openai",
      baseUrl: normalizeBaseUrl(
        env.OPENAI_API_BASE?.trim() || "https://api.openai.com",
      ),
      apiKey: openAiKey,
    };
  }

  const forgeKey = env.BUILT_IN_FORGE_API_KEY?.trim();
  if (forgeKey) {
    return {
      provider: "forge",
      baseUrl: normalizeBaseUrl(
        env.BUILT_IN_FORGE_API_URL?.trim() || "https://forge.manus.ai",
      ),
      apiKey: forgeKey,
    };
  }

  return null;
}
