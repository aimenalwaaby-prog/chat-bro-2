import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Speech from "expo-speech";
import * as FileSystem from "expo-file-system/legacy";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { BrandHeader, StatusBadge } from "@/components/chatbro-ui";
import { useColors } from "@/hooks/use-colors";
import { checkServerConnection } from "@/lib/_core/api";
import { recordModelUse } from "@/lib/model-preferences";
import { trpc } from "@/lib/trpc";
import { chatBroModels, getModelTypeTags, isModelAvailableToSelect, isPlannedModel, type ChatBroModel } from "@/shared/chatbro-catalog";
import { listInstalledLocalModels, type InstalledLocalModel } from "@/lib/local-runtime";

type Attachment = {
  uri: string;
  name: string;
  mimeType: string;
  kind: "image" | "file";
  base64?: string;
  remoteUrl?: string;
  extractedText?: string;
};
type Message = {
  id: string;
  role: "assistant" | "user";
  text: string;
  time: string;
  attachments?: Attachment[];
};
const historyKey = (model: string) =>
  `chatbro:conversation:${encodeURIComponent(model)}`;
const welcome = (model?: string): Message => ({
  id: `welcome-${model ?? "chatbro"}`,
  role: "assistant",
  text: model
    ? `مرحبًا بك. هذه محادثة مستقلة مع ${model}.`
    : "مرحبًا بك في Chat Bro. اختر نموذجًا ثم أرسل طلبك.",
  time: "الآن",
});

