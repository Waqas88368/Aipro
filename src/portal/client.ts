/**
 * Portal client — speaks the real UnicodeSIS JSON API discovered from the
 * official SPA bundle (see docs/portal-research.md).
 *
 *  - login:  POST {base}Security/login  {username: "<local>@su", password}
 *  - data:   GET/POST {base}<path> with "Authorization: Bearer <token>"
 *  - throttling: minimum interval between requests (per client)
 *  - retries: transient failures only (network, timeout, 5xx), with backoff
 *  - The password is used in-memory for exactly one call and never logged.
 */

import type { Diag } from "../diag/logger.ts";

export interface PortalLoginResult {
  ok: boolean;
  token?: string;
  studentId?: string;
  /** machine code for the failure reason */
  errorCode?: string;
  /** redacted error message (no secrets) */
  message?: string;
}

export interface ApiResult<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  /** machine code */
  errorCode?: string;
  /** server-provided message, already sanitized by the caller before logging */
  message?: string;
}

export interface PortalClientOptions {
  baseUrl: string;
  throttleMs: number;
  maxRetries: number;
  diag: Diag;
  /** injectable fetch for tests */
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export function normalizePortalEmail(email: string): { ok: boolean; local?: string; reason?: string } {
  const trimmed = email.trim().toLowerCase();
  const m = /^([a-z0-9._%+-]+)@su\.edu\.eg$/.exec(trimmed);
  if (!m) return { ok: false, reason: "email_invalid" };
  return { ok: true, local: m[1]! };
}

const TRANSIENT_HTTP = new Set([500, 502, 503, 504]);

export class PortalClient {
  private readonly baseUrl: string;
  private readonly throttleMs: number;
  private readonly maxRetries: number;
  private readonly diag: Diag;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private lastRequestAt = 0;

  constructor(opts: PortalClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "") + "/";
    this.throttleMs = opts.throttleMs;
    this.maxRetries = opts.maxRetries;
    this.diag = opts.diag;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.now = opts.now ?? Date.now;
  }

  /** Wait for the throttle window (no-op when the client is idle). */
  private async throttle(): Promise<void> {
    const elapsed = this.now() - this.lastRequestAt;
    const wait = this.throttleMs - elapsed;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastRequestAt = this.now();
  }

  /**
   * Login. `password` stays in memory only; the request body is never logged.
   * Accepts the full university email OR the bare local part.
   */
  async login(identifier: string, password: string): Promise<PortalLoginResult> {
    const norm = normalizePortalEmail(identifier);
    const local = norm.local ?? identifier.trim().toLowerCase().replace(/@su\.edu\.eg$/, "");
    const body = { username: local + "@su", password };

    let lastError: PortalLoginResult = { ok: false, errorCode: "err_generic" };
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      await this.throttle();
      try {
        const res = await this.fetchImpl(this.baseUrl + "Security/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const text = await res.text();
        let json: unknown = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = null;
        }
        const status = res.status;
        if (status >= 200 && status < 300 && json) {
          const candidate = Array.isArray(json) ? (json[0] as Record<string, unknown>) : (json as Record<string, unknown>);
          const token = typeof candidate?.Token === "string" ? candidate.Token : typeof candidate?.token === "string" ? candidate.token : undefined;
          if (token) {
            this.diag.info("portal.login.ok");
            const studentId = pickString(candidate, ["StudentID", "StudentId", "studentId", "UserID"]);
            return { ok: true, token, studentId };
          }
          // 200 without token → error object like {Message}
          const msg = pickString(candidate, ["Message", "message"]);
          lastError = { ok: false, errorCode: codeForStatus(status), message: msg };
          if (!TRANSIENT_HTTP.has(status)) break;
        } else {
          lastError = { ok: false, errorCode: codeForStatus(status), message: pickMessage(json) };
          if (!TRANSIENT_HTTP.has(status)) break;
        }
      } catch (err) {
        const kind = err instanceof TypeError ? "err_network" : "err_timeout";
        this.diag.warn("portal.login.transient", { kind, attempt });
        lastError = { ok: false, errorCode: kind };
      }
    }
    this.diag.info("portal.login.failed", { code: lastError.errorCode });
    return lastError;
  }

  /**
   * Authenticated API call with throttling + transient retries.
   * Never logs the Authorization header value.
   */
  async api<T = unknown>(
    path: string,
    opts: { method?: "GET" | "POST"; body?: unknown; token: string },
  ): Promise<ApiResult<T>> {
    const { method = "GET", body, token } = opts;
    let last: ApiResult<T> = { ok: false, status: 0, errorCode: "err_generic" };
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      await this.throttle();
      try {
        const res = await this.fetchImpl(this.baseUrl + path, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const text = await res.text();
        let json: unknown = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = null;
        }
        const status = res.status;
        if (status >= 200 && status < 300) {
          return { ok: true, status, data: json as T };
        }
        const msg = pickMessage(json);
        this.diag.warn("portal.api.error", { path: sanitizePath(path), status, attempt });
        last = { ok: false, status, errorCode: codeForStatus(status), message: msg };
        if (!TRANSIENT_HTTP.has(status)) break; // 401 etc. → no retry
      } catch {
        this.diag.warn("portal.api.transient", { path: sanitizePath(path), attempt });
        last = { ok: false, status: 0, errorCode: "err_network" };
      }
    }
    return last;
  }

  /** Redirect-safe helper: build a full URL for a rel path (used by POSTs). */
  url(path: string): string {
    return this.baseUrl + path;
  }
}

/** Path with query params stripped for safe logging. */
function sanitizePath(path: string): string {
  return path.split("?")[0] ?? path;
}

function pickMessage(json: unknown): string | undefined {
  if (!json || typeof json !== "object") return undefined;
  const rec = json as Record<string, unknown>;
  if (Array.isArray(json)) return pickMessage(rec[0]);
  for (const k of ["Message", "message", "error", "Error"]) {
    const v = rec[k];
    if (typeof v === "string" && v) return v;
  }
  return undefined;
}

export function pickString(rec: Record<string, unknown> | null | undefined, keys: string[]): string | undefined {
  if (!rec) return undefined;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

export function pickNumber(rec: Record<string, unknown> | null | undefined, keys: string[]): number | undefined {
  if (!rec) return undefined;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v.replace(",", "."));
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

function codeForStatus(status: number): string {
  if (status === 401 || status === 403) return "err_invalid_credentials";
  if (status === 429) return "err_throttled";
  if (status >= 500) return "err_portal_down";
  if (status === 0) return "err_network";
  return "err_http_status";
}
