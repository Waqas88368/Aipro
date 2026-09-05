# مساعد الجامعة الذكي على تيليجرام — AI University Student Assistant

> حالة الرد على سؤال «أرسل Export الـ workflow الحالي أو قل: ابدأ من الصفر»:
> **لا يوجد أي n8n workflow في هذا المستودع (المستودع كان فارغًا تمامًا عند البدء) — إذن: «ابدأ من الصفر»**،
> وبُنيت نسخة **Modular من الصفر** (Gateway / Auth / Extraction / Storage / AI / Reminders) كما هو موضح أدناه.

## 1. القرارات الأساسية

| النقطة | القرار | السبب |
|---|---|---|
| n8n | لا يوجد workflow → بناء مستقل بدون n8n | المستودع فارغ، والكود قابل للاختبار محليًا ويمكن لاحقًا تغليفه داخل n8n إذا استدعت الحاجة |
| لغة التنفيذ | TypeScript خالص بلا أي مكتبات runtime (صفر اعتماديات) | قليل المخاطر، سهل التدقيق، يعمل على Node 24 بنظام type-stripping المدمج |
| كلمة المرور | تُستخدم في الذاكرة لنداء دخول واحد فقط، **لا تُخزّن ولا تُسجّل ولا تُرسل لأي AI** | شرط الأمان الأساسي |
| التحقق من البيانات | محرك حتمي (deterministic) 100% — الـ AI يُرتّب ويشرح فقط | شرطك: كل التحقق والتخطيط حتمي |
| نجاح الدخول ≠ نجاح الاستخراج | حالة آلية انتقالية منفصلة لكل مرحلة | الإصلاح الجوهري المطلوب |

## 2. المعمارية (Modular)

```
src/
  config.ts            قراءة env والتحقق
  diag/logger.ts       سجل تشخيصي بتمويه الأسرار (password/token/authorization → [REDACTED]) + ملف حلقي bounded
  i18n/ar.ts, en.ts    كل الرسائل والأزرار والأخطاء من كتالوجات موحّدة (اختيار اللغة أول خطوة، تُحفظ لكل مستخدم)
  domain/
    state.ts           آلة الحالة: NEW → LANGUAGE_SET → AUTHENTICATING → AUTHENTICATED → EXTRACTING_DATA →
                       DATA_VALIDATED → DATA_SAVED → READY (+ حالات فشل منفصلة AUTH_FAILED/EXTRACTION_FAILED/VALIDATION_FAILED)
    academic.ts        كائن البيانات الموحّد + التطبيع + التحقق، والتفريق بين «فارغة» و«فشل الاستخراج» لكل قسم
    engine.ts          المحرك الحتمي: متطلبات سابقة، تعارض مواعيد، خطط 12 / 18 / 21 ساعة (تعداد محصّن ومحدود)
  storage/store.ts     تخزين دائم (JSON ذري بكتابة عبر tmp+rename) — يحتوي التوكن للـ refresh فقط، لا كلمة مرور
  portal/
    client.ts          عميل بوابة UnicodeSIS الحقيقية: دخول + Bearer + throttling + إعادة محاولة للأخطاء المؤقتة
    extractor.ts       سحب كل الأقسام بنفس الجلسة، status لكل قسم: success | empty | failure
  ai/ranker.ts         تخطيط/شرح فقط؛ fallback حتمي عند غياب المفتاح؛ لا يرى أي أسرار
  moodle/client.ts     محوّل Moodle/K-Moodle (REST) — تحقق حي معلّق
  reminders/           إرسال تذكيرات بدون تكرار (dedupe بمعرّف الواجب + موعد التسليم)
  gateway/
    telegram.ts        عميل Bot API بـ long-polling (صفر اعتماديات)
    handlers.ts        الـ flows ولوحات الأزرار — كلها تقرأ من نفس مصدر البيانات المحفوظ
  app.ts               التوصيل + health endpoint + دوران الـ polling والتذكيرات
docs/portal-research.md  نتائج الفحص الحي لبوابة الجامعة (مصدر كل الـ endpoints)
```

## 3. آلة الحالة — نجاح الدخول لا يعني نجاح الاستخراج

```
NEW ─(اختيار اللغة)─▶ LANGUAGE_SET ─(إيميل/باسورد)─▶ AUTHENTICATING ─▶ AUTHENTICATED
AUTHENTICATED ─▶ EXTRACTING_DATA ─▶ DATA_VALIDATED ─▶ DATA_SAVED ─▶ READY (Dashboard فقط هنا)
                                                    │
        AUTH_FAILED ◀── فشل الدخول (401/بيانات خاطئة/البوابة 503)
        EXTRACTION_FAILED ◀── أي قسم أساسي فشل → يظهر تقرير الأقسام الفاشلة، لا Dashboard
        VALIDATION_FAILED ◀── البيانات استُخرجت لكن لم تجتز الفحوصات الحتمية
```

