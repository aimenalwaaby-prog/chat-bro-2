import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { BrandHeader, SectionHeading, StatusBadge } from "@/components/chatbro-ui";
import { useColors } from "@/hooks/use-colors";
import { checkServerConnection } from "@/lib/_core/api";
import { loadModelPreferences, toggleModelFavorite } from "@/lib/model-preferences";
import { trpc } from "@/lib/trpc";
import { chatBroModels, filterModels, getModelTypeTags, isModelAvailableToSelect, type ChatBroModel } from "@/shared/chatbro-catalog";

const typeFilters = ["الكل", "محادثة", "فهم الصور", "إنشاء الصور", "صوت", "فيديو", "برمجة", "بحث ويب"];
const providers: { key: NonNullable<ChatBroModel["providerKey"]>; label: string }[] = [
  { key: "chatbro", label: "Chat Bro" },
  { key: "builtIn", label: "الخادم المدمج" },
  { key: "openrouter", label: "OpenRouter" },
  { key: "anthropic", label: "Anthropic" },
  { key: "gemini", label: "Google Gemini" },
  { key: "groq", label: "Groq" },
  { key: "cloudflare", label: "Cloudflare AI" },
  { key: "mistral", label: "Mistral" },
  { key: "huggingface", label: "Hugging Face" },
  { key: "deepinfra", label: "DeepInfra" },
  { key: "nvidia", label: "NVIDIA NIM" },
  { key: "replicate", label: "Replicate" },
  { key: "fal", label: "fal.ai" },
  { key: "gateway", label: "البوابات" },
  { key: "local", label: "محلي" },
];

