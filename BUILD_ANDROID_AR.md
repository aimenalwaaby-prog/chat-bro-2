# بناء Android وملف APK

## المتطلبات

- Node.js متوافق مع `package.json` و`pnpm`.
- Android SDK مع منصات/أدوات البناء التي يطلبها مشروع Expo وJDK متوافق.

## إعادة البناء

```bash
pnpm install --frozen-lockfile
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```

يوجد ملف التثبيت الناتج في:

```text
android/app/build/outputs/apk/release/app-release.apk
```

## ملاحظة توقيع

ملف APK المسلم هو **نسخة release موقعة بمفتاح Android debug الافتراضي** كي يمكن تثبيتها للاختبار والتجربة؛ ليس مفتاح نشر خاصًا بك ولا يُعد جاهزًا للنشر في Google Play. قبل النشر أنشئ keystore خاصًا، واحفظه خارج Git، واضبط `signingConfigs.release` ومتغيرات السر على بيئة البناء.

مفاتيح مزودي الذكاء الاصطناعي لا تدخل في APK؛ يجب ضبطها على خادم API كما هو موضح في `PROVIDERS_SETUP_AR.md`.
