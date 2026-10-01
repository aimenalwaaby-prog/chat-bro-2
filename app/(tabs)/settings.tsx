import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Linking, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { BrandHeader, SectionHeading } from "@/components/chatbro-ui";
import { useColors } from "@/hooks/use-colors";
import { checkServerConnection } from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { chatBroModels, isModelAvailableToSelect } from "@/shared/chatbro-catalog";

const profileTypes = ["طالب", "مطور", "باحث", "صانع محتوى", "مستخدم عام"];
const providerFlags = [
  { key: "builtInLLM", label: "الخادم المدمج" },
  { key: "openrouter", label: "OpenRouter" },
  { key: "anthropic", label: "Anthropic" },
  { key: "gateway", label: "بوابات النماذج" },
  { key: "forgeImages", label: "Forge · إنشاء الصور" },
];

export default function SettingsScreen() {
  const colors = useColors();
  const [profile, setProfile] = useState<Auth.LocalProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [profileType, setProfileType] = useState(profileTypes[4]);
  const [favoriteModels, setFavoriteModels] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [notifications, setNotifications] = useState(true);
  const [server, setServer] = useState<{ ok: boolean; latencyMs: number; url: string; capabilities?: Record<string, boolean> } | null>(null);

  const openContactLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("تعذر فتح الرابط", "تأكد من توفر تطبيق مناسب على جهازك ثم حاول مرة أخرى.");
    }
  };

  useEffect(() => {
    void Auth.getLocalProfile().then((saved) => {
      setProfile(saved);
      if (saved) {
        setName(saved.name);
        setProfileType(saved.profileType);
        setFavoriteModels(saved.favoriteModels);
        setBio(saved.bio);
        setImageUri(saved.imageUri);
      }
    });
    void checkServerConnection().then(setServer);
  }, []);

  const selectedModelsLabel = useMemo(
    () => favoriteModels.length ? favoriteModels.join("، ") : "لم تختر نماذج بعد",
    [favoriteModels],
  );

  const startEditing = () => {
    if (profile) {
      setName(profile.name);
      setProfileType(profile.profileType);
      setFavoriteModels(profile.favoriteModels);
      setBio(profile.bio);
      setImageUri(profile.imageUri);
    }
    setEditing(true);
  };

  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("الصلاحية مطلوبة", "اسمح للتطبيق بالوصول إلى الصور لاختيار صورة الملف الشخصي.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
    });
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  };

  const toggleFavorite = (model: string) => {
    setFavoriteModels((current) => current.includes(model)
      ? current.filter((item) => item !== model)
      : [...current, model].slice(-5));
  };

  const saveProfile = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      Alert.alert("الاسم مطلوب", "اكتب اسمًا لملفك الشخصي أولًا.");
      return;
    }
    const now = new Date().toISOString();
    const next: Auth.LocalProfile = {
      id: profile?.id ?? `local-${Date.now()}`,
      name: cleanName,
      profileType,
      favoriteModels,
      bio: bio.trim(),
      imageUri,
      createdAt: profile?.createdAt ?? now,
      updatedAt: now,
    };
    await Auth.saveLocalProfile(next);
    setProfile(next);
    setEditing(false);
  };

  const clearProfile = () => {
    Alert.alert("حذف الملف المحلي؟", "سيتم حذف بيانات الملف الشخصي فقط، ولن تُحذف المحادثات.", [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => void (async () => {
        await Auth.clearLocalProfile();
        setProfile(null);
        setName("");
        setProfileType(profileTypes[4]);
        setFavoriteModels([]);
        setBio("");
        setImageUri(null);
        setEditing(false);
      })() },
    ]);
  };

  return (
    <ScreenContainer className="px-5 pt-4">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        <BrandHeader title="الإعدادات" eyebrow="CHAT BRO" />
        <View className="mt-7 rounded-[25px] bg-[#0C7FA9] p-5">
          <View className="flex-row-reverse items-center">
            {profile?.imageUri ? (
              <Image source={{ uri: profile.imageUri }} className="h-14 w-14 rounded-[19px]" />
            ) : (
              <View className="h-14 w-14 items-center justify-center rounded-[19px] bg-white/20"><MaterialIcons name="person" size={28} color="white" /></View>
            )}
            <View className="mr-3 flex-1">
              <Text className="text-[11px] font-semibold text-[#B8F5FF] text-right">ملف محلي على جهازك</Text>
              <Text className="mt-1 text-[17px] font-extrabold text-white text-right">{profile?.name || "أنشئ ملفك الشخصي"}</Text>
              {profile ? <Text className="mt-1 text-[11px] text-[#D8FAFF] text-right">{profile.profileType} · {selectedModelsLabel}</Text> : null}
            </View>
            <MaterialIcons name={profile ? "verified-user" : "account-circle"} size={19} color="#8FF4FF" />
          </View>
          <Text className="mt-4 text-right text-[10px] leading-4 text-[#D8FAFF]">بيانات الملف الشخصي اختيارية، وتُحفظ محليًا على هذا الجهاز فقط.</Text>
          <Pressable onPress={profile ? startEditing : () => setEditing(true)} className="mt-4 rounded-2xl bg-white px-3 py-2.5">
            <Text className="text-center text-[11px] font-bold text-[#0C7FA9]">{profile ? "تعديل الملف الشخصي" : "إنشاء ملف شخصي محلي"}</Text>
          </Pressable>
        </View>

        {editing ? (
          <View className="mt-6 rounded-[22px] border bg-surface p-4" style={{ borderColor: colors.border }}>
            <SectionHeading title="بيانات الملف" />
            <Pressable onPress={() => void choosePhoto()} className="mb-4 flex-row-reverse items-center justify-center gap-2 rounded-2xl border py-3" style={{ borderColor: colors.border }}>
              {imageUri ? <Image source={{ uri: imageUri }} className="h-10 w-10 rounded-xl" /> : <MaterialIcons name="add-a-photo" size={20} color={colors.primary} />}
              <Text className="text-[11px] font-bold text-primary">{imageUri ? "تغيير صورة الملف" : "إضافة صورة للملف"}</Text>
            </Pressable>
            <TextInput value={name} onChangeText={setName} placeholder="الاسم" placeholderTextColor={colors.muted} className="mb-3 rounded-2xl border px-4 py-3 text-right text-[13px] text-foreground" style={{ borderColor: colors.border, writingDirection: "rtl" }} />
            <TextInput value={bio} onChangeText={setBio} placeholder="نبذة قصيرة (اختياري)" placeholderTextColor={colors.muted} multiline className="mb-3 min-h-[70px] rounded-2xl border px-4 py-3 text-right text-[13px] text-foreground" style={{ borderColor: colors.border, writingDirection: "rtl" }} />
            <Text className="mb-2 text-right text-[11px] font-bold text-foreground">نوع الاستخدام</Text>
            <View className="mb-4 flex-row-reverse flex-wrap gap-2">
              {profileTypes.map((type) => <Pressable key={type} onPress={() => setProfileType(type)} className="rounded-full border px-3 py-2" style={{ borderColor: type === profileType ? colors.primary : colors.border, backgroundColor: type === profileType ? "#E6F8FD" : colors.surface }}><Text className="text-[10px] font-semibold text-foreground">{type}</Text></Pressable>)}
            </View>
            <Text className="mb-2 text-right text-[11px] font-bold text-foreground">النماذج المفضلة (حتى 5)</Text>
            <View className="mb-4 flex-row-reverse flex-wrap gap-2">
              {chatBroModels.filter((model) => isModelAvailableToSelect(model, server?.capabilities)).map((model) => <Pressable key={model.name} onPress={() => toggleFavorite(model.name)} className="rounded-full border px-3 py-2" style={{ borderColor: favoriteModels.includes(model.name) ? colors.primary : colors.border, backgroundColor: favoriteModels.includes(model.name) ? "#E6F8FD" : colors.surface }}><Text className="text-[10px] font-semibold text-foreground">{model.name}</Text></Pressable>)}
            </View>
            <View className="flex-row-reverse gap-2">
              <Pressable onPress={() => void saveProfile()} className="flex-1 rounded-2xl bg-primary px-3 py-3"><Text className="text-center text-[11px] font-bold text-[#062034]">حفظ الملف</Text></Pressable>
              <Pressable onPress={() => setEditing(false)} className="rounded-2xl border px-4 py-3" style={{ borderColor: colors.border }}><Text className="text-[11px] font-bold text-muted">إلغاء</Text></Pressable>
            </View>
            {profile ? <Pressable onPress={clearProfile} className="mt-3"><Text className="text-center text-[10px] text-red-500">حذف الملف المحلي</Text></Pressable> : null}
          </View>
        ) : null}

        <View className="mt-6 rounded-[22px] border bg-surface p-4" style={{ borderColor: colors.border }}>
          <View className="flex-row-reverse items-center justify-between">
            <View className="flex-row-reverse items-center gap-3"><View className={`h-10 w-10 items-center justify-center rounded-2xl ${server?.ok ? "bg-[#E5F8EF]" : "bg-[#FFF0E8]"}`}><MaterialIcons name={server?.ok ? "cloud-done" : "cloud-off"} size={20} color={server?.ok ? "#18885D" : "#C86B45"} /></View><View><Text className="text-right text-[12px] font-bold text-foreground">اتصال الخادم</Text><Text className="mt-1 text-right text-[10px] text-muted">{server ? (server.ok ? `متصل · ${server.latencyMs}ms` : "غير متاح حاليًا") : "جارٍ الفحص..."}</Text></View></View>
            <Pressable onPress={() => void checkServerConnection().then(setServer)} className="rounded-xl border px-3 py-2" style={{ borderColor: colors.border }}><Text className="text-[10px] font-bold text-primary">فحص</Text></Pressable>
          </View>
          {server?.capabilities ? <>
            <View className="mt-3 flex-row-reverse flex-wrap gap-2">
              {providerFlags.map(({ key, label }) => {
                const configured = Boolean(server.capabilities?.[key]);
                return <View key={key} className="rounded-full border px-3 py-2" style={{ borderColor: configured ? "#A6DEC6" : colors.border, backgroundColor: configured ? "#E8F8EE" : colors.surface }}><Text className="text-[10px] font-semibold" style={{ color: configured ? "#176B3D" : colors.muted }}>{label} · {configured ? "مهيأ" : "غير مهيأ"}</Text></View>;
              })}
            </View>
            <Text className="mt-2 text-right text-[9px] leading-4 text-muted">تعكس العلامات وجود إعدادات الخادم فقط، ولا تكشف المفاتيح أو تؤكد صلاحيتها. مسار Forge للصور منفصل عن مفتاح النماذج النصية.</Text>
          </> : null}
        </View>

        <View className="mt-6 rounded-[22px] border bg-surface p-4" style={{ borderColor: colors.border }}>
          <SectionHeading title="تواصل مع المطور" />
          <Text className="mt-2 text-right text-[10px] leading-5 text-muted">للاستفسارات أو الملاحظات، يمكنك التواصل مباشرة عبر واتساب أو البريد الإلكتروني.</Text>
          <View className="mt-3 gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="التواصل مع المطور عبر واتساب"
              onPress={() => void openContactLink("https://wa.me/967784755343")}
              className="flex-row-reverse items-center rounded-2xl bg-[#E8F8EE] px-4 py-3"
            >
              <MaterialIcons name="chat" size={21} color="#168A4A" />
              <View className="mr-3 flex-1">
                <Text className="text-right text-[12px] font-bold text-[#176B3D]">واتساب</Text>
                <Text className="mt-1 text-right text-[10px] text-[#37845A]">784755343</Text>
              </View>
              <MaterialIcons name="open-in-new" size={17} color="#37845A" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="إرسال بريد إلكتروني إلى المطور"
              onPress={() => void openContactLink("mailto:aimenalwwaby@gmail.com")}
              className="flex-row-reverse items-center rounded-2xl bg-[#EAF5FB] px-4 py-3"
            >
              <MaterialIcons name="email" size={21} color="#147BA5" />
              <View className="mr-3 flex-1">
                <Text className="text-right text-[12px] font-bold text-[#145F7D]">البريد الإلكتروني</Text>
                <Text className="mt-1 text-right text-[10px] text-[#397C97]">aimenalwwaby@gmail.com</Text>
              </View>
              <MaterialIcons name="open-in-new" size={17} color="#397C97" />
            </Pressable>
          </View>
        </View>

        <View className="mt-8"><SectionHeading title="التفضيلات" /><View className="overflow-hidden rounded-[23px] border bg-surface" style={{ borderColor: colors.border }}><View className="flex-row-reverse items-center px-4 py-4"><View className="h-9 w-9 items-center justify-center rounded-[13px] bg-[#E8F5F9]"><MaterialIcons name="notifications-none" size={19} color="#1589AE" /></View><View className="mr-3 flex-1"><Text className="text-[13px] font-bold text-foreground text-right">الإشعارات</Text><Text className="mt-1 text-[10px] text-muted text-right">تنبيهات المهام والنتائج</Text></View><Switch value={notifications} onValueChange={setNotifications} trackColor={{ false: "#DCE7EC", true: "#8BEAF7" }} thumbColor={notifications ? "#0E9BC6" : "#FFFFFF"} /></View><View className="flex-row-reverse items-center border-t px-4 py-4" style={{ borderTopColor: colors.border }}><MaterialIcons name="security" size={19} color="#1589AE" /><Text className="mr-3 flex-1 text-[12px] text-muted text-right">المفاتيح الحساسة تبقى على الخادم ولا تُضمّن في التطبيق.</Text></View></View></View>
      </ScrollView>
    </ScreenContainer>
  );
}
