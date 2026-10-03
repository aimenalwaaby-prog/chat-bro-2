import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, FlatList, Platform, Pressable, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { BrandHeader, StatusBadge } from "@/components/chatbro-ui";
import { useColors } from "@/hooks/use-colors";
import { loadModelPreferences, toggleModelFavorite } from "@/lib/model-preferences";
import { compatibility, downloadLocalModel, getDeviceProfile, listInstalledLocalModels, LOCAL_MODELS, removeLocalModel, type InstalledLocalModel } from "@/lib/local-runtime";

function formatBytes(bytes: number) { return bytes < 1024 ** 3 ? `${Math.round(bytes / 1024 ** 2)} MB` : `${(bytes / 1024 ** 3).toFixed(1)} GB`; }

export default function LocalModelsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [installed, setInstalled] = useState<InstalledLocalModel[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const device = getDeviceProfile();
  const deviceTierLabel = device.tier === "low" ? "اقتصادي" : device.tier === "balanced" ? "متوسط" : "قوي";
  const isAndroid = Platform.OS === "android";
  const refresh = () => listInstalledLocalModels().then(setInstalled);
  useEffect(() => { void refresh(); void loadModelPreferences().then((saved) => setFavoriteIds(new Set(saved.favorites.map((item) => item.id)))); }, []);

  const toggleFavorite = async (model: typeof LOCAL_MODELS[number]) => {
    const next = await toggleModelFavorite({ id: `local:${model.id}`, name: model.name, provider: "محلي على الجهاز", route: "local" });
    setFavoriteIds(new Set(next.favorites.map((item) => item.id)));
  };

  const doInstall = async (model: typeof LOCAL_MODELS[number]) => {
    try {
      setProgress((current) => ({ ...current, [model.id]: 1 }));
      await downloadLocalModel(model, (value) => setProgress((current) => ({ ...current, [model.id]: value })));
      await refresh();
      setProgress((current) => ({ ...current, [model.id]: 100 }));
      Alert.alert("تم التنزيل والتحقق", `${model.name} اجتاز فحص GGUF وأصبح جاهزًا للمحادثة المحلية.`);
    } catch (error) {
      setProgress((current) => { const next = { ...current }; delete next[model.id]; return next; });
      Alert.alert("فشل التنزيل أو التحقق", error instanceof Error ? error.message : "تعذر تنزيل ملف GGUF صالح.");
    }
  };

  const install = (model: typeof LOCAL_MODELS[number]) => {
    if (!isAndroid) {
      Alert.alert("Android فقط", "تنزيل وتشغيل النماذج المحلية متاح في تطبيق Android الأصلي فقط.");
      return;
    }
    const check = compatibility(model);
    if (check.level === "warning") {
      Alert.alert("نموذج ثقيل", `${check.reason} قد يعمل ببطء شديد أو يتوقف بسبب ضغط الذاكرة. هل تريد المتابعة؟`, [
        { text: "إلغاء", style: "cancel" },
        { text: "متابعة", style: "destructive", onPress: () => void doInstall(model) },
      ]);
      return;
    }
    void doInstall(model);
  };

  return <ScreenContainer className="px-5 pt-4">
    <BrandHeader title="النماذج المحلية" eyebrow="ON-DEVICE RUNTIME" onPress={() => router.push("/(tabs)/local-chat")} />
    <Text className="mt-7 text-[25px] font-extrabold text-foreground text-right">تشغيل داخل الهاتف، لا داخل Render.</Text>
    <Text className="mt-2 text-[12px] leading-5 text-muted text-right">هذه ملفات GGUF حقيقية من Hugging Face، ويُتحقق من HTTP والحجم ورأس النموذج قبل تسجيلها كمثبتة. تعمل عبر llama.cpp بعد تنزيلها، ولا تحتاج إلى Ollama أو OpenRouter أو اتصال بالخادم.</Text>
    {!isAndroid ? <View className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-3"><Text className="text-right text-[11px] font-semibold text-amber-900">التنزيل والتشغيل متاحان في APK Android فقط.</Text></View> : null}
    <View className="mt-4 rounded-[18px] border bg-surface p-3" style={{ borderColor: colors.border }}>
      <View className="flex-row-reverse items-center justify-between"><StatusBadge label={`${installed.length} مثبت`} tone="full" /><Text className="text-[10px] text-muted">{device.memoryKnown ? `RAM ≈ ${device.totalMemoryGb.toFixed(1)}GB` : "RAM غير معروفة · وضع آمن"} · {deviceTierLabel} · {device.modelName}</Text></View>
      <Text className="mt-2 text-[10px] text-muted text-right">يُضبط السياق واستهلاك الذاكرة تلقائيًا. النماذج التي قد تضغط جهازك تُمنع، والأثقل الآمن يحتاج موافقة قبل التنزيل.</Text>
    </View>
    {installed.length > 0 ? <Pressable onPress={() => router.push("/(tabs)/local-chat")} className="mt-3 flex-row-reverse items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3"><MaterialIcons name="chat" size={18} color="#062034" /><Text className="font-bold text-[#062034]">فتح المحادثة المحلية</Text></Pressable> : null}
    <FlatList
      data={LOCAL_MODELS}
      keyExtractor={(model) => model.id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ gap: 10, paddingVertical: 14, paddingBottom: 32 }}
      renderItem={({ item }) => {
        const check = compatibility(item);
        const saved = installed.find((model) => model.id === item.id);
        const percent = progress[item.id];
        const downloading = percent !== undefined && percent < 100;
        return <View className="rounded-[21px] border bg-surface p-3.5" style={{ borderColor: colors.border }}>
          <View className="flex-row-reverse items-center">
            <View className="h-11 w-11 items-center justify-center rounded-[15px] bg-[#E6F8FD]"><MaterialIcons name="smart-toy" size={21} color="#0787B4" /></View>
            <View className="mr-3 flex-1">
              <Text className="text-[13px] font-bold text-foreground text-right">{item.name}</Text>
              <Text className="mt-1 text-[10px] text-muted text-right">{item.description}</Text>
              <Text className="mt-1 text-[10px] text-muted text-right">{formatBytes(item.sizeBytes)} · {item.quant}</Text>
            </View>
            <StatusBadge label={saved ? "مثبت ومتحقق" : isAndroid ? check.label : "Android فقط"} tone={saved ? "full" : check.level === "warning" ? "trial" : "limited"} />
            <Pressable accessibilityRole="button" accessibilityLabel={favoriteIds.has(`local:${item.id}`) ? "إزالة من المفضلة" : "إضافة إلى المفضلة"} onPress={() => void toggleFavorite(item)} className="ml-1 h-9 w-9 items-center justify-center rounded-xl"><MaterialIcons name={favoriteIds.has(`local:${item.id}`) ? "star" : "star-outline"} size={20} color={favoriteIds.has(`local:${item.id}`) ? "#E1A526" : colors.muted} /></Pressable>
          </View>
          <Text className="mt-2 text-[10px] text-muted text-right">{check.reason}</Text>
          {downloading ? <Text className="mt-2 text-[10px] text-primary text-right">جارٍ التنزيل والتحقق: {percent}%</Text> : saved ? <Pressable onPress={() => Alert.alert("حذف النموذج؟", "سيُحذف ملف النموذج من الهاتف.", [
            { text: "إلغاء", style: "cancel" },
            { text: "حذف", style: "destructive", onPress: async () => { await removeLocalModel(saved); await refresh(); } },
          ])} className="mt-3 self-end rounded-full border px-3 py-1.5" style={{ borderColor: colors.border }}><Text className="text-[10px] font-bold text-muted">حذف</Text></Pressable> : <Pressable disabled={!isAndroid || check.level === "blocked"} onPress={() => install(item)} className="mt-3 self-end rounded-full bg-primary px-3 py-2" style={{ opacity: !isAndroid || check.level === "blocked" ? 0.45 : 1 }}><Text className="text-[10px] font-bold text-[#062034]">{!isAndroid ? "Android فقط" : check.level === "blocked" ? "غير مناسب" : "تنزيل والتحقق والتشغيل"}</Text></Pressable>}
        </View>;
      }}
    />
  </ScreenContainer>;
}
