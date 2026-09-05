# البنية المعيارية — Modular Architecture

> القرار: البناء من الصفر (لا يوجد workflow موجود). البنية التالية محايدة
> تقنيًا في تعريف الواجهات (contracts) بحيث يمكن تنفيذها كخدمة كود أو
> n8n workflows معيارية، ولا تحتاج كلمة مرور أو Token في أي مرحلة تصميم.

## 1) الوحدات (Modules)

```
┌─────────────── Telegram (Gateway) ───────────────┐
│  /start → اختيار لغة (العربية/English) → حالة المستخدم  │
└───────────────┬──────────────────────────────────┘
                ▼
┌─────────────── Auth ─────────────────────────────┐
│  إيميل @su.edu.eg + كلمة مرور (في الذاكرة فقط)         │
│  POST Security/login → JWT في الذاكرة               │
└───────────────┬──────────────────────────────────┘
                ▼  AUTHENTICATED
┌─────────────── Extraction ───────────────────────┐
│  نفس الجلسة: StudentID → Transcript/Registration/ │
│  Schedule/Advising/Grading/Attendance/Financial   │
│  النتيجة: {status: OK|EMPTY|FAILED, data, errors} │
└───────────────┬──────────────────────────────────┘
                ▼  DATA_VALIDATED
┌─────────────── Validation + Storage ─────────────┐
│  تحقق deterministic (مخطط + تعارضات) ثم حفظ موحّد     │
│  StudentData (schema-versioned) → DATA_SAVED      │
└───────────────┬──────────────────────────────────┘
                ▼  READY → Dashboard (من التخزين فقط)
┌─────────────── Services ─────────────────────────┐
│  Engine (خطط 12/18/21)  │  AI (ترتيب/شرح فقط)     │
│  Moodle (deadlines)     │  Reminders (بلا تكرار) │
│  Session/Refresh/Logout │  Diagnostics (بلا أسرار)│
└──────────────────────────────────────────────────┘
```

### 1.1 Gateway (Telegram)
- أول رسالة: اختيار اللغة. اللغة تُحفظ في حالة المستخدم وتُطبَّق على **كل**
  الرسائل والأزرار والأخطاء من جدول i18n واحد (`ar` / `en`).
- حالة المستخدم تتحكم بالأوامر المسموحة (لا يصل dashboard قبل `READY`).
- أزرار الـ Dashboard تُنشأ من كائن البيانات المخزَّن، **وليس** من إعادة فحص.

### 1.2 Auth (دخول آمن)
- التحقق: الإيميل يجب أن ينتهي بـ `@su.edu.eg` قبل أي طلب.
- كلمة المرور: كائن في الذاكرة فقط؛ تُصفَّر بعد الطلب؛ **لا** تُسجَّل، **لا**
  تُرسل للذكاء الاصطناعي، **لا** تدخل السجل التشخيصي ولا رسائل الخطأ ولا أي
  تصدير.
- آلة حالات صريحة (الإصلاح الجوهري — الدخول الناجح ≠ بيانات ناجحة):

```
START → LANG_SELECTED → AWAITING_CREDENTIALS → AUTHENTICATING
   ├─ فشل 401/403       → AUTH_FAILED → إعادة إدخال (مع throttling)
   └─ نجاح (JWT)        → AUTHENTICATED
AUTHENTICATED → EXTRACTING_DATA (سحب كامل في نفس الجلسة)
   ├─ فشل مؤقت          → إعادة (retry بتراجع مضاعف)
   ├─ فشل دائم          → EXTRACTION_FAILED (نبقي أي جزء سُحب، رسالة واضحة)
   └─ بيانات → DATA_VALIDATED (تطبيع + تحقق)
DATA_VALIDATED → DATA_SAVED (حفظ موحّد موقّع بالمخطط) → READY
READY → REFRESH (إعادة دورة الاستخراج) | LOGGED_OUT (إبطال الجلسة)
```

### 1.3 Extraction (طبقة الاستخراج — محولات لكل مسار)
- `StudentID` يُستخرج من الحمولة المُصادَق عليها (لكل مسارات API مفتاحها)،
  **منفصلًا عن الإيميل** — لا يُشتق من الإيميل أبدًا.
