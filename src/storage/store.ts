/**
 * Persistent JSON store with atomic writes (tmp + rename) and a promise
 * queue so writes never interleave. Contains session tokens for refresh —
 * treat data/store.json as sensitive; passwords are NEVER stored.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AcademicData, ExtractionReport } from "../domain/academic.ts";
import type { UserState } from "../domain/state.ts";
import type { Lang } from "../i18n/index.ts";

export interface StoredUser {
  tgId: string;
  lang: Lang;
  state: UserState;
  /** Full validated university email (not a secret). */
  email?: string;
  /** Session token for refresh — a credential; kept out of logs. */
  session?: { token: string; obtainedAt: number; studentId?: string };
  academic?: AcademicData;
  extraction?: ExtractionReport;
  moodle?: { baseUrl: string; token: string };
  /** Assignment reminder dedupe map. */
  notified?: Record<string, { dueAt: number; sentAt: number }>;
  authError?: { code: string; at: number };
  createdAt: number;
  updatedAt: number;
}

export interface Store {
  getUser(tgId: string): Promise<StoredUser | undefined>;
  updateUser(tgId: string, patch: Partial<StoredUser>): Promise<StoredUser>;
  allUsers(): Promise<StoredUser[]>;
}

export function createStore(dataDir: string): Store {
  const dir = dataDir;
  const path = join(dir, "store.json");
  mkdirSync(dir, { recursive: true });

  let cache: Record<string, StoredUser> | undefined = undefined;
  let queue: Promise<unknown> = Promise.resolve();

  function loadUnsafeLocked(): Record<string, StoredUser> {
    if (cache) return cache;
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, "utf8");
        cache = JSON.parse(raw) as Record<string, StoredUser>;
      } catch {
        cache = {};
      }
    } else {
      cache = {};
    }
    return cache;
  }

  function persistUnsafeLocked(): void {
    if (!cache) return;
    const tmp = path + ".tmp";
    writeFileSync(tmp, JSON.stringify(cache, null, 2), "utf8");
    renameSync(tmp, path);
  }

  function enqueue<T>(fn: () => T | Promise<T>): Promise<T> {
    const next = queue.then(fn, fn);
    queue = next.catch(() => undefined);
    return next;
  }

  return {
    async getUser(tgId: string): Promise<StoredUser | undefined> {
      return enqueue(() => loadUnsafeLocked()[tgId]);
    },
    async updateUser(tgId: string, patch: Partial<StoredUser>): Promise<StoredUser> {
      return enqueue(() => {
        const users = loadUnsafeLocked();
        const now = Date.now();
        const prev = users[tgId] ?? {
          tgId,
          lang: "ar",
          state: "NEW",
          createdAt: now,
          updatedAt: now,
        };
        const merged: StoredUser = { ...prev, ...patch, updatedAt: now };
        users[tgId] = merged;
        persistUnsafeLocked();
        return merged;
      });
    },
    async allUsers(): Promise<StoredUser[]> {
      return enqueue(() => Object.values(loadUnsafeLocked()));
    },
  };
}
