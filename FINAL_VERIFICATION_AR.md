# التحقق النهائي — Chat Bro Android 1.0.2

## فحوص المصدر

- `pnpm check`: ناجح.
- `pnpm test`: ناجح — 7 ملفات، 16 اختبارًا.
- `pnpm lint`: ناجح دون أخطاء ESLint؛ ظهر تحذير Node غير مانع عن نوع الوحدة في إعداد ESLint.
- `pnpm build`: ناجح — حزمة الخادم `dist/index.js` بحجم 112.7 kB.
- `npx expo export --platform web`: ناجح، و`dist/downloads/chatbro-latest.apk` يطابق ملف التحميل.
- `git diff --check`: ناجح.

## Android APK

- الاسم: `ChatBro-Android.apk`.
- الحزمة: `com.app.chatbro`، `versionName=1.0.2`، `versionCode=3`.
- `minSdk=24` و`targetSdk=36`، ABI: `arm64-v8a` فقط.
- الحجم: 97,598,019 بايت.
- `aapt`: معلومات الحزمة والإصدار مطابقة؛ `apksigner verify`: ناجح.
- التوقيع يستخدم Android Debug الافتراضي للتثبيت الجانبي؛ ليس توقيع متجر.
- لم يُثبّت APK على جهاز مادي. لا يتوفر بناء ARMv7 من `llama.rn` بسبب غياب `librnllama.so` لـARMv7؛ لذلك عُطل/استُبعد دعم هذه المعمارية بدل تسليم ملف غير موثوق.

## تحسينات الأجهزة

ملف الذاكرة الفعلية وسنة الجهاز يوجهان حدود النماذج. تتكيف قيم llama.cpp، ويُستخدم mmap وذاكرة KV من نوع q8_0 وسياق واحد. جرى تحديد سجل المحادثة بـ48 رسالة، وتأجيل تحرير السياق إلى ما بعد انتهاء التوليد إذا خرج المستخدم من الشاشة. حدود RAM تقديرية، ولا يمكن ضمان أداء متماثل على كل شريحة أو منع Android من إغلاق تطبيق عند نفاد ذاكرة النظام.

راجع `DEVICE_COMPATIBILITY_AR.md` و`BUILD_ANDROID_AR.md` و`README_DELIVERY_AR.md`.
