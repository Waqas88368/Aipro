/**
 * Application entrypoint — wires config, diag, store, portal, ai, moodle,
 * telegram long-polling, periodic reminders and a tiny health endpoint.
 *
 * Secrets policy: BOT_TOKEN is used only by the Telegram client; the portal
 * password lives in env or arrives via an update and is used for exactly one
 * login call; neither is ever logged.
 */

import { createServer } from "node:http";
import { createRanker } from "./ai/ranker.ts";
import { loadConfig } from "./config.ts";
import { createDiag } from "./diag/logger.ts";
import { handleUpdate, runReminderPass, type BotDeps } from "./gateway/handlers.ts";
import { createTelegramClient } from "./gateway/telegram.ts";
import { createMoodleClient } from "./moodle/client.ts";
import { PortalClient } from "./portal/client.ts";
import { createStore } from "./storage/store.ts";

const CFG = loadConfig();

if (!CFG.botToken) {
  console.error("[startup] BOT_TOKEN is not set (see .env.example). Bot cannot start.");
  process.exit(1);
}

const diag = createDiag({ dataDir: CFG.dataDir });
const store = createStore(CFG.dataDir);
const portal = new PortalClient({
  baseUrl: CFG.portalBaseUrl,
  throttleMs: CFG.portalThrottleMs,
  maxRetries: CFG.portalMaxRetries,
  diag,
});
const ranker = createRanker({ baseUrl: CFG.aiBaseUrl, apiKey: CFG.aiApiKey, model: CFG.aiModel, diag });
const moodle =
  CFG.moodleBaseUrl && CFG.moodleToken
    ? createMoodleClient({ baseUrl: CFG.moodleBaseUrl, token: CFG.moodleToken, diag })
    : undefined;

const tg = createTelegramClient(CFG.botToken);

const deps: BotDeps = {
  tg,
  store,
  portal,
  ranker,
  moodle,
  diag,
  reminderHorizonMs: CFG.reminderHorizonDays * 86_400_000,
  provisionedEmail: CFG.portalEmail,
  provisionedPassword: CFG.portalPassword,
};

if (deps.provisionedEmail) diag.info("config.provisioned_credentials");
diag.info("bot.startup", { stateChain: ["AUTHENTICATED", "EXTRACTING_DATA", "DATA_VALIDATED", "DATA_SAVED", "READY"] });

// ── health endpoint (used by sandbox/ops to confirm liveness) ──────────────
const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, state: "running", ts: Date.now() }));
    return;
  }
  res.writeHead(404);
  res.end();
});
server.listen(CFG.port, () => diag.info("health.listen", { port: CFG.port }));

// ── long polling loop ───────────────────────────────────────────────────────
let stopped = false;

async function pollLoop(): Promise<void> {
  while (!stopped) {
    try {
      const updates = await tg.poll();
      for (const u of updates) {
        try {
          await handleUpdate(deps, u);
        } catch (err) {
          diag.error("update.handler.failed", { error: String(err) });
        }
      }
    } catch (err) {
      diag.warn("poll.loop.error", { error: String(err) });
    }
  }
}
void pollLoop();

// ── periodic reminders ──────────────────────────────────────────────────────
const reminderTimer = setInterval(() => {
  runReminderPass(deps).catch((err) => diag.warn("reminder.pass.failed", { error: String(err) }));
}, CFG.reminderIntervalMs);

// ── graceful shutdown ───────────────────────────────────────────────────────
function shutdown(): void {
  stopped = true;
  clearInterval(reminderTimer);
  server.close();
  setTimeout(() => process.exit(0), 300).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

diag.info("bot.ready");
