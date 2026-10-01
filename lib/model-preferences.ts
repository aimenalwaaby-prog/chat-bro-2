import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "chatbro:model-preferences:v1";

export type ModelShortcut = {
  id: string;
  name: string;
  provider: string;
  route: "chat" | "images" | "local";
};

export type ModelUsage = ModelShortcut & {
  count: number;
  lastUsedAt: number;
};

export type ModelPreferences = {
  favorites: ModelShortcut[];
  usage: ModelUsage[];
};

const EMPTY: ModelPreferences = { favorites: [], usage: [] };

function isShortcut(value: unknown): value is ModelShortcut {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ModelShortcut>;
  return typeof item.id === "string" && typeof item.name === "string" &&
    typeof item.provider === "string" &&
    (item.route === "chat" || item.route === "images" || item.route === "local");
}

export async function loadModelPreferences(): Promise<ModelPreferences> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<ModelPreferences>;
    const favorites = Array.isArray(parsed.favorites) ? parsed.favorites.filter(isShortcut).slice(0, 30) : [];
    const usage = Array.isArray(parsed.usage)
      ? parsed.usage.filter((item): item is ModelUsage => isShortcut(item) && typeof (item as ModelUsage).count === "number" && typeof (item as ModelUsage).lastUsedAt === "number").slice(0, 30)
      : [];
    return { favorites, usage };
  } catch {
    return EMPTY;
  }
}

async function saveModelPreferences(value: ModelPreferences) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  return value;
}

export async function toggleModelFavorite(model: ModelShortcut): Promise<ModelPreferences> {
  const current = await loadModelPreferences();
  const exists = current.favorites.some((item) => item.id === model.id);
  const favorites = exists
    ? current.favorites.filter((item) => item.id !== model.id)
    : [model, ...current.favorites].slice(0, 30);
  return saveModelPreferences({ ...current, favorites });
}

export async function recordModelUse(model: ModelShortcut): Promise<ModelPreferences> {
  const current = await loadModelPreferences();
  const existing = current.usage.find((item) => item.id === model.id);
  const usageItem: ModelUsage = {
    ...model,
    count: (existing?.count ?? 0) + 1,
    lastUsedAt: Date.now(),
  };
  const usage = [usageItem, ...current.usage.filter((item) => item.id !== model.id)]
    .sort((a, b) => b.count - a.count || b.lastUsedAt - a.lastUsedAt)
    .slice(0, 30);
  return saveModelPreferences({ ...current, usage });
}
