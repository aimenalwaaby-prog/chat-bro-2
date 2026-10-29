import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 10 : Math.max(insets.bottom, 8);
  const tabBarHeight = 62 + bottomPadding;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginTop: 1 },
        tabBarStyle: {
          ...(Platform.OS === "web" ? { display: "none" as const } : {}),
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
        name="explore"
        options={{
          title: "استكشاف",
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={22}
              name="safari.fill"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "المحادثة",
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
        name="library"
        options={{
          title: "المكتبة",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="books.vertical.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "حسابي",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="person.crop.circle.fill" color={color} />,
        }}
      />
      <Tabs.Screen name="models" options={{ href: null }} />
      <Tabs.Screen name="model-library" options={{ href: null }} />
      <Tabs.Screen name="local-chat" options={{ href: null }} />
      <Tabs.Screen name="local-models" options={{ href: null }} />
      <Tabs.Screen name="web-sites" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="images" options={{ href: null }} />
      <Tabs.Screen name="model-repositories" options={{ href: null }} />
      <Tabs.Screen name="provider-keys" options={{ href: null }} />
      <Tabs.Screen name="about" options={{ href: null }} />
      <Tabs.Screen name="web-browser" options={{ href: null, tabBarStyle: { display: "none" } }} />
    </Tabs>
  );
}
