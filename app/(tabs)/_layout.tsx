import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { useEffect, useState } from "react";
import { listInstalledLocalModels } from "@/lib/local-runtime";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 10 : Math.max(insets.bottom, 8);
  const tabBarHeight = 62 + bottomPadding;
  const [hasLocalModels, setHasLocalModels] = useState(false);
  useEffect(() => { let active = true; listInstalledLocalModels().then((items) => active && setHasLocalModels(items.length > 0)); return () => { active = false; }; }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginTop: 1 },
        tabBarStyle: {
          paddingTop: 7,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "الرئيسية",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={22} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "محادثة",
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={22}
              name="bubble.left.and.bubble.right.fill"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="models"
        options={{
          title: "النماذج",
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={22}
              name="square.stack.3d.up.fill"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="local-chat"
        options={{
          href: hasLocalModels ? "/local-chat" : null,
          title: "محادثة محلية",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="bubble.left.and.bubble.right.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="local-models"
        options={{
          title: hasLocalModels ? "محلي" : "تنزيل محلي",
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={22}
              name="square.stack.3d.up.fill"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="web-sites"
        options={{
          title: "مواقع AI",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={22} name="globe" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "الإعدادات",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={22} name="gearshape.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
