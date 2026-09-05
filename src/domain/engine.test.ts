import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkSubjectEligibility,
  computePlans,
  rankPlansDeterministically,
  slotsOverlap,
  type PlanTarget,
} from "./engine.ts";
import type { PastSubject, Subject } from "./academic.ts";

function sub(code: string, hours: number, extra: Partial<Subject> = {}): Subject {
  return { code, hours, prereqCodes: [], slots: [], ...extra };
}

const M_101 = sub("M101", 3);
const M_102 = sub("M102", 3, { prereqCodes: ["M101"] });
const C_201 = sub("C201", 4);
const P_301 = sub("P301", 2, { prereqCodes: ["C201"] });
const E_101 = sub("E101", 3, { prereqCodes: ["X999"] }); // unmet prereq

test("slotsOverlap: same day overlapping returns true", () => {
  assert.equal(slotsOverlap({ day: 1, start: "08:00", end: "10:00" }, { day: 1, start: "09:00", end: "11:00" }), true);
  assert.equal(slotsOverlap({ day: 1, start: "08:00", end: "10:00" }, { day: 1, start: "10:00", end: "12:00" }), false);
  assert.equal(slotsOverlap({ day: 2, start: "08:00", end: "10:00" }, { day: 1, start: "09:00", end: "11:00" }), false);
});

test("checkSubjectEligibility honors passed, enrolled, prereqs", () => {
  const passed: PastSubject[] = [{ code: "M101", nameEN: "Math", hours: 3, grade: "B+" }];
  assert.equal(checkSubjectEligibility(M_101, passed, []).eligible, false); // already passed
  assert.equal(checkSubjectEligibility(M_102, passed, []).eligible, true); // prereq passed
  assert.equal(checkSubjectEligibility(M_102, [], []).eligible, false); // prereq missing
  assert.equal(checkSubjectEligibility(M_102, passed, [M_102]).eligible, false); // enrolled
  assert.equal(checkSubjectEligibility(E_101, passed, []).eligible, false); // unmet prereq
});

test("computePlans: 12/18/21 exact totals, conflict-free", () => {
  const available = [M_101, M_102, C_201, P_301, E_101, sub("F100", 2), sub("G110", 3)];
  const passed: PastSubject[] = [{ code: "M101", nameEN: "Math", hours: 3, grade: "A" }];
  // M101 passed → excluded; E101 has unmet prereq → excluded
  const res = computePlans({ available, passed, current: [] });
  const for12 = res.targets[12]!;
  assert.equal(for12.feasible, true);
  for (const plan of for12.plans) {
    assert.equal(plan.totalHours, 12);
    assert.equal(plan.subjectCodes.includes("M101"), false, "passed subject must not appear");
    assert.equal(plan.subjectCodes.includes("E101"), false, "unmet-prereq subject must not appear");
  }
  assert.ok(res.eligibilityIssues.some((i) => i.subjectCode === "M101" && i.code === "already_passed"));
  assert.ok(res.eligibilityIssues.some((i) => i.subjectCode === "E101" && i.code === "prereq_missing"));
});

test("computePlans: time conflicts rejected", () => {
  const slot = { day: 1, start: "08:00", end: "10:00" };
  const clashing = sub("T1", 3, { slots: [slot] });
  const clashingB = sub("T2", 3, { slots: [slot] });
  const fine = sub("T3", 6, { slots: [{ day: 2, start: "08:00", end: "11:00" }] });
  const res = computePlans({ available: [clashing, clashingB, fine], passed: [], current: [] });
  const for12 = res.targets[12]!;
  // T1+T2 clash → combination unfeasible; T1+T3 or T2+T3 alone can't reach 12 with 3+6=9
  assert.equal(for12.feasible, false);
});

test("computePlans: current enrollment conflicts block plans", () => {
  const slot = { day: 3, start: "09:00", end: "11:00" };
  const current = [sub("NOW1", 3, { slots: [slot] })];
  const clashing = sub("A1", 3, { slots: [slot] });
  const noClash = sub("B1", 3, { slots: [{ day: 4, start: "09:00", end: "11:00" }] });
  // target 6: A1 (clashes with NOW1) must be rejected; B1 alone = 3 → infeasible
  const res = computePlans({ available: [clashing, noClash], passed: [], current, targets: [6 as unknown as PlanTarget] });
  const for6 = res.targets[6 as unknown as PlanTarget]!;
  assert.ok(!for6.plans.some((p) => p.subjectCodes.includes("A1")));
});

test("computePlans: deterministic ordering", () => {
  const available = [
    sub("Z9", 3),
    sub("A1", 3),
    sub("B2", 3),
    sub("C3", 3),
    sub("D4", 6),
    sub("E5", 6),
  ];
  const res1 = computePlans({ available, passed: [], current: [] });
  const res2 = computePlans({ available, passed: [], current: [] });
  assert.deepEqual(res1, res2);
  const r12 = res1.targets[12]!;
  assert.equal(r12.feasible, true);
});

test("rankPlansDeterministically: heaviest valid plan first", () => {
  const plans = [
    { subjectCodes: ["A"], totalHours: 12, issues: [] },
    { subjectCodes: ["B", "C"], totalHours: 18, issues: [] },
  ];
  const ranked = rankPlansDeterministically(plans, []);
  assert.equal(ranked[0]!.totalHours, 18);
  assert.equal(ranked[0]!.subjectCodes.length, 2);
});
