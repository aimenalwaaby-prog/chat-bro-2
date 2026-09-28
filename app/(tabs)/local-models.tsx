import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { BrandHeader, StatusBadge } from "@/components/chatbro-ui";
import { useColors } from "@/hooks/use-colors";
import { compatibility, downloadLocalModel, getDeviceProfile, listInstalledLocalModels, LOCAL_MODELS, removeLocalModel, type InstalledLocalModel } from "@/lib/local-runtime";

function formatBytes(bytes: number) { return bytes < 1024 ** 3 ? `${Math.round(bytes / 1024 ** 2)} MB` : `${(bytes / 1024 ** 3).toFixed(1)} GB`; }

export default function LocalModelsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [installed, setInstalled] = useState<InstalledLocalModel[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const device = getDeviceProfile();
  const refresh = () => listInstalledLocalModels().then(setInstalled);
  useEffect(() => { void refresh(); }, []);

  const install = async (model: typeof LOCAL_MODELS[number]) => {
    const check = compatibility(model);
    if (check.level === "warning") {
      Alert.alert("⚠️ نموذج ثقيل", `${check.reason} قد يعمل ببطء شديد أو يتوقف بسبب ضغط الذاكرة. هل تريد المتابعة؟`, [{ text: "إلغاء", style: "cancel" }, { text: "متابعة", style: "destructive", onPress: () => void doInstall(model) }]);
      return;
    }
    await doInstall(model);
  };
  const doInstall = async (model: typeof LOCAL_MODELS[number]) => {
    try {
      setProgress((p) => ({ ...p, [model.id]: 1 }));
      await downloadLocalModel(model, (value) => setProgress((p) => ({ ...p, [model.id]: value })));
      await refresh();
      setProgress((p) => ({ ...p, [model.id]: 100 }));
      Alert.alert("تم التنزيل", `${model.name} أصبح جاهزًا للمحادثة المحلية.`);
    } catch (error) { Alert.alert("فشل التنزيل", error instanceof Error ? error.message : "تعذر تنزيل النموذج."); }
  };

  return <ScreenContainer className="px-5 pt-4">
    <BrandHeader title="النماذج المحلية" eyebrow="ON-DEVICE RUNTIME" onPress={() => router.push("/(tabs)/local-chat")} />
    <Text className="mt-7 text-[25px] font-extrabold text-foreground text-right">تشغيل داخل الهاتف، لا داخل Render.</Text>
    <Text className="mt-2 text-[12px] leading-5 text-muted text-right">هذه النماذج GGUF وتعمل عبر llama.cpp داخل التطبيق. بعد التنزيل لا تحتاج إلى Ollama أو OpenRouter أو اتصال بالخادم.</Text>
    <View className="mt-4 rounded-[18px] border bg-surface p-3" style={{ borderColor: colors.border }}><View className="flex-row-reverse items-center justify-between"><StatusBadge label={`${installed.length} مثبت`} tone="full" /><Text className="text-[10px] text-muted">RAM ≈ {device.totalMemoryGb.toFixed(1)}GB · {device.modelName}</Text></View><Text className="mt-2 text-[10px] text-muted text-right">المناسب لجهازك يظهر كمناسب، والأثقل يحتاج موافقة صريحة قبل التنزيل.</Text></View>
    {installed.length > 0 ? <Pressable onPress={() => router.push("/(tabs)/local-chat")} className="mt-3 flex-row-reverse items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3"><MaterialIcons name="chat" size={18} color="#062034" /><Text className="font-bold text-[#062034]">فتح المحادثة المحلية</Text></Pressable> : null}
    <FlatList data={LOCAL_MODELS} keyExtractor={(m) => m.id} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 14, paddingBottom: 32 }} renderItem={({ item }) => { const check = compatibility(item); const saved = installed.find((m) => m.id === item.id); const p = progress[item.id]; return <View className="rounded-[21px] border bg-surface p-3.5" style={{ borderColor: colors.border }}><View className="flex-row-reverse items-center"><View className="h-11 w-11 items-center justify-center rounded-[15px] bg-[#E6F8FD]"><MaterialIcons name="smart-toy" size={21} color="#0787B4" /></View><View className="mr-3 flex-1"><Text className="text-[13px] font-bold text-foreground text-right">{item.name}</Text><Text className="mt-1 text-[10px] text-muted text-right">{item.description}</Text><Text className="mt-1 text-[10px] text-muted text-right">{formatBytes(item.sizeBytes)} · {item.quant}</Text></View><StatusBadge label={saved ? "مثبت" : check.label} tone={saved ? "full" : check.level === "warning" ? "trial" : "limited"} /></View><Text className="mt-2 text-[10px] text-muted text-right">{check.reason}</Text>{p && p < 100 ? <Text className="mt-2 text-[10px] text-primary text-right">جارٍ التنزيل: {p}%</Text> : saved ? <Pressable onPress={() => Alert.alert("حذف النموذج؟", "سيُحذف ملف النموذج من الهاتف.", [{ text: "إلغاء", style: "cancel" }, { text: "حذف", style: "destructive", onPress: async () => { await removeLocalModel(saved); await refresh(); } }])} className="mt-3 self-end rounded-full border px-3 py-1.5" style={{ borderColor: colors.border }}><Text className="text-[10px] font-bold text-muted">حذف</Text></Pressable> : <Pressable disabled={check.level === "blocked"} onPress={() => void install(item)} className="mt-3 self-end rounded-full bg-primary px-3 py-2" style={{ opacity: check.level === "blocked" ? 0.45 : 1 }}><Text className="text-[10px] font-bold text-[#062034]">{check.level === "blocked" ? "غير مناسب" : "تنزيل وتشغيل"}</Text></Pressable>}</View>; }} />
  </ScreenContainer>;
}
