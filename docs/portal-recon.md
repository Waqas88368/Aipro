# استطلاع بوابة UniCodeSIS — بالأدلة

> تاريخ الفحص: 2026-09-05. الطريقة: جلب صفحات/حزم JS عامة من البوابة وفحصها
> نصيًا (لا يوجد أي تسجيل دخول، ولا أي بيانات اعتماد). كل ما يلي مبني على
> أدلة ملموسة من الشيفرة المنشورة للواجهة، وليس تخمينًا.

## 1) المكدس التقني

- **الخادم:** Microsoft-IIS/10.0 — `X-Powered-By: UnicodeSIS`
- **الواجهة:** تطبيق SPA مبني بـ **Vue 2** (webpack: `chunk-vendors` + `app.js`)،
  العنوان `UniCode_Portal`، الاسم الداخلي `UMIS_Applicant`
- **البروتوكول:** HTTP فقط (بدون TLS) على `http://unicodesis.su.edu.eg`
- **كل المسارات** (`/`, `/login`, `/newhome`, `/Dataapp`, ...) تُرجع نفس قشرة SPA
  (IIS SPA fallback) — لا يوجد تطبيق منفصل بمسار مختلف على هذا المضيف
- **قاعدة API واحدة** مدمجة في الحزمة:
  `http://Unicodesis.su.edu.eg:150/api/` (منفذ 150)
- **صور الملف الشخصي:** `http://unicodesis.su.edu.eg:90` + المسار

## 2) تدفق الدخول (مؤكد من الشيفرة)

1. النموذج يأخذ **Username** و **Password** (حقل `Username`، placeholder
   "Username").
2. يرسل الطلب:
   `POST http://unicodesis.su.edu.eg:150/api/Security/login`
   بجسم JSON:
   ```json
   { "username": "<Username>@su", "password": "<Password>" }
   ```
   **مهم:** الواجهة تلحق `@su` بالاسم المُدخل. لذلك إذا أدخل الطالب إيميله
   الكامل `x@su.edu.eg` فسيُرسل `x@su.edu.eg@su` (خطأ). الافتراض المعقول أن
   الاسم المطلوب هو الجزء المحلي من الإيميل (`x` → `x@su`)، **لكن هذا غير
   متحقق منه** ويجب فحصه بجلسة حقيقية قبل البناء عليه.
3. الاستجابة الناجحة: كائن فيه `Token` (أو مصفوفة `[0].Token`). الـ Token هو
   **JWT** (الواجهة تستدعي `parseJwt` على الـ Token لفحص حالة الدخول).
4. التخزين العميل: `sessionStorage.user` = كامل الاستجابة.
5. كل الطلبات اللاحقة ترسل:
   `Authorization: Bearer <token>` (يقرأ `token` أو `Token` من الكائن)، مع
   `withCredentials: true`.
6. على **HTTP 401** تخرج الواجهة من الجلسة وتعيد التوجيه إلى `/login`.
7. خروج: `sessionStorage.clear() + localStorage.clear()` (عميل فقط).

**كائن المستخدم (حقول ظاهرة في الشيفرة):** `FirstNameEN`, `LastNameEN`,
`URLPathPhoto`, `UserIDSerial`, `ApplicantID`, `LoginInfo[]` (قوائم/أدوار
تُدار من الخادم: `RoleName`, `ViewURL`), `Token`.

**اصطلاح الأخطاء:** الأخطاء تُرجع `response.data.Message`؛ **HTTP 404 = «لا
توجد بيانات»** (وليس خطأ) — تُستخدم في الواجهة لإظهار «لا بيانات».

## 3) خريطة مسارات API الخاصة بالطالب (مؤكدة من الحزم)

كل المسارات تبدأ من القاعدة `http://Unicodesis.su.edu.eg:150/api/` وتُستدعى
بمفتاح `StudentID` (إلا ما نُصّ عليه).

### الهوية والوصول
| المسار | الغرض |
| --- | --- |
| `Security/login` (POST) | الدخول — `{username, password}` |
| `Security/ExternalStudentLogin` (POST) | دخول خارجي بالاسم فقط (بدون كلمة مرور) |
| `Security/GetRegesterdUserData?ApplicantID=` | بيانات المستخدم المسجَّل |
| `Security/EmailListByApplicantCode?ApplicantCode=` | استرجاع إيميل بالكود |
| `Security/EmailListByNationalId?NationalId=` | استرجاع إيميل بالرقم القومي |
| `Security/SendPasswordToMail?ApplicantId=` | إرسال كلمة المرور للبريد |
| `ActiveDirectory/ValidateEmail?email=` | التحقق من صحة إيميل AD |
| `ActiveDirectory/checkStudent?ApplicantId=` | فحص حالة الطالب |
| `ExternalLogin/ChangeMyPassword?userName=&currentPassword=&newPassword=` | تغيير كلمة المرور |

### السجل الأكاديمي (GPA/CGPA)
| المسار | الغرض |
| --- | --- |
| `Transcript/SelectStudentTranscriptBySemester?StudentID=` | السجل بالفصل |
| `Transcript/SelectSTudentSemesterSummery?EnrollmentStudentId=` | ملخص الفصل |

