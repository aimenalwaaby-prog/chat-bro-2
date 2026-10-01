import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { BrandHeader } from "@/components/chatbro-ui";
import { useColors } from "@/hooks/use-colors";
import { aiWebSites, type AiWebSite } from "@/shared/chatbro-web-sites";

const categories = ["الكل", "محادثة", "برمجة وتطبيقات", "بحث وتعليم", "صور وفيديو", "صوت وموسيقى"];
export default function WebSitesScreen() {
  const colors = useColors(); const router = useRouter(); const [category, setCategory] = useState("الكل");
  const data = useMemo(() => category === "الكل" ? aiWebSites : aiWebSites.filter((site) => site.category === category), [category]);
  return <ScreenContainer className="px-5 pt-4"><BrandHeader title="مواقع AI" eyebrow="WEB AI DIRECTORY" /><Text className="mt-7 text-right text-[25px] font-extrabold text-foreground">أدوات جاهزة على الويب.</Text><Text className="mt-2 text-right text-[12px] leading-5 text-muted">روابط مصنفة حسب الاستخدام والقوة والتكلفة. افتح الموقع بأمان داخل متصفح Chat Bro.</Text><FlatList horizontal data={categories} keyExtractor={(item) => item} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 16 }} renderItem={({ item }) => <Pressable onPress={() => setCategory(item)} className={`rounded-full px-3 py-2 ${category === item ? "bg-[#102F43]" : "bg-surface"}`}><Text className={`text-[10px] font-bold ${category === item ? "text-white" : "text-muted"}`}>{item}</Text></Pressable>} /><FlatList data={data} keyExtractor={(item) => item.url} contentContainerStyle={{ gap: 10, paddingBottom: 32 }} renderItem={({ item }) => <SiteCard site={item} colors={colors} onOpen={() => router.push({ pathname: "/(tabs)/web-browser", params: { url: item.url, title: item.name } })} />} /></ScreenContainer>;
}
function SiteCard({ site, colors, onOpen }: { site: AiWebSite; colors: ReturnType<typeof useColors>; onOpen: () => void }) { return <View className="rounded-[20px] border bg-surface p-4" style={{ borderColor: colors.border }}><View className="flex-row-reverse items-start justify-between gap-3"><View className="flex-1"><Text className="text-right text-[14px] font-extrabold text-foreground">{site.name}</Text><Text className="mt-1 text-right text-[10px] leading-4 text-muted">{site.description}</Text></View><Text className={`rounded-full px-2 py-1 text-[9px] font-bold ${site.access === "مجاني" ? "bg-[#E5F8EF] text-[#168455]" : "bg-[#FFF4D8] text-[#A36A00]"}`}>{site.access}</Text></View><View className="mt-3 flex-row-reverse items-center justify-between"><Text className="text-[10px] text-muted">القوة {"★".repeat(site.strength)}{"☆".repeat(5 - site.strength)}</Text><Pressable onPress={onOpen} className="flex-row-reverse items-center gap-1 rounded-full bg-[#E6F8FD] px-3 py-2"><MaterialIcons name="web" size={14} color="#0787B4" /><Text className="text-[10px] font-bold text-[#0787B4]">فتح داخل التطبيق</Text></Pressable></View></View>; }
