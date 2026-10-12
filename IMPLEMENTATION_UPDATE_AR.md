# تحديث Chat Bro — مزودات الصور ومصادر النماذج

## ما تم تنفيذه

- إضافة خزنة مفاتيح مستخدم مشفرة بـ AES-256-GCM في `server/_core/user-key-vault.ts`.
- إضافة جدول `provider_keys` وترحيل `drizzle/0003_provider_keys.sql`.
- إضافة شاشة `provider-keys` لإضافة مفاتيح OpenAI-compatible وHugging Face وReplicate وOllama، مع تحديد هل المفتاح للمحادثة أو الصور أو الاثنين.
- ربط المفتاح المختار بالمحادثة وحفظ اختياره مع سجل المحادثة المحلي.
- إضافة مزود صور مخصص عبر `POST /images/generations` مع تخزين الناتج وإعادته للتطبيق.
- تصحيح مزود OpenRouter للصور:
  - النموذج الافتراضي أصبح `openai/gpt-image-1` بدل `openai/gpt-5-image`.
  - الصور المرجعية ترسل بصيغة `input_references` الموثقة ككائنات `image_url`.
- إضافة شاشة `model-repositories` لاكتشاف المصادر المدعومة بقوالب صريحة:
  - GitHub: `owner/repository`
  - GitLab: `group/project`
  - Bitbucket: `workspace/repository`
  - Hugging Face: `owner/model`
  - ModelScope: `owner/model`
  - Kaggle Models: `owner/model`
  - Ollama: `qwen2.5:7b`
  - Replicate: `owner/model`
  - Civitai: رقم model
  - OpenRouter: `provider/model`
  - Together AI: `provider/model`
  - Groq: معرف النموذج
  - NVIDIA NGC: معرف الكتالوج
  - Docker Hub: `namespace/image`
  - OpenAI-compatible: `https://host.example/v1`
- إضافة كتالوج رسمي ثابت من 30 مصدرًا حدده المستخدم، يتضمن Hugging Face Models وGGUF وOllama وllama.cpp وMLC LLM وONNX وTransformers وCandle وOpenVINO وExecuTorch وLiteRT وwhisper.cpp وPiper وRWKV وMamba وSmolLM وCoreNet وMiniCPM وLLaVA وOpenCLIP وFish Speech وChatTTS وFunASR وOpen-Sora وCogVideo وKandinsky وStable Diffusion WebUI وComfyUI وGPT4All وLocalAI.
- إضافة بحث فعلي في GitHub وHugging Face عبر API الخادم، وفحص فعلي لملفات GitHub/GitLab/Bitbucket/Hugging Face/Civitai وواجهات النماذج المستضافة.
- حفظ المستودع في قاعدة البيانات مع حالة `added/syncing/synced/installing/installed/failed`.
- إضافة مزامنة فعلية تقرأ manifests وREADME وconfig وtokenizer وملفات JSON/النصوص.
- إضافة قراءة آمنة للأرشيفات وAPK كـ ZIP مع قائمة المحتويات، وحدود للحجم وعدد الملفات ومنع المسارات الخطرة.
- إضافة تثبيت حقيقي لـ Ollama عبر `/api/pull`، وتفعيل مسارات OpenRouter/Together/Groq/OpenAI-compatible كنماذج مستضافة، وتنزيل artifacts الصغيرة إلى التخزين.
- تشغيل نماذج Ollama المثبتة عبر OpenAI-compatible `/v1/chat/completions` داخل المحادثة.
- إضافة روابط مستقلة في القائمة الجانبية للمفاتيح والمستودعات.
- تشديد رفع الملفات ليحتاج تسجيل الدخول والتحقق من ملكية المحادثة.
- تشديد التفريغ الصوتي لمنع روابط HTTP وعناوين الشبكات الخاصة، مع timeout وحد حجم.
- تشديد فحص مفاتيح التخزين ومنع المسارات غير الآمنة.
- جعل CORS fail-closed في الإنتاج عند غياب المصدر المسموح.
- إصلاح GitHub Actions ليتوافق مع pnpm وNode 22 وscripts المشروع الفعلية.
- تحسين رسائل أخطاء البوابات لتشمل جزءًا محدودًا من سبب رفض المزود.

## لماذا لم تكن بعض النماذج تعمل؟

### OpenRouter

