import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { BrandHeader, SectionHeading } from "@/components/chatbro-ui";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

type FileFilter = "all" | "image" | "document";

function formatSize(bytes: number | null) {
  if (!bytes || bytes < 0) return "الحجم غير متاح";
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ميغابايت`;
}

export default function FilesScreen() {
  const colors = useColors();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FileFilter>("all");
  const files = trpc.attachments.list.useQuery(undefined, { retry: 0 });
  const download = trpc.attachments.download.useMutation();

  const visibleFiles = useMemo(() => (files.data ?? []).filter((file) => {
    const matchesQuery = file.fileName.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    const mime = file.mimeType ?? "";
    const matchesFilter = filter === "all" || (filter === "image" ? mime.startsWith("image/") : !mime.startsWith("image/"));
    return matchesQuery && matchesFilter;
  }), [files.data, filter, query]);

  const openFile = async (id: number) => {
    try {
      const result = await download.mutateAsync({ id });
      const canOpen = await Linking.canOpenURL(result.url);
      if (!canOpen) throw new Error("لا يوجد تطبيق مناسب لفتح هذا الملف على الجهاز.");
      await Linking.openURL(result.url);
    } catch (error) {
      Alert.alert("تعذر فتح الملف", error instanceof Error ? error.message : "حدث خطأ غير متوقع.");
    }
  };

  const filters: { value: FileFilter; label: string }[] = [
    { value: "all", label: "الكل" },
    { value: "image", label: "صور" },
    { value: "document", label: "مستندات وملفات" },
  ];

  return (
    <ScreenContainer className="px-5 pt-4">
      <ScrollView contentContainerStyle={{ paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
        <BrandHeader title="ملفاتي" eyebrow="مرفقات الحساب" />
        <View className="mt-6 flex-row-reverse items-center justify-between">
          <View>
            <Text className="text-right text-[24px] font-extrabold text-foreground">ملفاتك المرفوعة</Text>
            <Text className="mt-1 text-right text-[11px] text-muted">مرفقات الحساب المرتبطة بالمحادثات</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="تحديث الملفات" onPress={() => void files.refetch()} className="h-11 w-11 items-center justify-center rounded-2xl border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <MaterialIcons name="refresh" size={21} color={colors.primary} />
          </Pressable>
        </View>

        <View className="mt-5 flex-row-reverse items-center rounded-2xl border px-3" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <MaterialIcons name="search" size={20} color={colors.muted} />
          <TextInput value={query} onChangeText={setQuery} placeholder="ابحث باسم الملف" placeholderTextColor={colors.muted} className="flex-1 px-3 py-3 text-right text-[12px] text-foreground" style={{ writingDirection: "rtl" }} />
        </View>
        <View className="mt-3 flex-row-reverse gap-2">
          {filters.map((item) => (
            <Pressable key={item.value} onPress={() => setFilter(item.value)} className="rounded-full border px-3 py-2" style={{ backgroundColor: filter === item.value ? colors.primary : colors.surface, borderColor: filter === item.value ? colors.primary : colors.border }}>
              <Text className="text-[10px] font-bold" style={{ color: filter === item.value ? colors.background : colors.foreground }}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <View className="mt-6">
          <SectionHeading title={files.data ? `${visibleFiles.length} ملف` : "الملفات"} action="تحديث" onAction={() => void files.refetch()} />
          {files.isLoading ? <Text className="mt-3 text-right text-[11px] text-muted">جارٍ تحميل الملفات…</Text> : null}
          {files.error ? <View className="rounded-2xl border p-4" style={{ backgroundColor: colors.surface, borderColor: colors.error }}><Text className="text-right text-[11px] font-bold text-foreground">تعذر تحميل الملفات</Text><Text className="mt-1 text-right text-[10px] leading-5 text-muted">{files.error.message}</Text><Pressable onPress={() => void files.refetch()} className="mt-3 self-end rounded-xl bg-primary px-3 py-2"><Text className="text-[10px] font-bold" style={{ color: colors.background }}>إعادة المحاولة</Text></Pressable></View> : null}
          {!files.isLoading && !files.error && visibleFiles.length === 0 ? <View className="items-center rounded-2xl border p-6" style={{ backgroundColor: colors.surface, borderColor: colors.border }}><MaterialIcons name="folder-open" size={28} color={colors.primary} /><Text className="mt-3 text-center text-[12px] font-bold text-foreground">{files.data?.length ? "لا توجد نتائج مطابقة" : "لا توجد ملفات مرفوعة بعد"}</Text><Text className="mt-1 text-center text-[10px] leading-5 text-muted">ارفع ملفًا من شاشة المحادثة ليظهر هنا.</Text></View> : null}
          {visibleFiles.map((file) => {
            const isImage = (file.mimeType ?? "").startsWith("image/");
            return (
              <View key={file.id} className="mt-3 flex-row-reverse items-center rounded-2xl border p-3" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: colors.background }}>
                  <MaterialIcons name={isImage ? "image" : (file.mimeType === "application/pdf" ? "picture-as-pdf" : "description")} size={21} color={colors.primary} />
                </View>
                <View className="mr-3 flex-1">
                  <Text numberOfLines={1} className="text-right text-[11px] font-bold text-foreground">{file.fileName}</Text>
                  <Text className="mt-1 text-right text-[9px] text-muted">{file.mimeType ?? "نوع غير محدد"} · {formatSize(file.sizeBytes)}</Text>
                  <Text className="mt-1 text-right text-[9px] text-muted">{new Date(file.createdAt).toLocaleDateString("ar")}{file.conversationId ? ` · محادثة ${file.conversationId}` : " · ملف مرفوع"}</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`فتح الملف ${file.fileName}`} onPress={() => void openFile(file.id)} disabled={download.isPending || file.status !== "ready"} className="h-10 w-10 items-center justify-center rounded-xl border" style={{ borderColor: colors.border, opacity: download.isPending || file.status !== "ready" ? 0.5 : 1 }}>
                  <MaterialIcons name="open-in-new" size={19} color={colors.primary} />
                </Pressable>
              </View>
            );
          })}
        </View>

        <View className="mt-6 rounded-2xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
          <Text className="text-right text-[10px] font-bold text-foreground">حدود مدير الملفات الحالي</Text>
          <Text className="mt-1 text-right text-[10px] leading-5 text-muted">تعرض هذه الشاشة مرفقات المحادثات المسجلة للحساب فقط وتفتحها عبر رابط تنزيل موقّع بعد التحقق من الملكية. المجلدات والمفضلة والحذف الفعلي ومخرجات أدوات الذكاء الاصطناعي ليست مفعّلة هنا بعد؛ لم يُضف حذف للسجل دون قدرة مؤكدة على حذف الملف من التخزين.</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