export default function ChatScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ prompt?: string; model?: string; directModel?: string }>();
  const initialModel = params.model ?? "";
  const [selectedModel, setSelectedModel] = useState(initialModel);
  const [messages, setMessages] = useState<Message[]>([
    welcome(initialModel || undefined),
  ]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [loadedHistory, setLoadedHistory] = useState("");
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [deepThinkingEnabled, setDeepThinkingEnabled] = useState(false);
  const [localModels, setLocalModels] = useState<InstalledLocalModel[]>([]);
  const [serverCapabilities, setServerCapabilities] = useState<Record<string, boolean> | null>(null);
  const completeChat = trpc.chat.complete.useMutation();
  const uploadFile = trpc.attachments.upload.useMutation();
  const generateImage = trpc.images.generate.useMutation();
  const transcribe = trpc.voice.transcribe.useMutation();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const historyModel = selectedModel || "Chat Bro";
  const openRouterModels = trpc.models.openRouter.useQuery(undefined, { staleTime: 60_000, retry: 2 });
  const builtInModels = trpc.models.builtIn.useQuery(undefined, { enabled: Boolean(serverCapabilities?.builtInLLM), staleTime: 60_000, retry: 1 });
  const anthropicModels = trpc.models.anthropic.useQuery(undefined, { enabled: Boolean(serverCapabilities?.anthropic), staleTime: 60_000, retry: 1 });
  const geminiModels = trpc.models.gemini.useQuery(undefined, { enabled: Boolean(serverCapabilities?.gemini), staleTime: 60_000, retry: 1 });
  const groqModels = trpc.models.groq.useQuery(undefined, { enabled: Boolean(serverCapabilities?.groq), staleTime: 60_000, retry: 1 });
  const cloudflareModels = trpc.models.cloudflare.useQuery(undefined, { enabled: Boolean(serverCapabilities?.cloudflare), staleTime: 60_000, retry: 1 });
  const gatewayModels = trpc.models.gateways.useQuery(undefined, { enabled: Boolean(serverCapabilities?.gateway), staleTime: 60_000, retry: 1 });
  const dynamicOpenRouterModels = useMemo<ChatBroModel[]>(() => (openRouterModels.data?.models ?? []).filter((model) => !model.outputModalities?.length || model.outputModalities.includes("text")).map((model) => {
    const candidate: ChatBroModel = {
      name: model.name, modelId: `openrouter:${model.id}`, provider: "OpenRouter", providerKey: "openrouter", icon: "hub",
      tone: model.prompt === "0" && model.completion === "0" ? "full" : "limited",
      status: model.prompt === "0" && model.completion === "0" ? "مجاني" : "متاح",
      limit: model.contextLength ? `سياق ${model.contextLength.toLocaleString()} رمز` : "حسب المزود", category: "محادثة", requiresKey: true, localOnly: false, runtime: "gateway",
      inputModalities: model.inputModalities ?? [], outputModalities: model.outputModalities ?? ["text"], supportsVision: model.inputModalities?.includes("image"), verified: true,
    };
    return { ...candidate, types: getModelTypeTags(candidate) };
  }), [openRouterModels.data]);
  const dynamicBuiltInModels = useMemo<ChatBroModel[]>(() => (builtInModels.data?.models ?? []).map((model) => ({
    name: model.name, modelId: `builtin:${model.id}`, provider: `الخادم المدمج · ${model.provider}`, providerKey: "builtIn", icon: "auto-awesome", tone: "limited",
    status: "متاح من الخادم", limit: "حسب إعداد المزود", category: "محادثة", requiresKey: false, localOnly: false, runtime: "cloud", inputModalities: ["text"], outputModalities: ["text"], types: ["محادثة"], verified: true,
  })), [builtInModels.data]);
  const dynamicGeminiModels = useMemo<ChatBroModel[]>(() => (geminiModels.data?.models ?? []).map((model) => ({
    name: `${model.name} · Gemini`, modelId: `gemini:${model.id}`, provider: "Google Gemini · مباشر", providerKey: "gemini", icon: "auto-awesome", tone: "limited",
    status: "متاح من Gemini", limit: model.contextLength ? `سياق ${model.contextLength.toLocaleString()} رمز` : "حسب حساب Google", category: "محادثة", requiresKey: true, localOnly: false, runtime: "gateway",
    inputModalities: model.supportsVision ? ["text", "image"] : ["text"], outputModalities: ["text"], supportsVision: model.supportsVision, verified: true, types: ["محادثة", ...(model.supportsVision ? ["فهم الصور"] : [])],
  })), [geminiModels.data]);
  const dynamicGroqModels = useMemo<ChatBroModel[]>(() => (groqModels.data?.models ?? []).map((model) => ({
    name: `${model.name} · Groq`, modelId: `groq:${model.id}`, provider: "Groq · مباشر", providerKey: "groq", icon: "speed", tone: "limited",
    status: "متاح من Groq", limit: model.contextLength ? `سياق ${model.contextLength.toLocaleString()} رمز` : "حسب حساب Groq", category: "محادثة", requiresKey: true, localOnly: false, runtime: "gateway",
    inputModalities: ["text"], outputModalities: ["text"], supportsVision: false, verified: true, types: ["محادثة", "برمجة"],
  })), [groqModels.data]);
  const dynamicCloudflareModels = useMemo<ChatBroModel[]>(() => (cloudflareModels.data?.models ?? []).map((model) => ({
    name: `${model.name} · Cloudflare`, modelId: `cloudflare:${model.id}`, provider: "Cloudflare Workers AI", providerKey: "cloudflare", icon: "cloud", tone: "limited",
    status: "متاح من Cloudflare", limit: "حسب حساب Cloudflare", category: "محادثة", requiresKey: true, localOnly: false, runtime: "gateway",
    inputModalities: ["text"], outputModalities: ["text"], supportsVision: false, verified: true, types: ["محادثة", "برمجة"],
  })), [cloudflareModels.data]);
  const dynamicAnthropicModels = useMemo<ChatBroModel[]>(() => (anthropicModels.data?.models ?? []).map((model) => ({
    name: `${model.name} · Anthropic`, modelId: `anthropic:${model.id}`, provider: "Anthropic · مباشر", providerKey: "anthropic", icon: "auto-awesome", tone: "limited",
    status: "متاح من Anthropic", limit: model.contextLength ? `سياق ${model.contextLength.toLocaleString()} رمز` : "حسب حساب Anthropic", category: "محادثة", requiresKey: true, localOnly: false, runtime: "gateway", inputModalities: model.supportsVision ? ["text", "image"] : ["text"], outputModalities: ["text"], types: ["محادثة", ...(model.supportsVision ? ["فهم الصور"] : [])], supportsVision: model.supportsVision, verified: true,
  })), [anthropicModels.data]);
  const dynamicGatewayModels = useMemo<ChatBroModel[]>(() => (gatewayModels.data?.models ?? []).filter((model) => !model.outputModalities?.length || model.outputModalities.includes("text")).map((model) => {
    const providerName = model.provider.toLowerCase();
    const providerKey: ChatBroModel["providerKey"] = providerName.includes("mistral") ? "mistral" : providerName.includes("hugging") ? "huggingface" : providerName.includes("deepinfra") ? "deepinfra" : providerName.includes("nvidia") ? "nvidia" : providerName.includes("replicate") ? "replicate" : providerName.includes("fal") ? "fal" : "gateway";
    return {
    name: `${model.name} · ${model.provider}`, modelId: model.id, provider: model.provider, providerKey, icon: "hub", tone: "limited",
    status: "متاح من البوابة", limit: model.contextLength ? `سياق ${model.contextLength.toLocaleString()} رمز` : "حسب البوابة", category: "محادثة", requiresKey: true, localOnly: false, runtime: "gateway", inputModalities: model.inputModalities ?? [], outputModalities: model.outputModalities ?? ["text"], supportsVision: model.inputModalities?.includes("image"), verified: true,
  }; }), [gatewayModels.data]);
  const cloudChatModels = useMemo(() => {
    const liveModels = [...dynamicBuiltInModels, ...dynamicGeminiModels, ...dynamicGroqModels, ...dynamicCloudflareModels, ...dynamicAnthropicModels, ...dynamicGatewayModels, ...dynamicOpenRouterModels];
    const staticModels = chatBroModels.filter((model) => isModelAvailableToSelect(model, serverCapabilities));
    const existing = new Set(staticModels.map((model) => model.modelId));
    return [...staticModels, ...liveModels.filter((model) => !existing.has(model.modelId))];
  }, [dynamicAnthropicModels, dynamicBuiltInModels, dynamicCloudflareModels, dynamicGeminiModels, dynamicGatewayModels, dynamicGroqModels, dynamicOpenRouterModels, serverCapabilities]);
  const selectedCatalogModel = cloudChatModels.find((model) => model.name === selectedModel);
  const selectedRuntimeModel = selectedCatalogModel?.modelId;
  useEffect(() => { let active = true; listInstalledLocalModels().then((items) => active && setLocalModels(items)); return () => { active = false; }; }, []);
  useEffect(() => {
    let active = true;
    void checkServerConnection().then((result) => {
      if (!active) return;
      const capabilities = result.capabilities ?? {};
      setServerCapabilities(capabilities);
      setWebSearchEnabled(Boolean(capabilities.openrouter));
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setLoadedHistory("");
    let active = true;
    AsyncStorage.getItem(historyKey(historyModel)).then((stored) => {
      if (!active) return;
      try {
        const parsed = stored ? (JSON.parse(stored) as Message[]) : [];
        setMessages(
          parsed.length ? parsed : [welcome(selectedModel || undefined)],
        );
      } catch {
        setMessages([welcome(selectedModel || undefined)]);
      }
      setLoadedHistory(historyModel);
    });
    return () => {
      active = false;
    };
  }, [selectedModel, historyModel]);
  useEffect(() => {
    if (loadedHistory === historyModel && messages.length)
      void AsyncStorage.setItem(
        historyKey(historyModel),
        JSON.stringify(messages),
      );
  }, [messages, historyModel, loadedHistory]);
  useEffect(() => {
    if (params.prompt) setInput(params.prompt);
  }, [params.prompt]);
  const suggestions = useMemo(
    () => ["لخّص هذا الملف", "حلّل الصورة المرفقة", "اكتب خطة تطبيق"],
    [],
  );
  const localModelSelected = localModels.some((model) => model.name === selectedModel);
  const canUseWebSearch = Boolean(serverCapabilities?.openrouter) && !localModelSelected;
  const canGenerateImage = Boolean(serverCapabilities?.openrouter || serverCapabilities?.forgeImages || serverCapabilities?.imageService || serverCapabilities?.pollinations || serverCapabilities?.replicate || serverCapabilities?.fal);
  const canAttachImage = !localModelSelected && (!selectedModel || Boolean(selectedCatalogModel?.supportsVision || selectedCatalogModel?.inputModalities?.includes("image")));
  useEffect(() => { if (localModelSelected) setWebSearchEnabled(false); else if (serverCapabilities?.openrouter) setWebSearchEnabled(true); }, [localModelSelected, serverCapabilities?.openrouter]);

  const addImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "الصلاحية مطلوبة",
        "اسمح للتطبيق بالوصول إلى الصور لإرفاق صورة.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setAttachments((current) => [
        ...current,
        {
          uri: a.base64
            ? `data:${a.mimeType ?? "image/jpeg"};base64,${a.base64}`
            : a.uri,
          name: a.fileName ?? "image.jpg",
          mimeType: a.mimeType ?? "image/jpeg",
          kind: "image",
          base64: a.base64 ?? undefined,
        },
      ]);
    }
  };
  const addFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "application/pdf",
        "text/*",
        "application/json",
        "application/zip",
      ],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setAttachments((current) => [
        ...current,
        {
          uri: a.uri,
          name: a.name,
          mimeType: a.mimeType ?? "application/octet-stream",
          kind: "file",
        },
      ]);
    }
  };
  const uploadAttachment = async (attachment: Attachment) => {
    const base64 = attachment.base64 ?? await FileSystem.readAsStringAsync(attachment.uri, { encoding: FileSystem.EncodingType.Base64 });
    const result = await uploadFile.mutateAsync({ name: attachment.name, mimeType: attachment.mimeType, base64 });
    return { ...attachment, remoteUrl: result.url, extractedText: result.extractedText ?? undefined };
  };
  const toggleRecording = async () => {
    try {
      if (recorderState.isRecording) {
        await recorder.stop();
        if (recorder.uri) {
          const base64 = await FileSystem.readAsStringAsync(recorder.uri, { encoding: FileSystem.EncodingType.Base64 });
          const uploaded = await uploadFile.mutateAsync({ name: "voice.m4a", mimeType: "audio/mp4", base64 });
          const result = await transcribe.mutateAsync({ audioUrl: uploaded.url, language: "ar" });
          setInput((current) => `${current}${current ? " " : ""}${result.text}`);
        }
      } else {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) { Alert.alert("الصلاحية مطلوبة", "اسمح للتطبيق باستخدام الميكروفون."); return; }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
      }
    } catch (error) {
      Alert.alert("تعذر تسجيل الصوت", error instanceof Error ? error.message : "حاول مرة أخرى.");
    }
  };
  const copyMessage = async (text: string) => {
    await Clipboard.setStringAsync(text);
  };
  const speakMessage = async (message: Message) => {
    await Speech.stop();
    if (speakingId === message.id) {
      setSpeakingId(null);
      return;
    }
    setSpeakingId(message.id);
    Speech.speak(message.text, {
      language: "ar-SA",
      onDone: () => setSpeakingId(null),
      onStopped: () => setSpeakingId(null),
      onError: () => setSpeakingId(null),
    });
  };
  useEffect(
    () => () => {
      void Speech.stop();
    },
    [],
  );

  const sendMessage = async () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || isTyping) return;
    const localModel = localModels.find((model) => model.name === selectedModel);
    const isImageCommand = /^\/image(?:\s|$)/i.test(text);
    const imagePrompt = text.replace(/^\/image(?:\s+|$)/i, "").trim();
    if (localModel && attachments.length) {
      Alert.alert("المحادثة المحلية نصية", "النماذج المثبتة حاليًا لا تدعم الصور أو الملفات. لن تُرفع المرفقات إلى الخادم.");
      return;
    }
    if (webSearchEnabled && localModel) {
      Alert.alert("البحث غير متاح محليًا", "للحفاظ على خصوصية المحادثة المحلية، لا تُرسل رسائلها إلى الإنترنت. اختر نموذجًا سحابيًا للبحث.");
      return;
    }
    if (webSearchEnabled && !serverCapabilities?.openrouter) {
      Alert.alert("البحث غير مهيأ", "بحث الويب يحتاج مفتاح OpenRouter مضبوطًا على الخادم.");
      return;
    }
    if (isImageCommand && !imagePrompt) {
      Alert.alert("أضف وصف الصورة", "اكتب وصفًا بعد /image ثم أرسل الطلب.");
      return;
    }
    if (isImageCommand && attachments.length) {
      Alert.alert("أنشئ صورة من وصف نصي", "أزل المرفقات قبل توليد صورة جديدة.");
      return;
    }
    if (isImageCommand && !canGenerateImage) {
      Alert.alert("توليد الصور غير مهيأ", "يلزم تفعيل OpenRouter أو Forge ImageService في إعدادات الخادم.");
      return;
    }
    setIsTyping(true);
    const isLocalConversation = Boolean(localModel);
    let uploadedAttachments: Attachment[];
    try {
      uploadedAttachments = isLocalConversation ? attachments : await Promise.all(attachments.map(uploadAttachment));
    } catch (error) {
      setIsTyping(false);
      Alert.alert("فشل رفع المرفق", error instanceof Error ? error.message : "تحقق من الملف وحاول مرة أخرى.");
      return;
    }
    const promptParts = uploadedAttachments.flatMap((a) => [
      ...(a.extractedText ? [{ type: "text" as const, text: `محتوى الملف ${a.name}:\n${a.extractedText}` }] : []),
      a.kind === "image" ? { type: "image_url" as const, image_url: { url: a.remoteUrl ?? a.uri } } : { type: "file_url" as const, file_url: { url: a.remoteUrl ?? a.uri, mime_type: a.mimeType } },
    ]);
    const userMessage: Message = {
      id: `${Date.now()}`,
      role: "user",
      text: text || "أرفقت ملفًا/صورة. حلل المرفق.",
      time: new Date().toLocaleTimeString("ar-SA", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      attachments: uploadedAttachments,
    };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setAttachments([]);
    if (isImageCommand) {
      try {
        const result = await generateImage.mutateAsync({ prompt: imagePrompt });
        setMessages((current) => [...current, { id: `${Date.now()}-image`, role: "assistant", text: "تم إنشاء الصورة.", time: "الآن", attachments: [{ uri: result.url ?? "", remoteUrl: result.url, name: "generated.png", mimeType: "image/png", kind: "image" }] }]);
      } catch (error) {
        setMessages((current) => [...current, { id: `${Date.now()}-image-error`, role: "assistant", text: error instanceof Error ? error.message : "تعذر إنشاء الصورة.", time: "الآن" }]);
      }
      setIsTyping(false);
      return;
    }
    void recordModelUse({
      id: localModel ? `local:${localModel.id}` : selectedRuntimeModel || "chatbro:default",
      name: selectedModel || "المساعد العام",
      provider: localModel ? "محلي على الجهاز" : selectedCatalogModel?.provider ?? "Chat Bro · الخادم",
      route: localModel ? "local" : "chat",
    }).catch(() => undefined);
    try {
      if (localModel) {
        const local = localModel;
        const { completeLocal } = await import("@/lib/local-runtime");
        const reply = await completeLocal(local, [
          { role: "system", content: "أنت مساعد محلي داخل Chat Bro. لا تدّعي الوصول إلى الإنترنت. إذا احتاج السؤال معلومات حديثة فاذكر ذلك بوضوح." },
          ...messages.map((m) => ({ role: m.role, content: m.text })),
          { role: "user", content: text || "حلل المرفق." },
        ]);
        setMessages((current) => [...current, { id: `${Date.now()}-local`, role: "assistant", text: reply || "لم يُنتج النموذج ردًا.", time: "الآن" }]);
        return;
      }
      const response = await completeChat.mutateAsync({
        model: params.directModel || selectedRuntimeModel || undefined,
        useWebSearch: webSearchEnabled,
        deepThinking: deepThinkingEnabled,
        messages: [...messages, userMessage].map((message, index) =>
          index === messages.length
            ? {
                role: message.role,
                content: [
                  ...(text ? [{ type: "text" as const, text }] : []),
                  ...promptParts,
                ],
              }
            : { role: message.role, content: message.text },
        ),
      });
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-reply`,
          role: "assistant",
          text: response.content,
          time: "الآن",
        },
      ]);
    } catch (error) {
      console.error("[ChatBro] chat request failed:", error);
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      const friendly = message.includes("abort") || message.includes("timeout")
        ? "انتهت مهلة الاتصال بالنموذج. حاول مرة أخرى."
        : message.includes("api") && message.includes("key")
          ? "المزود المضمن غير مفعّل حاليًا على الخادم. لا تحتاج إلى إدخال أي مفتاح داخل التطبيق؛ يلزم ضبطه في Environment Variables على الخادم فقط."
          : message.includes("quota") || message.includes("limit")
            ? "تم الوصول إلى الحد المسموح لهذا المزود."
            : "تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت وحاول مرة أخرى.";
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-offline`,
          role: "assistant",
          text: friendly,
          time: "الآن",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <ScreenContainer className="px-5 pt-4" edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 24}
        className="flex-1"
      >
        <BrandHeader title="محادثاتك" eyebrow="CHAT BRO" />
        <View
          className="mt-4 rounded-[18px] border bg-surface px-3 py-2.5"
          style={{ borderColor: colors.border }}
        >
          <Pressable
            onPress={() => setModelsOpen((open) => !open)}
            style={({ pressed }) => pressed && { opacity: 0.7 }}
            className="flex-row-reverse items-center justify-between"
          >
            <View className="flex-row-reverse items-center gap-2">
              <MaterialIcons name="tune" size={17} color={colors.primary} />
              <Text className="text-[11px] font-bold text-foreground">
                {selectedModel || "اختر النموذج"}
              </Text>
            </View>
            <MaterialIcons
              name={modelsOpen ? "expand-less" : "expand-more"}
              size={20}
              color={colors.muted}
            />
          </Pressable>
          {modelsOpen ? (
            <View className="mt-3 rounded-2xl border p-2" style={{ borderColor: colors.border, backgroundColor: colors.background }}>
              <View className="flex-row-reverse items-center justify-between px-2 pb-2">
                <View className="flex-row-reverse items-center justify-between w-full"><Text className="text-right text-[10px] font-bold text-muted">{cloudChatModels.length} سحابي · {localModels.length} محلي</Text><Text className="text-right text-[9px] text-muted">🌐 البحث الحديث مفعّل للمسار السحابي</Text></View>
                <Text className="text-right text-[10px] text-muted">اسحب للأعلى والأسفل</Text>
              </View>
              <ScrollView
                nestedScrollEnabled
                showsVerticalScrollIndicator
                contentContainerStyle={{ gap: 6, paddingBottom: 2 }}
                style={{ maxHeight: 310 }}
              >
                {localModels.length ? <><Text className="px-2 pt-2 pb-1 text-right text-[10px] font-extrabold text-primary">📱 النماذج المحلية</Text>{localModels.map((model) => (
                  <Pressable key={`local-${model.id}`} onPress={() => { setSelectedModel(model.name); setModelsOpen(false); }} className="min-h-[52px] flex-row-reverse items-center rounded-xl border px-3 py-2" style={{ backgroundColor: model.name === selectedModel ? colors.primary : colors.surface, borderColor: model.name === selectedModel ? colors.primary : colors.border }}>
                    <MaterialIcons name="smart-toy" size={17} color={model.name === selectedModel ? "#062034" : colors.muted} />
                    <View className="mr-2 flex-1"><Text numberOfLines={1} className="text-right text-[11px] font-bold text-foreground">{model.name}</Text><Text className="text-right text-[9px] text-muted">محلي على الجهاز · بلا خادم</Text></View>
                    {model.name === selectedModel ? <MaterialIcons name="check-circle" size={17} color="#062034" /> : null}
                  </Pressable>
                ))}</> : null}
                <Text className="px-2 pt-2 pb-1 text-right text-[10px] font-extrabold text-primary">☁️ النماذج السحابية</Text>
                {cloudChatModels.map((model) => (
                  <Pressable
                    key={model.name}
                    disabled={isPlannedModel(model.modelId)}
                    onPress={() => { setSelectedModel(model.name); setModelsOpen(false); }}
                    style={({ pressed }) => [
                      {
                        backgroundColor: model.name === selectedModel ? colors.primary : colors.surface,
                        borderColor: model.name === selectedModel ? colors.primary : colors.border,
                      },
                        pressed && { opacity: 0.72 },
                        isPlannedModel(model.modelId) && { opacity: 0.58 },
                    ]}
                    className="min-h-[52px] flex-row-reverse items-center rounded-xl border px-3 py-2"
                  >
                    <MaterialIcons name={model.icon as never} size={17} color={model.name === selectedModel ? "#062034" : colors.muted} />
                    <View className="mr-2 flex-1">
                      <Text numberOfLines={1} className="text-right text-[11px] font-bold text-foreground">{model.name}</Text>
                      <Text numberOfLines={1} className="text-right text-[9px] text-muted">{model.provider} · {model.category}</Text>
                      <View className="mt-1 flex-row-reverse items-center gap-1">
                        <StatusBadge label={model.status} tone={model.tone} />
                        {model.requiresKey ? <Text className="text-[9px] text-muted">مفتاح API</Text> : null}
                      </View>
                    </View>
                    {model.name === selectedModel ? <MaterialIcons name="check-circle" size={17} color="#062034" /> : null}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: 18, gap: 12, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View
              className={item.role === "user" ? "items-start" : "items-end"}
            >
              <View
                className={
                  item.role === "user"
                    ? "max-w-[88%] rounded-[20px] rounded-br-[6px] bg-[#DFF7FD] px-4 py-3"
                    : "max-w-[92%] rounded-[20px] rounded-bl-[6px] border bg-surface px-4 py-3"
                }
                style={
                  item.role === "assistant"
                    ? { borderColor: colors.border }
                    : undefined
                }
              >
                {item.attachments?.map((a) =>
                  a.kind === "image" ? (
                    <Image
                      key={a.remoteUrl ?? a.uri}
                      source={{ uri: a.remoteUrl ?? a.uri }}
                      className="mb-2 h-40 w-40 rounded-xl"
                      resizeMode="cover"
                    />
                  ) : (
                    <Text
                      key={a.remoteUrl ?? a.uri}
                      className="mb-2 text-right text-[11px] font-semibold text-primary"
                    >
                      📎 {a.name}
                    </Text>
                  ),
                )}
                <Text
                  selectable
                  className="text-right text-[13px] leading-5 text-foreground"
                >
                  {item.text}
                </Text>
                <Text className="mt-2 text-right text-[10px] text-muted">
                  {item.time}
                </Text>
                <View
                  className="mt-2 flex-row-reverse items-center gap-3 border-t pt-2"
                  style={{ borderTopColor: colors.border }}
                >
                  <Pressable onPress={() => void copyMessage(item.text)}>
                    <MaterialIcons
                      name="content-copy"
                      size={15}
                      color={colors.muted}
                    />
                  </Pressable>
                  {item.role === "assistant" ? (
                    <Pressable onPress={() => void speakMessage(item)}>
                      <MaterialIcons
                        name={
                          speakingId === item.id ? "stop-circle" : "volume-up"
                        }
                        size={16}
                        color={colors.muted}
                      />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          )}
          ListHeaderComponent={
            <View className="mb-2 flex-row-reverse flex-wrap justify-start gap-2">
              {suggestions.map((suggestion) => (
                <Pressable
                  key={suggestion}
                  onPress={() => setInput(suggestion)}
                  style={({ pressed }) => pressed && { opacity: 0.65 }}
                  className="rounded-full border bg-surface px-3 py-2"
                >
                  <Text className="text-[11px] font-semibold text-muted">
                    {suggestion}
                  </Text>
                </Pressable>
              ))}
            </View>
          }
          ListFooterComponent={
            isTyping ? (
              <View
                className="self-end rounded-[18px] border bg-surface px-4 py-3"
                style={{ borderColor: colors.border }}
              >
                <ActivityIndicator size="small" />
              </View>
            ) : null
          }
        />
        <View
          className="mb-2 rounded-[22px] border bg-surface px-3 py-2.5"
          style={{ borderColor: colors.border }}
        >
          {attachments.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-2"
            >
              {attachments.map((a) => (
                <Pressable
                  key={a.uri}
                  onPress={() =>
                    setAttachments((current) =>
                      current.filter((x) => x.uri !== a.uri),
                    )
                  }
                  className="mr-2 rounded-lg bg-[#E6F8FD] px-2 py-1"
                >
                  <Text className="text-[10px] text-[#0787B4]">
                    {a.kind === "image" ? "صورة" : a.name} ×
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          <View className="mb-2 flex-row-reverse flex-wrap items-center justify-between gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canUseWebSearch }}
              disabled={!canUseWebSearch}
              onPress={() => setWebSearchEnabled((enabled) => !enabled)}
              style={({ pressed }) => [{ opacity: !canUseWebSearch ? 0.45 : pressed ? 0.7 : 1 }]}
              className="flex-row-reverse items-center gap-1 rounded-full border px-3 py-1.5"
            >
              <MaterialIcons name="language" size={15} color={webSearchEnabled ? colors.primary : colors.muted} />
              <Text className="text-[10px] font-bold" style={{ color: webSearchEnabled ? colors.primary : colors.muted }}>
                {localModelSelected ? "المحلي بلا إنترنت" : serverCapabilities === null ? "الخادم لا يستجيب" : !serverCapabilities.openrouter ? "بحث الويب · قريبًا" : webSearchEnabled ? "بحث الويب مفعّل" : "بحث الويب"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="إنشاء صورة بالذكاء الاصطناعي"
              accessibilityState={{ disabled: !canGenerateImage }}
              disabled={!canGenerateImage}
              onPress={() => {
                const draftedPrompt = input.trim().replace(/^\/image(?:\s+|$)/i, "");
                router.push({ pathname: "/(tabs)/images", params: draftedPrompt ? { prompt: draftedPrompt } : {} });
              }}
              style={({ pressed }) => [{ opacity: !canGenerateImage ? 0.45 : pressed ? 0.7 : 1 }]}
              className="flex-row-reverse items-center gap-1 rounded-full border px-3 py-1.5"
            >
              <MaterialIcons name="auto-awesome" size={15} color={canGenerateImage ? colors.primary : colors.muted} />
              <Text className="text-[10px] font-bold" style={{ color: canGenerateImage ? colors.primary : colors.muted }}>إنشاء صورة</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="تفعيل التفكير العميق"
              onPress={() => setDeepThinkingEnabled((enabled) => !enabled)}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              className="flex-row-reverse items-center gap-1 rounded-full border px-3 py-1.5"
            >
              <MaterialIcons name="psychology" size={15} color={deepThinkingEnabled ? colors.primary : colors.muted} />
              <Text className="text-[10px] font-bold" style={{ color: deepThinkingEnabled ? colors.primary : colors.muted }}>{deepThinkingEnabled ? "تفكير عميق مفعّل" : "تفكير عميق"}</Text>
            </Pressable>
          </View>
          {webSearchEnabled ? <Text className="mb-2 text-right text-[9px] leading-4 text-muted">عند التفعيل يُرسل نص السؤال إلى الخادم وOpenRouter للبحث، وقد يُحتسب استخدام إضافي. لا يُستخدم في المحادثة المحلية.</Text> : null}
          {canGenerateImage ? <Text className="mb-2 text-right text-[9px] text-muted">توليد الصور يرسل الوصف إلى الخادم وقد يستهلك رصيد مزود الذكاء الاصطناعي.</Text> : null}
          {selectedModel && !localModelSelected && !canAttachImage ? <Text className="mb-2 text-right text-[9px] text-muted">هذا النموذج لا يعلن دعم إدخال الصور؛ اختر نموذجًا يدعم فهم الصور أو استخدم أداة إنشاء الصور.</Text> : null}
          <View className="flex-row-reverse items-end gap-2">
            <Pressable
              disabled={!canAttachImage}
              onPress={addImage}
              style={({ pressed }) => [
                { backgroundColor: "#E6F8FD", opacity: canAttachImage ? 1 : 0.4 },
                pressed && { opacity: 0.7 },
              ]}
              className="h-10 w-10 items-center justify-center rounded-[14px]"
            >
              <MaterialIcons name="image" size={20} color="#0787B4" />
            </Pressable>
            <Pressable
              disabled={localModelSelected}
              onPress={addFile}
              style={({ pressed }) => [
                { backgroundColor: "#E6F8FD", opacity: localModelSelected ? 0.4 : 1 },
                pressed && { opacity: 0.7 },
              ]}
              className="h-10 w-10 items-center justify-center rounded-[14px]"
            >
              <MaterialIcons name="attach-file" size={20} color="#0787B4" />
            </Pressable>
            <Pressable
              onPress={() => void toggleRecording()}
              disabled={localModelSelected}
              style={({ pressed }) => [{ backgroundColor: recorderState.isRecording ? "#FFD8D8" : "#E6F8FD", opacity: localModelSelected ? 0.4 : 1 }, pressed && { opacity: 0.7 }]}
              className="h-10 w-10 items-center justify-center rounded-[14px]"
            >
              <MaterialIcons name={recorderState.isRecording ? "stop" : "mic"} size={20} color={recorderState.isRecording ? "#C62828" : "#0787B4"} />
            </Pressable>
            <TextInput
              value={input}
              onChangeText={setInput}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
              blurOnSubmit={false}
              multiline
              placeholder="اكتب رسالتك..."
              placeholderTextColor={colors.muted}
              className="max-h-[110px] min-h-[42px] flex-1 py-2 text-[14px] text-foreground"
              style={{ textAlign: "right", writingDirection: "rtl" }}
            />
            <Pressable
              onPress={sendMessage}
              disabled={isTyping}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
                  opacity: isTyping ? 0.45 : 1,
                },
                pressed && { transform: [{ scale: 0.96 }] },
              ]}
              className="h-11 w-11 items-center justify-center rounded-[15px]"
            >
              <MaterialIcons name="arrow-upward" size={21} color="#062034" />
            </Pressable>
          </View>
          <View className="mt-2 flex-row-reverse items-center justify-between px-1">
            <Text className="text-[10px] text-muted">
              {selectedModel ? `محادثة ${selectedModel}` : "مساعد Chat Bro"}
            </Text>
            <StatusBadge label="جاهز" tone="full" />
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
