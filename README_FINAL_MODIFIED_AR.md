# تقرير تعديل Chat Bro

## الخلاصة

تم الحفاظ على جميع ملفات المشروع الحالية، ولم تُحذف أي نماذج أو مزودين أو روابط. عدد النماذج في الكتالوج قبل التعديل وبعده: **48 نموذجًا**.

تم ضبط التطبيق ليستخدم خادم الإنتاج:

`https://chatbro-api.onrender.com`

مع إبقاء إمكانية تجاوز الرابط عبر `EXPO_PUBLIC_API_BASE_URL` للتطوير المحلي أو الاستضافة الذاتية.

## ما تم تعديله

- `constants/oauth.ts`
  - تثبيت رابط `https://chatbro-api.onrender.com` كخادم افتراضي للنسخة الإنتاجية.
  - إبقاء متغير البيئة كخيار تجاوز.
- `lib/trpc.ts`
  - رفع مهلة الطلب إلى 60 ثانية.
  - إضافة إعادة محاولة متدرجة لمساعدة خدمة Render على الاستيقاظ بعد النوم.
- `lib/_core/api.ts`
  - إضافة مهلة وإعادة محاولة لطلبات REST.
  - تحويل فشل الاتصال إلى رسالة عربية مفهومة مع إبقاء التفاصيل في Console.
- `server/_core/index.ts`
  - تحسين CORS وإضافة `Vary: Origin`.
  - إبقاء `/health` و`/api/health` بصيغة JSON واضحة.
  - إضافة ردود JSON لمسارات 404 وأخطاء 500 بدل صفحات HTML.
- `app/(tabs)/chat.tsx`
  - عرض حالة النموذج ومتطلبات API Key داخل قائمة النماذج.
  - رسائل مختلفة للمهلة، فشل الاتصال، نقص المفتاح، وتجاوز الحصة.
- `shared/chatbro-web-sites.ts`
  - إصلاح فواصل ناقصة كانت تمنع TypeScript والبناء، مع الحفاظ على جميع الروابط.
- `tests/auth.logout.test.ts`
  - إصلاح تحويل نوع اختبار موجود مسبقًا لإكمال فحص TypeScript.
- `.env.example` و`README_CONNECTION_FIX_AR.md`
  - توثيق رابط Render والإعدادات الجديدة.

## التحقق

- `pnpm check`: ناجح.
- `pnpm test`: ناجح — 3 ملفات، 4 اختبارات.
- `pnpm build`: ناجح — تم تجميع خادم الإنتاج.
- الخادم المحلي: نجح `/health` و`/api/health` وطلبات CORS و404 بصيغة JSON.
- قائمة النماذج: 48 نموذجًا محفوظة دون حذف.

## النماذج ومتطلبات التشغيل

- النماذج السحابية المدمجة تحتاج إعداد `BUILT_IN_FORGE_API_KEY` على Render.
- نماذج OpenRouter تحتاج `OPENROUTER_API_KEY`.
- نماذج Ollama تحتاج خدمة Ollama وضبط `OLLAMA_BASE_URL`.
- نماذج llama.cpp تحتاج خدمة متوافقة وضبط `LLAMA_CPP_BASE_URL`.
- بوابات النماذج تحتاج `MODEL_GATEWAY_BASE_URL` أو `MODEL_GATEWAYS_JSON`.

لا يمكن من داخل APK أو من هذه البيئة اختلاق مفاتيح المزودين أو تشغيل نماذج خارجية لا تحتوي خدمة Render على مفاتيحها. التطبيق لا يحذف هذه النماذج عند غياب المفاتيح، بل يعرض حالتها ومتطلباتها.

## إعدادات Render المضافة

- خادم API: `https://chatbro-api.onrender.com`
- مستضيف الويب: `https://chatbro-web.onrender.com`
- فحص الصحة: `GET /api/health`
- متغيرات الواجهة العامة المضافة إلى مضيف الويب:
  - `EXPO_PUBLIC_API_BASE_URL=https://chatbro-api.onrender.com`
  - `EXPO_PUBLIC_OAUTH_SERVER_URL=https://api.manus.im`
  - `EXPO_PUBLIC_OAUTH_PORTAL_URL=https://manus.im`
  - `EXPO_PUBLIC_APP_ID=77Jvovp6K2UDiC56uFD6LT`

## ملاحظة خدمات الذكاء الاصطناعي على Render

أثناء التحقق النهائي، أصبح API والواجهة في حالة `live`، وأعاد `/api/health` حالة `ok: true`. أظهرت الاستجابة أن مفاتيح LLM وOpenRouter وOllama والبوابة غير مفعلة حاليًا على Render؛ يلزم إدخال مفاتيحها السرية من لوحة Render حتى تعمل هذه المزودات فعليًا.

## البناء

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
cd android
./gradlew assembleRelease
```

## تسجيل الدخول والملف الشخصي

تمت إزالة اعتماد شاشة الإعدادات على تسجيل دخول Manus أو Google. أصبح المستخدم قادرًا على إنشاء ملف شخصي محلي اختياري يتضمن الاسم، نوع الاستخدام، نبذة قصيرة، حتى خمسة نماذج مفضلة، وصورة شخصية. تُحفظ هذه البيانات عبر SecureStore على Android أو localStorage على الويب، ولا تُرسل إلى الخادم ولا تحتاج حسابًا أو كلمة مرور. يمكن تعديل الملف أو حذفه دون حذف المحادثات.