export default function ModelsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [activeType, setActiveType] = useState("الكل");
  const [activeProvider, setActiveProvider] = useState("all");
  const [query, setQuery] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [serverCapabilities, setServerCapabilities] = useState<Record<string, boolean> | null>(null);
  const openRouterModels = trpc.models.openRouter.useQuery(undefined, { enabled: serverCapabilities?.openrouter === true, staleTime: 60_000, retry: 1 });
  const builtInModels = trpc.models.builtIn.useQuery(undefined, { enabled: Boolean(serverCapabilities?.builtInLLM), staleTime: 60_000, retry: 1 });
  const anthropicModels = trpc.models.anthropic.useQuery(undefined, { enabled: Boolean(serverCapabilities?.anthropic), staleTime: 60_000, retry: 1 });
  const geminiModels = trpc.models.gemini.useQuery(undefined, { enabled: Boolean(serverCapabilities?.gemini), staleTime: 60_000, retry: 1 });
  const groqModels = trpc.models.groq.useQuery(undefined, { enabled: Boolean(serverCapabilities?.groq), staleTime: 60_000, retry: 1 });
  const cloudflareModels = trpc.models.cloudflare.useQuery(undefined, { enabled: Boolean(serverCapabilities?.cloudflare), staleTime: 60_000, retry: 1 });
  const gatewayModels = trpc.models.gateways.useQuery(undefined, { enabled: Boolean(serverCapabilities?.gateway), staleTime: 60_000, retry: 1 });

  useEffect(() => {
    let active = true;
    void checkServerConnection().then((result) => active && setServerCapabilities(result.capabilities ?? {}));
    void loadModelPreferences().then((saved) => active && setFavoriteIds(new Set(saved.favorites.map((item) => item.id))));
    return () => { active = false; };
  }, []);

  const allModels = useMemo<ChatBroModel[]>(() => {
    const searchTag = serverCapabilities?.openrouter ? ["بحث ويب"] : [];
    const openRouter = (openRouterModels.data?.models ?? []).map((model): ChatBroModel => {
      const candidate: ChatBroModel = {
        name: model.name,
        modelId: `openrouter:${model.id}`,
        provider: "OpenRouter · خارجي",
        providerKey: "openrouter",
        icon: "hub",
        tone: model.prompt === "0" && model.completion === "0" ? "full" : "limited",
        status: model.prompt === "0" && model.completion === "0" ? "مجاني" : "متاح من OpenRouter",
        limit: model.contextLength ? `سياق ${model.contextLength.toLocaleString()} رمز` : "حسب المزود",
        category: "محادثة",
        requiresKey: true,
        localOnly: false,
        runtime: "gateway",
        inputModalities: model.inputModalities ?? [],
        outputModalities: model.outputModalities ?? ["text"],
        supportsVision: model.inputModalities?.includes("image"),
        verified: true,
        sourceUrl: "https://openrouter.ai/models",
      };
      return { ...candidate, types: [...new Set([...getModelTypeTags(candidate), ...searchTag])] };
    });
    const builtIn = (builtInModels.data?.models ?? []).map((model): ChatBroModel => ({
      name: model.name,
      modelId: `builtin:${model.id}`,
      provider: `الخادم المدمج · ${model.provider}`,
      providerKey: "builtIn",
      icon: "auto-awesome",
      tone: "limited",
      status: "متاح من الخادم",
      limit: "حسب إعداد المزود",
      category: "محادثة",
      requiresKey: false,
      localOnly: false,
      runtime: "cloud",
      inputModalities: ["text"],
      outputModalities: ["text"],
      types: ["محادثة", ...searchTag, ...(/code|coder|program/i.test(model.id) ? ["برمجة"] : [])],
      verified: true,
    }));
    const anthropic = (anthropicModels.data?.models ?? []).map((model): ChatBroModel => ({
      name: `${model.name} · Anthropic`,
      modelId: `anthropic:${model.id}`,
      provider: "Anthropic · مباشر",
      providerKey: "anthropic",
      icon: "auto-awesome",
      tone: "limited",
      status: "متاح من Anthropic",
      limit: model.contextLength ? `سياق ${model.contextLength.toLocaleString()} رمز` : "حسب حساب Anthropic",
      category: "محادثة",
      requiresKey: true,
      localOnly: false,
      runtime: "gateway",
      inputModalities: model.supportsVision ? ["text", "image"] : ["text"],
      outputModalities: ["text"],
      supportsVision: model.supportsVision,
      types: ["محادثة", ...(model.supportsVision ? ["فهم الصور"] : []), ...searchTag],
      verified: true,
    }));
    const gemini = (geminiModels.data?.models ?? []).map((model): ChatBroModel => ({
      name: `${model.name} · Gemini`, modelId: `gemini:${model.id}`, provider: "Google Gemini · مباشر", providerKey: "gemini", icon: "auto-awesome",
      tone: "limited", status: "متاح من Gemini", limit: model.contextLength ? `سياق ${model.contextLength.toLocaleString()} رمز` : "حسب حساب Google", category: "محادثة",
      requiresKey: true, localOnly: false, runtime: "cloud", inputModalities: model.supportsVision ? ["text", "image"] : ["text"], outputModalities: ["text"], supportsVision: model.supportsVision, verified: true,
      types: ["محادثة", ...(model.supportsVision ? ["فهم الصور"] : []), ...searchTag],
    }));
    const groq = (groqModels.data?.models ?? []).map((model): ChatBroModel => ({
      name: `${model.name} · Groq`, modelId: `groq:${model.id}`, provider: "Groq · مباشر", providerKey: "groq", icon: "speed",
      tone: "limited", status: "متاح من Groq", limit: model.contextLength ? `سياق ${model.contextLength.toLocaleString()} رمز` : "حسب حساب Groq", category: "محادثة",
      requiresKey: true, localOnly: false, runtime: "cloud", inputModalities: ["text"], outputModalities: ["text"], verified: true, types: ["محادثة", "برمجة", ...searchTag],
    }));
    const cloudflare = (cloudflareModels.data?.models ?? []).map((model): ChatBroModel => ({
      name: `${model.name} · Cloudflare`, modelId: `cloudflare:${model.id}`, provider: "Cloudflare Workers AI", providerKey: "cloudflare", icon: "cloud",
      tone: "limited", status: "متاح من Cloudflare", limit: "حسب حساب Cloudflare", category: "محادثة", requiresKey: true, localOnly: false, runtime: "cloud",
      inputModalities: ["text"], outputModalities: ["text"], verified: true, types: ["محادثة", "برمجة", ...searchTag],
    }));
    const gatewayProviderKey = (provider: string): NonNullable<ChatBroModel["providerKey"]> => {
      const normalized = provider.toLowerCase();
      if (normalized.includes("mistral")) return "mistral";
      if (normalized.includes("hugging")) return "huggingface";
      if (normalized.includes("deepinfra")) return "deepinfra";
      if (normalized.includes("nvidia")) return "nvidia";
      if (normalized.includes("replicate")) return "replicate";
      if (normalized.includes("fal")) return "fal";
      return "gateway";
    };
    const gateways = (gatewayModels.data?.models ?? []).map((model): ChatBroModel => {
      const candidate: ChatBroModel = {
        name: `${model.name} · ${model.provider}`,
        modelId: model.id,
        provider: `بوابة · ${model.provider}`,
        providerKey: gatewayProviderKey(model.provider),
        icon: "hub",
        tone: "limited",
        status: "متاح من البوابة",
        limit: model.contextLength ? `سياق ${model.contextLength.toLocaleString()} رمز` : "حسب البوابة",
        category: "محادثة",
        requiresKey: true,
        localOnly: false,
        runtime: "gateway",
        inputModalities: model.inputModalities ?? ["text"],
        outputModalities: model.outputModalities ?? ["text"],
        supportsVision: model.inputModalities?.includes("image"),
        verified: true,
      };
      return { ...candidate, types: [...new Set([...getModelTypeTags(candidate), ...searchTag])] };
    });
    const configuredStatic = chatBroModels
      .filter((model) => isModelAvailableToSelect(model, serverCapabilities))
      .map((model) => ({ ...model, types: [...new Set([...(model.types ?? []), ...searchTag])] }));
    const liveModels = [...builtIn, ...anthropic, ...gemini, ...groq, ...cloudflare, ...gateways, ...openRouter];
    const existing = new Set(configuredStatic.map((model) => model.modelId));
    return [...configuredStatic, ...liveModels.filter((model) => !existing.has(model.modelId))];
  }, [anthropicModels.data, builtInModels.data, cloudflareModels.data, geminiModels.data, gatewayModels.data, groqModels.data, openRouterModels.data, serverCapabilities]);

  const filtered = useMemo(() => filterModels(allModels, activeType, query)
    .filter((model) => activeProvider === "all" || model.providerKey === activeProvider),
  [activeProvider, activeType, allModels, query]);
  const providerCounts = useMemo(() => new Set(allModels.map((model) => model.providerKey).filter(Boolean)), [allModels]);

  const toggleFavorite = async (model: ChatBroModel) => {
    const route = model.outputModalities?.includes("text") || !model.outputModalities?.length ? "chat" : "images";
    const next = await toggleModelFavorite({ id: model.modelId, name: model.name, provider: model.provider, route });
    setFavoriteIds(new Set(next.favorites.map((item) => item.id)));
  };

  const openModel = (model: ChatBroModel) => {
    if (model.modelId.startsWith("planned:")) return;
    const imageOnly = activeType === "إنشاء الصور" && model.outputModalities?.includes("image");
    const noTextOutput = Boolean(model.outputModalities?.length && !model.outputModalities.includes("text"));
    if (imageOnly || noTextOutput) {
      router.push({ pathname: "/(tabs)/images", params: { model: model.modelId } });
      return;
    }
    router.push({ pathname: "/(tabs)/chat", params: { model: model.name, directModel: model.modelId } });
  };

  return (
    <ScreenContainer className="px-5 pt-4">
      <BrandHeader title="النماذج" eyebrow="MODEL REGISTRY" onPress={() => router.push("/(tabs)/settings")} />
      <Text className="mt-7 text-right text-[25px] font-extrabold text-foreground">اختر القوة المناسبة.</Text>
      <Text className="mt-2 text-right text-[12px] leading-5 text-muted">صنّف الكتالوج حسب نوع الإدخال والإخراج أو مزود الخدمة. لا تظهر قدرة إلا إذا أبلغ عنها المزود؛ أداة إنشاء الصور تعمل من أي محادثة عند تهيئة مزود صور.</Text>

      <View className="mt-5 flex-row-reverse items-center rounded-[18px] border bg-surface px-3" style={{ borderColor: colors.border }}>
        <MaterialIcons name="search" size={20} color={colors.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="ابحث عن نموذج أو مزود..." placeholderTextColor={colors.muted} className="h-11 flex-1 px-3 text-[13px] text-foreground" style={{ textAlign: "right", writingDirection: "rtl" }} />
      </View>

      <Text className="mt-4 text-right text-[10px] font-bold text-muted">التصنيف حسب النوع</Text>
      <FlatList data={typeFilters} horizontal inverted showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 10 }} keyExtractor={(item) => item} renderItem={({ item }) => (
        <Pressable onPress={() => setActiveType(item)} style={({ pressed }) => [{ backgroundColor: activeType === item ? colors.primary : colors.surface, borderColor: activeType === item ? colors.primary : colors.border }, pressed && { opacity: 0.72 }]} className="rounded-full border px-4 py-2">
          <Text className={activeType === item ? "text-[10px] font-bold text-[#062034]" : "text-[10px] font-semibold text-muted"}>{item}</Text>
        </Pressable>
      )} />

      <Text className="mt-1 text-right text-[10px] font-bold text-muted">المزوّد</Text>
      <FlatList data={[{ key: "all", label: "الكل" }, ...providers.filter((provider) => providerCounts.has(provider.key))]} horizontal inverted showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 9, paddingBottom: 14 }} keyExtractor={(item) => item.key} renderItem={({ item }) => (
        <Pressable onPress={() => setActiveProvider(item.key)} style={({ pressed }) => [{ backgroundColor: activeProvider === item.key ? "#DDF8FF" : colors.surface, borderColor: activeProvider === item.key ? "#76DDF3" : colors.border }, pressed && { opacity: 0.72 }]} className="rounded-full border px-3.5 py-2">
          <Text className="text-[10px] font-semibold text-foreground">{item.label}</Text>
        </Pressable>
      )} />

      <View className="mb-3 flex-row-reverse items-center justify-between">
        <StatusBadge label={`${filtered.length} نموذجًا`} tone="full" />
        <Text className="text-right text-[10px] text-muted">{openRouterModels.isFetching || builtInModels.isFetching || anthropicModels.isFetching || geminiModels.isFetching || groqModels.isFetching || cloudflareModels.isFetching || gatewayModels.isFetching ? "تحديث الكتالوج…" : allModels.length ? "بيانات مباشرة من جميع المزودين المهيئين" : "لا يوجد مزود سحابي مهيأ"}</Text>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.modelId || "default"}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 9, paddingBottom: 32 }}
        renderItem={({ item }) => {
          const tags = getModelTypeTags(item).slice(0, 4);
          const favorite = favoriteIds.has(item.modelId);
          return (
            <View className="flex-row-reverse items-center rounded-[20px] border p-3" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <Pressable disabled={item.modelId.startsWith("planned:")} onPress={() => openModel(item)} className="min-h-[78px] flex-1 flex-row-reverse items-center" style={{ opacity: item.modelId.startsWith("planned:") ? 0.68 : 1 }}>
                <View className="h-11 w-11 items-center justify-center rounded-[15px] bg-[#E6F8FD]"><MaterialIcons name={item.icon as never} size={21} color="#0787B4" /></View>
                <View className="mr-3 flex-1">
                  <View className="flex-row-reverse items-center justify-between gap-2"><Text numberOfLines={1} className="flex-1 text-right text-[12px] font-bold text-foreground">{item.name}</Text><StatusBadge label={item.status} tone={item.tone} /></View>
                  <Text numberOfLines={1} className="mt-1 text-right text-[10px] text-muted">{item.provider} · {item.limit}</Text>
                  <View className="mt-1.5 flex-row-reverse flex-wrap gap-1">
                    {tags.map((tag) => <View key={`${item.modelId}-${tag}`} className="rounded-full bg-[#E8F5F9] px-2 py-1"><Text className="text-[9px] font-semibold text-[#27687B]">{tag}</Text></View>)}
                    {item.inputModalities?.includes("image") ? <Text className="self-center text-[9px] text-muted">إدخال صور</Text> : null}
                    {item.outputModalities?.includes("image") ? <Text className="self-center text-[9px] text-muted">إخراج صور</Text> : null}
                  </View>
                </View>
                <MaterialIcons name={activeType === "إنشاء الصور" || (item.outputModalities?.length && !item.outputModalities.includes("text")) ? "image" : "chevron-left"} size={19} color={colors.muted} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={favorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة"} onPress={() => void toggleFavorite(item)} className="ml-1 h-10 w-10 items-center justify-center rounded-xl">
                <MaterialIcons name={favorite ? "star" : "star-outline"} size={21} color={favorite ? "#E1A526" : colors.muted} />
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={<View className="items-center py-10"><SectionHeading title="لم نجد نماذج مطابقة" /><Text className="text-[12px] text-muted">جرّب نوعًا أو مزودًا آخر أو امسح البحث.</Text></View>}
      />
    </ScreenContainer>
  );
}
