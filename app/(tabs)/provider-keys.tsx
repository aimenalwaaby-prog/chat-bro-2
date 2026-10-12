import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { BrandHeader, SectionHeading } from "@/components/chatbro-ui";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

const templates = [
  { provider: "OpenAI-compatible", baseUrl: "https://api.example.com/v1", kind: "both" as const, hint: "OpenRouter / LM Studio / vLLM / Together" },
  { provider: "Hugging Face", baseUrl: "https://api-inference.huggingface.co/v1", kind: "chat" as const, hint: "نماذج Hugging Face المتوافقة" },
  { provider: "Replicate", baseUrl: "https://api.replicate.com/v1", kind: "image" as const, hint: "إنشاء الصور والتنبؤات" },
  { provider: "Ollama", baseUrl: "https://your-ollama-host/v1", kind: "both" as const, hint: "خادم Ollama بعيد" },
];

export default function ProviderKeysScreen() {
  const colors = useColors();
  const keys = trpc.providerKeys.list.useQuery(undefined, { retry: 0 });
  const addKey = trpc.providerKeys.add.useMutation({ onSuccess: () => { void keys.refetch(); setApiKey(""); Alert.alert("تم الحفظ", "حُفظ المفتاح مشفرًا على الخادم ويمكن اختياره داخل المحادثات."); } });
  const removeKey = trpc.providerKeys.remove.useMutation({ onSuccess: () => void keys.refetch() });
  const [name, setName] = useState("");
  const [provider, setProvider] = useState(templates[0].provider);
  const [baseUrl, setBaseUrl] = useState(templates[0].baseUrl);
  const [kind, setKind] = useState<"chat" | "image" | "both">("both");
  const [apiKey, setApiKey] = useState("");
  const [modelPrefix, setModelPrefix] = useState("");
  const submit = () => {
    if (!name.trim() || !apiKey.trim()) return Alert.alert("بيانات ناقصة", "أدخل اسم المفتاح والمفتاح السري.");
    addKey.mutate({ name: name.trim(), provider, baseUrl: baseUrl.trim(), kind, apiKey: apiKey.trim(), modelPrefix: modelPrefix.trim() || undefined });
  };
  return <ScreenContainer className="px-5 pt-4"><ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
    <BrandHeader title="مفاتيحي" eyebrow="PRIVATE PROVIDERS" />
    <Text className="mt-6 text-right text-[23px] font-extrabold text-foreground">مفاتيحك، تحت سيطرتك.</Text>
    <Text className="mt-2 text-right text-[11px] leading-5 text-muted">تُشفّر المفاتيح في الخادم ولا تظهر مرة أخرى بعد حفظها. اختر المفتاح من المحادثة ليبقى المسار مرتبطًا بها محليًا.</Text>
    <View className="mt-5 rounded-[22px] border bg-surface p-4" style={{ borderColor: colors.border }}>
      <SectionHeading title="قوالب مصادر مدعومة" />
      <View className="mt-3 gap-2">{templates.map((item) => <Pressable key={item.provider} onPress={() => { setProvider(item.provider); setBaseUrl(item.baseUrl); setKind(item.kind); }} className="flex-row-reverse items-center rounded-2xl border px-3 py-3" style={{ borderColor: provider === item.provider ? colors.primary : colors.border, backgroundColor: provider === item.provider ? "#E6F8FD" : colors.surface }}><MaterialIcons name="hub" size={18} color={colors.primary} /><View className="mr-2 flex-1"><Text className="text-right text-[11px] font-bold text-foreground">{item.provider}</Text><Text className="mt-1 text-right text-[9px] text-muted">{item.hint}</Text></View></Pressable>)}</View>
    </View>
    <View className="mt-5 rounded-[22px] border bg-surface p-4" style={{ borderColor: colors.border }}>
      <SectionHeading title="إضافة مصدر مخصص" />
      <TextInput value={name} onChangeText={setName} placeholder="اسم المفتاح، مثل: مفتاح العمل" placeholderTextColor={colors.muted} className="mt-3 rounded-2xl border px-4 py-3 text-right text-[12px] text-foreground" style={{ borderColor: colors.border, writingDirection: "rtl" }} />
      <TextInput value={provider} onChangeText={setProvider} placeholder="اسم المزود" placeholderTextColor={colors.muted} className="mt-2 rounded-2xl border px-4 py-3 text-right text-[12px] text-foreground" style={{ borderColor: colors.border }} />
      <TextInput value={baseUrl} onChangeText={setBaseUrl} placeholder="https://.../v1" autoCapitalize="none" keyboardType="url" placeholderTextColor={colors.muted} className="mt-2 rounded-2xl border px-4 py-3 text-left text-[12px] text-foreground" style={{ borderColor: colors.border }} />
      <TextInput value={apiKey} onChangeText={setApiKey} placeholder="API key" secureTextEntry autoCapitalize="none" placeholderTextColor={colors.muted} className="mt-2 rounded-2xl border px-4 py-3 text-left text-[12px] text-foreground" style={{ borderColor: colors.border }} />
      <TextInput value={modelPrefix} onChangeText={setModelPrefix} placeholder="النموذج الافتراضي (اختياري)" placeholderTextColor={colors.muted} className="mt-2 rounded-2xl border px-4 py-3 text-left text-[12px] text-foreground" style={{ borderColor: colors.border }} />
      <View className="mt-3 flex-row-reverse flex-wrap gap-2">{(["chat", "image", "both"] as const).map((value) => <Pressable key={value} onPress={() => setKind(value)} className="rounded-full border px-3 py-2" style={{ borderColor: kind === value ? colors.primary : colors.border, backgroundColor: kind === value ? "#E6F8FD" : colors.surface }}><Text className="text-[10px] font-bold text-foreground">{value === "chat" ? "محادثة" : value === "image" ? "صور" : "محادثة + صور"}</Text></Pressable>)}</View>
      <Pressable disabled={addKey.isPending} onPress={submit} className="mt-4 rounded-2xl bg-primary px-4 py-3"><Text className="text-center text-[11px] font-extrabold text-[#062034]">{addKey.isPending ? "جارٍ الحفظ…" : "حفظ المفتاح المشفر"}</Text></Pressable>
    </View>
    <View className="mt-5 rounded-[22px] border bg-surface p-4" style={{ borderColor: colors.border }}><SectionHeading title="المفاتيح المحفوظة" />{keys.data?.length ? keys.data.map((item) => <View key={item.id} className="mt-3 flex-row-reverse items-center rounded-2xl border px-3 py-3" style={{ borderColor: colors.border }}><MaterialIcons name={item.kind === "image" ? "image" : "vpn-key"} size={18} color={colors.primary} /><View className="mr-2 flex-1"><Text className="text-right text-[11px] font-bold text-foreground">{item.name}</Text><Text className="mt-1 text-right text-[9px] text-muted">{item.provider} · {item.kind} · {item.baseUrl}</Text></View><Pressable onPress={() => Alert.alert("حذف المفتاح؟", "سيُفصل عن المحادثات القادمة.", [{ text: "إلغاء", style: "cancel" }, { text: "حذف", style: "destructive", onPress: () => removeKey.mutate({ id: item.id }) }])}><MaterialIcons name="delete-outline" size={20} color="#C94D54" /></Pressable></View>) : <Text className="mt-3 text-right text-[10px] leading-5 text-muted">سجّل الدخول ثم أضف أول مفتاح. لن يتم عرض قيمته السرية هنا.</Text>}</View>
  </ScrollView></ScreenContainer>;
}
