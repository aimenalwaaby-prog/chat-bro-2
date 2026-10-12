import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { BrandHeader, SectionHeading } from "@/components/chatbro-ui";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { modelSourceKinds, type ModelSourceKind } from "@/shared/model-sources";

const labels: Record<ModelSourceKind, string> = {
  github: "GitHub", gitlab: "GitLab", bitbucket: "Bitbucket", huggingface: "Hugging Face",
  modelscope: "ModelScope", kaggle: "Kaggle", ollama: "Ollama", replicate: "Replicate",
  civitai: "Civitai", openrouter: "OpenRouter", together: "Together AI", groq: "Groq",
  "nvidia-ngc": "NVIDIA NGC", "docker-hub": "Docker Hub", "openai-compatible": "OpenAI-compatible",
};

export default function ModelLibraryScreen() {
  const colors = useColors();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ModelSourceKind | "all">("all");
  const library = trpc.catalog.library.useQuery(undefined, { retry: 0 });
  const remove = trpc.catalog.removeModel.useMutation({ onSuccess: () => void library.refetch() });
  const filtered = useMemo(() => (library.data ?? []).filter((model) =>
    (filter === "all" || model.source === filter) &&
    (!query.trim() || `${model.name} ${model.modelId} ${model.description ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))
  ), [filter, library.data, query]);

  const confirmRemove = (id: number, name: string) => Alert.alert("إزالة من المكتبة؟", `سيُزال ${name} من قائمة Chat Bro فقط؛ لن يتغير المصدر الخارجي.`, [
    { text: "إلغاء", style: "cancel" },
    { text: "إزالة", style: "destructive", onPress: () => remove.mutate({ id }) },
  ]);

  return <ScreenContainer className="px-5 pt-4">
    <ScrollView contentContainerStyle={{ paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
      <BrandHeader title="مكتبة النماذج" eyebrow="MY MODEL LIBRARY" onPress={() => router.push("/(tabs)/model-repositories")} />
      <Text className="mt-7 text-right text-[25px] font-extrabold text-foreground">نماذجك المحفوظة.</Text>
      <Text className="mt-2 text-right text-[12px] leading-5 text-muted">هذه مكتبتك المستقلة: احفظ فيها نماذج اكتشفتها من مستودعات مختلفة، وابحث فيها وافتح صفحة المصدر. الحفظ لا يعني تنزيل الأوزان أو أن النموذج جاهز للتشغيل؛ ستظهر تلك الحالات فقط بعد تنفيذها فعليًا.</Text>
      <View className="mt-5 flex-row-reverse items-center justify-between rounded-2xl border bg-surface p-3" style={{ borderColor: colors.border }}>
        <View className="flex-row-reverse items-center gap-2"><MaterialIcons name="inventory-2" size={19} color={colors.primary} /><Text className="text-right text-[12px] font-bold text-foreground">{library.data?.length ?? 0} محفوظ</Text></View>
        <Pressable onPress={() => router.push("/(tabs)/model-repositories")} className="rounded-xl bg-primary px-3 py-2"><Text className="text-[10px] font-bold text-[#062034]">استكشاف المستودعات</Text></Pressable>
      </View>
      <View className="mt-4 flex-row-reverse items-center rounded-2xl border bg-surface px-3" style={{ borderColor: colors.border }}>
        <MaterialIcons name="search" size={19} color={colors.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="ابحث بالاسم أو المعرّف أو الوصف" placeholderTextColor={colors.muted} className="h-11 flex-1 px-3 text-right text-[12px] text-foreground" style={{ writingDirection: "rtl" }} />
      </View>
      <SectionHeading title="المصدر" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse", gap: 8, paddingVertical: 8 }}>
        {[{ key: "all" as const, label: "الكل" }, ...modelSourceKinds.map((key) => ({ key, label: labels[key] }))].map((item) => <Pressable key={item.key} onPress={() => setFilter(item.key)} className="rounded-full border px-3 py-2" style={{ borderColor: filter === item.key ? colors.primary : colors.border, backgroundColor: filter === item.key ? "#DDF8FF" : colors.surface }}><Text className="text-[10px] font-semibold text-foreground">{item.label}</Text></Pressable>)}
      </ScrollView>
      <View className="mt-3 rounded-[22px] border bg-surface p-4" style={{ borderColor: colors.border }}>
        <SectionHeading title="عناصر المكتبة" action="تحديث" onAction={() => void library.refetch()} />
        {library.isLoading ? <Text className="py-5 text-center text-[11px] text-muted">جارٍ تحميل المكتبة…</Text> : null}
        {library.error ? <Text className="py-4 text-right text-[11px] leading-5 text-red-600">تعذر تحميل المكتبة: {library.error.message}</Text> : null}
        {remove.error ? <Text className="mb-2 text-right text-[10px] text-red-600">تعذرت الإزالة: {remove.error.message}</Text> : null}
        {!library.isLoading && !library.error && filtered.length === 0 ? <View className="items-center py-7"><MaterialIcons name="inventory-2" size={30} color={colors.muted} /><Text className="mt-2 text-[11px] font-semibold text-foreground">لا توجد نماذج مطابقة.</Text><Text className="mt-1 text-center text-[10px] leading-5 text-muted">اذهب إلى المستودعات، ابحث عن نماذج، ثم احفظ ما تحتاجه في هذه المكتبة.</Text></View> : null}
        {filtered.map((model) => <View key={model.id} className="mt-3 rounded-2xl border p-3" style={{ borderColor: colors.border }}>
          <View className="flex-row-reverse items-start gap-2"><MaterialIcons name="smart-toy" size={19} color={colors.primary} /><View className="flex-1"><Text className="text-right text-[12px] font-bold text-foreground">{model.name}</Text><Text className="mt-1 text-right text-[9px] text-muted">{labels[model.source as ModelSourceKind] ?? model.source} · {model.modelId}</Text>{model.description ? <Text numberOfLines={3} className="mt-2 text-right text-[10px] leading-4 text-muted">{model.description}</Text> : null}{model.task ? <Text className="mt-1 text-right text-[9px] text-muted">المهمة: {model.task}</Text> : null}{model.license ? <Text className="mt-1 text-right text-[9px] text-muted">الترخيص: {model.license}</Text> : null}{model.downloads !== null || model.likes !== null ? <Text className="mt-1 text-right text-[9px] text-muted">{model.downloads !== null ? `${model.downloads.toLocaleString()} تنزيل` : ""}{model.downloads !== null && model.likes !== null ? " · " : ""}{model.likes !== null ? `${model.likes.toLocaleString()} إعجاب` : ""}</Text> : null}<Text className="mt-2 text-right text-[9px] font-semibold text-amber-700">محفوظ في المكتبة · لم يُنزّل أو يُختبر للتشغيل</Text></View></View>
          <View className="mt-3 flex-row-reverse gap-2"><Pressable onPress={() => void Linking.openURL(model.url)} className="flex-1 flex-row-reverse items-center justify-center gap-1 rounded-xl border px-3 py-2" style={{ borderColor: colors.border }}><MaterialIcons name="open-in-new" size={14} color={colors.primary} /><Text className="text-[10px] font-bold text-primary">فتح صفحة المصدر</Text></Pressable><Pressable disabled={remove.isPending} onPress={() => confirmRemove(model.id, model.name)} className="flex-row-reverse items-center justify-center gap-1 rounded-xl border px-3 py-2" style={{ borderColor: "#F2D3D3", opacity: remove.isPending ? 0.5 : 1 }}><MaterialIcons name="delete-outline" size={15} color="#B42318" /><Text className="text-[10px] font-bold text-red-700">إزالة</Text></Pressable></View>
        </View>)}
      </View>
    </ScrollView>
  </ScreenContainer>;
}
