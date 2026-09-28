# تشغيل النماذج المحلية داخل الهاتف

- تمت إضافة `llama.rn` لتشغيل GGUF داخل تطبيق React Native مباشرة، بدل Ollama/Render.
- تمت إضافة مدير محلي مستقل في `lib/local-runtime.ts`.
- النماذج المحلية تُنزّل إلى مساحة التطبيق وتُشغّل من الملف المحلي.
- تمت إضافة محادثة مستقلة `local-chat.tsx` لا تمر عبر `server/routers.ts`.
- تظهر تبويب المحادثة المحلية بعد وجود أول نموذج مثبت.
- تم وضع فحص تقريبي للذاكرة وتحذير للنماذج الثقيلة.
- تم تقييد Android build إلى `arm64-v8a` لأن llama.rn يدعم Android arm64-v8a/x86_64، وليس armeabi-v7a.
- OpenRouter بقي في المسار السحابي، وتمت إضافة `openrouter:web_search` و`openrouter:web_fetch` لتمكين المعلومات الحديثة عند استخدام النماذج السحابية.
- مفتاح OpenRouter منفصل عن `MODEL_GATEWAY_API_KEY`.

ملاحظة البناء: يجب تشغيل تثبيت الحزم ثم إعادة بناء Android لأن `llama.rn` مكتبة Native وليست JavaScript فقط.
