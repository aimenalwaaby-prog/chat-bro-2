# بناء Android وملف APK

## المتطلبات

- Node.js وpnpm حسب `package.json`.
- JDK متوافق وAndroid SDK Platform 36 وBuild Tools 36.0.0 وNDK 27.1.12297006.

## إعادة البناء

يستهدف APK الحالي `arm64-v8a` فقط؛ السبب أن اعتماد `llama.rn` الأصلي لا يوفّر مكتبة Android لـARMv7. يبقى إصدار التطبيق 1.0.2، و`versionCode` الحالي 3.

```bash
pnpm install --frozen-lockfile
npx expo prebuild --platform android --no-install
cd android
./gradlew assembleRelease
```

المخرج:

```text
android/app/build/outputs/apk/release/app-release.apk
```

الحدود التقديرية للذاكرة المحلية وإعدادات الأجهزة موضحة في `DEVICE_COMPATIBILITY_AR.md`.

## التوقيع

نسخة APK المسلّمة **موقعة بمفتاح Android debug الافتراضي** للتثبيت الجانبي والتجربة؛ ليست موقعة بمفتاح نشر خاص ولا تُعد جاهزة للنشر في Google Play. قبل النشر في المتجر أنشئ keystore خاصًا، واحفظه خارج Git، واضبط `signingConfigs.release` ومتغيرات السر على بيئة البناء.

لا تدخل مفاتيح مزودي الذكاء الاصطناعي في APK؛ تُحفظ على خادم API كما هو موضح في `PROVIDERS_SETUP_AR.md`.