- نتيجة كل محوّل (envelope):
  ```json
  { "status": "OK | EMPTY | FAILED", "data": ..., "errors": [...] }
  ```
  - `EMPTY` = استجابة نجاح (200) بقائمة/كائن فارغ ⇒ «لا توجد بيانات» — حالة
    صحيحة تُعرض هكذا.
  - `FAILED` = خطأ (شبكة/HTTP/مخطط) ⇒ تُعاد المحاولة وفق السياسة ثم تُبلَّغ.
- التطبيع: تحويل إلى حقل موحّد (أسماء/تواريخ/أرقام موحّدة، إصلاح أخطاء
  الترميز العربية، تطبيع الأيام/الأوقات).

### 1.4 Validation + Storage (كائن موحّد دائم)
- مخطط واحد `StudentData` محفوظ دائمًا، يحمل `schemaVersion` و
  `extractedAt` و `validationReport`:

```jsonc
{
  "schemaVersion": 1,
  "student": {
    "studentId": "…",            // من البوابة — وليس من الإيميل
    "email": "…@su.edu.eg",
    "fullNameEn": "…", "fullNameAr": "…",
    "faculty": "…", "level": 1, "program": "…",
    "gpa": 3.4, "cgpa": 3.1,     // مع مصدرهما (فصل/سجل)
    "creditsEarned": 45,
    "enrollmentStatus": "…"
  },
  "courses": {
    "current":   [{ code, name, creditHours, section, status: "registered" }],
    "previous":  [{ code, name, creditHours, grade,   status: "completed" }],
    "dropped":   [{ code, name, creditHours, status: "dropped" }],
    "available": [{ code, name, creditHours, prerequisites, corequisites }]
  },
  "schedule": [{ day, timeFrom, timeTo, courseCode, section, location }],
  "advising": { "advisorName": "…", "allowedCourses": [], "forbiddenCourses": [],
                "advisingStatus": "…", "registrationApproved": false },
  "grades": { "activity": "…", "quizzes": "…", "attendancePercentage": 0.9 },
  "financial": { "summary": "…" },
  "moodle": { "enabled": true, "lastSync": "…", "assignments": [] },
  "metadata": { "schemaVersion": 1, "extractedAt": "…",
                "validationReport": { "passed": true, "checks": [] } }
}
```

- **كل أزرار البوت تقرأ من هذا الكائن فقط** (نفس المصدر دائمًا).
- الفرق بين «لا توجد بيانات» و«فشل الاستخراج» ظاهر في الحالة والرسالة، وليس
  في كائن فارغ مموّه.

### 1.5 Verification Engine (محرك deterministic)
- مدخلاته: البيانات المحقَّق منها + قواعد الكلية (ساعات، متطلبات، تعارضات).
- مخرجات الحسابات **قواعدية بحتة** (اختبارات unit إلزامية):
  - التوافقيات: المادة المسموح/الممنوع (من `Student_Advisor_Allowed_Forbidden_Courses_get`).
  - المتطلبات السابقة والمرافقة (prerequisites/corequisites).
  - تعارض الوقت مع الجدول الحالي، وتعارض الامتحانات.
  - حد الساعات: خطط 12 / 18 / 21 ساعة حسب القواعد الآمنة لكل مستوى.
  - الموازنة: تحميل الفصل + النتائج المتوقعة.
- **الذكاء الاصطناعي يُستدعى بعد الحساب فقط**: ترتيب الخيارات المتكافئة وكتابة
  الشرح بلغة المستخدم، على مدخلات مُتحقَّق منها — لا يقرر شيئًا بنفسه.

### 1.6 Moodle + Reminders
- ربط K-Moodle برمز (token) كل طالب (مشفر عند التخزين).
- المزامنة: جلب assignments و deadlines.
- **التذكيرات بلا تكرار:** بصمة فريدة لكل واجب
  `(courseCode + assignmentId + moduleId + timemodified)` تُحفظ في سجل
  الإرسال؛ لا تُرسل نفس الواجب مرتين؛ إعادة الإرسال فقط عند تغيّر المستند
  (موعد جديد أو درجة) — وبحد أقصى للتنبيهات لكل واجب.

