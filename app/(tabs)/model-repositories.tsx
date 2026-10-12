import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { BrandHeader, SectionHeading } from "@/components/chatbro-ui";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { featuredModelRepositories, type ModelSourceKind } from "@/shared/model-sources";

const sources: { key: ModelSourceKind; label: string; placeholder: string }[] = [
  { key: "github", label: "GitHub", placeholder: "owner/repository" },
  { key: "gitlab", label: "GitLab", placeholder: "group/project" },
  { key: "bitbucket", label: "Bitbucket", placeholder: "workspace/repository" },
  { key: "huggingface", label: "Hugging Face", placeholder: "owner/model" },
  { key: "modelscope", label: "ModelScope", placeholder: "owner/model" },
  { key: "kaggle", label: "Kaggle Models", placeholder: "owner/model" },
  { key: "ollama", label: "Ollama", placeholder: "qwen2.5:7b" },
  { key: "replicate", label: "Replicate", placeholder: "owner/model" },
  { key: "civitai", label: "Civitai", placeholder: "رقم model" },
  { key: "openrouter", label: "OpenRouter", placeholder: "provider/model" },
  { key: "together", label: "Together AI", placeholder: "provider/model" },
  { key: "groq", label: "Groq", placeholder: "llama-3.3-70b-versatile" },
  { key: "nvidia-ngc", label: "NVIDIA NGC", placeholder: "model-name" },
  { key: "docker-hub", label: "Docker Hub", placeholder: "namespace/image" },
  { key: "openai-compatible", label: "OpenAI-compatible", placeholder: "https://host/v1" },
];

