import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useMemo, useState } from "react";

import { ScreenContainer } from "@/components/screen-container";
import { BrandHeader, ModelCard, SectionHeading } from "@/components/chatbro-ui";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

const quickActions = [
  ["chat-bubble-outline", "محادثة", "ابدأ مع أي نموذج", "/(tabs)/chat"],
  ["travel-explore", "بحث شامل", "ابحث وحلل", "/(tabs)/chat"],
  ["auto-awesome", "الصور", "نماذج الصور", "/(tabs)/models"],
  ["code", "البرمجة", "مساعدو الكود", "/(tabs)/chat"],
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const [prompt, setPrompt] = useState("");
  const builtInModels = trpc.models.builtIn.useQuery(undefined, { staleTime: 60_000, retry: 0 });
  const openRouterModels = trpc.models.openRouter.useQuery(undefined, { staleTime: 60_000, retry: 0 });
  const recommendedModels = useMemo(() => [
    ...(builtInModels.data?.models ?? []).map((model) => ({
      name: model.name,
      provider: `${model.provider} · خادم مدمج`,
      icon: "auto-awesome" as const,
      tone: "limited" as const,
      status: "مفهرس من الخادم",
      limit: "وفق إعداد المزود",
    })),
    ...(openRouterModels.data?.models ?? []).filter((model) => !model.outputModalities?.length || model.outputModalities.includes("text")).map((model) => ({
      name: model.name,
      provider: "OpenRouter · فهرس الخادم",
      icon: "hub" as const,
      tone: "limited" as const,
      status: "مفهرس من المصدر",
      limit: model.contextLength ? `سياق ${model.contextLength.toLocaleString()} رمز` : "حسب المصدر",
    })),
  ].slice(0, 6), [builtInModels.data, openRouterModels.data]);

  const startChat = () => {
    const value = prompt.trim();
    router.push(value ? { pathname: "/(tabs)/chat", params: { prompt: value } } : "/(tabs)/chat");
    setPrompt("");
  };

  return (
    <ScreenContainer className="px-5 pt-3" containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 34 }}>
        <BrandHeader onPress={() => router.push("/(tabs)/settings")} />

        <View className="mt-8">
          <Text className="text-right text-[30px] font-extrabold leading-9 text-foreground">كل أدواتك الذكية.</Text>
          <Text className="mt-2 text-right text-[13px] leading-5 text-muted">محادثة، بحث، برمجة وصور، في مساحة واحدة بدون زحمة.</Text>
        </View>

        <View className="mt-5 rounded-[26px] border p-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <View className="flex-row-reverse items-center justify-between">
            <View className="flex-row-reverse items-center gap-2">
              <View className="h-9 w-9 items-center justify-center rounded-2xl bg-[#DDF8FF]">
                <MaterialIcons name="auto-awesome" size={18} color="#0787B4" />
              </View>
              <View>
                <Text className="text-right text-[12px] font-bold text-foreground">ابدأ محادثة جديدة</Text>
                <Text className="mt-0.5 text-right text-[10px] text-muted">سيتم اختيار النموذج من شاشة المحادثة</Text>
              </View>
            </View>
          </View>
          <View className="mt-4 flex-row-reverse items-end gap-2 rounded-[20px] border px-3 py-2" style={{ borderColor: colors.border }}>
            <Pressable onPress={startChat} className="h-11 w-11 items-center justify-center rounded-[15px]" style={{ backgroundColor: colors.primary }}>
              <MaterialIcons name="arrow-upward" size={22} color="#062034" />
            </Pressable>
            <TextInput
              value={prompt}
              onChangeText={setPrompt}
              onSubmitEditing={startChat}
              placeholder="اكتب طلبك هنا..."
              placeholderTextColor={colors.muted}
              multiline
              className="min-h-[42px] flex-1 py-2 text-right text-[14px] text-foreground"
              style={{ writingDirection: "rtl" }}
            />
          </View>
        </View>

        <View className="mt-7">
          <SectionHeading title="اختصارات" action="كل الأدوات" onAction={() => router.push("/(tabs)/models")} />
          <View className="gap-2">
            {quickActions.map(([icon, label, desc, route]) => (
              <Pressable key={label} onPress={() => router.push(route as never)} className="flex-row-reverse items-center rounded-[20px] border px-4 py-3.5" style={({ pressed }) => [{ backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.75 }]}>
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#E8F8FC]">
                  <MaterialIcons name={icon as never} size={21} color="#0787B4" />
                </View>
                <View className="mr-3 flex-1">
                  <Text className="text-right text-[13px] font-bold text-foreground">{label}</Text>
                  <Text className="mt-0.5 text-right text-[10px] text-muted">{desc}</Text>
                </View>
                <MaterialIcons name="chevron-left" size={20} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        </View>

        <View className="mt-8">
          <SectionHeading title="نماذج من مصادر مهيأة" action="كل النماذج" onAction={() => router.push("/(tabs)/models")} />
          {recommendedModels.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse", paddingLeft: 4 }}>
              {recommendedModels.map((model, index) => <ModelCard key={`${model.provider}:${model.name}:${index}`} {...model} onPress={() => router.push({ pathname: "/(tabs)/chat", params: { model: model.name } })} />)}
            </ScrollView>
          ) : (
            <View className="rounded-2xl border p-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <Text className="text-right text-[11px] font-semibold text-foreground">{builtInModels.isLoading || openRouterModels.isLoading ? "جارٍ تحميل الكتالوج…" : "لا توجد نماذج من المصادر المهيأة حاليًا."}</Text>
              {(builtInModels.isError || openRouterModels.isError) ? <Text className="mt-1 text-right text-[10px] text-muted">تعذر تحديث أحد الكتالوجات؛ يمكنك فتح شاشة استكشاف والمحاولة مجددًا.</Text> : null}
            </View>
          )}
        </View>

        <Pressable onPress={() => router.push("/(tabs)/web-sites")} className="mt-7 flex-row-reverse items-center rounded-[22px] border p-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#EEE8FF]"><MaterialIcons name="language" size={21} color="#7451C5" /></View>
          <View className="mr-3 flex-1"><Text className="text-right text-[13px] font-bold text-foreground">دليل مواقع الذكاء الاصطناعي</Text><Text className="mt-1 text-right text-[10px] text-muted">روابط المحادثة والبحث والبرمجة والصور والصوت</Text></View>
          <MaterialIcons name="chevron-left" size={20} color={colors.muted} />
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}
