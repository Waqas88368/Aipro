/**
 * Extraction orchestration — pulls every dataset in the same authenticated
 * session, then normalizes, validates and persists. Each section tracks its
 * own status: success | empty | failure. A failed section NEVER degrades
 * into "empty data" — this is the login≠extraction guarantee.
 *
 * Field-name mapping is defensive (multiple candidate names) because the
 * exact response shapes still need confirmation against a real session
 * (see docs/portal-research.md → section 4).
 */

import type { Diag } from "../diag/logger.ts";
import type {
  AcademicData,
  DeletedSubject,
  ExtractionReport,
  ExtractionSection,
  PastSubject,
  ScheduleSlot,
  SectionKey,
  Subject,
} from "../domain/academic.ts";
import { SECTION_KEYS } from "../domain/academic.ts";
import { pickNumber, pickString, type PortalClient } from "./client.ts";

export interface ExtractionContext {
  client: PortalClient;
  token: string;
  studentId: string;
  email: string;
  diag: Diag;
  /** Marked true until a real session confirms the field names. */
  pendingLiveVerify: boolean;
}

export interface SectionResult {
  outcome: { status: "success" | "empty" | "failure"; error?: string; attempts: number };
  /** raw payload kept only for sections that normalize into the data object */
  payload?: unknown;
}

type SectionRunner = (ctx: ExtractionContext) => Promise<SectionResult>;

function asArray(data: unknown, keys: string[]): unknown[] | null {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    for (const k of keys) {
      const v = (data as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v;
      if (v && typeof v === "object" && !Array.isArray(v)) return [v];
    }
    return null;
  }
  return null;
}

