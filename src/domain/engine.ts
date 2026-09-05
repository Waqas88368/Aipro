/**
 * Deterministic planning engine — NO AI involved.
 *
 * Verifies prerequisites, detects conflicts, and computes feasible
 * registration plans for exact totals of 12 / 18 / 21 credit hours.
 * The AI layer (if enabled) only re-orders and explains plans produced here.
 */

import type { PastSubject, Subject } from "./academic.ts";

export const PLAN_TARGETS = [12, 18, 21] as const;
export type PlanTarget = (typeof PLAN_TARGETS)[number];

export const PLAN_MAX_PLANS_PER_TARGET = 8;
const PLAN_MAX_NODES = 100_000;

export type PlanIssueCode =
  | "prereq_missing"
  | "time_conflict"
  | "already_passed"
  | "already_enrolled";

export interface PlanIssue {
  code: PlanIssueCode;
  subjectCode: string;
  detail?: string;
}

export interface SubjectPlan {
  subjectCodes: string[];
  totalHours: number;
  issues: PlanIssue[];
}

export interface PlanResult {
  /** Never null when targets were computed ({} only when no available subjects). */
  targets: Partial<Record<PlanTarget, { plans: SubjectPlan[]; feasible: boolean }>>;
  /** true when the available-subjects section was missing/failed vs truly empty. */
  availableMissing: boolean;
  /** Subjects excluded by deterministic verification, with the reason. */
  eligibilityIssues: PlanIssue[];
}

function minutes(slot: { start: string; end: string }): [number, number] {
  const sParts = slot.start.split(":");
  const eParts = slot.end.split(":");
  return [Number(sParts[0]) * 60 + Number(sParts[1]), Number(eParts[0]) * 60 + Number(eParts[1])];
}

/** True when two time slots overlap on the same day. */
export function slotsOverlap(
  a: { day: number; start: string; end: string },
  b: { day: number; start: string; end: string },
): boolean {
  if (a.day !== b.day) return false;
  const [as, ae] = minutes(a);
  const [bs, be] = minutes(b);
  return as < be && bs < ae;
}

function subjectConflictsWith(code: string, chosen: Subject[], current: Subject[]): string[] {
  const target = chosen.find((s) => s.code === code);
  if (!target) return [];
  const others = [...chosen, ...current].filter((s) => s.code !== code);
  const clashes: string[] = [];
  for (const other of others) {
    for (const a of target.slots) {
      for (const b of other.slots) {
        if (slotsOverlap(a, b)) {
          clashes.push(other.code);
          return clashes;
        }
      }
    }
  }
  return clashes;
}

export interface RequestError {
  code: PlanIssueCode;
  subjectCode: string;
}

export interface PlanRequest {
  available: Subject[];
  passed: PastSubject[];
  current: Subject[];
  targets?: readonly PlanTarget[];
  maxPlansPerTarget?: number;
}

/**
 * Validates one subject against the deterministic rule set.
 * Returns the issues; an empty array means the subject is eligible,
 * with eligible=true.
 */
export function checkSubjectEligibility(
  subject: Subject,
  passed: PastSubject[],
  current: Subject[],
): { eligible: boolean; issues: PlanIssue[] } {
  const issues: PlanIssue[] = [];
  if (passed.some((p) => p.code === subject.code)) {
    issues.push({ code: "already_passed", subjectCode: subject.code });
  }
  if (current.some((c) => c.code === subject.code)) {
    issues.push({ code: "already_enrolled", subjectCode: subject.code });
  }
  const passedSet = new Set(passed.map((p) => p.code));
  for (const prereq of subject.prereqCodes ?? []) {
    if (!passedSet.has(prereq)) {
      issues.push({ code: "prereq_missing", subjectCode: subject.code, detail: prereq });
    }
  }
  return { eligible: issues.length === 0, issues };
}

