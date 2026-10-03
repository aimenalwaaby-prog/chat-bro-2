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

/** Rotate through configured keys, then include provider-specific environment keys as last-resort fallbacks. */
export function getProviderKeyCandidates(provider: string, fallback?: string | readonly (string | undefined)[]) {
  const keys = configuredKeys()[provider] ?? [];
  const cursor = cursors.get(provider) ?? 0;
  if (keys.length) cursors.set(provider, cursor + 1);
  const offset = keys.length ? cursor % keys.length : 0;
  const rotated = [...keys.slice(offset), ...keys.slice(0, offset)];
  const directKeys = (typeof fallback === "string" ? [fallback] : fallback ?? [])
    .filter((key): key is string => typeof key === "string" && key.length > 0);
  return [...new Set([...rotated, ...directKeys])];
}

export function resetProviderPoolForTests() {
  cursors.clear();
}