function asObject(data: unknown, keys: string[]): Record<string, unknown> | null {
  if (data && typeof data === "object") {
    if (Array.isArray(data)) {
      if (data.length === 1) {
        const first = data[0];
        if (first && typeof first === "object" && !Array.isArray(first)) return first as Record<string, unknown>;
      }
      const rec = data as unknown as Record<string, unknown>;
      for (const k of keys) {
        const v = rec[k];
        if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
      }
      return null;
    }
    const rec = data as Record<string, unknown>;
    for (const k of keys) {
      const v = rec[k];
      if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
    }
    return rec;
  }
  return null;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function apiError(res: { ok: boolean; errorCode?: string }): string {
  return res.errorCode ?? "unexpected_shape";
}

/** GET a section; `keys` locate the row array inside the payload. */
async function getRows(ctx: ExtractionContext, path: string, keys: string[]): Promise<{ rows: unknown[]; result: SectionResult }> {
  const res = await ctx.client.api<unknown>(path, { token: ctx.token });
  if (!res.ok) {
    return { rows: [], result: { outcome: { status: "failure", error: apiError(res), attempts: 1 } } };
  }
  const rows = asArray(res.data, keys);
  if (rows === null) {
    return { rows: [], result: { outcome: { status: "failure", error: "unexpected_shape", attempts: 1 } } };
  }
  const status = rows.length ? "success" : "empty";
  return { rows, result: { outcome: { status, attempts: 1 }, payload: rows } };
}

const getPath = (path: string, sid: string) => `${path}?StudentID=${encodeURIComponent(sid)}`;

async function getObject(ctx: ExtractionContext, path: string, keys: string[]): Promise<{ obj: Record<string, unknown> | null; result: SectionResult }> {
  const res = await ctx.client.api<unknown>(path, { token: ctx.token });
  if (!res.ok) return { obj: null, result: { outcome: { status: "failure", error: apiError(res), attempts: 1 } } };
  const obj = asObject(res.data, keys);
  if (!obj) return { obj: null, result: { outcome: { status: "failure", error: "unexpected_shape", attempts: 1 } } };
  return { obj, result: { outcome: { status: "success", attempts: 1 }, payload: obj } };
}

const RUNNERS: Record<SectionKey, SectionRunner> = {
  student: async (ctx) => {
    const { obj, result } = await getObject(ctx, getPath("AR_StudentInfo/GetStudentData", ctx.studentId), ["StudentData", "studentData", "data"]);
    return obj ? result : { outcome: { status: "failure", error: "unexpected_shape", attempts: 1 } };
  },
  personal: async (ctx) => {
    const { obj, result } = await getObject(ctx, getPath("AR_StudentInfo/GetPersonalData", ctx.studentId), ["data", "PersonalData", "personalData"]);
    return obj ? result : { outcome: { status: "failure", error: "unexpected_shape", attempts: 1 } };
  },
  semester: async (ctx) => {
    const res = await ctx.client.api<unknown>(`Transcript/SelectSTudentSemesterSummery?EnrollmentStudentId=${encodeURIComponent(ctx.studentId)}`, {
      method: "POST",
      body: {},
      token: ctx.token,
    });
    if (!res.ok) return { outcome: { status: "failure", error: apiError(res), attempts: 1 } };
    const obj = asObject(res.data, ["data", "Summary", "summery"]);
    if (!obj) return { outcome: { status: "failure", error: "unexpected_shape", attempts: 1 } };
    return { outcome: { status: "success", attempts: 1 }, payload: obj };
  },
  transcript: async (ctx) => {
    const res = await ctx.client.api<unknown>(`Transcript/SelectStudentTranscriptBySemester?StudentID=${encodeURIComponent(ctx.studentId)}`, {
      method: "POST",
      body: {},
      token: ctx.token,
    });
    if (!res.ok) return { outcome: { status: "failure", error: apiError(res), attempts: 1 } };
    const rows = asArray(res.data, ["data", "Transcript", "transcript", "Result"]);
    if (rows === null) return { outcome: { status: "failure", error: "unexpected_shape", attempts: 1 } };
    return { outcome: { status: rows.length ? "success" : "empty", attempts: 1 }, payload: rows };
  },
  current: async (ctx) => (await getRows(ctx, getPath("StudentRegistration/StudentRegistrationCourses", ctx.studentId), ["data", "Courses", "courses", "Result"])).result,
  available: async (ctx) => (await getRows(ctx, getPath("StudentRegistration/StudentCustomRegistrationCourses", ctx.studentId), ["data", "Courses", "courses", "Result"])).result,
  deleted: async (ctx) => (await getRows(ctx, getPath("AcademicAdvising/student_RequestCourses_Select", ctx.studentId), ["data", "Requests", "requests", "Result"])).result,
  schedule: async (ctx) => (await getRows(ctx, getPath("StudentSchedule/GetStudentSchedule", ctx.studentId), ["data", "Schedule", "schedule", "Result"])).result,
  credits: async (ctx) => {
    const { obj, result } = await getObject(ctx, getPath("StudentRegistration/GetRegistrationCredits", ctx.studentId), ["data", "Credits", "credits"]);
    return obj ? result : { outcome: { status: "failure", error: "unexpected_shape", attempts: 1 } };
  },
};

// ── normalization (defensive field mapping) ─────────────────────────────────

const CODE_KEYS = ["Code", "CourseCode", "SubjectCode", "code", "CourseID", "CourseId"];
const NAME_KEYS = ["NameEN", "CourseNameEN", "SubjectNameEN", "Name", "CourseName", "nameEN", "SubjectName"];
const NAME_AR_KEYS = ["NameAR", "CourseNameAR", "ArabicName", "nameAR"];
const HOURS_KEYS = ["CreditHours", "Hours", "Credit", "hours", "CreditHrs", "MaxHours"];
const GRADE_KEYS = ["Grade", "Degree", "grade", "FinalGrade"];
const GPA_KEYS = ["GPA", "Gpa", "gpa", "TotalGPA", "TotalGpa"];
const CGPA_KEYS = ["CGPA", "Cgpa", "cgpa", "CumulativeGPA"];
const LEVEL_KEYS = ["Level", "LevelName", "AcademicLevel", "level", "LevelId", "StudentLevel"];
const SEMESTER_KEYS = ["Semester", "Term", "SemesterName", "TermName", "AcademicSemester", "SemesterNameEN"];
const DAY_KEYS = ["Day", "DayId", "WeekDay", "day", "DayName"];
const START_KEYS = ["StartTime", "Start", "From", "TimeFrom", "startTime", "start", "TimeStart"];
const END_KEYS = ["EndTime", "End", "To", "TimeTo", "endTime", "end", "TimeEnd"];
const LOCATION_KEYS = ["Location", "Hall", "Place", "Room", "location", "Venue"];
const SECTION_PLAIN_KEYS = ["Section", "Group", "SectionNo", "section", "GroupName"];
const PREREQ_KEYS = ["Prerequisites", "PreRequisites", "PreReq", "prereqCodes", "Prerequisit", "Prerequisite"];
const DROP_REASON_KEYS = ["Reason", "Status", "Action", "reason", "RequestStatus"];
const INSTRUCTOR_KEYS = ["Instructor", "DoctorName", "StaffName", "InstructorName"];
const FACULTY_KEYS = ["FacultyName", "Faculty", "CollegeName", "FacultyEN"];
const PROGRAM_KEYS = ["ProgramName", "Program", "DepartmentName", "ProgramEN"];

export function parseSlot(day: unknown, start: unknown, end: unknown, location?: unknown): ScheduleSlot | null {
  let d = typeof day === "number" ? day : Number(day);
  if (!Number.isInteger(d) || d < 0 || d > 6) d = 0;
  const sRaw = typeof start === "string" ? start : String(start ?? "");
  const eRaw = typeof end === "string" ? end : String(end ?? "");
  const s = sRaw.padStart(5, "0");
  const e = eRaw.padStart(5, "0");
  if (!/^\d{1,2}:\d{2}$/.test(sRaw) || !/^\d{1,2}:\d{2}$/.test(eRaw)) return null;
  return {
    day: d,
    start: s,
    end: e,
    location: typeof location === "string" && location ? location : undefined,
  };
}

function pickFirst(rec: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const v = rec[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

export function normalizeSubject(row: Record<string, unknown>): Subject | null {
  const code = pickString(row, CODE_KEYS);
  if (!code) return null;
  const slots: ScheduleSlot[] = [];
  for (const sKey of ["Schedule", "Times", "Lectures", "slots", "Sessions"]) {
    const arr = asArray(row[sKey], []);
    if (arr) {
      for (const it of arr) {
        const rec = asRecord(it);
        const slot = parseSlot(pickFirst(rec, DAY_KEYS), pickFirst(rec, START_KEYS), pickFirst(rec, END_KEYS), pickFirst(rec, LOCATION_KEYS));
        if (slot) slots.push(slot);
      }
      if (slots.length) break;
    }
  }
  if (!slots.length) {
    const slot = parseSlot(pickFirst(row, DAY_KEYS), pickFirst(row, START_KEYS), pickFirst(row, END_KEYS), pickFirst(row, LOCATION_KEYS));
    if (slot) slots.push(slot);
  }
  const prereqsRaw = pickFirst(row, PREREQ_KEYS);
  const prereqCodes = typeof prereqsRaw === "string" ? prereqsRaw.split(/[,;،\s]+/).map((s) => s.trim()).filter(Boolean) : undefined;
  return {
    code,
    nameEN: pickString(row, NAME_KEYS),
    nameAR: pickString(row, NAME_AR_KEYS),
    hours: pickNumber(row, HOURS_KEYS) ?? 3,
    section: pickString(row, SECTION_PLAIN_KEYS),
    instructor: pickString(row, INSTRUCTOR_KEYS),
    prereqCodes,
    slots,
  };
}

export function normalizePastSubject(row: Record<string, unknown>): PastSubject | null {
  const code = pickString(row, CODE_KEYS);
  if (!code) return null;
  return {
    code,
    nameEN: pickString(row, NAME_KEYS),
    hours: pickNumber(row, HOURS_KEYS) ?? 3,
    grade: pickString(row, GRADE_KEYS) ?? "",
    gradePoints: pickNumber(row, ["GradePoints", "Points", "CreditPoints"]),
    semester: pickString(row, SEMESTER_KEYS),
  };
}

export function normalizeDeletedSubject(row: Record<string, unknown>): DeletedSubject | null {
  const code = pickString(row, CODE_KEYS);
  if (!code) return null;
  return {
    code,
    nameEN: pickString(row, NAME_KEYS),
    hours: pickNumber(row, HOURS_KEYS) ?? 3,
    reason: pickString(row, DROP_REASON_KEYS),
  };
}

function joinName(rec: Record<string, unknown>): string {
  const first = pickString(rec, ["FirstNameEN", "FirstName", "FirstEN"]);
  const last = pickString(rec, ["LastNameEN", "LastName", "LastEN"]);
  if (first && last) return `${first} ${last}`;
  return first ?? last ?? "";
}

export interface NormalizedAcademic {
  data: AcademicData;
}

/** Combine extraction payloads into the unified AcademicData object. */
export function buildAcademicData(
  ctx: ExtractionContext,
  payloads: Record<SectionKey, unknown>,
): NormalizedAcademic {
  const studentRaw = asObject(payloads.student, ["StudentData", "studentData"]) ?? asRecord(payloads.student);
  const personalRaw = asObject(payloads.personal, ["data", "PersonalData", "personalData"]) ?? asRecord(payloads.personal);
  const semesterRaw = asObject(payloads.semester, ["data", "Summary", "summery"]) ?? asRecord(payloads.semester);
  const creditsRaw = asObject(payloads.credits, ["data", "Credits", "credits"]) ?? asRecord(payloads.credits);

  const data: AcademicData = {
    studentId: pickString(studentRaw, ["StudentID", "StudentId", "studentId"]) ?? ctx.studentId,
    email: ctx.email,
    fullNameEN: pickString(personalRaw, ["NameEN", "FullNameEN", "FullName", "StudentNameEN", "Name"]) ?? joinName(personalRaw),
    fullNameAR: pickString(personalRaw, ["NameAR", "FullNameAR", "ArabicName"]),
    faculty: pickString(personalRaw, FACULTY_KEYS) ?? pickString(studentRaw, FACULTY_KEYS),
    program: pickString(personalRaw, PROGRAM_KEYS) ?? pickString(studentRaw, PROGRAM_KEYS),
    level: pickString(semesterRaw, LEVEL_KEYS) ?? pickString(personalRaw, LEVEL_KEYS),
    gpa: pickNumber(semesterRaw, GPA_KEYS) ?? pickNumber(studentRaw, GPA_KEYS),
    cgpa: pickNumber(semesterRaw, CGPA_KEYS) ?? pickNumber(studentRaw, CGPA_KEYS),
    semester: {
      year: pickString(semesterRaw, ["YearName", "AcademicYear", "Year"]),
      term: pickString(semesterRaw, SEMESTER_KEYS),
      label: pickString(semesterRaw, ["Label", "SemesterLabel"]),
    },
    credits: pickNumber(creditsRaw, ["Credits", "MaxCredits", "AllowedCredits", "CreditsHours", "MaxHours"]),
    subjects: {
      current: (asArray(payloads.current, ["data", "Courses", "courses", "Result"]) ?? [])
        .map((r) => normalizeSubject(asRecord(r)))
        .filter((s): s is Subject => s !== null),
      past: (asArray(payloads.transcript, ["data", "Transcript", "transcript", "Result"]) ?? [])
        .map((r) => normalizePastSubject(asRecord(r)))
        .filter((s): s is PastSubject => s !== null),
      deleted: (asArray(payloads.deleted, ["data", "Requests", "requests", "Result"]) ?? [])
        .map((r) => normalizeDeletedSubject(asRecord(r)))
        .filter((s): s is DeletedSubject => s !== null),
      available: (asArray(payloads.available, ["data", "Courses", "courses", "Result"]) ?? [])
        .map((r) => normalizeSubject(asRecord(r)))
        .filter((s): s is Subject => s !== null),
    },
    schedule: (asArray(payloads.schedule, ["data", "Schedule", "schedule", "Result"]) ?? [])
      .map((r) => {
        const rec = asRecord(r);
        return parseSlot(pickFirst(rec, DAY_KEYS), pickFirst(rec, START_KEYS), pickFirst(rec, END_KEYS), pickFirst(rec, LOCATION_KEYS));
      })
      .filter((s): s is ScheduleSlot => s !== null),
  };

  return { data };
}

/**
 * Run every section (sequentially, throttled) and produce the report.
 * A section failure does not stop the others.
 */
export async function extractAll(
  ctx: ExtractionContext,
): Promise<{ report: ExtractionReport; payloads: Record<SectionKey, unknown>; }> {
  const startedAt = Date.now();
  const sections: ExtractionSection[] = [];
  const payloads: Record<SectionKey, unknown> = {
    student: undefined,
    personal: undefined,
    semester: undefined,
    transcript: undefined,
    current: undefined,
    available: undefined,
    deleted: undefined,
    schedule: undefined,
    credits: undefined,
  };

  for (const key of SECTION_KEYS) {
    const runner = RUNNERS[key];
    try {
      const result = await runner(ctx);
      sections.push({ key, status: result.outcome.status, error: result.outcome.error, attempts: result.outcome.attempts });
      if (result.payload !== undefined) payloads[key] = result.payload;
    } catch (err) {
      ctx.diag.error("extract.section.failed", { section: key, error: String(err) });
      sections.push({ key, status: "failure", error: "unexpected", attempts: 1 });
    }
  }

  return {
    report: { startedAt, finishedAt: Date.now(), sections, pendingLiveVerify: ctx.pendingLiveVerify },
    payloads,
  };
}

/** Whether the extraction reached the "READY-able" threshold. */
export function extractionReadiness(report: ExtractionReport): { ready: boolean; failed: SectionKey[] } {
  const failed = report.sections.filter((s) => s.status === "failure").map((s) => s.key);
  const required: SectionKey[] = ["student", "personal", "current", "available", "schedule"];
  const coreMissing = required.filter((k) => {
    const s = report.sections.find((x) => x.key === k);
    return !s || s.status === "failure";
  });
  return { ready: coreMissing.length === 0, failed: [...failed, ...coreMissing.filter((k) => !failed.includes(k))] };
}
