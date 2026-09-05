import assert from "node:assert/strict";
import { test } from "node:test";
import { decideReminders, keyFor } from "./reminders.ts";
import type { MoodleAssignment } from "../moodle/client.ts";

const a1: MoodleAssignment = { courseId: 1, courseName: "Math", id: 11, name: "HW1", dueAt: 1_800_000_000 };
const a2: MoodleAssignment = { courseId: 2, courseName: "Physics", id: 22, name: "Lab", dueAt: 1_800_000_000 + 86_400 };
const far: MoodleAssignment = { courseId: 3, courseName: "Chem", id: 33, name: "Essay", dueAt: 1_800_000_000 + 5 * 86_400 };
const noDue: MoodleAssignment = { courseId: 4, courseName: "Bio", id: 44, name: "Open", dueAt: 0 };

const NOW = (a1.dueAt - 86_400) * 1000; // exactly 1 day before a1
const HORIZON = 2 * 86_400_000; // 2 days → includes a1 and a2 (a2 is 2 days ahead)

test("decideReminders: sends within horizon, skips far and no-due", () => {
  const { toSend, nextNotified } = decideReminders([a1, a2, far, noDue], {}, NOW, HORIZON);
  // a1 (1 day ahead) and a2 (2 days ahead, boundary) are within horizon
  assert.equal(toSend.length, 2);
  assert.ok(toSend.every((x) => x.kind === "new"));
  assert.equal(nextNotified[keyFor(a1)]!.dueAt, a1.dueAt);
  assert.equal(nextNotified[keyFor(a2)]!.dueAt, a2.dueAt);
  assert.equal(nextNotified[keyFor(far)], undefined);
  assert.equal(nextNotified[keyFor(noDue)], undefined);
});

test("decideReminders: dedupes — no resend for unchanged due date", () => {
  const notified = { [keyFor(a1)]: { dueAt: a1.dueAt, sentAt: 100 } };
  const { toSend } = decideReminders([a1], notified, NOW, HORIZON);
  assert.equal(toSend.length, 0);
});

test("decideReminders: resends when due date changed (kind=updated)", () => {
  const notified = { [keyFor(a1)]: { dueAt: a1.dueAt - 86_400, sentAt: 100 } };
  const { toSend } = decideReminders([a1], notified, NOW, HORIZON);
  assert.equal(toSend.length, 1);
  assert.equal(toSend[0]!.kind, "updated");
});
