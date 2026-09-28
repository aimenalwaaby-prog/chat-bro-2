# تقرير التحقق النهائي

## البناء

- `pnpm install --frozen-lockfile`: ناجح
- `pnpm check`: ناجح
- `pnpm lint`: ناجح
- `pnpm test`: ناجح
- `pnpm run build`: ناجح
- `npx expo export --platform web`: ناجح
- `./gradlew assembleRelease --no-daemon`: ناجح

## APK

- الحزمة: `com.app.chatbro`
- النوع: Release
- الإصدار: `1.0.0` / versionCode `1`
- compile/target SDK: `36`

## Render

- API: `https://chatbro-api.onrender.com`
- Web: `https://chatbro-web.onrender.com`
- فحص الصحة: `/api/health` يعيد `ok: true`
- CORS من الواجهة إلى API ناجح.
- مسار الرسائل الصحيح هو `chat.complete`.

## ملاحظة مهمة

اختبار `chat.complete` يصل إلى الخادم، لكن إرسال رد نموذج فعلي يحتاج تفعيل مزود واحد على Render بإضافة مفتاحه السري (`BUILT_IN_FORGE_API_KEY` أو `OPENROUTER_API_KEY`) أو تشغيل Ollama/llama.cpp مع رابط الخدمة. لا يمكن تضمين مفاتيح سرية داخل APK أو اختلاقها من هذه البيئة.

ملف `android/local.properties` محلي فقط وتم استبعاده من ZIP حتى لا يحتوي مسار SDK خاص بهذه البيئة.
