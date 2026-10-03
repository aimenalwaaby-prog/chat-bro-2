# Chat Bro — Android 1.0.2

## ملفات التسليم

- `ChatBro-Android.apk`: نسخة release للتثبيت الجانبي، `versionCode=3`، ومعمارية ARM64.
- `ChatBro-Android-Project.zip`: أرشيف المصدر ومجلد Android المولّد، مع استبعاد Git و`node_modules` وملفات البيئة السرية ومخرجات البناء المحلية.
- رابط التحميل في الويب: `https://chatbro-web.onrender.com/downloads/chatbro-latest.apk`.

## توافق الهواتف

يستهدف APK هواتف Android ARM64 و`minSdk=24`. حسّنت إدارة الذاكرة للنماذج المحلية: تقرأ RAM الفعلية، تقلل حدود السياق والدفعات والخيوط والسجل حسب الجهاز، وتحدّ المحادثة إلى 48 رسالة وتحرر سياق النموذج بعد انتهاء الاستخدام/عند الخلفية. راجع `DEVICE_COMPATIBILITY_AR.md` لحدود النماذج التقديرية.

**لا يتوفر إصدار ARMv7 آمن في هذه النسخة**: مكتبة `llama.rn` المستخدمة لتشغيل GGUF محليًا لا تتضمن `librnllama.so` لـARMv7. فشل بناء ABI منفردًا بهذه المكتبة، لذلك لم أوزّع ملفًا قد يتعطل. الأجهزة 32-bit غير مدعومة بهذا APK.

## نتيجة التحقق

نجحت فحوص TypeScript والاختبارات (16 اختبارًا) وESLint و`pnpm build` وتصدير الويب وتجميع Android. تحقق `aapt` من `com.app.chatbro` و`versionName=1.0.2` و`versionCode=3` و`minSdk=24`، وتحقق `apksigner` من التوقيع. APK موقّع بمفتاح Android Debug الافتراضي؛ لا يصلح مفتاحًا لإصدار Google Play.

لم يُثبّت APK على هاتف فعلي بعد. أُبقيت مفاتيح API في خادم Render فقط؛ لا تدخل في APK أو المصدر. لم أرسل طلبًا حيًا لتوليد صورة/نص قد يستهلك رصيدًا.
