import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { BrandHeader, SectionHeading, StatusBadge } from "@/components/chatbro-ui";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { chatBroModels, filterModels, isPlannedModel, type ChatBroModel } from "@/shared/chatbro-catalog";

const filters = ["الكل", "محادثة", "صور", "صوت", "برمجة", "بحث"];

export default function ModelsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [active, setActive] = useState("الكل");
  const [query, setQuery] = useState("");
  const openRouterModels = trpc.models.openRouter.useQuery(undefined, { staleTime: 60_000, retry: 2 });
  const allModels = useMemo<ChatBroModel[]>(() => {
    const dynamic = (openRouterModels.data?.models ?? []).map((model): ChatBroModel => ({
      name: model.name,
      modelId: `openrouter:${model.id}`,
      provider: "OpenRouter · خارجي",
      icon: "hub",
      tone: model.prompt === "0" && model.completion === "0" ? "full" : "limited",
      status: model.prompt === "0" && model.completion === "0" ? "مجاني" : "متاح الآن",
      limit: model.contextLength ? `سياق ${model.contextLength.toLocaleString()} رمز` : "حسب المزود",
      category: "محادثة",
      requiresKey: true,
      localOnly: false,
      runtime: "gateway",
      supportsVision: /vision|vl|gemini|gpt-4o|qwen/i.test(model.id),
      verified: true,
      sourceUrl: "https://openrouter.ai/models",
    }));
    const existing = new Set(chatBroModels.map((model) => model.modelId));
    return [...chatBroModels.filter((model) => !model.localOnly), ...dynamic.filter((model) => !existing.has(model.modelId))];
  }, [openRouterModels.data]);
  const filtered = useMemo(() => filterModels(allModels, active, query), [active, allModels, query]);
  return (
    <ScreenContainer className="px-5 pt-4">
      <BrandHeader title="النماذج" eyebrow="MODEL REGISTRY" onPress={() => router.push("/(tabs)/settings")} />
      <Text className="mt-7 text-[25px] font-extrabold text-foreground text-right">اختر القوة المناسبة.</Text>
      <Text className="mt-2 text-[12px] leading-5 text-muted text-right">النماذج السحابية تُحدّث من OpenRouter مباشرة. النماذج المحلية تعمل داخل الهاتف عبر llama.cpp وبشكل منفصل.</Text>

      <View className="mt-5 flex-row-reverse items-center rounded-[18px] border bg-surface px-3" style={{ borderColor: colors.border }}><MaterialIcons name="search" size={20} color={colors.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="ابحث عن نموذج أو مزود..." placeholderTextColor={colors.muted} className="h-11 flex-1 px-3 text-[13px] text-foreground" style={{ textAlign: "right", writingDirection: "rtl" }} /></View>
      <FlatList data={filters} horizontal inverted showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 14 }} keyExtractor={(item) => item} renderItem={({ item }) => <Pressable onPress={() => setActive(item)} style={({ pressed }) => [{ backgroundColor: active === item ? colors.primary : colors.surface, borderColor: active === item ? colors.primary : colors.border }, pressed && { opacity: 0.72 }]} className="rounded-full border px-4 py-2"><Text className={active === item ? "text-[11px] font-bold text-[#062034]" : "text-[11px] font-semibold text-muted"}>{item}</Text></Pressable>} />

      <View className="mb-3 flex-row-reverse items-center justify-between"><StatusBadge label={`${allModels.length} نموذجًا`} tone="full" /><Text className="text-[11px] text-muted">{openRouterModels.isFetching ? "تحديث الكتالوج…" : openRouterModels.data?.available ? "OpenRouter مباشر" : "الكتالوج السحابي غير متاح"}</Text></View>
      <FlatList data={filtered} keyExtractor={(item) => item.modelId} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 32 }} renderItem={({ item }) => { const plannedModel = isPlannedModel(item.modelId); const directModel = item.modelId.startsWith("openrouter:") ? item.modelId : undefined; return <Pressable disabled={plannedModel} onPress={() => router.push({ pathname: "/(tabs)/chat", params: { model: item.name, ...(directModel ? { directModel } : {}) } })} style={({ pressed }) => [{ backgroundColor: colors.surface, borderColor: colors.border, opacity: plannedModel ? 0.7 : 1 }, pressed && { opacity: 0.75 }]} className="flex-row-reverse items-center rounded-[21px] border p-3.5"><View className="h-11 w-11 items-center justify-center rounded-[15px] bg-[#E6F8FD]"><MaterialIcons name={item.icon as never} size={21} color={plannedModel ? colors.muted : "#0787B4"} /></View><View className="mr-3 flex-1"><View className="flex-row-reverse items-center justify-between"><Text className="text-[13px] font-bold text-foreground">{item.name}</Text><StatusBadge label={item.status} tone={item.tone} /></View><Text className="mt-1 text-[11px] text-muted text-right">{item.provider} · {item.category}</Text><Text className="mt-1 text-[10px] text-muted text-right">{item.limit}</Text></View>{plannedModel ? <MaterialIcons name="schedule" size={20} color={colors.muted} /> : <MaterialIcons name="chevron-left" size={20} color={colors.muted} />}</Pressable>; }} ListEmptyComponent={<View className="items-center py-10"><SectionHeading title="لم نجد هذا النموذج" /><Text className="text-[12px] text-muted">جرّب كلمة بحث مختلفة.</Text></View>} />
    </ScreenContainer>
  );
}
