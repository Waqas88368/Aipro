import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePortalEmail } from "./client.ts";
import {
  buildAcademicData,
  extractAll,
  extractionReadiness,
  normalizeSubject,
  type ExtractionContext,
} from "./extractor.ts";
import type { Diag } from "../diag/logger.ts";
import { createDiag } from "../diag/logger.ts";
import type { ExtractionSection } from "../domain/academic.ts";

const noopDiag: Diag = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  registerSecret: () => undefined,
  tail: () => "",
};

test("normalizePortalEmail: only @su.edu.eg accepted", () => {
  assert.equal(normalizePortalEmail("omar@su.edu.eg").ok, true);
  assert.equal(normalizePortalEmail("omar@su.edu.eg").local, "omar");
  assert.equal(normalizePortalEmail("Omar.K@SU.EDU.EG").local, "omar.k");
  assert.equal(normalizePortalEmail("omar@gmail.com").ok, false);
  assert.equal(normalizePortalEmail("omar@su.edu.eg.eg").ok, false);
});

test("normalizeSubject: defensive field mapping", () => {
  const s = normalizeSubject({
    CourseCode: "M101",
    CourseNameEN: "Mathematics",
    CreditHours: 4,
    Section: "A",
    Day: 1,
    StartTime: "8:00",
    EndTime: "10:00",
    Location: "B1",
  });
  assert.ok(s);
  assert.equal(s.code, "M101");
  assert.equal(s.hours, 4);
  assert.equal(s.slots.length, 1);
  assert.equal(s.slots[0]!.start, "08:00");
});

test("normalizeSubject: nested schedule array", () => {
  const s = normalizeSubject({
    Code: "P201",
    hours: 3,
    Schedule: [
      { DayId: 2, From: "09:00", To: "11:00", Room: "Hall1" },
      { DayId: 4, From: "09:00", To: "11:00", Room: "Hall2" },
    ],
  });
  assert.ok(s);
  assert.equal(s.slots.length, 2);
  assert.equal(s.slots[0]!.day, 2);
});

test("extractAll + buildAcademicData: success vs failure vs empty sections", async () => {
  const responses: Record<string, unknown> = {
    "AR_StudentInfo/GetStudentData": { StudentData: { StudentID: "20241234" } },
    "AR_StudentInfo/GetPersonalData": { data: { NameEN: "Omar Test" } },
    "Transcript/SelectSTudentSemesterSummery": { GPA: 3.5, CGPA: 3.2 },
    "Transcript/SelectStudentTranscriptBySemester": { Transcript: [{ Code: "M101", Grade: "A", Hours: 3 }] },
    "StudentRegistration/StudentRegistrationCourses": { Courses: [] },
    "StudentRegistration/StudentCustomRegistrationCourses": { Courses: [{ CourseCode: "C201", CreditHours: 3 }] },
    "AcademicAdvising/student_RequestCourses_Select": null, // failure
    "StudentSchedule/GetStudentSchedule": { Schedule: [{ Day: 1, StartTime: "08:00", EndTime: "10:00" }] },
    "StudentRegistration/GetRegistrationCredits": { Credits: 21 },
  };
  const ctx: ExtractionContext = {
    client: {
      url: () => "",
      async login() {
        return { ok: true, token: "t" };
      },
      async api<T>(path: string) {
        const key = path.split("?")[0]!;
        if (key.endsWith("SelectSTudentSemesterSummery")) {
          // POST shape like others
        }
        const body = responses[key];
        if (body === null) return { ok: false, status: 500, errorCode: "err_portal_down" };
        if (body === undefined) return { ok: false, status: 404, errorCode: "err_http_status" };
        return { ok: true, status: 200, data: body as T };
      },
    } as never,
    token: "t",
    studentId: "20241234",
    email: "omar@su.edu.eg",
    diag: noopDiag,
    pendingLiveVerify: true,
  };

  const { report, payloads } = await extractAll(ctx);
  // deleted section failed, others fine
  const deleted = report.sections.find((s) => s.key === "deleted")!;
  assert.equal(deleted.status, "failure");
  const current = report.sections.find((s) => s.key === "current")!;
  assert.equal(current.status, "empty"); // empty ≠ failure
  const transcript = report.sections.find((s) => s.key === "transcript")!;
  assert.equal(transcript.status, "success");

  const { data } = buildAcademicData(ctx, payloads);
  assert.equal(data.studentId, "20241234");
  assert.equal(data.fullNameEN, "Omar Test");
  assert.equal(data.gpa, 3.5);
  assert.equal(data.subjects.available.length, 1);
  assert.equal(data.subjects.current.length, 0);
  assert.equal(data.schedule.length, 1);

  const readiness = extractionReadiness(report);
  // "deleted" is an optional section — its failure must NOT block READY,
  // but it must still be reported distinctly from empty data
  assert.equal(readiness.ready, true);
  assert.deepEqual(readiness.failed, ["deleted"]);
});

test("extractionReadiness: fails when a core section fails", () => {
  const makeReport = (): ExtractionSection[] => [
    { key: "student", status: "success", attempts: 1 },
    { key: "personal", status: "success", attempts: 1 },
    { key: "semester", status: "empty", attempts: 1 },
    { key: "transcript", status: "empty", attempts: 1 },
    { key: "current", status: "empty", attempts: 1 },
    { key: "available", status: "empty", attempts: 1 },
    { key: "deleted", status: "empty", attempts: 1 },
    { key: "schedule", status: "empty", attempts: 1 },
    { key: "credits", status: "failure", attempts: 1 },
  ];
  const toReport = (sections: ExtractionSection[]) => ({
    startedAt: 0,
    finishedAt: 0,
    pendingLiveVerify: true,
    sections,
  });
  // baseline: all core sections ok; optional credits failed → still ready
  const baseline = extractionReadiness(toReport(makeReport()));
  assert.equal(baseline.ready, true);
  assert.deepEqual(baseline.failed, ["credits"]);
  const sections = makeReport();
  sections[0] = { ...sections[0]!, status: "failure" }; // student fails
  const r = extractionReadiness(toReport(sections));
  assert.equal(r.ready, false);
  assert.ok(r.failed.includes("student"));
});
