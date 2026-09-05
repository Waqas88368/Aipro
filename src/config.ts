/**
 * Runtime configuration — parsed once from process.env.
 * No secrets are ever printed; config values are only read here.
 */

export interface AppConfig {
  botToken: string;
  portalBaseUrl: string;
  portalEmail?: string;
  portalPassword?: string;
  portalThrottleMs: number;
  portalMaxRetries: number;
  aiBaseUrl?: string;
  aiApiKey?: string;
  aiModel: string;
  moodleBaseUrl?: string;
  moodleToken?: string;
  reminderIntervalMs: number;
  reminderHorizonDays: number;
  dataDir: string;
  port: number;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const botToken = env.BOT_TOKEN ?? "";
  const config: AppConfig = {
    botToken,
    portalBaseUrl: env.PORTAL_BASE_URL ?? "http://unicodesis.su.edu.eg:150/api/",
    portalEmail: env.PORTAL_EMAIL || undefined,
    portalPassword: env.PORTAL_PASSWORD || undefined,
    portalThrottleMs: intEnv("PORTAL_THROTTLE_MS", 900),
    portalMaxRetries: intEnv("PORTAL_MAX_RETRIES", 3),
    aiBaseUrl: env.AI_API_BASE_URL || undefined,
    aiApiKey: env.AI_API_KEY || undefined,
    aiModel: env.AI_MODEL || "gpt-4o-mini",
    moodleBaseUrl: env.MOODLE_BASE_URL || undefined,
    moodleToken: env.MOODLE_TOKEN || undefined,
    reminderIntervalMs: intEnv("REMINDER_INTERVAL_MS", 3_600_000),
    reminderHorizonDays: intEnv("REMINDER_HORIZON_DAYS", 2),
    dataDir: env.DATA_DIR ?? "./data",
    port: intEnv("PORT", 3000),
  };
  return config;
}
