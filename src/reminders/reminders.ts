/**
 * Reminder dedupe — pure logic, unit-tested.
 *
 * A reminder is sent at most once per (courseId, assignmentId) unless the
 * due date changes (then it is re-sent as an "updated" reminder).
 */
import type { MoodleAssignment } from "../moodle/client.ts";

export interface NotifiedEntry {
  dueAt: number;
  sentAt: number;
}

export type NotifiedMap = Record<string, NotifiedEntry>;

export const keyFor = (a: MoodleAssignment): string => `${a.courseId}:${a.id}`;

export interface ReminderDecision {
  toSend: Array<{ assignment: MoodleAssignment; kind: "new" | "updated" }>;
  nextNotified: NotifiedMap;
}

/**
 * @param nowMs current epoch ms
 * @param horizonMs look-ahead window
 */
export function decideReminders(
  assignments: MoodleAssignment[],
  notified: NotifiedMap,
  nowMs: number,
  horizonMs: number,
): ReminderDecision {
  const toSend: ReminderDecision["toSend"] = [];
  const next: NotifiedMap = { ...notified };
  const nowSec = Math.floor(nowMs / 1000);

  for (const a of assignments) {
    if (a.dueAt === 0) continue; // no due date → no reminder
    const key = keyFor(a);
    const prev = notified[key];
    if (prev === undefined) {
      // never notified → send if within horizon (including overdue)
      if (a.dueAt <= nowSec + Math.floor(horizonMs / 1000)) {
        toSend.push({ assignment: a, kind: "new" });
        next[key] = { dueAt: a.dueAt, sentAt: nowSec };
      }
    } else if (prev.dueAt !== a.dueAt) {
      // due date changed → re-send
      toSend.push({ assignment: a, kind: "updated" });
      next[key] = { dueAt: a.dueAt, sentAt: nowSec };
    }
  }
  return { toSend, nextNotified: next };
}
