import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { BrandHeader } from "@/components/chatbro-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { checkServerConnection } from "@/lib/_core/api";
import { trpc } from "@/lib/trpc";

type GeneratorChoice = { id: string; name: string; provider: string; detail: string };

export default function ImagesScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ model?: string; prompt?: string }>();
  const initialModel = Array.isArray(params.model) ? params.model[0] : params.model;
  const initialPrompt = Array.isArray(params.prompt) ? params.prompt[0] : params.prompt;
  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const [selectedModel, setSelectedModel] = useState(initialModel ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [serverCapabilities, setServerCapabilities] = useState<Record<string, boolean> | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState("");
  const imageModels = trpc.models.openRouter.useQuery(undefined, { enabled: serverCapabilities?.openrouter === true, staleTime: 60_000, retry: 1 });
  const imageCatalog = trpc.images.models.useQuery(undefined, { staleTime: 60_000, retry: 1 });
  const generateImage = trpc.images.generate.useMutation();
  const retryServer = async () => {
    setServerCapabilities(null);
    const result = await checkServerConnection();
    setServerCapabilities(result.capabilities ?? {});
    await imageCatalog.refetch();
  };

  useEffect(() => {
    let active = true;
    void checkServerConnection().then((result) => active && setServerCapabilities(result.capabilities ?? {}));
    return () => { active = false; };
  }, []);
  useEffect(() => { if (initialModel) setSelectedModel(initialModel); }, [initialModel]);
  useEffect(() => { if (initialPrompt) setPrompt(initialPrompt); }, [initialPrompt]);

  const choices = useMemo<GeneratorChoice[]>(() => {
    const forge: GeneratorChoice[] = serverCapabilities?.forgeImages
      ? [{ id: "MODEL_GPT_IMAGE_2", name: "GPT Image 2", provider: "Forge · الخادم", detail: "إنشاء صور · جودة متوسطة" }]
      : [];
    const openRouter = (imageCatalog.data?.models ?? [])
      .filter((model) => Boolean(model.id ?? model.model))
      .map((model): GeneratorChoice => ({
        id: `openrouter:${model.id ?? model.model}`,
        name: model.id ?? model.model ?? "نموذج صور",
        provider: "OpenRouter",
        detail: `${model.access ?? "غير محدد"} · ${model.dailyLimit ?? "الحد حسب المزود"}`,
      }));
    return [...forge, ...openRouter];
  }, [imageCatalog.data, serverCapabilities]);

  const canGenerate = Boolean(serverCapabilities?.openrouter || serverCapabilities?.forgeImages);
  const selectedChoice = choices.find((item) => item.id === selectedModel);
  const create = async () => {
    const cleanPrompt = prompt.trim();
    if (cleanPrompt.length < 3) {
      Alert.alert("أضف وصف الصورة", "اكتب وصفًا من ثلاثة أحرف على الأقل.");
      return;
    }
    if (!canGenerate) {
      Alert.alert("مولّد الصور غير مهيأ", "يلزم إعداد OpenRouter أو Forge ImageService على الخادم أولًا.");
      return;
    }
    setError("");
    setImageUrl("");
    try {
      const serverModel = selectedModel.startsWith("openrouter:") && serverCapabilities?.forgeImages === undefined
        ? selectedModel.slice("openrouter:".length)
        : selectedModel;
      const result = await generateImage.mutateAsync({ prompt: cleanPrompt, ...(serverModel ? { model: serverModel } : {}), quality: "medium" });
      if (!result.url) throw new Error("لم يُرجع مزود الصور رابطًا للصورة.");
      setImageUrl(result.url);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "تعذر إنشاء الصورة. حاول مجددًا.";
      setError(message);
    }
  };

  return (
    <ScreenContainer className="px-5 pt-4">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        <BrandHeader title="إنشاء الصور" eyebrow="IMAGE STUDIO" onPress={() => router.push("/(tabs)/chat")} />
        <View className="mt-6 rounded-[25px] bg-[#0C7FA9] p-5">
          <View className="flex-row-reverse items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/20"><MaterialIcons name="auto-awesome" size={25} color="white" /></View>
            <View className="flex-1"><Text className="text-right text-[18px] font-extrabold text-white">حوّل الوصف إلى صورة</Text><Text className="mt-1 text-right text-[10px] leading-4 text-[#D8FAFF]">أداة مستقلة؛ استخدمها من أي محادثة، واختر نموذجًا يعلن دعم إخراج الصور.</Text></View>
          </View>
        </View>

        <Text className="mb-2 mt-6 text-right text-[12px] font-bold text-foreground">نموذج إنشاء الصورة</Text>
        <Pressable onPress={() => setPickerOpen((value) => !value)} className="flex-row-reverse items-center justify-between rounded-2xl border bg-surface px-4 py-3.5" style={{ borderColor: colors.border }}>
          <View className="flex-row-reverse items-center gap-2"><MaterialIcons name="image-search" size={19} color={colors.primary} /><View><Text className="text-right text-[12px] font-bold text-foreground">{selectedChoice?.name ?? "اختيار تلقائي من الخادم"}</Text><Text className="mt-1 text-right text-[10px] text-muted">{selectedChoice ? `${selectedChoice.provider} · ${selectedChoice.detail}` : "المزود المهيأ يختار النموذج الافتراضي"}</Text></View></View>
          <MaterialIcons name={pickerOpen ? "expand-less" : "expand-more"} size={21} color={colors.muted} />
        </Pressable>
        {pickerOpen ? (
          <View className="mt-2 rounded-2xl border p-2" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
            <Pressable onPress={() => { setSelectedModel(""); setPickerOpen(false); }} className="rounded-xl px-3 py-3" style={{ backgroundColor: selectedModel ? colors.surface : "#E6F8FD" }}><Text className="text-right text-[11px] font-semibold text-foreground">اختيار تلقائي من الخادم</Text></Pressable>
            {choices.map((choice) => <Pressable key={choice.id} onPress={() => { setSelectedModel(choice.id); setPickerOpen(false); }} className="mt-1 rounded-xl px-3 py-3" style={{ backgroundColor: choice.id === selectedModel ? "#E6F8FD" : colors.surface }}><Text className="text-right text-[11px] font-semibold text-foreground">{choice.name}</Text><Text className="mt-1 text-right text-[9px] text-muted">{choice.provider} · {choice.detail}</Text></Pressable>)}
            {imageCatalog.isFetching || imageModels.isFetching ? <ActivityIndicator className="py-2" /> : null}
            {!choices.length && !imageModels.isFetching ? <Text className="px-3 py-2 text-right text-[10px] leading-4 text-muted">لا توجد نماذج صور ظاهرة في الكتالوج بعد. يمكن استخدام الاختيار التلقائي إذا كان الخادم مهيأ.</Text> : null}
          </View>
        ) : null}

        <Text className="mb-2 mt-5 text-right text-[12px] font-bold text-foreground">وصف الصورة</Text>
        <TextInput value={prompt} onChangeText={setPrompt} multiline maxLength={4000} textAlignVertical="top" placeholder="صف الصورة التي تريدها بالتفصيل…" placeholderTextColor={colors.muted} className="min-h-[150px] rounded-[20px] border bg-surface px-4 py-4 text-right text-[13px] leading-6 text-foreground" style={{ borderColor: colors.border, writingDirection: "rtl" }} />
        <Text className="mt-2 text-right text-[9px] text-muted">{prompt.length}/4000 · {serverCapabilities === null ? "جارٍ التحقق من الخادم…" : "الطلب يُرسل إلى مزود الصور المهيأ وقد يُحتسب استخدام خارجي."}</Text>
        <Pressable disabled={!canGenerate || generateImage.isPending} onPress={() => void create()} className="mt-4 flex-row-reverse items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4" style={{ opacity: !canGenerate || generateImage.isPending ? 0.55 : 1 }}>
          {generateImage.isPending ? <ActivityIndicator color="#062034" /> : <MaterialIcons name="auto-awesome" size={20} color="#062034" />}
          <Text className="text-[12px] font-extrabold text-[#062034]">{generateImage.isPending ? "جارٍ إنشاء الصورة…" : "إنشاء الصورة"}</Text>
        </Pressable>
        {!canGenerate ? <Text className="mt-3 text-center text-[10px] leading-5 text-muted">{serverCapabilities === null ? "الخادم لا يستجيب حاليًا؛ أعد المحاولة بعد تشغيل الخدمة." : "مولّد الصور غير مهيأ؛ يحتاج مفتاح OpenRouter أو إعداد Forge ImageService على الخادم."}</Text> : null}
        {serverCapabilities === null ? <Pressable onPress={() => void retryServer()} className="mt-2 rounded-xl border px-4 py-3" style={{ borderColor: colors.border }}><Text className="text-center text-[10px] font-bold text-primary">إعادة الاتصال بالخادم</Text></Pressable> : null}
        {error ? <Text className="mt-3 text-right text-[11px] leading-5 text-red-600">{error}</Text> : null}
        {imageUrl ? <View className="mt-6 overflow-hidden rounded-[24px] border bg-surface p-2" style={{ borderColor: colors.border }}><Image source={{ uri: imageUrl }} resizeMode="contain" className="h-[320px] w-full rounded-[18px]" /><Text className="mt-2 text-center text-[10px] font-semibold text-primary">تم إنشاء الصورة</Text></View> : null}
      </ScrollView>
    </ScreenContainer>
  );
}
