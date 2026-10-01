type ProviderKeyConfig = Record<string, string[]>;
const cursors = new Map<string, number>();

function configuredKeys(): ProviderKeyConfig {
  try {
    const parsed = JSON.parse(process.env.PROVIDER_API_KEYS_JSON ?? "{}");
    return Object.fromEntries(Object.entries(parsed).map(([provider, value]) => [provider, Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : []]));
  } catch {
    return {};
  }
}

export function getProviderKey(provider: string, fallback?: string) {
  const keys = configuredKeys()[provider] ?? (fallback ? [fallback] : []);
  if (!keys.length) return fallback;
  const cursor = cursors.get(provider) ?? 0;
  const key = keys[cursor % keys.length];
  cursors.set(provider, cursor + 1);
  return key;
}

export function resetProviderPoolForTests() {
  cursors.clear();
}
