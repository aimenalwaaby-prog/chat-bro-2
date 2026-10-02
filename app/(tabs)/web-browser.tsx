import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from "react-native";
import WebView, { type WebViewNavigation } from "react-native-webview";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

const BrowserView = WebView as any;

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export default function WebBrowserScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string; title?: string }>();
  const initialUrl = normalizeUrl(String(params.url ?? "https://chatgpt.com"));
  const [url, setUrl] = useState(initialUrl);
  const [address, setAddress] = useState(initialUrl);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [translated, setTranslated] = useState(false);
  const webView = useRef<any>(null);

  if (Platform.OS === "web") {
    return <ScreenContainer className="px-5 pt-4"><Text className="text-right text-[14px] font-bold text-foreground">المتصفح الداخلي متاح في تطبيق Android</Text><Text className="mt-2 text-right text-[11px] text-muted">على الويب افتح الرابط من المتصفح العادي.</Text></ScreenContainer>;
  }

  const navigate = () => {
    const next = normalizeUrl(address);
    setAddress(next);
    setUrl(next);
  };
  const onNavigation = (state: WebViewNavigation) => {
    setAddress(state.url);
    setCanGoBack(state.canGoBack);
    setCanGoForward(state.canGoForward);
  };
  const toggleTranslation = () => {
    const current = normalizeUrl(address);
    if (translated) {
      setTranslated(false);
      setUrl(current.replace(/^https:\/\/translate\.google\.com\/translate\?sl=auto&tl=ar&u=/, ""));
      return;
    }
    setTranslated(true);
    setUrl(`https://translate.google.com/translate?sl=auto&tl=ar&u=${encodeURIComponent(current)}`);
  };

  return <ScreenContainer className="pt-3" edges={["top", "left", "right"]}>
    <View className="flex-row-reverse items-center px-4"><Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full border" style={{ borderColor: colors.border }}><MaterialIcons name="close" size={20} color={colors.foreground} /></Pressable><Text numberOfLines={1} className="mr-3 flex-1 text-right text-[16px] font-extrabold text-foreground">{String(params.title ?? "متصفح Chat Bro")}</Text></View>
    <View className="mx-4 mt-3 flex-row-reverse items-center rounded-2xl border bg-surface px-2" style={{ borderColor: colors.border }}><Pressable onPress={navigate} className="h-10 w-10 items-center justify-center"><MaterialIcons name="arrow-forward" size={19} color={colors.primary} /></Pressable><TextInput value={address} onChangeText={setAddress} onSubmitEditing={navigate} autoCapitalize="none" autoCorrect={false} keyboardType="url" className="h-10 flex-1 px-2 text-right text-[11px] text-foreground" style={{ writingDirection: "ltr" }} /><Pressable onPress={() => webView.current?.reload()} className="h-10 w-10 items-center justify-center"><MaterialIcons name="refresh" size={19} color={colors.muted} /></Pressable></View>
    <View className="mx-4 mt-2 flex-row-reverse items-center justify-between"><View className="flex-row-reverse items-center gap-2"><Pressable disabled={!canGoForward} onPress={() => webView.current?.goForward()} className="h-8 w-8 items-center justify-center rounded-full border" style={{ borderColor: colors.border, opacity: canGoForward ? 1 : 0.35 }}><MaterialIcons name="chevron-left" size={18} color={colors.foreground} /></Pressable><Pressable disabled={!canGoBack} onPress={() => webView.current?.goBack()} className="h-8 w-8 items-center justify-center rounded-full border" style={{ borderColor: colors.border, opacity: canGoBack ? 1 : 0.35 }}><MaterialIcons name="chevron-right" size={18} color={colors.foreground} /></Pressable><Pressable onPress={toggleTranslation} className="h-8 flex-row-reverse items-center gap-1 rounded-full border px-2" style={{ borderColor: colors.border }}><MaterialIcons name="translate" size={15} color={translated ? colors.primary : colors.muted} /><Text className="text-[9px] font-bold" style={{ color: translated ? colors.primary : colors.muted }}>{translated ? "العربية" : "ترجمة"}</Text></Pressable></View>{loading ? <View className="flex-row-reverse items-center gap-2"><ActivityIndicator size="small" color={colors.primary} /><Text className="text-[10px] text-muted">جارٍ التحميل</Text></View> : <Text className="text-[10px] text-muted">{translated ? "ترجمة داخل التطبيق" : "تصفح داخل التطبيق"}</Text>}</View>
    <BrowserView ref={webView} source={{ uri: url }} onLoadStart={() => setLoading(true)} onLoadEnd={() => setLoading(false)} onNavigationStateChange={onNavigation} startInLoadingState javaScriptEnabled domStorageEnabled cacheEnabled cacheMode={Platform.OS === "android" ? "LOAD_DEFAULT" : undefined} sharedCookiesEnabled thirdPartyCookiesEnabled setSupportMultipleWindows={false} allowsBackForwardNavigationGestures style={{ flex: 1, marginTop: 8 }} />
  </ScreenContainer>;
}
