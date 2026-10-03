import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as NavigationBar from "expo-navigation-bar";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, Text, TextInput, View } from "react-native";
import WebView, { type WebViewNavigation } from "react-native-webview";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

const BrowserView = WebView as any;

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "https://chatgpt.com";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(trimmed)) return `https://${trimmed}`;
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
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
  const [error, setError] = useState("");
  const [browserFocused, setBrowserFocused] = useState(false);
  const originalUrl = useRef(initialUrl);
  const webView = useRef<any>(null);

  useFocusEffect(useCallback(() => {
    setBrowserFocused(true);
    if (Platform.OS === "android") {
      void NavigationBar.setBehaviorAsync("overlay-swipe").catch(() => undefined);
      void NavigationBar.setVisibilityAsync("hidden").catch(() => undefined);
    }
    return () => {
      setBrowserFocused(false);
      if (Platform.OS === "android") void NavigationBar.setVisibilityAsync("visible").catch(() => undefined);
    };
  }, []));

  if (Platform.OS === "web") {
    return <ScreenContainer className="px-5 pt-4"><Text className="text-right text-[14px] font-bold text-foreground">المتصفح الداخلي متاح في تطبيق Android</Text><Text className="mt-2 text-right text-[11px] text-muted">على الويب افتح الرابط من المتصفح العادي.</Text></ScreenContainer>;
  }

  const navigate = () => {
    const next = normalizeUrl(address);
    setAddress(next);
    setError("");
    setTranslated(false);
    setUrl(next);
  };
  const onNavigation = (state: WebViewNavigation) => {
    if (/^https?:\/\//i.test(state.url)) setAddress(state.url);
    setCanGoBack(state.canGoBack);
    setCanGoForward(state.canGoForward);
  };
  const onShouldStart = (request: { url: string }) => {
    if (/^(https?:|about:blank)/i.test(request.url)) return true;
    void Linking.openURL(request.url).catch(() => undefined);
    return false;
  };
  const toggleTranslation = () => {
    if (translated) {
      setTranslated(false);
      setUrl(originalUrl.current);
      return;
    }
    originalUrl.current = /^https?:\/\//i.test(address) ? address : url;
    setTranslated(true);
    setUrl(`https://translate.google.com/translate?sl=auto&tl=ar&u=${encodeURIComponent(originalUrl.current)}`);
  };

  return <ScreenContainer className="pt-1" edges={[]} safeAreaClassName="bg-black">
    <StatusBar hidden={browserFocused} />
    <View className="z-10 mx-2 mt-1 flex-row-reverse items-center rounded-2xl border bg-surface/95 px-2" style={{ borderColor: colors.border }}>
      <Pressable accessibilityRole="button" accessibilityLabel="إغلاق المتصفح" onPress={() => router.back()} className="h-10 w-10 items-center justify-center"><MaterialIcons name="close" size={20} color={colors.foreground} /></Pressable>
      <TextInput value={address} onChangeText={setAddress} onSubmitEditing={navigate} autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="go" className="h-10 flex-1 px-2 text-[11px] text-foreground" style={{ writingDirection: "ltr", textAlign: "left" }} placeholder="اكتب رابطًا أو ابحث" placeholderTextColor={colors.muted} />
      <Pressable accessibilityRole="button" accessibilityLabel="فتح الرابط" onPress={navigate} className="h-10 w-9 items-center justify-center"><MaterialIcons name="arrow-forward" size={18} color={colors.primary} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="تحديث الصفحة" onPress={() => { setError(""); webView.current?.reload(); }} className="h-10 w-9 items-center justify-center"><MaterialIcons name="refresh" size={18} color={colors.muted} /></Pressable>
    </View>
    <View className="z-10 mx-3 mt-1 flex-row-reverse items-center justify-between">
      <View className="flex-row-reverse items-center gap-2">
        <Pressable disabled={!canGoBack} onPress={() => webView.current?.goBack()} className="h-8 w-8 items-center justify-center rounded-full bg-surface/90" style={{ opacity: canGoBack ? 1 : 0.4 }}><MaterialIcons name="arrow-forward" size={17} color={colors.foreground} /></Pressable>
        <Pressable disabled={!canGoForward} onPress={() => webView.current?.goForward()} className="h-8 w-8 items-center justify-center rounded-full bg-surface/90" style={{ opacity: canGoForward ? 1 : 0.4 }}><MaterialIcons name="arrow-back" size={17} color={colors.foreground} /></Pressable>
        <Pressable onPress={toggleTranslation} className="h-8 flex-row-reverse items-center gap-1 rounded-full bg-surface/90 px-2"><MaterialIcons name="translate" size={14} color={translated ? colors.primary : colors.muted} /><Text className="text-[9px] font-bold" style={{ color: translated ? colors.primary : colors.muted }}>{translated ? "الأصل" : "ترجمة"}</Text></Pressable>
      </View>
      {loading ? <View className="flex-row-reverse items-center gap-2 rounded-full bg-surface/90 px-2 py-1"><ActivityIndicator size="small" color={colors.primary} /><Text className="text-[9px] text-muted">جارٍ التحميل</Text></View> : null}
    </View>
    {error ? <View className="z-10 mx-3 mt-1 rounded-xl bg-red-50 px-3 py-2"><Text className="text-right text-[10px] text-red-700">{error}</Text><Pressable onPress={() => { setError(""); webView.current?.reload(); }}><Text className="mt-1 text-right text-[10px] font-bold text-red-800">إعادة المحاولة</Text></Pressable></View> : null}
    <BrowserView
      ref={webView}
      source={{ uri: url }}
      onLoadStart={() => { setLoading(true); setError(""); }}
      onLoadEnd={() => setLoading(false)}
      onError={({ nativeEvent }: { nativeEvent?: { description?: string } }) => { setLoading(false); setError(nativeEvent?.description ?? "تعذر فتح هذا الموقع. تحقق من الرابط والاتصال."); }}
      onHttpError={({ nativeEvent }: { nativeEvent?: { statusCode?: number } }) => { if ((nativeEvent?.statusCode ?? 0) >= 400) setError(`أعاد الموقع حالة HTTP ${nativeEvent?.statusCode}.`); }}
      onNavigationStateChange={onNavigation}
      onShouldStartLoadWithRequest={onShouldStart}
      onOpenWindow={({ nativeEvent }: { nativeEvent?: { targetUrl?: string } }) => { const targetUrl = nativeEvent?.targetUrl; if (targetUrl && /^https?:\/\//i.test(targetUrl)) { setAddress(targetUrl); setUrl(targetUrl); } }}
      originWhitelist={["http://*", "https://*"]}
      startInLoadingState
      javaScriptEnabled
      domStorageEnabled
      cacheEnabled
      cacheMode={Platform.OS === "android" ? "LOAD_DEFAULT" : undefined}
      sharedCookiesEnabled
      thirdPartyCookiesEnabled
      javaScriptCanOpenWindowsAutomatically
      setSupportMultipleWindows={false}
      allowsBackForwardNavigationGestures
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction
      style={{ flex: 1, backgroundColor: "#ffffff" }}
    />
  </ScreenContainer>;
}
