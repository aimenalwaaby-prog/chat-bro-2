# مذكرة تسليم Chat Bro

تم بناء APK Release نهائي بعد إصلاح سبب الخروج الفوري عند الإقلاع. اسم الحزمة `com.app.chatbro`، الإصدار `1.0.0`، والحد الأدنى Android 7.0، مع دعم ARM64 وARMv7.

## سبب الخلل وإصلاحه

كشف Expo Doctor أن المشروع كان يخلط بين إصدارات Expo SDK 54 وSDK أحدث: كانت `expo-document-picker` و`expo-image-picker` بإصدارات غير متوافقة، وكان `expo-asset` مفقودًا رغم اعتماد `expo-audio` عليه. تم تثبيت الإصدارات الصحيحة، إضافة `expo-asset`، وإضافة plugins المطلوبة في `app.config.ts`. نتيجة Expo Doctor بعد الإصلاح: **18/18 فحصًا ناجحًا**.

## التحقق

نجح `pnpm check`، ونجحت الاختبارات الأربعة، ونجح بناء Android. APK موقّع وفق APK Signature Scheme v2، ومحاذاته صحيحة، ويحتوي على `arm64-v8a` و`armeabi-v7a`. فحص الحزمة لم يجد مفتاح API مضمّنًا.

## الخادم والمفاتيح

عنوان الخادم الافتراضي هو `https://chatbro-api.onrender.com`، ومسار الصحة يعمل. تبقى مفاتيح OpenRouter وAnthropic في Environment Variables على Render فقط. الملف المرفق سابقًا يحتوي سرًا خامًا واحدًا بلا اسم مزود، لذلك لم يُسند عشوائيًا إلى Claude أو OpenRouter.

## المزايا الإضافية

تمت إضافة دعم Claude عبر `ANTHROPIC_API_KEY`، وإضافة نماذج Claude الحالية، مع نماذج مستقبلية موسومة **قريبًا** ولا يمكن اختيارها قبل اعتماد معرفاتها ومفاتيحها. لم تُحذف النماذج المحلية أو نماذج OpenRouter الموجودة.
