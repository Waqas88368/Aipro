import assert from "node:assert/strict";
import { test } from "node:test";
import { DeterministicRanker } from "../ai/ranker.ts";
import type { Subject } from "../domain/academic.ts";
import type { SubjectPlan } from "../domain/engine.ts";

const subjects: Subject[] = [
  { code: "A1", nameEN: "Alpha", hours: 6, slots: [] },
  { code: "B2", nameEN: "Beta", hours: 6, slots: [] },
  { code: "C3", nameEN: "Gamma", hours: 6, slots: [] },
];

const plans: SubjectPlan[] = [
  { subjectCodes: ["A1", "B2"], totalHours: 12, issues: [] },
  { subjectCodes: ["A1", "C3"], totalHours: 12, issues: [] },
];

test("DeterministicRanker picks the first plan deterministically", async () => {
  const r = new DeterministicRanker();
  const out = await r.rank({
    plans,
    subjects,
    targetHours: 12,
    academic: {
      studentId: "s",
      email: "e",
      fullNameEN: "n",
      subjects: { current: [], past: [], deleted: [], available: [] },
      schedule: [],
    },
  });
  assert.equal(out.usedFallback, true);
  assert.deepEqual(out.subjectCodes, ["A1", "B2"]);
  const out2 = await r.rank({
    plans,
    subjects,
    targetHours: 12,
    academic: {
      studentId: "s",
      email: "e",
      fullNameEN: "n",
      subjects: { current: [], past: [], deleted: [], available: [] },
      schedule: [],
    },
  });
  assert.deepEqual(out2.subjectCodes, out.subjectCodes);
});

test("OpenAiRanker falls back deterministically on network failure", async () => {
  const { OpenAiRanker } = await import("../ai/ranker.ts");
  const r = new OpenAiRanker({
    baseUrl: "http://127.0.0.1:1", // unreachable
    apiKey: "k",
    model: "m",
    diag: {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      registerSecret: () => undefined,
      tail: () => "",
    },
    fetchImpl: async () => {
      throw new Error("down");
    },
  });
  const out = await r.rank({
    plans,
    subjects,
    targetHours: 12,
    academic: {
      studentId: "s",
      email: "e",
      fullNameEN: "n",
      subjects: { current: [], past: [], deleted: [], available: [] },
      schedule: [],
    },
  });
  assert.equal(out.usedFallback, true);
});
