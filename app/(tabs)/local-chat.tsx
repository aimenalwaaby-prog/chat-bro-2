import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { BrandHeader, StatusBadge } from "@/components/chatbro-ui";
import { useColors } from "@/hooks/use-colors";
import { completeLocal, getDeviceProfile, listInstalledLocalModels, type InstalledLocalModel } from "@/lib/local-runtime";

type Message = { id: string; role: "user" | "assistant"; text: string };
const key = (id: string) => `chatbro:local-conversation:${encodeURIComponent(id)}`;

export default function LocalChatScreen() {
  const colors = useColors();
  const router = useRouter();
  const [models, setModels] = useState<InstalledLocalModel[]>([]);
  const [selected, setSelected] = useState<InstalledLocalModel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const device = useMemo(() => getDeviceProfile(), []);

  const refresh = useCallback(async () => {
    const installed = await listInstalledLocalModels();
    setModels(installed);
    if (!selected || !installed.some((m) => m.id === selected.id)) setSelected(installed[0] ?? null);
  }, [selected]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!selected) return;
    AsyncStorage.getItem(key(selected.id)).then((raw) => setMessages(raw ? JSON.parse(raw) : [{ id: "welcome", role: "assistant", text: `هذه محادثة محلية مستقلة مع ${selected.name}. لا تُرسل رسائلك إلى OpenRouter أو Render.` }]));
  }, [selected]);
  useEffect(() => { if (selected && messages.length) void AsyncStorage.setItem(key(selected.id), JSON.stringify(messages)); }, [messages, selected]);

  const send = async () => {
    const text = input.trim();
    if (!text || !selected || busy) return;
    setInput("");
    const next = [...messages, { id: `${Date.now()}`, role: "user" as const, text }];
    setMessages(next);
    setBusy(true);
    try {
      const reply = await completeLocal(selected, [
        { role: "system", content: "أنت مساعد محلي داخل Chat Bro. لا تدّعي الوصول إلى الإنترنت أو المعلومات الحديثة. إذا احتاج السؤال معلومات بعد معرفتك التدريبية، صرّح بذلك بوضوح." },
        ...next.map((m) => ({ role: m.role, content: m.text })),
      ]);
      setMessages((current) => [...current, { id: `${Date.now()}-reply`, role: "assistant", text: reply || "لم يُنتج النموذج ردًا." }]);
    } catch (error) {
      Alert.alert("تعذر تشغيل النموذج", error instanceof Error ? error.message : "فشل تشغيل النموذج محليًا.");
    } finally { setBusy(false); }
  };

  return <ScreenContainer className="px-5 pt-4" edges={["top", "left", "right"]}>
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 24} className="flex-1">
      <BrandHeader title="المحادثة المحلية" eyebrow="ON-DEVICE AI" onPress={() => router.push("/(tabs)/local-models")} />
      <View className="mt-3 rounded-2xl border bg-surface p-3" style={{ borderColor: colors.border }}>
        <View className="flex-row-reverse items-center justify-between"><StatusBadge label="محلي 100%" tone="full" /><Text className="text-[10px] text-muted">RAM ≈ {device.totalMemoryGb.toFixed(1)}GB</Text></View>
        <Text className="mt-2 text-[10px] text-muted text-right">المعالجة تتم على الهاتف عبر llama.cpp، ولا تمر الرسائل عبر الخادم.</Text>
      </View>
      <View className="mt-3 flex-row-reverse gap-2">
        {models.map((m) => <Pressable key={m.id} onPress={() => setSelected(m)} className="rounded-full border px-3 py-2" style={{ borderColor: m.id === selected?.id ? colors.primary : colors.border, backgroundColor: m.id === selected?.id ? colors.primary : colors.surface }}><Text className="text-[10px] font-bold text-foreground">{m.name}</Text></Pressable>)}
      </View>
      {!selected ? <View className="flex-1 items-center justify-center"><Text className="text-[14px] font-bold text-foreground">لا يوجد نموذج محلي بعد</Text><Text className="mt-2 text-[11px] text-muted">نزّل أول نموذج من قسم النماذج المحلية.</Text><Pressable onPress={() => router.push("/(tabs)/local-models")} className="mt-4 rounded-full bg-primary px-4 py-2"><Text className="font-bold text-[#062034]">تنزيل نموذج</Text></Pressable></View> : <>
        <FlatList data={messages} keyExtractor={(m) => m.id} className="mt-3 flex-1" contentContainerStyle={{ gap: 9, paddingVertical: 8 }} renderItem={({ item }) => <View className={item.role === "user" ? "self-end max-w-[88%] rounded-2xl bg-primary px-3 py-2" : "self-start max-w-[92%] rounded-2xl border bg-surface px-3 py-2"} style={item.role === "assistant" ? { borderColor: colors.border } : undefined}><Text className="text-[12px] leading-5 text-foreground">{item.text}</Text></View>} />
        <View className="mt-2 flex-row-reverse items-end gap-2"><TextInput value={input} onChangeText={setInput} multiline placeholder="اكتب للنموذج المحلي..." placeholderTextColor={colors.muted} className="min-h-[46px] max-h-[110px] flex-1 rounded-2xl border bg-surface px-3 py-2 text-right text-[12px] text-foreground" style={{ borderColor: colors.border }} /><Pressable onPress={() => void send()} disabled={busy || !input.trim()} className="h-[46px] w-[46px] items-center justify-center rounded-full bg-primary">{busy ? <ActivityIndicator /> : <MaterialIcons name="send" size={19} color="#062034" />}</Pressable></View>
      </>}
    </KeyboardAvoidingView>
  </ScreenContainer>;
}