/** Deterministic candidate ordering for stable output. */
export function sortSubjects(subjects: Subject[]): Subject[] {
  return [...subjects].sort((a, b) => {
    if (b.hours !== a.hours) return b.hours - a.hours;
    return a.code.localeCompare(b.code);
  });
}

/**
 * Enumerate exact-sum combinations (backtracking with pruning, bounded).
 */
function enumeratePlans(subjects: Subject[], target: number, cap: number): string[][] {
  const results: string[][] = [];
  let nodes = 0;
  const n = subjects.length;
  const hours = subjects.map((s) => s.hours);
  // suffix sums for the "can we still reach target" prune
  const suffix = new Array<number>(n + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) suffix[i] = suffix[i + 1]! + hours[i]!;

  const dfs = (idx: number, sum: number, acc: string[]) => {
    nodes++;
    if (nodes > PLAN_MAX_NODES || results.length >= cap) return;
    if (sum === target) {
      results.push([...acc]);
      return;
    }
    if (idx >= n) return;
    if (sum + suffix[idx]! < target) return; // remainder can't reach target
    const s = subjects[idx]!;
    if (sum + s.hours <= target) {
      acc.push(s.code);
      dfs(idx + 1, sum + s.hours, acc);
      acc.pop();
    }
    dfs(idx + 1, sum, acc);
  };
  dfs(0, 0, []);
  return results;
}

/**
 * Compute feasible plans for each target total.
 * Deterministic: same input → same output.
 */
export function computePlans(req: PlanRequest): PlanResult {
  const targets: PlanResult["targets"] = {};
  const passed = req.passed;
  const current = req.current;
  const maxPlans = req.maxPlansPerTarget ?? PLAN_MAX_PLANS_PER_TARGET;

  // 1. eligibility pass (deterministic verification)
  const eligible: Subject[] = [];
  const eligibilityIssues: PlanIssue[] = [];
  for (const s of sortSubjects(req.available)) {
    const { eligible: ok, issues } = checkSubjectEligibility(s, passed, current);
    if (ok) eligible.push(s);
    else eligibilityIssues.push(...issues);
  }

  const targetsToUse = (req.targets ?? PLAN_TARGETS) as readonly PlanTarget[];

  for (const target of targetsToUse) {
    const combos = enumeratePlans(eligible, target, maxPlans);
    const plans: SubjectPlan[] = [];
    for (const codes of combos) {
      const subjectMap = new Map(eligible.map((s) => [s.code, s]));
      // build chosen set, then verify conflicts among chosen + current
      const chosen = codes.map((c) => subjectMap.get(c)!).filter(Boolean);
      const issues: PlanIssue[] = [];
      for (const c of chosen) {
        for (const otherCode of subjectConflictsWith(c.code, chosen, current)) {
          issues.push({ code: "time_conflict", subjectCode: c.code, detail: otherCode });
          break;
        }
      }
      const totalHours = chosen.reduce((acc, s) => acc + s.hours, 0);
      if (issues.length === 0) {
        plans.push({ subjectCodes: codes, totalHours, issues });
      }
    }
    targets[target] = { plans, feasible: plans.length > 0 };
  }

  return {
    targets,
    availableMissing: false,
    eligibilityIssues,
  };
}

/** Deterministic fallback ordering used when no AI is configured. */
export function rankPlansDeterministically(
  plans: SubjectPlan[],
  _subjects: Subject[],
): SubjectPlan[] {
  return [...plans].sort((a, b) => {
    // prefer fewer issues (already all zero here, kept for future rules)
    if (a.issues.length !== b.issues.length) return a.issues.length - b.issues.length;
    // then heavier load first (more ambitious plan)
    if (a.totalHours !== b.totalHours) return b.totalHours - a.totalHours;
    // then more subjects first, then lexicographic for stability
    if (a.subjectCodes.length !== b.subjectCodes.length) return b.subjectCodes.length - a.subjectCodes.length;
    return a.subjectCodes.join("").localeCompare(b.subjectCodes.join(""));
  });
}
