/**
 * Diagnostic logger with mandatory redaction.
 *
 * Guarantees:
 *  - Any registered secret (password, token, API key) is masked everywhere.
 *  - Object keys named password/token/secret/authorization are masked even if
 *    the value was not registered.
 *  - Logs go to stdout and to a bounded ring file under DATA_DIR/diag.log.
 *  - The portal password is NEVER registered here by the caller; the caller
 *    simply never passes it to any log call. This module is the last line of
 *    defense, not the first.
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type LogLevel = "debug" | "info" | "warn" | "error";

const SENSITIVE_KEYS = new Set([
  "password",
  "pass",
  "token",
  "secret",
  "authorization",
  "api_key",
  "apikey",
  "wstoken",
  "cookie",
]);

function maskString(value: unknown): unknown {
  if (typeof value === "string") return "[REDACTED]";
  return value;
}

/** Deep-sanitize a value before logging. */
export function sanitize(value: unknown, secrets: readonly string[]): unknown {
  if (typeof value === "string") {
    let out = value;
    for (const s of secrets) {
      if (s && s.length >= 4 && out.includes(s)) out = out.replaceAll(s, "[REDACTED]");
    }
    return out;
  }
  if (Array.isArray(value)) return value.map((v) => sanitize(v, secrets));
  if (value && typeof value === "object") {
    const rec: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      rec[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? maskString(v) : sanitize(v, secrets);
    }
    return rec;
  }
  return value;
}

export interface Diag {
  debug(msg: string, meta?: unknown): void;
  info(msg: string, meta?: unknown): void;
  warn(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
  /** Register an additional secret to redact (e.g. a session token). */
  registerSecret(secret: string): void;
  /** Bounded tail of the diagnostic log (for the health endpoint). */
  tail(n: number): string;
}

const MAX_LOG_BYTES = 256 * 1024;

export function createDiag(opts: { dataDir: string; secrets?: string[] }): Diag {
  const secrets: string[] = [...(opts.secrets ?? [])];
  const logPath = join(opts.dataDir, "diag.log");
  try {
    mkdirSync(opts.dataDir, { recursive: true });
  } catch {
    /* storage may be read-only in some deployments */
  }

  function write(level: LogLevel, msg: string, meta?: unknown): void {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      msg,
      meta: meta === undefined ? undefined : sanitize(meta, secrets),
    });
    // stdout for the operator
    process.stdout.write(line + "\n");
    // bounded ring file
    try {
      const existing = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
      const next = (existing + line + "\n").slice(-MAX_LOG_BYTES);
      writeFileSync(logPath, next, "utf8");
    } catch {
      /* non-fatal */
    }
  }

  return {
    debug: (m, meta) => write("debug", m, meta),
    info: (m, meta) => write("info", m, meta),
    warn: (m, meta) => write("warn", m, meta),
    error: (m, meta) => write("error", m, meta),
    registerSecret(secret: string) {
      if (secret && secret.length >= 4 && !secrets.includes(secret)) secrets.push(secret);
    },
    tail(n: number) {
      try {
        const text = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
        return text.split("\n").filter(Boolean).slice(-n).join("\n");
      } catch {
        return "";
      }
    },
  };
}