- **الفارغ يختلف عن الفاشل**: كل قسم له `status: success|empty|failure`؛ القسم الفارغ حالة صحيحة (لا مواد مسجلة)،
  والقسم الفاشل خطأ يُعرض ويُعاد التحديث. المادة المحذوفة/المنسحبة لا تُحسب في الخطة ولا تُلبي متطلباتًا سابقة.
- **Dashboard** لا يظهر إلا بعد `READY`، وكل أزراره (الملف، GPA، المواد، الجدول، الخطط، الواجبات، refresh، logout، اللغة)
  تقرأ من كائن البيانات المحفوظ نفسه.

## 4. ما تم فحصه فعلًا في البوابة (وليس تخمينًا)

تفاصيل كاملة في `docs/portal-research.md`. الخلاصة:
- الواجهة Vue SPA بدون أي form HTML → كل شيء عبر JSON API على `http://unicodesis.su.edu.eg:150/api/`.
- الدخول: `POST Security/login` بـ `{username: "<local>@su", password}` — أي أن الإيميل `x@su.edu.eg` يُرسل مختصرًا `x@su`.
- كل الطلبات بـ `Authorization: Bearer <Token>` (JWT، من استجابة الدخول نفسها). الأخطاء `{Message}` + 401 = انتهاء الجلسة.
- خريطة endpoints كاملة مستخرجة من حزم الواجهة الرسمية (GetStudentData، GetPersonalData، Transcript/sec،
  StudentSchedule، StudentRegistrationCourses، GetCoursesForSelection، GetRegistrationCredits، وغيرها).

**الأمانة العلمية — ما زال معلقًا (لا أدّعي أن الـ scraping جاهز قبل فحصه):**
1. ⚠️ شكل JSON الفعلي لكل استجابة بعد دخول بجلسة حقيقية — الكود مكتوب بشكل دفاعي (يبحث عن عدة أسماء حقول) لكن لم يُثبَّت.
2. ⚠️ معاملات `SelectStudentTranscriptBySemester` و `SelectSTudentSemesterSummery`.
3. ⛔ أثناء الفحص كان خادم الـ API على المنفذ 150 يعيد `503` ثم timeout — أي أن **سكربت الفحص الحي لم يكتمل لأن الخادم متوقف**.
4. Moodle/K-Moodle: المحوّل مبني على بروتوكول Moodle REST القياسي؛ التحقق الحي يحتاج توكن المستخدم.
   التذكيرات تعمل بدون تكرار حسب `docs` (حقل `notified` محفوظ).

## 5. سياسة الأسرار (لا ترسل شيئًا منها هنا)

- `BOT_TOKEN`: من .env — لا يُرسل في الشات أبدًا.
- باسورد البوابة: يُدخله المستخدم للبوت أو من env؛ يُستخدم مرة واحدة، ثم يُتخلص منه.
  الـ logger يموّه أي مفتاح `password/token/authorization` حتى لو وصل بالخطأ.
- التوكن (JWT) يُخزّن على القرص `data/store.json` لإتاحة الـ refresh بدون إعادة كلمة مرور — الملف حساس.
- الـ AI لا يستقبل أبدًا: باسورد، توكنات، أو إيميلات.

## 6. التشغيل والاختبار

```bash
npm install                 # اعتماديات تطوير فقط (TypeScript + @types/node)
cp .env.example .env        # ضع BOT_TOKEN فقط؛ PORTAL_EMAIL/PORTAL_PASSWORD اختياريان
npm start                   # long-polling + health على المنفذ PORT
npm run check               # tsc --noEmit + node --test (25 اختبارًا)
```

## 7. خارطة الطريق للتحقق الحي (بالترتيب)

1. شغّل البوت محليًا بإيميلك الحقيقي (لا ترسل الباسورد هنا — ضعه في .env على جهازك).
2. بعد `READY`، نفّذ التحقق من أسماء الحقول الفعلية (أمر `diag` قادم) وثبّت `normalize*` بالمطابقات الحقيقية.
3. أثبِت معاملات الترانسكريبت وملخص الفصل، ثم ارفع علامة `pendingLiveVerify`.
4. اربط Moodle بتوكنك وأكّد التذكيرات بلا تكرار.
5. (اختياري) ضع مفتاح AI — عندها فقط يُستخدم الترتيب بالذكاء الاصطناعي، مع بقاء المحرك الحتمي هو الحكم.