### المواد والجدول
| المسار | الغرض |
| --- | --- |
| `StudentRegistration/StudentRegistrationCourses?StudentID=` | مواد التسجيل الحالية |
| `StudentRegistration/StudentCustomRegistrationCourses?StudentID=` | مواد مخصصة |
| `StudentRegistration/GetRegistrationCredits?StudentID=` | الساعات المعتمدة |
| `RegistrationRequest/GetRegistrationCourses?StudentId=` | مواد طلب التسجيل |
| `RegistrationRequest/GetStudentSchedule?StudentId=` | الجدول (طلب) |
| `StudentSchedule/GetStudentSchedule?StudentID=` | الجدول |
| `StudentSchedule/StudentSchedule?StudentID=` | الجدول (بديل) |
| `StudentSchedule/StudentBasicCourses?StudentId=` | المواد الأساسية |
| `CurrentlyAchievedAcadimicLevel/GetCoursesForSelection?StudentID=` | مواد المستوى المحقق للاختيار |

### الإرشاد الأكاديمي (allowed/forbidden والتعارضات)
| المسار | الغرض |
| --- | --- |
| `AcademicAdvising/GetAcademicAdvice?StudentID=` | نصيحة أكاديمية |
| `AcademicAdvising/GetStudentState?StudentID=` | حالة الطالب |
| `AcademicAdvising/StudentAdvisingStatus?StudentID=` | حالة الإرشاد |
| `AcademicAdvising/Student_Advisor_Allowed_Forbidden_Courses_get?StudentID=` | المواد المسموحة/الممنوعة |
| `AcademicAdvising/Student_Advisor_Data?StudentID=` | بيانات المرشد |
| `AcademicAdvising/student_RequestCourses_Select?StudentID=` | طلبات المواد |
| `AcademicAdvising/Student_insert_RequestCourse?StudentID=` | إدراج طلب مادة |

### الدرجات والحضور
| المسار | الغرض |
| --- | --- |
| `StudentGrading/GetStudentActivityGrading?StudentID=` | درجات النشاط |
| `StudentGrading/GetStudentQUICKQUIZEZ?StudentID=` | الكويزات |
| `StudentGrading/StudentSurvey?StudentID=` | الاستبيانات |
| `StudentAttendance/GetAbsenceDatails?StudentID=` | تفاصيل الغياب |
| `StudentAttendance/GetAbsencePercentage?StudentID=` | نسبة الغياب |
| `StudentAttendance/GetAbsenceWarnings?StudentID=` | إنذارات الغياب |

### المالية والمنح
| المسار | الغرض |
| --- | --- |
| `CashReceipts/GetStudentAccountDetails?StudentID=` | تفاصيل الحساب |
| `CashReceipts/GetStudentBasicFinancialData?StudentID=` | البيانات المالية الأساسية |
| `CashReceipts/GetStudentFinancialHistory?StudentID=` | السجل المالي |
| `CashReceipts/GetStudentTransactions?StudentID=` | المعاملات |
| `Charges/GetStudentCreditChargesBasic?StudentID=` | رسوم دائنة |
| `Charges/GetStudentDebitChargesBasic?StudentID=` | رسوم مدينة |
| `Charges/GetStudentDebitChargesAdvanced?StudentID=` | رسوم مدينة متقدمة |
| `Scholarships/GetStudentCurrentScholarship?StudentID=` | المنحة الحالية |
| `Scholarships/GetStudentHistoryScholarship?StudentID=` | تاريخ المنح |

### أخرى
| المسار | الغرض |
| --- | --- |
| `MilitaryEducation/GetCourses?StudentId=` / `GetStudentReservationInfo?StudentId=` | التربية العسكرية |
| `Lookup/GetActiveAvailableSemester` | الفصل النشط |
| `HelpPages/SelectHelpPageAndSection?PageId=` | صفحات المساعدة |

## 4) تكاملات خارجية ظاهرة

- **Google OAuth** (`accounts.google.com/gsi/client`) — دخول عبر Google.
- **بوابة المرافق:** `https://sufacilities.su.edu.eg/api_login?token=<token>`
  (SSO عبر الـ Token نفسه).
- **بوابات دفع:** Fawry، Banque Misr (Mastercard)، UPG.

## 5) غير المتحقق منه (يحتاج جلسة حقيقية) — لا يُدّعى أنه جاهز

1. **أشكال الاستجابات الفعلية** لكل مسار بعد الدخول (JSON الحقيقي) — غير مرئية
   من الحزم الثابتة.
2. **خرائط الأسماء:** هل `Security/login` يقبل الجزء المحلي من الإيميل فقط
   (`x` → `x@su`) أم الإيميل الكامل؟ هل `StudentID` يساوي `UserIDSerial` أم
   `ApplicantID` أم قيمة مستقلة؟
3. **سلوك الخادم بعد الدخول:** هل توجد جلسة/كوكيز إضافية؟ هل الـ Token ينتهي؟
   هل توجد CAPTCHA أو قيود معدل؟
4. **قوائم `LoginInfo` الفعلية** لطالب `@su.edu.eg` (الأدوار والروابط التي يديرها
   الخادم) لمعرفة أي الصفحات يراها الطالب فعلًا.
5. **حدود الخادم:** معدل الطلبات المسموح، مهلات، سلوك 429/5xx.

**كيف يُغلق هذا البند بأمان:** بلا كلمة مرور في الشات. الطريقة الآمنة هي أن
يُلتقط المستخدم **جلسة/استجابات ممثّلة ومُجرّدة** (fixtures) خارج الشات وتوضع
في `fixtures/` لفحص الـ adapters، أو تشغيل فحص محلي بجلسة حقيقية في بيئة
المستخدم نفسه. عندها فقط يُعلَن أن الاستخراج «جاهز».