كان الاسم الافتراضي القديم `openai/gpt-5-image` غير مضمون في واجهة الصور الحالية. تم تغييره إلى `openai/gpt-image-1`. كما أن OpenRouter يوثق الصور المرجعية على شكل كائنات `image_url`، وليس قائمة نصوص URL فقط. تم تصحيح الشكل.

يجب أن يكون النموذج الظاهر في كتالوج OpenRouter مخصصًا لإخراج الصور. لا يكفي أن يكون نموذجًا متعدد الوسائط لفهم الصور؛ فالإدخال والإخراج قدرات منفصلة.

### Gemini

Gemini لا يستخدم `/chat/completions`. المسار الصحيح هو:

```text
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
```

ويجب أن يكون `model` معرفًا حقيقيًا من قائمة النماذج. الكود ينظف بادئة `models/`، لكن معرفًا قديمًا أو نموذجًا لا يدعم `generateContent` سيؤدي إلى 400/403. كما أن الكود كان يجمع أخطاء المفاتيح في رسالة عامة، لذلك أصبح تشخيص المفتاح والنموذج أهم من تجربة معرفات ثابتة قديمة.

### Anthropic

Anthropic يستخدم Messages API وليس OpenAI Chat Completions. المسار الصحيح هو `/v1/messages` ويحتاج `max_tokens` و`messages` و`model` وترويسة `anthropic-version`. المسار الموجود يطابق ذلك، لكن النموذج يجب أن يكون معرفًا متاحًا للحساب، ويجب أن تكون الفوترة/الصلاحية مفعلة.

### البوابات وHugging Face وMistral وDeepInfra وNVIDIA وFireworks

هذه تعتمد على OpenAI-compatible، لكن هناك ثلاثة شروط متكررة:

1. عنوان `baseUrl` يجب أن يحتوي الجزء الصحيح مثل `/v1` أو `/v1/openai` بحسب المزود.
2. معرف النموذج يجب أن يطابق قيمة `id` التي يعيدها endpoint `/models` حرفيًا.
3. ليس كل نموذج في الكتالوج يدعم `chat/completions`؛ بعض النماذج توليد نص خام أو embedding أو صور فقط.

تم تحسين رسالة الخطأ لتضمين رد المزود المختصر بدل الاكتفاء بـ HTTP status فقط.

## التحقق النهائي

- `pnpm check`: ناجح.
- `pnpm test`: ناجح — 8 ملفات، 19 اختبارًا.
- `pnpm build`: ناجح — `dist/index.js` بحجم يقارب 130.9 KB.
- `pnpm lint`: ناجح، مع تحذير معروف متعلق بـ `eslint.config.js` وعدم وجود `type: module` في `package.json`.

## التشغيل

أضف هذه المتغيرات على الخادم:

```env
JWT_SECRET=قيمة طويلة عشوائية
KEY_VAULT_SECRET=قيمة طويلة مستقلة لتشفير مفاتيح المستخدمين
ALLOWED_ORIGINS=https://واجهة-التطبيق
VOICE_ALLOWED_HOSTS=chatbro-api.onrender.com
GITHUB_TOKEN=اختياري لتحسين حدود GitHub API
```

يجب تشغيل migration `drizzle/0003_provider_keys.sql` قبل استعمال شاشة المفاتيح. لا تضع `KEY_VAULT_SECRET` أو مفاتيح المزودات داخل تطبيق الهاتف أو متغيرات `EXPO_PUBLIC_*`.

يجب أيضًا تشغيل `drizzle/0004_model_sources.sql` قبل استعمال إدارة المستودعات. لتثبيت وتشغيل Ollama فعليًا، اجعل `OLLAMA_BASE_URL` قابلًا للوصول من خادم Chat Bro. لا ينفذ الخادم APK عشوائيًا؛ يقرأه ويفحصه كأرشيف ويخزنه كأثر قابل للتنزيل، بينما تثبيت APK على Android يحتاج مسارًا أصليًا وصلاحية Package Installer.

## مراجع التحقق

- [1]: https://openrouter.ai/docs/guides/overview/multimodal/image-generation "OpenRouter Image Generation"
- [2]: https://ai.google.dev/api/generate-content "Gemini generateContent API"
- [3]: https://platform.claude.com/docs/en/api/messages "Anthropic Messages API"
- [4]: https://developers.openai.com/api/reference/overview/ "OpenAI API Overview"
