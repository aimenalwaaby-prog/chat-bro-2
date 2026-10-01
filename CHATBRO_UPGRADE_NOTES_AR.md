# Chat Bro 1.1.0 - التعديلات المنفذة

- القائمة الجانبية تبقى خارج الشاشة بالكامل ولا تظهر إلا بالسحب من الحافة اليمنى، مع إغلاق بالسحب/زر الرجوع ولمسة خارجية.
- تحسين حركة القائمة الجانبية باستخدام Spring native driver ومنطقة سحب حافة أوسع.
- إضافة نماذج محلية إضافية: Gemma 3 1B، Llama 3.2 1B، Phi-3.5 Mini، Qwen3 4B، مع التحقق من ملفات GGUF قبل التسجيل.
- إضافة مزودي المحادثة الأربعة: Google Gemini، Groq، OpenRouter، Cloudflare Workers AI. مفاتيحهم تبقى في الخادم ولا تُضمّن داخل APK.
- Gemini: جلب قائمة النماذج مباشرة من Gemini API.
- Groq: جلب النماذج من Models API واستخدام Chat Completions المتوافق مع OpenAI.
- Cloudflare Workers AI: دعم نماذج محددة من CLOUDFLARE_MODELS مع حساب Cloudflare وAPI Token.
- OpenRouter: تحديث مسار توليد الصور إلى Image API المخصص `/api/v1/images` بدل الاعتماد على Chat Completions لتوليد الصور.
- بحث الويب: الإبقاء على OpenRouter Web Search server tool، مع جعل مزودات Gemini/Groq/Cloudflare تعمل كمسارات محادثة مستقلة.
- تحديث /health لإظهار حالة Gemini/Groq/Cloudflare حتى تظهر الأدوات والموديلات بصورة صحيحة.
- تحديث `.env.example` بمتغيرات المزودين الأربعة.

متغيرات الخادم المطلوبة:
GEMINI_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_MODELS=@cf/meta/llama-3.1-8b-instruct,@cf/qwen/qwen1.5-7b-chat-awq

ملاحظة: لا تضع أي مفتاح API داخل كود التطبيق أو ملف APK. يجب ضبط المفاتيح في Environment Variables على الخادم ثم إعادة النشر.
