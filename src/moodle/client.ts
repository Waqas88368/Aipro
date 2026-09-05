/**
 * Moodle / K-Moodle adapter (REST web service).
 *
 * Uses the standard Moodle REST protocol:
 *   GET {base}/webservice/rest/server.php?wstoken=..&wsfunction=mod_assign_get_assignments&moodlewsrestformat=json
 *
 * ⚠️ Live verification pending: the exact endpoint and token type depend on
 * the university's Moodle/K-Moodle instance. The adapter is defensive and
 * the caller treats failures as non-fatal.
 */

import type { Diag } from "../diag/logger.ts";

export interface MoodleAssignment {
  courseId: number;
  courseName: string;
  id: number;
  name: string;
  dueAt: number; // unix seconds (Moodle convention)
}

export interface MoodleClient {
  getAssignments(): Promise<{ ok: boolean; assignments: MoodleAssignment[]; error?: string }>;
}

export function createMoodleClient(opts: {
  baseUrl: string;
  token: string;
  diag: Diag;
  fetchImpl?: typeof fetch;
}): MoodleClient {
  const base = opts.baseUrl.replace(/\/+$/, "");
  const fetchImpl = opts.fetchImpl ?? fetch;

  return {
    async getAssignments() {
      const url =
        `${base}/webservice/rest/server.php` +
        `?wstoken=${encodeURIComponent(opts.token)}` +
        `&wsfunction=mod_assign_get_assignments&moodlewsrestformat=json`;
      try {
        const res = await fetchImpl(url, { method: "GET" });
        if (!res.ok) {
          opts.diag.warn("moodle.http_error", { status: res.status });
          return { ok: false, assignments: [], error: `http_${res.status}` };
        }
        const json = (await res.json()) as {
          courses?: Array<{
            id?: number;
            fullname?: string;
            assignments?: Array<{ id?: number; name?: string; duedate?: number }>;
          }>;
          errorcode?: string;
        };
        if (json.errorcode) {
          opts.diag.warn("moodle.ws_error", { errorcode: json.errorcode });
          return { ok: false, assignments: [], error: json.errorcode };
        }
        const assignments: MoodleAssignment[] = [];
        for (const c of json.courses ?? []) {
          for (const a of c.assignments ?? []) {
            if (a.id === undefined || a.name === undefined) continue;
            assignments.push({
              courseId: c.id ?? 0,
              courseName: c.fullname ?? "",
              id: a.id,
              name: a.name,
              dueAt: a.duedate ?? 0,
            });
          }
        }
        return { ok: true, assignments };
      } catch (err) {
        opts.diag.warn("moodle.network_error", { error: String(err) });
        return { ok: false, assignments: [], error: "network" };
      }
    },
  };
}
