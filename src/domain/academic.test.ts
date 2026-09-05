import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyAcademicData, validateAcademicData, type Subject } from "./academic.ts";

test("empty academic data validates as invalid (student id + name missing)", () => {
  const d = emptyAcademicData("", "");
  const { valid, issues } = validateAcademicData(d);
  assert.equal(valid, false);
  assert.ok(issues.some((i) => i.code === "student_id_missing_or_invalid"));
  assert.ok(issues.some((i) => i.code === "name_missing"));
});

test("valid data passes", () => {
  const d = emptyAcademicData("20241234", "x@su.edu.eg");
  d.fullNameEN = "Omar Test";
  d.gpa = 3.2;
  d.cgpa = 3.1;
  d.subjects.available = [
    { code: "M101", nameEN: "Math", hours: 3, slots: [{ day: 1, start: "08:00", end: "10:00" }] },
  ];
  const { valid, issues } = validateAcademicData(d);
  assert.equal(valid, true, issues.map((i) => i.code).join(","));
});

test("duplicate codes and out-of-range GPA are flagged", () => {
  const d = emptyAcademicData("20241234", "x@su.edu.eg");
  d.fullNameEN = "Omar Test";
  d.gpa = 9.5;
  const dup: Subject = { code: "M101", hours: 3, slots: [] };
  d.subjects.current = [dup, { ...dup }];
  const { valid, issues } = validateAcademicData(d);
  assert.equal(valid, false);
  assert.ok(issues.some((i) => i.code === "gpa_out_of_range"));
  assert.ok(issues.some((i) => i.code === "duplicate_codes_in_current"));
});