### 1.7 Session / Refresh / Logout / Throttling / Retries
- **الجلسة:** لكل مستخدم كائن جلسة (token مشفَّر، منتهي الصلاحية، وقت الدخول)؛
  عند انتهاء الصلاحية: `AUTH_EXPIRED` → إعادة دخول دون فقدان البيانات المحفوظة.
- **Refresh:** دورة استخراج كاملة جديدة تُحدِّث StudentData (الجدول المتغير،
  المواد، GPA) مع الحفاظ على التاريخ السابق.
- **Logout:** إبطال الجلسة محليًا + `Security/logout` إن وُجد + مسح كلمة
  المرور والـ token من الذاكرة.
- **Throttling:** حد لعدد محاولات الدخول لكل chatId (مثلًا 5/15 دقيقة ثم
  قفل مؤقت)، وحد معدل عام على طلبات البوابة، وcooldown للمزامنات.
- **Retries:** للخطأ المؤقت فقط (شبكة، 5xx، 429، مهلة) مع تراجع مضاعف
  وبحد أقصى؛ **لا** إعادة لمحاولة دخول على 401/403 (خطأ دائم).

### 1.8 Diagnostics (سجل تشخيصي بلا أسرار)
- أحداث مسطّلة: المعرف الداخلي للمستخدم، الحالة، المسار، رمز الخطأ، المدة،
  correlationId — بدون: كلمة المرور، الـ token الكامل (مختصر: آخر 4)،
  محتوى الرسائل، بيانات شخصية زائدة.
- إخفاء (redaction) تلقائي للأنماط الحسّاسة قبل الكتابة.
- فترة احتفاظ محددة + طريقة مسح يدوي.

## 2) قواعد أمنية ثابتة للتنفيذ

1. كلمة المرور: ذاكرة فقط → صفر بعد الطلب (zeroize). ممنوع في: اللوجز،
   رسائل الخطأ، السياقات المدفوعة للـ LLM، الـ exports، التشخيص، الشات.
2. Bot Token و Moodle tokens: من مدير أسرار/متغيرات بيئة فقط — **لا** في
   الشيفرة أو الشات أو المستودع.
3. الـ JWT: يُحفظ مشفَّرًا في التخزين (مفتاح من البيئة)، ولا يُرسل إلا
   للمضيف الأصلي `unicodesis.su.edu.eg:150` (allowlist للمضيفين).
4. التحذير: بوابة الجامعة **HTTP بدون TLS** — صحيح أنها تصميم الجهة الأخرى،
   لكن نتحقق من متطلباته ويعامَل كمخاطرة موثقة.
5. المصادقة من Telegram إلى خدمتنا: تحقق من صرامة المدخلات، وقيود معدل،
   ورفض الرسائل الغريبة.

## 3) قرارات معلقة تحتاج المستخدم (لكي نكمل)

| القرار | الخيارات | أثرها |
| --- | --- | --- |
| بيئة التشغيل | n8n (استيراد workflows JSON) أم خدمة كود (Python/Node) | شكل التسليم بالكامل |
| التحقق من أشكال الاستجابات | fixture جلسة مُجرَّدة خارج الشات | جاهزية Phase 2 |
| قاعدة بيانات الحالة | SQLite/Postgres/Redis | تخزين StudentData والجلسات |
| حساب الاختبار | إن وُجد (خارج الشات، بيئة المستخدم) | فحص الدخول الحقيقي |

## 4) خطة الأطوار

| الطور | المحتوى | شرط البدء |
| --- | --- | --- |
| 1 | Gateway + Auth + آلة الحالات + Language i18n | تأكيد بيئة التشغيل |
| 2 | Extraction adapters لكل المسارات الموثقة | fixtures للاستجابات |
| 3 | Verification Engine + خطط 12/18/21 | طور 1-2 |
| 4 | Moodle + Reminders بلا تكرار | طور 3 + reachability |
| 5 | Session/Refresh/Throttling/Retries/Diagnostics (تغليف) | طور 1-4 |
