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

/** Rotate through configured keys, then include the provider-specific environment key as a last-resort fallback. */
export function getProviderKeyCandidates(provider: string, fallback?: string) {
  const keys = configuredKeys()[provider] ?? [];
  const cursor = cursors.get(provider) ?? 0;
  if (keys.length) cursors.set(provider, cursor + 1);
  const offset = keys.length ? cursor % keys.length : 0;
  const rotated = [...keys.slice(offset), ...keys.slice(0, offset)];
  if (fallback) rotated.push(fallback);
  return [...new Set(rotated.filter((key): key is string => typeof key === "string" && key.length > 0))];
}

export function resetProviderPoolForTests() {
  cursors.clear();
}
