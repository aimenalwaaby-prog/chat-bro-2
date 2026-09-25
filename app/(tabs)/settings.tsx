import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { BrandHeader, SectionHeading } from "@/components/chatbro-ui";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { startOAuthLogin } from "@/constants/oauth";
import { checkServerConnection } from "@/lib/_core/api";

export default function SettingsScreen() {
  const colors = useColors();
  const { user, loading, logout } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [server, setServer] = useState<{ ok: boolean; latencyMs: number; url: string } | null>(null);

  useEffect(() => {
    void checkServerConnection().then(setServer);
  }, []);

  return (
    <ScreenContainer className="px-5 pt-4">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        <BrandHeader title="الإعدادات" eyebrow="CHAT BRO" />
        <View className="mt-7 rounded-[25px] bg-[#0C7FA9] p-5">
          <View className="flex-row-reverse items-center justify-between">
            <View className="h-14 w-14 items-center justify-center rounded-[19px] bg-white/20"><MaterialIcons name="person" size={28} color="white" /></View>
            <View className="mr-3 flex-1">
              <Text className="text-[11px] font-semibold text-[#B8F5FF] text-right">ملفك الشخصي</Text>
              <Text className="mt-1 text-[17px] font-extrabold text-white text-right">{loading ? "جارٍ التحقق..." : user?.name || "زائر Chat Bro"}</Text>
              {user?.email ? <Text className="mt-1 text-[11px] text-[#D8FAFF] text-right">{user.email}</Text> : null}
            </View>
            <MaterialIcons name={user ? "verified" : "account-circle"} size={19} color="#8FF4FF" />
          </View>
          {user ? (
            <Pressable onPress={() => void logout()} style={({ pressed }) => [pressed && { opacity: 0.75 }]} className="mt-4 rounded-2xl bg-white/15 px-3 py-2.5"><Text className="text-center text-[11px] font-bold text-white">تسجيل الخروج</Text></Pressable>
          ) : (
            <Pressable onPress={() => void startOAuthLogin()} style={({ pressed }) => [pressed && { opacity: 0.75 }]} className="mt-4 flex-row-reverse items-center justify-center gap-2 rounded-2xl bg-white px-3 py-2.5"><MaterialIcons name="login" size={17} color="#0C7FA9" /><Text className="text-[11px] font-bold text-[#0C7FA9]">تسجيل الدخول عبر الملف الشخصي / Google</Text></Pressable>
          )}
        </View>

        <View className="mt-6 rounded-[22px] border bg-surface p-4" style={{ borderColor: colors.border }}>
          <View className="flex-row-reverse items-center justify-between">
            <View className="flex-row-reverse items-center gap-3">
              <View className={`h-10 w-10 items-center justify-center rounded-2xl ${server?.ok ? "bg-[#E5F8EF]" : "bg-[#FFF0E8]"}`}>
                <MaterialIcons name={server?.ok ? "cloud-done" : "cloud-off"} size={20} color={server?.ok ? "#18885D" : "#C86B45"} />
              </View>
              <View>
                <Text className="text-right text-[12px] font-bold text-foreground">اتصال الخادم</Text>
                <Text className="mt-1 text-right text-[10px] text-muted">{server ? (server.ok ? `متصل · ${server.latencyMs}ms` : "غير متاح حاليًا") : "جارٍ الفحص..."}</Text>
              </View>
            </View>
            <Pressable onPress={() => void checkServerConnection().then(setServer)} className="rounded-xl border px-3 py-2" style={{ borderColor: colors.border }}><Text className="text-[10px] font-bold text-primary">فحص</Text></Pressable>
          </View>
        </View>

        <View className="mt-8"><SectionHeading title="التفضيلات" /><View className="overflow-hidden rounded-[23px] border bg-surface" style={{ borderColor: colors.border }}>
          <View className="flex-row-reverse items-center px-4 py-4"><View className="h-9 w-9 items-center justify-center rounded-[13px] bg-[#E8F5F9]"><MaterialIcons name="notifications-none" size={19} color="#1589AE" /></View><View className="mr-3 flex-1"><Text className="text-[13px] font-bold text-foreground text-right">الإشعارات</Text><Text className="mt-1 text-[10px] text-muted text-right">تنبيهات المهام والنتائج</Text></View><Switch value={notifications} onValueChange={setNotifications} trackColor={{ false: "#DCE7EC", true: "#8BEAF7" }} thumbColor={notifications ? "#0E9BC6" : "#FFFFFF"} /></View>
          <View className="flex-row-reverse items-center border-t px-4 py-4" style={{ borderTopColor: colors.border }}><MaterialIcons name="security" size={19} color="#1589AE" /><Text className="mr-3 flex-1 text-[12px] text-muted text-right">المفاتيح الحساسة تبقى على الخادم ولا تُضمّن في التطبيق.</Text></View>
        </View></View>

        <View className="mt-8"><SectionHeading title="عن Chat Bro" /><View className="rounded-[23px] border bg-surface p-4" style={{ borderColor: colors.border }}><View className="flex-row-reverse items-center justify-between"><Text className="text-[12px] font-semibold text-foreground">الإصدار</Text><Text className="text-[11px] text-muted">0.3.1</Text></View><Text className="mt-5 text-[10px] leading-4 text-muted text-right">تسجيل Google يظهر ضمن بوابة OAuth عند تفعيله فيها؛ لا نضع Client ID أو أي سر داخل APK.</Text></View></View>
      </ScrollView>
    </ScreenContainer>
  );
}
