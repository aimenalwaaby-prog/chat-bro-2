# تقرير التحقق — Chat Bro Android 1.0.2

## البناء والفحوص

- `pnpm check`: ناجح.
- `pnpm test`: ناجح — 7 ملفات و15 اختبارًا.
- `pnpm lint`: ناجح؛ تحذير Node عن نوع الوحدة في ملف إعداد ESLint غير مانع.
- `pnpm build`: ناجح.
- `npx expo export --platform web`: ناجح، ويضم APK في مسار التنزيل العام.
- `./gradlew assembleRelease`: نجح من إعداد Android المولّد بواسطة Expo.
- `aapt` و`apksigner verify`: ناجحان.

## APK

الحزمة `com.app.chatbro`، الإصدار 1.0.2 (`versionCode=3`)، `minSdk=24`، `targetSdk=36`، ومعمارية `arm64-v8a`. موقّع بمفتاح Android Debug للتثبيت الجانبي؛ لم يُختبر على هاتف فعلي ولا يصلح توقيعًا للنشر في Google Play.

`llama.rn` لا يوفّر مكتبة ARMv7 اللازمة للتشغيل المحلي، لذلك لا يتضمن APK نسخة 32-bit. تكييف الذاكرة للنماذج المحلية والحدود التقديرية موثقة في `DEVICE_COMPATIBILITY_AR.md`.

## أسرار ونشر

مفاتيح المزودين لا تُحفظ في APK أو المصدر، بل في إعدادات الخادم. يُستبعد `android/local.properties` من أرشيف المشروع كي لا يتضمن مسار Android SDK المحلي. انشر تغييرات المصدر إلى `main` لتشغيل النشر التلقائي لخدمات Render المرتبطة بالمستودع.