export default function ModelRepositoriesScreen() {
  const colors = useColors();
  const [source, setSource] = useState<ModelSourceKind>("github");
  const [reference, setReference] = useState("");
  const [query, setQuery] = useState("");
  const catalogSearch = trpc.catalog.searchSources.useQuery({ source, reference: reference || "ai-models", query: query || undefined }, { enabled: false, retry: 0 });
  const inspect = trpc.catalog.inspect.useQuery({ source, reference: reference || "ai-models" }, { enabled: false, retry: 0 });
  const saved = trpc.catalog.sources.useQuery(undefined, { retry: 0 });
  const add = trpc.catalog.addSource.useMutation({ onSuccess: () => { void saved.refetch(); Alert.alert("تمت الإضافة", "تم حفظ المصدر في قائمة المستودعات. يمكنك الآن مزامنته وتثبيت ما يدعمه."); } });
  const sync = trpc.catalog.sync.useMutation({ onSuccess: () => { void saved.refetch(); Alert.alert("تمت المزامنة", "تم تحديث ملفات المصدر وبياناته الوصفية."); } });
  const install = trpc.catalog.install.useMutation({ onSuccess: () => { void saved.refetch(); Alert.alert("اكتمل التثبيت", "أصبح المصدر مسجلاً كجاهز للتشغيل بالـ runtime المناسب."); } });
  const readFile = trpc.catalog.readFile.useMutation({ onSuccess: (result) => Alert.alert(`محتوى ${result.path}`, result.text.slice(0, 7000) + (result.text.length > 7000 ? "\n…" : "")) });
  const manifestPaths = (metadataJson: string | null) => {
    try { const parsed: { manifests?: { path?: unknown }[] } = JSON.parse(metadataJson ?? "{}"); const manifests = Array.isArray(parsed.manifests) ? parsed.manifests : []; return manifests.map((item) => item.path).filter((path: unknown): path is string => typeof path === "string").slice(0, 20); } catch { return [] as string[]; }
  };
  const addReference = (value: string) => { setReference(value); void inspect.refetch(); };
  const showInspection = () => {
    if (inspect.data) Alert.alert("نتيجة الفحص", `${inspect.data.normalized.label}\n\nالملفات: ${inspect.data.files.length}\nالملفات القابلة للقراءة: ${inspect.data.manifests.length}\nالتثبيت: ${inspect.data.capabilities.installModes.join(", ") || "غير متاح"}\nالتشغيل: ${inspect.data.capabilities.canRun ? "متاح" : "يحتاج runtime"}`);
  };
  return <ScreenContainer className="px-5 pt-4"><ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
    <BrandHeader title="مستودعات AI" eyebrow="REAL SOURCES" />
    <Text className="mt-6 text-right text-[23px] font-extrabold text-foreground">مصادر فعلية، لا روابط شكلية.</Text>
    <Text className="mt-2 text-right text-[11px] leading-5 text-muted">أضف المصدر ثم افحص ملفاته، اقرأ README وconfig وAPK والأرشيفات، مزامنه، وثبّت النموذج عندما يكون runtime مهيأً. روابط المستودعات محفوظة هنا بشكل مستقل عن مفاتيح API.</Text>
    <View className="mt-5 rounded-[22px] border bg-surface p-4" style={{ borderColor: colors.border }}><SectionHeading title="الكتالوج الرسمي — 30 مصدرًا" /><Text className="mt-1 text-right text-[10px] text-muted">هذه قائمة محددة وليست روابط عشوائية. كل بطاقة مرتبطة بعنوانها الرسمي وتصنيف التشغيل المدعوم.</Text>{featuredModelRepositories.map((item) => <View key={item.id} className="mt-3 rounded-2xl border p-3" style={{ borderColor: colors.border }}><View className="flex-row-reverse items-center"><MaterialIcons name={item.category === "speech" ? "record-voice-over" : item.category === "image" ? "image" : item.category === "video" ? "movie" : item.category === "runtime" ? "memory" : "hub"} size={18} color={colors.primary} /><View className="mr-2 flex-1"><Text className="text-right text-[11px] font-bold text-foreground">{item.name}</Text><Text className="mt-1 text-right text-[9px] text-muted">{item.category} · {item.supports.join(" · ")}</Text></View></View><View className="mt-2 flex-row-reverse gap-2"><Pressable onPress={() => void Linking.openURL(item.url)} className="flex-1 rounded-xl border px-2 py-2" style={{ borderColor: colors.border }}><Text className="text-center text-[9px] font-bold text-foreground">فتح الرسمي</Text></Pressable>{item.reference ? <Pressable onPress={() => { setSource(item.source); setReference(item.reference!); }} className="flex-1 rounded-xl bg-primary px-2 py-2"><Text className="text-center text-[9px] font-bold text-[#062034]">تحديد للفحص</Text></Pressable> : null}</View></View>)}</View>
    <View className="mt-5 rounded-[22px] border bg-surface p-4" style={{ borderColor: colors.border }}>
      <SectionHeading title="إضافة مستودع أو runtime" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>{sources.map((item) => <Pressable key={item.key} onPress={() => setSource(item.key)} className="rounded-full border px-3 py-2" style={{ borderColor: source === item.key ? colors.primary : colors.border, backgroundColor: source === item.key ? "#E6F8FD" : colors.surface }}><Text className="text-[10px] font-bold text-foreground">{item.label}</Text></Pressable>)}</ScrollView>
      <TextInput value={reference} onChangeText={setReference} placeholder={sources.find((item) => item.key === source)?.placeholder} placeholderTextColor={colors.muted} autoCapitalize="none" className="rounded-2xl border px-4 py-3 text-left text-[12px] text-foreground" style={{ borderColor: colors.border }} />
      <View className="mt-3 flex-row-reverse gap-2"><Pressable onPress={() => void inspect.refetch()} className="flex-1 rounded-2xl border px-3 py-3" style={{ borderColor: colors.primary }}><Text className="text-center text-[10px] font-bold text-primary">{inspect.isFetching ? "جارٍ الفحص…" : "فحص حقيقي"}</Text></Pressable><Pressable onPress={() => add.mutate({ source, reference })} disabled={add.isPending || reference.trim().length < 2} className="flex-1 rounded-2xl bg-primary px-3 py-3"><Text className="text-center text-[10px] font-extrabold text-[#062034]">حفظ المصدر</Text></Pressable></View>
      {inspect.data ? <View className="mt-3 rounded-2xl border p-3" style={{ borderColor: colors.border }}><Text className="text-right text-[11px] font-bold text-foreground">{inspect.data.normalized.label}</Text><Text className="mt-1 text-right text-[10px] text-muted">{inspect.data.files.length} ملف · {inspect.data.manifests.length} ملف قابل للقراءة · modes: {inspect.data.capabilities.installModes.join(", ") || "لا يوجد"}</Text><Pressable onPress={showInspection} className="mt-2"><Text className="text-right text-[10px] font-bold text-primary">عرض تفاصيل الفحص</Text></Pressable></View> : null}
    </View>
    <View className="mt-5 rounded-[22px] border bg-surface p-4" style={{ borderColor: colors.border }}><SectionHeading title="بحث مباشر في المصدر" /><TextInput value={query} onChangeText={setQuery} placeholder="بحث إضافي اختياري" placeholderTextColor={colors.muted} className="mt-3 rounded-2xl border px-4 py-3 text-right text-[12px] text-foreground" style={{ borderColor: colors.border, writingDirection: "rtl" }} /><Pressable onPress={() => void catalogSearch.refetch()} className="mt-3 rounded-2xl border px-3 py-3" style={{ borderColor: colors.primary }}><Text className="text-center text-[10px] font-bold text-primary">{catalogSearch.isFetching ? "جارٍ البحث…" : "بحث في API المصدر"}</Text></Pressable>{catalogSearch.data?.items.map((item) => <Pressable key={item.id} onPress={() => { addReference(item.id); void Linking.openURL(item.url); }} className="mt-3 rounded-2xl border p-3" style={{ borderColor: colors.border }}><View className="flex-row-reverse items-center"><MaterialIcons name="source" size={18} color={colors.primary} /><View className="mr-2 flex-1"><Text numberOfLines={1} className="text-right text-[11px] font-bold text-foreground">{item.name}</Text><Text numberOfLines={2} className="mt-1 text-right text-[9px] text-muted">{item.description || "مصدر قابل للفحص"}</Text></View></View></Pressable>)}</View>
    <View className="mt-5 rounded-[22px] border bg-surface p-4" style={{ borderColor: colors.border }}><SectionHeading title="مصادري المحفوظة" />{saved.data?.length ? saved.data.map((item) => <View key={item.id} className="mt-3 rounded-2xl border p-3" style={{ borderColor: colors.border }}><View className="flex-row-reverse items-center"><MaterialIcons name="inventory-2" size={18} color={colors.primary} /><View className="mr-2 flex-1"><Text className="text-right text-[11px] font-bold text-foreground">{item.label}</Text><Text className="mt-1 text-right text-[9px] text-muted">{item.status} · {item.installMode || "بدون runtime"}</Text></View></View><View className="mt-3 flex-row-reverse flex-wrap gap-2"><Pressable onPress={() => sync.mutate({ sourceId: item.id })} className="rounded-xl border px-3 py-2" style={{ borderColor: colors.primary }}><Text className="text-[9px] font-bold text-primary">مزامنة</Text></Pressable><Pressable onPress={() => install.mutate({ sourceId: item.id, mode: item.installMode === "ollama-pull" ? "ollama-pull" : item.installMode === "remote-model" ? "remote-model" : item.installMode === "inference-api" ? "inference-api" : "download-artifacts" })} className="rounded-xl bg-primary px-3 py-2"><Text className="text-[9px] font-bold text-[#062034]">تثبيت/تفعيل</Text></Pressable></View>{manifestPaths(item.metadataJson).map((path) => <Pressable key={path} onPress={() => readFile.mutate({ sourceId: item.id, path })} className="mt-2 rounded-xl border px-3 py-2" style={{ borderColor: colors.border }}><Text numberOfLines={1} className="text-right text-[9px] text-primary">قراءة: {path}</Text></Pressable>)}{item.lastError ? <Text className="mt-2 text-right text-[9px] text-red-500">{item.lastError}</Text> : null}</View>) : <Text className="mt-3 text-right text-[10px] text-muted">لا توجد مصادر محفوظة بعد.</Text>}</View>
    <View className="mt-5 rounded-[22px] border p-4" style={{ borderColor: "#F2D3A1", backgroundColor: "#FFF9EC" }}><Text className="text-right text-[10px] font-bold text-foreground">ملاحظة APK</Text><Text className="mt-2 text-right text-[10px] leading-5 text-muted">يتم فحص APK كأرشيف ZIP وقراءة قائمة الملفات والـ manifests بأمان. لا يشغّل الخادم تطبيق Android عشوائيًا. تثبيت APK على الهاتف يحتاج مسار Android أصلي وصلاحية Package Installer، لذلك نحتفظ به كأثر قابل للتنزيل والتحليل ولا ننفذ كودًا غير موثوق على الخادم.</Text></View>
  </ScrollView></ScreenContainer>;
}
