import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";

import { BrandHeader } from "@/components/chatbro-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

async function openLink(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("تعذر فتح الرابط", "تأكد من وجود تطبيق مناسب على جهازك.");
  }
}

export default function AboutScreen() {
  const colors = useColors();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const androidApkUrl = process.env.EXPO_PUBLIC_ANDROID_APK_URL ?? "https://chatbro-web.onrender.com/downloads/chatbro-latest.apk";
  return (
    <ScreenContainer className="px-5 pt-4">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        <BrandHeader title="حول التطبيق" eyebrow="ABOUT CHAT BRO" onPress={() => router.push("/(tabs)/settings")} />
        <View className="mt-7 items-center rounded-[28px] bg-[#0C7FA9] px-5 py-7">
          <View className="h-[72px] w-[72px] items-center justify-center rounded-[24px] bg-white/20"><MaterialIcons name="smart-toy" size={38} color="white" /></View>
          <Text className="mt-4 text-[23px] font-extrabold text-white">Chat Bro</Text>
          <Text className="mt-1 text-[11px] text-[#D8FAFF]">الإصدار {Constants.expoConfig?.version ?? "1.0.0"} · Android وWeb</Text>
          <Text className="mt-4 text-center text-[11px] leading-5 text-[#E7FCFF]">واجهة موحدة للتحدث مع نماذج الذكاء الاصطناعي السحابية والمحلية، مع أدوات بحث ويب وإنشاء صور عند تهيئة مزوداتها.</Text>
        </View>

        <Pressable onPress={() => void openLink(androidApkUrl)} className="mt-4 flex-row-reverse items-center rounded-2xl border bg-surface px-4 py-4" style={{ borderColor: colors.border }}>
          <MaterialIcons name="download" size={22} color={colors.primary} />
          <View className="mr-3 flex-1"><Text className="text-right text-[12px] font-extrabold text-foreground">تحميل تطبيق Android</Text><Text className="mt-1 text-right text-[10px] text-muted">نسخة ARM64 · تتطلب Android 64-bit</Text></View>
          <MaterialIcons name="open-in-new" size={17} color={colors.muted} />
        </Pressable>

        <Text className="mb-2 mt-6 text-right text-[13px] font-extrabold text-foreground">ما الذي يقدمه Chat Bro؟</Text>
        {[
          ["hub", "كتالوجات مباشرة من مزودي النماذج المهيئين على الخادم."],
          ["smart-toy", "تنزيل ملفات GGUF حقيقية وتشغيلها محليًا عبر llama.cpp على Android."],
          ["language", "بحث ويب للمحادثات السحابية عند إعداد OpenRouter."],
          ["image", "أداة إنشاء صور مستقلة قابلة للاستخدام مع أي نموذج محادثة."],
          ["security", "مفاتيح المزود لا تُضمّن داخل APK؛ تحفظ في إعدادات الخادم."],
        ].map(([icon, text]) => <View key={text} className="mb-2 flex-row-reverse items-center rounded-2xl border bg-surface px-4 py-3" style={{ borderColor: colors.border }}><MaterialIcons name={icon as never} size={19} color={colors.primary} /><Text className="mr-3 flex-1 text-right text-[11px] leading-5 text-foreground">{text}</Text></View>)}

        <Pressable onPress={() => setExpanded((value) => !value)} className="mt-3 flex-row-reverse items-center justify-between rounded-2xl border bg-surface px-4 py-4" style={{ borderColor: colors.border }}><Text className="text-right text-[12px] font-bold text-foreground">الخصوصية ومعلومات التشغيل</Text><MaterialIcons name={expanded ? "expand-less" : "expand-more"} size={21} color={colors.muted} /></Pressable>
        {expanded ? <View className="mt-2 rounded-2xl border bg-surface p-4" style={{ borderColor: colors.border }}><Text className="text-right text-[10px] leading-5 text-muted">المحادثات مع النماذج السحابية والبحث وإنشاء الصور ترسل الطلب إلى الخادم والمزود المختار. النماذج المحلية المثبتة تعمل على الجهاز ولا تُرسل رسائلها إلى الخادم. تُحفظ المفضلة وسجل الاستخدام محليًا على الجهاز. يرجى مراجعة سياسات مزود الخدمة قبل مشاركة بيانات حساسة.</Text></View> : null}

        <Text className="mb-2 mt-6 text-right text-[13px] font-extrabold text-foreground">تواصل مع المطور</Text>
        <Pressable onPress={() => void openLink("https://wa.me/967784755343")} className="mb-2 flex-row-reverse items-center rounded-2xl bg-[#E8F8EE] px-4 py-3"><MaterialIcons name="chat" size={21} color="#168A4A" /><Text className="mr-3 flex-1 text-right text-[11px] font-bold text-[#176B3D]">واتساب · 784755343</Text><MaterialIcons name="open-in-new" size={17} color="#37845A" /></Pressable>
        <Pressable onPress={() => void openLink("mailto:aimenalwwaby@gmail.com")} className="flex-row-reverse items-center rounded-2xl bg-[#EAF5FB] px-4 py-3"><MaterialIcons name="email" size={21} color="#147BA5" /><Text className="mr-3 flex-1 text-right text-[11px] font-bold text-[#145F7D]">aimenalwwaby@gmail.com</Text><MaterialIcons name="open-in-new" size={17} color="#397C97" /></Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}
