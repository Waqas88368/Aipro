# فحص بوابة الجامعة — UnicodeSIS (su.edu.eg)

> تم هذا الفحص مباشرة على الموقع الحقيقي بتاريخ 2026-09-05 من بيئة التنفيذ.
> الهدف: تحديد طريقة عمل الموقع فعليًا بعد تسجيل الدخول، وليس الافتراض.

## 1. البنية العامة

- الواجهة: تطبيق Vue SPA واحد باسم `UMIS_Applicant` (`<div id="app">`، بدون HTML server-rendered).
  - الصفحة: `http://unicodesis.su.edu.eg/login`
  - لذلك **لا يوجد form HTML** يمكن scrape له — كل شيء عبر JSON API.
- خادم الويب: `Microsoft-IIS/10.0`، `X-Powered-By: UnicodeSIS`.
- خادم الـ API منفصل على منفذ مختلف: `http://unicodesis.su.edu.eg:150/api/`
  (مكتشف من الحزمة `app.070419a2.js`، الوحدة `84e7`).
- أصول ثابتة/صور على `http://unicodesis.su.edu.eg:90`.
- CORS يسمح بـ `Origin: http://unicodesis.su.edu.eg` مع `Authorization` header.

## 2. تسجيل الدخول (مُتحقق منه من الكود)

```
POST {base}/Security/login
Content-Type: application/json
body: { "username": "<local>@su", "password": "<password>" }
```

- حقل اسم المستخدم في النموذج هو نص حر، والتطبيق يلحق `@su` تلقائيًا:
  `username = e.Username + "@su"`.
  - الإيميل الجامعي هو `<local>@su.edu.eg`، أي أن الـ API يقبل الصيغة المختصرة `<local>@su`.
  - في بوتنا: نتحقق من أن الإيميل ينتهي بـ `@su.edu.eg`، ثم نرسل `<local>@su`.
- الاستجابة الناجحة: كائن فيه `Token` (JWT) — أو مصفوفة عنصرها الأول فيه `Token`.
  - نفس الاستجابة تحمل بيانات المستخدم كاملة (تُحفظ في `sessionStorage["user"]`).
- كل الطلبات اللاحقة:
  `Authorization: Bearer <Token>` + `withCredentials: true`
  (من interceptor الحزمة: `Bearer " + (t.token || t.Token)`).
- عند `401` يقوم التطبيق بتسجيل الخروج تلقائيًا (أي انتهاء الجلسة = إعادة تسجيل دخول).
- أخطاء الـ API تأتي في جسم الاستجابة كـ `{ "Message": "..." }` مع status مناسب.

## 3. نقاط البيانات بعد تسجيل الدخول (خريطة الـ API)

| القسم | Method | المسار |
|---|---|---|
| بيانات الطالب الأساسية | GET | `AR_StudentInfo/GetStudentData?StudentID=` |
| البيانات الشخصية | GET | `AR_StudentInfo/GetPersonalData?StudentID=` |
| السجل الدراسي (ترانسكريبت) | POST | `Transcript/SelectStudentTranscriptBySemester?StudentID=` |
| ملخص الفصل (GPA/CGPA غالبًا) | POST | `Transcript/SelectSTudentSemesterSummery?EnrollmentStudentId=` |
| المواد المسجلة حاليًا | GET | `StudentRegistration/StudentRegistrationCourses?StudentID=` |
| مواد التسجيل المخصص | GET | `StudentRegistration/StudentCustomRegistrationCourses?StudentID=` |
| مواد متاحة للاختيار | GET | `CurrentlyAchievedAcadimicLevel/GetCoursesForSelection?StudentID=` |
| طلبات/مواد محذوفة (سجل الطلبات) | GET | `AcademicAdvising/student_RequestCourses_Select?StudentID=` |
| الجدول | GET | `StudentSchedule/GetStudentSchedule?StudentID=` |
| الجدول الأساسي | GET | `StudentSchedule/StudentBasicCourses?StudentID=` |
| الساعات المعتمدة المسموحة | GET | `StudentRegistration/GetRegistrationCredits?StudentID=` |
| السنة الأكاديمية للطالب | GET | `AcademicYear_SemesterAPI/ARG_SelectAcademicYearByStudent?StudentID=` |
| حالة التسجيل | GET | `Lookup/GetEnrollmentStatus` |
| الفصل النشط | GET | `Lookup/GetActiveAvailableSemester` |
| حالة الطالب الأكاديمية | GET | `AcademicAdvising/GetStudentState?StudentID=` |
| الغياب | GET | `StudentAttendance/GetAbsenceDatails?StudentID=` |
| الحساب المالي | GET | `CashReceipts/GetStudentAccountDetails?StudentID=` |
| المعادلات/التحويل | GET | `Transfer_Advising/GetStudentEquivalentTransferTranscript?StudentID=` |
| تغيير كلمة المرور | POST | `ExternalLogin/ChangeMyPassword` |

ملاحظة: توجد نسخة ثانية من الجدول والمواد المسجلة تحت
`RegistrationRequest/GetStudentSchedule?StudentId=` و `RegistrationRequest/GetRegistrationCourses?StudentId=`.

## 4. حالة التحقق الحية (الأمانة العلمية)

- ✅ مُتحقق منه فعليًا: بنية SPA، خادم الـ API على المنفذ 150، مسار الدخول وصيغة `username@su`،
  آلية `Bearer`، شكل الأخطاء `{Message}`، وخريطة الـ endpoints أعلاه (مستخرجة من كود الواجهة الرسمي).
- ⚠️ غير مُتحقق منه بعد (يتطلب جلسة حقيقية):
  1. **شكل JSON الفعلي** لكل استجابة (أسماء الحقول مثل `StudentData`، `GPA`، `CGPA`، صفوف الجدول...).
     الكود مكتوب بشكل دفاعي (يبحث عن عدة أسماء حقول مرشحة) لكنه يحتاج جلسة حقيقية ليُثبَّت.
  2. معاملات `SelectStudentTranscriptBySemester` و `SelectSTudentSemesterSummery` (body/params الإضافية).
  3. تصنيف "المواد المحذوفة" — هل تأتي من سجل الطلبات أم من حالة في بيانات التسجيل.
- ⛔ وقت الفحص: خادم الـ API على المنفذ 150 كان يعيد `503 Service Unavailable` ثم timeout.
  أي أن الـ API **متوقف حاليًا** (وليس محجوبًا عنا: خادم الويب نفسه استجاب من نفس البيئة).

## 5. كيف نكمل التحقق

1. يشغّل المستخدم البوت محليًا بإيميله وكلمة مروره (عبر env أو عبر البوت نفسه — لا تُرسل الأسرار هنا).
2. أمر تشخيصي `diag` يطبع لكل قسم: status + عدد العناصر + أول حقلين (بدون قيم حساسة).
3. نثبّت أسماء الحقول الحقيقية في `normalize.ts` ثم نزيل علامة "pending".
