import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, BackHandler, Dimensions, PanResponder, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/use-colors";
import { loadModelPreferences, type ModelPreferences, type ModelShortcut } from "@/lib/model-preferences";

const DrawerContext = createContext<{ openDrawer: () => void }>({ openDrawer: () => undefined });

export function useAppDrawer() {
  return useContext(DrawerContext);
}

export function AppDrawerShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const width = Dimensions.get("window").width;
  const drawerWidth = Math.min(360, Math.max(280, width * 0.86));
  const [open, setOpen] = useState(false);
  const [preferences, setPreferences] = useState<ModelPreferences>({ favorites: [], usage: [] });
  const openRef = useRef(false);
  const translateX = useRef(new Animated.Value(drawerWidth)).current;

  const openDrawer = useCallback(() => {
    openRef.current = true;
    setOpen(true);
    void loadModelPreferences().then(setPreferences);
  }, []);
  const closeDrawer = useCallback(() => {
    openRef.current = false;
    setOpen(false);
  }, []);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_event, gesture) => {
      const horizontal = Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25;
      if (!horizontal) return false;
      return openRef.current ? gesture.dx > 18 : gesture.x0 > width - 30 && gesture.dx < -18;
    },
    onPanResponderRelease: (_event, gesture) => {
      if (openRef.current && gesture.dx > 70) closeDrawer();
      else if (!openRef.current && gesture.x0 > width - 30 && gesture.dx < -70) openDrawer();
    },
    onPanResponderTerminationRequest: () => false,
  }), [closeDrawer, openDrawer, width]);

  useEffect(() => {
    translateX.setValue(drawerWidth);
  }, [drawerWidth, translateX]);
  useEffect(() => {
    Animated.spring(translateX, {
      toValue: open ? 0 : drawerWidth,
      useNativeDriver: true,
      damping: 24,
      stiffness: 240,
      mass: 0.8,
    }).start();
  }, [drawerWidth, open, translateX]);
  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      closeDrawer();
      return true;
    });
    return () => subscription.remove();
  }, [closeDrawer, open]);

  const navigate = useCallback((path: string) => {
    closeDrawer();
    router.push(path as never);
  }, [closeDrawer, router]);

  const openModel = useCallback((model: ModelShortcut) => {
    closeDrawer();
    if (model.route === "images") {
      router.push({ pathname: "/(tabs)/images" as never, params: { model: model.id } as never });
    } else if (model.route === "local") {
      router.push("/(tabs)/local-models" as never);
    } else {
      router.push({ pathname: "/(tabs)/chat" as never, params: { model: model.name, ...(model.id ? { directModel: model.id } : {}) } as never });
    }
  }, [closeDrawer, router]);

  const shortcut = (model: ModelShortcut, trailing?: string) => (
    <Pressable key={model.id} onPress={() => openModel(model)} className="mb-1 flex-row-reverse items-center rounded-xl px-2.5 py-2.5" style={({ pressed }) => [{ backgroundColor: pressed ? colors.surface : "transparent" }]}>
      <MaterialIcons name={model.route === "images" ? "image" : model.route === "local" ? "smart-toy" : "psychology"} size={18} color={colors.primary} />
      <View className="mr-2 flex-1">
        <Text numberOfLines={1} className="text-right text-[12px] font-semibold text-foreground">{model.name}</Text>
        <Text numberOfLines={1} className="mt-0.5 text-right text-[10px] text-muted">{model.provider}{trailing ? ` · ${trailing}` : ""}</Text>
      </View>
      <MaterialIcons name="chevron-left" size={17} color={colors.muted} />
    </Pressable>
  );

  return (
    <DrawerContext.Provider value={{ openDrawer }}>
      <View {...panResponder.panHandlers} style={{ flex: 1 }}>
        {children}
        {open ? (
          <View pointerEvents="box-none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="إغلاق القائمة الجانبية" onPress={closeDrawer} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(2, 14, 24, 0.54)" }} />
          </View>
        ) : null}
        <Animated.View
          pointerEvents={open ? "auto" : "none"}
          accessibilityViewIsModal={open}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: drawerWidth, zIndex: 1001, backgroundColor: colors.background, borderLeftColor: colors.border, borderLeftWidth: 1, transform: [{ translateX }] }}
        >
          <View style={{ paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 12), flex: 1 }}>
            <View className="mb-3 flex-row-reverse items-center justify-between px-5 pb-3" style={{ borderBottomColor: colors.border, borderBottomWidth: 1 }}>
              <View className="flex-row-reverse items-center gap-2">
                <View className="h-10 w-10 items-center justify-center rounded-[14px] bg-[#DDF8FF]"><MaterialIcons name="smart-toy" size={23} color="#0787B4" /></View>
                <View><Text className="text-right text-[16px] font-extrabold text-foreground">Chat Bro</Text><Text className="text-right text-[10px] text-muted">القائمة الرئيسية</Text></View>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="إغلاق القائمة" onPress={closeDrawer} className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: colors.surface }}><MaterialIcons name="close" size={21} color={colors.foreground} /></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
              <Text className="mb-2 px-2 text-right text-[11px] font-extrabold text-primary">المفضلة</Text>
              {preferences.favorites.length ? preferences.favorites.slice(0, 8).map((model) => shortcut(model)) : <Text className="mb-3 px-2 text-right text-[11px] leading-5 text-muted">أضف نماذجك المفضلة من صفحة النماذج لتظهر هنا.</Text>}

              <Text className="mb-2 mt-3 px-2 text-right text-[11px] font-extrabold text-primary">الأكثر استخدامًا</Text>
              {preferences.usage.length ? preferences.usage.slice(0, 5).map((model) => shortcut(model, `${model.count} استخدام`)) : <Text className="mb-3 px-2 text-right text-[11px] leading-5 text-muted">ستظهر النماذج هنا بعد استخدامها في المحادثات.</Text>}

              <Text className="mb-2 mt-3 px-2 text-right text-[11px] font-extrabold text-primary">التطبيق</Text>
              <DrawerLink icon="chat" label="محادثة جديدة" onPress={() => navigate("/(tabs)/chat")} colors={colors} />
              <DrawerLink icon="widgets" label="النماذج وتصنيفاتها" onPress={() => navigate("/(tabs)/models")} colors={colors} />
              <DrawerLink icon="image" label="إنشاء الصور" onPress={() => navigate("/(tabs)/images")} colors={colors} />
              <DrawerLink icon="smart-toy" label="النماذج المحلية" onPress={() => navigate("/(tabs)/local-models")} colors={colors} />
              <DrawerLink icon="language" label="أدوات الويب" onPress={() => navigate("/(tabs)/web-sites")} colors={colors} />
              <DrawerLink icon="settings" label="إعدادات التطبيق" onPress={() => navigate("/(tabs)/settings")} colors={colors} />
              <DrawerLink icon="info-outline" label="حول التطبيق" onPress={() => navigate("/(tabs)/about")} colors={colors} />
              <View className="mt-4 rounded-2xl border p-3" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
                <Text className="text-right text-[10px] leading-5 text-muted">تُحفظ المفضلة وسجل الاستخدام على هذا الجهاز. تتطلب النماذج السحابية اتصالًا ومفتاح مزود مهيأ على الخادم.</Text>
              </View>
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </DrawerContext.Provider>
  );
}

function DrawerLink({ icon, label, onPress, colors }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; label: string; onPress: () => void; colors: ReturnType<typeof useColors> }) {
  return (
    <Pressable onPress={onPress} className="mb-1 flex-row-reverse items-center rounded-xl px-2.5 py-3" style={({ pressed }) => [{ backgroundColor: pressed ? colors.surface : "transparent" }]}>
      <MaterialIcons name={icon} size={19} color={colors.foreground} />
      <Text className="mr-3 flex-1 text-right text-[12px] font-semibold text-foreground">{label}</Text>
      <MaterialIcons name="chevron-left" size={17} color={colors.muted} />
    </Pressable>
  );
}
