import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { BrandHeader, StatusBadge } from "@/components/chatbro-ui";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { chatBroModels } from "@/shared/chatbro-catalog";

function formatBytes(bytes: number) {
  if (bytes < 1024 ** 3) return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function estimatedSize(name: string) {
  const match = name.match(/(\d+(?:\.\d+)?)B/i);
  if (!match) return "الحجم يحدده المشغل";
  const billions = Number(match[1]);
  return `≈ ${formatBytes(billions * 0.7 * 1024 ** 3)} تقديريًا`;
}

export default function LocalModelsScreen() {
  const colors = useColors();
  const router = useRouter();
  const localStatus = trpc.models.localStatus.useQuery();
  const llamaStatus = trpc.models.llamaStatus.useQuery();
  const pullModel = trpc.models.pull.useMutation({ onSuccess: () => void localStatus.refetch() });
  const localModels = chatBroModels.filter((model) => model.localOnly);
  const installed = localStatus.data?.models ?? [];
  const totalSpace = installed.reduce((sum, model) => sum + (model.size ?? 0), 0);

  return (
    <ScreenContainer className="px-5 pt-4">
      <BrandHeader title="النماذج المحلية" eyebrow="LOCAL RUNTIME" onPress={() => router.push("/(tabs)/settings")} />
      <Text className="mt-7 text-[25px] font-extrabold text-foreground text-right">تنزيل وتشغيل منفصل.</Text>
      <Text className="mt-2 text-[12px] leading-5 text-muted text-right">الأوزان لا تدخل APK. التنزيل يتم على Ollama في خادم التشغيل، والمحادثة تستخدم النموذج المثبت مباشرة.</Text>
      <View className="mt-5 mb-3 rounded-[18px] border bg-surface p-3" style={{ borderColor: colors.border }}>
        <View className="flex-row-reverse items-center justify-between"><StatusBadge label={`${localModels.length} خيارًا`} tone="full" /><Text className="text-[10px] text-muted">Ollama: {localStatus.data?.available ? "متصل" : "غير متصل"} · llama.cpp: {llamaStatus.data?.available ? "متصل" : "غير متصل"}</Text></View>
        <Text className="mt-2 text-[11px] text-muted text-right">المساحة المستخدمة: {formatBytes(totalSpace)} · المثبت: {installed.length}</Text>
        {pullModel.error ? <Text className="mt-2 text-[10px] text-[#B23A48] text-right">تعذر التنزيل: شغّل Ollama على الخادم ثم أعد المحاولة.</Text> : null}
      </View>
      <FlatList
        data={localModels}
        keyExtractor={(item) => item.name}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingBottom: 32 }}
        renderItem={({ item }) => {
          const tag = item.modelId.replace(/^ollama:|^llama:/, "");
          const isLlama = item.runtime === "llama.cpp";
          const installedModel = !isLlama && installed.find((model) => model.name === tag || model.name.startsWith(`${tag}:`));
          return <Pressable onPress={() => router.push({ pathname: "/(tabs)/chat", params: { model: item.name } })} style={({ pressed }) => [{ backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.75 }]} className="flex-row-reverse items-center rounded-[21px] border p-3.5">
            <View className="h-11 w-11 items-center justify-center rounded-[15px] bg-[#E6F8FD]"><MaterialIcons name={item.icon as never} size={21} color="#0787B4" /></View>
            <View className="mr-3 flex-1"><Text className="text-[13px] font-bold text-foreground text-right">{item.name}</Text><Text className="mt-1 text-[10px] text-muted text-right">{tag} · {item.category}</Text><Text className="mt-1 text-[10px] text-muted text-right">{installedModel ? `مثبت · ${formatBytes(installedModel.size ?? 0)}` : estimatedSize(item.name)}</Text></View>
            {isLlama ? <Pressable onPress={() => item.sourceUrl ? void Linking.openURL(item.sourceUrl) : undefined} className="rounded-full bg-[#E6F8FD] px-2.5 py-1.5"><Text className="text-[10px] font-bold text-[#0787B4]">المصدر</Text></Pressable> : <Pressable onPress={() => void pullModel.mutateAsync({ model: item.modelId })} disabled={pullModel.isPending || Boolean(installedModel)} className="rounded-full bg-[#E6F8FD] px-2.5 py-1.5"><Text className="text-[10px] font-bold text-[#0787B4]">{installedModel ? "مثبت" : pullModel.isPending ? "جارٍ" : "تنزيل"}</Text></Pressable>}
          </Pressable>;
        }}
      />
    </ScreenContainer>
  );
}
