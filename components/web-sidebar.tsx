import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Link, usePathname } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";

const navigation = [
  { href: "/", label: "الرئيسية", icon: "home" as const },
  { href: "/chat", label: "المحادثة", icon: "chat" as const },
  { href: "/models", label: "النماذج", icon: "widgets" as const },
  { href: "/local-models", label: "النماذج المحلية", icon: "smart-toy" as const },
  { href: "/images", label: "إنشاء الصور", icon: "image" as const },
  { href: "/web-sites", label: "أدوات الويب", icon: "language" as const },
  { href: "/settings", label: "الإعدادات", icon: "settings" as const },
];

export function WebSidebar() {
  const colors = useColors();
  const pathname = usePathname();
  return (
    <View style={{ width: 248, borderLeftWidth: 1, borderLeftColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 18, paddingTop: 28, paddingBottom: 20 }}>
      <View className="mb-8 flex-row-reverse items-center px-2">
        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#DDF8FF]"><MaterialIcons name="smart-toy" size={25} color="#0787B4" /></View>
        <View className="mr-3"><Text className="text-right text-[17px] font-extrabold text-foreground">Chat Bro</Text><Text className="mt-0.5 text-right text-[10px] text-muted">مساحة ذكاء اصطناعي</Text></View>
      </View>
      <Text className="mb-3 px-2 text-right text-[10px] font-bold text-muted">مساحة العمل</Text>
      {navigation.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href as never} asChild>
            <Pressable className="mb-1 flex-row-reverse items-center rounded-xl px-3 py-3" style={({ pressed }) => [{ backgroundColor: active ? "#DDF8FF" : pressed ? colors.background : "transparent" }]}>
              <MaterialIcons name={item.icon} size={20} color={active ? colors.primary : colors.muted} />
              <Text className="mr-3 flex-1 text-right text-[12px] font-semibold" style={{ color: active ? colors.primary : colors.foreground }}>{item.label}</Text>
              {active ? <View className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
            </Pressable>
          </Link>
        );
      })}
      <View className="mt-auto rounded-2xl border p-3" style={{ borderColor: colors.border, backgroundColor: colors.background }}>
        <Text className="text-right text-[10px] font-bold text-foreground">نسخة الويب الكاملة</Text>
        <Text className="mt-1 text-right text-[9px] leading-4 text-muted">المحادثة والنماذج والصور والبحث والإعدادات تعمل من مساحة واحدة.</Text>
      </View>
    </View>
  );
}
