import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image, Pressable, Text, View, type ImageSourcePropType } from "react-native";
import { useAppDrawer } from "@/components/app-drawer";
import { useColors } from "@/hooks/use-colors";

export type IconName = React.ComponentProps<typeof MaterialIcons>["name"];

export function LogoMark({ size = 42 }: { size?: number }) {
  return (
    <Image
      source={require("../assets/images/chatbro-logo-small.png")}
      style={{ width: size, height: size, borderRadius: size * 0.3 }}
      resizeMode="cover"
    />
  );
}

export function BrandHeader({
  eyebrow = "منصة ذكاء اصطناعي موحّدة",
  title = "Chat Bro",
  onPress,
}: {
  eyebrow?: string;
  title?: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  const { openDrawer } = useAppDrawer();
  return (
    <View className="flex-row-reverse items-center justify-between">
      <View className="flex-row-reverse items-center gap-3">
        <LogoMark size={46} />
        <View>
          <Text className="text-[11px] font-semibold tracking-[1.5px] text-primary text-right">{eyebrow}</Text>
          <Text className="mt-0.5 text-[23px] font-extrabold tracking-tight text-foreground text-right">{title}</Text>
        </View>
      </View>
      <View className="flex-row-reverse items-center gap-2">
        <Pressable
          onPress={openDrawer}
          accessibilityRole="button"
          accessibilityLabel="فتح القائمة الجانبية"
          style={({ pressed }) => [
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.72, transform: [{ scale: 0.96 }] },
          ]}
          className="h-11 w-11 items-center justify-center rounded-2xl border"
        >
          <MaterialIcons name="menu" size={24} color={colors.foreground} />
        </Pressable>
        {onPress ? (
          <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel="إجراء الشاشة"
            style={({ pressed }) => [
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.72, transform: [{ scale: 0.96 }] },
            ]}
            className="h-11 w-11 items-center justify-center rounded-2xl border"
          >
            <MaterialIcons name="arrow-forward" size={22} color={colors.foreground} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function SectionHeading({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View className="mb-3 flex-row-reverse items-center justify-between">
      <Text className="text-[17px] font-bold text-foreground text-right">{title}</Text>
      {action ? (
        <Pressable onPress={onAction} style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <Text style={{ color: colors.primary }} className="text-[12px] font-semibold">{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function IconTile({
  icon,
  label,
  tone = "blue",
  onPress,
  compact = false,
}: {
  icon: IconName;
  label: string;
  tone?: "blue" | "purple" | "pink" | "green" | "orange" | "slate";
  onPress?: () => void;
  compact?: boolean;
}) {
  const palette = {
    blue: { bg: "#DDF8FF", ink: "#0787B4" },
    purple: { bg: "#EEE5FF", ink: "#7C4DCE" },
    pink: { bg: "#FFE5EF", ink: "#D65285" },
    green: { bg: "#E0FAEF", ink: "#148A61" },
    orange: { bg: "#FFF0D8", ink: "#C47B16" },
    slate: { bg: "#E8F0F6", ink: "#52728A" },
  }[tone];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        { width: compact ? 78 : 92 },
        pressed && { opacity: 0.72, transform: [{ scale: 0.96 }] },
      ]}
      className="items-center"
    >
      <View style={{ backgroundColor: palette.bg }} className="h-[54px] w-[54px] items-center justify-center rounded-[18px]">
        <MaterialIcons name={icon} size={24} color={palette.ink} />
      </View>
      <Text className="mt-2 text-[11px] font-semibold leading-4 text-muted text-center">{label}</Text>
    </Pressable>
  );
}

export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "full" | "limited" | "trial" | "paid";
}) {
  const styles = {
    full: { bg: "#E4F8EE", ink: "#198C60", dot: "#25B97B" },
    limited: { bg: "#FFF4D8", ink: "#B67812", dot: "#E4A52E" },
    trial: { bg: "#FFE9DF", ink: "#C8623C", dot: "#E2784F" },
    paid: { bg: "#F0EAF7", ink: "#7A5A9E", dot: "#9876BA" },
  }[tone];
  return (
    <View style={{ backgroundColor: styles.bg }} className="flex-row-reverse items-center gap-1.5 self-start rounded-full px-2.5 py-1">
      <View style={{ backgroundColor: styles.dot }} className="h-1.5 w-1.5 rounded-full" />
      <Text style={{ color: styles.ink }} className="text-[10px] font-bold">{label}</Text>
    </View>
  );
}

export function ModelCard({
  name,
  provider,
  icon,
  tone,
  status,
  limit,
  onPress,
}: {
  name: string;
  provider: string;
  icon: IconName;
  tone: "full" | "limited" | "trial" | "paid";
  status: string;
  limit: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && { opacity: 0.75, transform: [{ scale: 0.985 }] },
      ]}
      className="mr-3 w-[214px] rounded-[22px] border p-4"
    >
      <View className="flex-row-reverse items-start justify-between">
        <View className="h-10 w-10 items-center justify-center rounded-[14px] bg-[#E6F8FD]">
          <MaterialIcons name={icon} size={21} color="#0787B4" />
        </View>
        <StatusBadge label={status} tone={tone} />
      </View>
      <Text numberOfLines={1} className="mt-4 text-[14px] font-bold text-foreground text-right">{name}</Text>
      <Text className="mt-0.5 text-[11px] text-muted text-right">{provider}</Text>
      <View className="mt-3 flex-row-reverse items-center justify-between">
        <Text className="text-[10px] text-muted">{limit}</Text>
        <Text className="text-[10px] font-semibold text-primary">آخر تحقق · ٣س</Text>
      </View>
    </Pressable>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: IconName;
  title: string;
  description: string;
}) {
  const colors = useColors();
  return (
    <View className="items-center justify-center rounded-[26px] border border-dashed p-8" style={{ borderColor: colors.border }}>
      <View className="h-14 w-14 items-center justify-center rounded-[20px] bg-[#E7F8FC]">
        <MaterialIcons name={icon} size={28} color={colors.primary} />
      </View>
      <Text className="mt-4 text-[16px] font-bold text-foreground text-center">{title}</Text>
      <Text className="mt-2 max-w-[280px] text-[12px] leading-5 text-muted text-center">{description}</Text>
    </View>
  );
}

export function ProgressLine({ value, color = "#42D9FF" }: { value: number; color?: string }) {
  return (
    <View className="h-1.5 overflow-hidden rounded-full bg-[#DCECF2]">
      <View style={{ width: `${Math.max(0, Math.min(value, 100))}%`, backgroundColor: color }} className="h-full rounded-full" />
    </View>
  );
}

export const appAssets: { hero: ImageSourcePropType; logo: ImageSourcePropType } = {
  hero: require("../assets/images/chatbro-hero.jpg"),
  logo: require("../assets/images/chatbro-logo-small.png"),
};
