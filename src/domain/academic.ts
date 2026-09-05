/**
 * Unified academic data object (persisted) + normalization + validation.
 *
 * Every bot surface reads from this single object. We deliberately keep
 * "empty" distinct from "failed":
 *  - section status "empty"    → data exists but has no rows (a valid state)
 *  - section status "failure"  → extraction error (network, portal, parsing)
 */

export type SectionStatus = "success" | "empty" | "failure";

export const SECTION_KEYS = [
  "student",
  "personal",
  "semester",
  "transcript",
  "current",
  "available",
  "deleted",
  "schedule",
  "credits",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export interface ExtractionSection {
  key: SectionKey;
  status: SectionStatus;
  error?: string; // short machine code, not raw server text
  attempts: number;
}

export interface ExtractionReport {
  startedAt: number;
  finishedAt: number;
  sections: ExtractionSection[];
  pendingLiveVerify: boolean; // true until field names are confirmed against a real session
}

export interface ScheduleSlot {
  day: number; // 0 = Sunday ... 6 = Saturday (or 1=Monday per locale later; kept numeric)
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  location?: string;
}

export interface Subject {
  code: string;
  nameEN?: string;
  nameAR?: string;
  hours: number;
  section?: string;
  instructor?: string;
  prereqCodes?: string[];
  slots: ScheduleSlot[];
}

export interface PastSubject {
  code: string;
  nameEN?: string;
  hours: number;
  grade: string;
  gradePoints?: number;
  semester?: string;
}

export interface DeletedSubject {
  code: string;
  nameEN?: string;
  hours: number;
  reason?: string;
}

export interface AcademicData {
  studentId: string;
  email: string;
  fullNameEN: string;
  fullNameAR?: string;
  faculty?: string;
  program?: string;
  level?: string;
  gpa?: number;
  cgpa?: number;
  semester?: { year?: string; term?: string; label?: string };
  credits?: number;
  subjects: {
    current: Subject[];
    past: PastSubject[];
    deleted: DeletedSubject[];
    available: Subject[];
  };
  schedule: ScheduleSlot[]; // enriched with subject names by the presenter
  scheduleSubjects?: Array<{ code: string; nameEN?: string; slots: ScheduleSlot[] }>;
}

/** Empty-yet-valid academic data (used before any extraction). */
export function emptyAcademicData(studentId: string, email: string): AcademicData {
  return {
    studentId,
    email,
    fullNameEN: "",
    subjects: { current: [], past: [], deleted: [], available: [] },
    schedule: [],
  };
}

export interface ValidationIssue {
  code: string; // e.g. "student_id_missing", "gpa_out_of_range"
  section: SectionKey | "global";
}

/** Deterministic validation of normalized academic data. */
export function validateAcademicData(d: AcademicData): {
  valid: boolean;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];

  if (!/^[A-Za-z0-9\-]{3,}$/.test(d.studentId)) {
    issues.push({ code: "student_id_missing_or_invalid", section: "student" });
  }
  if (!d.fullNameEN.trim()) {
    issues.push({ code: "name_missing", section: "personal" });
  }
  for (const [key, v] of [
    ["gpa", d.gpa],
    ["cgpa", d.cgpa],
  ] as const) {
    if (v !== undefined && (!Number.isFinite(v) || v < 0 || v > 4.01)) {
      issues.push({ code: `${key}_out_of_range`, section: "semester" });
    }
  }
  const codes = (arr: Array<{ code: string }>) => arr.map((s) => s.code.trim()).filter(Boolean);
  for (const [name, arr] of [
    ["current", d.subjects.current],
    ["available", d.subjects.available],
  ] as const) {
    const list = codes(arr);
    if (new Set(list).size !== list.length) {
      issues.push({ code: `duplicate_codes_in_${name}`, section: name });
    }
  }
  for (const s of [...d.subjects.current, ...d.subjects.available]) {
    if (s.hours < 0 || s.hours > 12) {
      issues.push({ code: "hours_out_of_range", section: "student" });
      break;
    }
    for (const slot of s.slots) {
      if (slot.day < 0 || slot.day > 6 || !/^\d{2}:\d{2}$/.test(slot.start) || !/^\d{2}:\d{2}$/.test(slot.end)) {
        issues.push({ code: "schedule_slot_invalid", section: "schedule" });
        break;
      }
    }
  }
  return { valid: issues.length === 0, issues };
}

/** Human-readable tick/cross per section for the summary message. */
export function sectionBadges(report: ExtractionReport, t: (key: string) => string): string {
  return report.sections
    .map((s) => {
      const label =
        s.status === "success" ? t("section_success") : s.status === "empty" ? t("section_empty") : t("section_failed");
      return `${s.key}: ${label}`;
    })
    .join("\n");
}
