/**
 * Bot flow handlers — every message/button/error goes through the i18n
 * catalogs; every state transition follows the state machine; the unified
 * data object stored in the user record is the only data source.
 *
 * Secret policy:
 *  - password: read once from an update, used for one login call, dropped.
 *  - session token: stored on disk (needed for refresh) but never logged.
 *  - nothing secret is ever included in AI prompts or diagnostics.
 */

import type { Ranker } from "../ai/ranker.ts";
import type { Diag } from "../diag/logger.ts";
import type { AcademicData } from "../domain/academic.ts";
import { validateAcademicData } from "../domain/academic.ts";
import { computePlans, PLAN_TARGETS, type PlanTarget } from "../domain/engine.ts";
import type { Lang, I18nKey } from "../i18n/index.ts";
import { t } from "../i18n/index.ts";
import { createMoodleClient, type MoodleClient } from "../moodle/client.ts";
import { buildAcademicData, extractAll, extractionReadiness } from "../portal/extractor.ts";
import { normalizePortalEmail, type PortalClient } from "../portal/client.ts";
import type { Store, StoredUser } from "../storage/store.ts";
import { BUSY_STATES } from "../domain/state.ts";
import type { TelegramClient, TgButtonRow, TgUpdate } from "./telegram.ts";
import { decideReminders, type NotifiedMap } from "../reminders/reminders.ts";

export interface BotDeps {
  tg: TelegramClient;
  store: Store;
  portal: PortalClient;
  ranker: Ranker;
  moodle?: MoodleClient;
  diag: Diag;
  reminderHorizonMs: number;
  now?: () => number;
  /** Set when deployed credentials exist; otherwise the bot asks the user. */
  provisionedEmail?: string;
  provisionedPassword?: string;
}

export const DAY_NAMES: Record<Lang, string[]> = {
  ar: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

// ── keyboards ───────────────────────────────────────────────────────────────

export function mainMenu(lang: Lang): { inline_keyboard: TgButtonRow[] } {
  return {
    inline_keyboard: [
      [{ text: t(lang, "btn_profile"), callback_data: "menu:profile" }, { text: t(lang, "btn_gpa"), callback_data: "menu:gpa" }],
      [{ text: t(lang, "btn_current"), callback_data: "menu:current" }, { text: t(lang, "btn_available"), callback_data: "menu:available" }],
      [{ text: t(lang, "btn_deleted"), callback_data: "menu:deleted" }, { text: t(lang, "btn_schedule"), callback_data: "menu:schedule" }],
      [{ text: t(lang, "btn_plan"), callback_data: "menu:plan" }, { text: t(lang, "btn_assignments"), callback_data: "menu:assignments" }],
      [{ text: t(lang, "btn_refresh"), callback_data: "action:refresh" }, { text: t(lang, "btn_logout"), callback_data: "action:logout" }],
      [{ text: t(lang, "btn_language"), callback_data: "action:lang" }],
    ],
  };
}

function languageKeyboard(): { inline_keyboard: TgButtonRow[] } {
  return {
    inline_keyboard: [
      [{ text: "🇪🇬 العربية", callback_data: "lang:ar" }],
      [{ text: "🇬🇧 English", callback_data: "lang:en" }],
    ],
  };
}

function planTargetKeyboard(lang: Lang): { inline_keyboard: TgButtonRow[] } {
  return {
    inline_keyboard: [
      ...PLAN_TARGETS.map((hs) => [
        {
          text: hs === 12 ? t(lang, "plan_target_12") : hs === 18 ? t(lang, "plan_target_18") : t(lang, "plan_target_21"),
          callback_data: `plan:${hs}`,
        },
      ]),
      [{ text: t(lang, "btn_back"), callback_data: "menu:dashboard" }],
    ],
  };
}

// ── formatters (read exclusively from the stored academic data) ─────────────

const fmtGpa = (v?: number) => (v === undefined ? "—" : v.toFixed(2));

function formatProfile(u: StoredUser, lang: Lang): string {
  const a = u.academic ?? emptyAcademic(u);
  return (
    t(lang, "profile_title") +
    "\n" +
    t(lang, "profile_line", {
      name: a.fullNameEN || u.email || "—",
      faculty: a.faculty ?? "—",
      level: a.level ?? "—",
      studentId: a.studentId || "—",
    })
  );
}

function formatGpa(u: StoredUser, lang: Lang): string {
  const a = u.academic;
  const head = t(lang, "gpa_title") + "\n";
  if (!a) return head + t(lang, "gpa_missing");
  if (a.gpa === undefined && a.cgpa === undefined && !a.semester?.label) return head + t(lang, "gpa_missing");
  const semesterLabel = a.semester?.label ?? ([a.semester?.year, a.semester?.term].filter(Boolean).join(" ") || "—");
  return (
    head +
    t(lang, "gpa_value", {
      gpa: fmtGpa(a.gpa),
      cgpa: fmtGpa(a.cgpa),
      semester: semesterLabel,
    })
  );
}

function formatSubjectLine(s: { code: string; nameEN?: string; nameAR?: string; hours: number; section?: string }, lang: Lang): string {
  const name = s.nameEN ?? s.nameAR ?? "";
  return t(lang, "subject_line", {
    code: s.code,
    name: name || "—",
    hours: s.hours,
    section: s.section ? ` (${s.section})` : "",
  });
}

function formatList(
  titleKey: I18nKey,
  emptyKey: I18nKey,
  lines: string[],
  lang: Lang,
  count: number,
): string {
  if (count === 0) return t(lang, titleKey, { count: 0 }) + "\n" + t(lang, emptyKey);
  return t(lang, titleKey, { count }) + "\n" + lines.join("\n");
}

function formatSchedule(u: StoredUser, lang: Lang): string {
  const a = u.academic;
  const rows = (a?.schedule ?? []).map((slot, i) => {
    const name =
      a?.scheduleSubjects?.[i]?.nameEN ??
      a?.scheduleSubjects?.[i]?.code ??
      (a?.subjects.current.find((s) => s.slots.some((x) => x.day === slot.day && x.start === slot.start && x.end === slot.end))?.nameEN ?? `#${i + 1}`);
    return t(lang, "schedule_line", {
      day: DAY_NAMES[lang][slot.day] ?? String(slot.day),
      start: slot.start,
      end: slot.end,
      name: name.includes("#") ? name.slice(1) : name,
      location: slot.location ?? "—",
    });
  });
  return formatList("schedule_title", "schedule_empty", rows, lang, rows.length);
}

function emptyAcademic(u: StoredUser): AcademicData {
  return {
    studentId: u.session?.studentId ?? "",
    email: u.email ?? "",
    fullNameEN: "",
    subjects: { current: [], past: [], deleted: [], available: [] },
    schedule: [],
  };
}

// ── the extraction pipeline: AUTHENTICATED → EXTRACTING_DATA → … → READY ────

async function runExtractionPipeline(
  deps: BotDeps,
  u: StoredUser,
  chatId: number,
  token: string,
  studentId: string,
): Promise<StoredUser> {
  const lang = u.lang;
  const ctx = {
    client: deps.portal,
    token,
    studentId,
    email: u.email ?? "",
    diag: deps.diag,
    pendingLiveVerify: true,
  };

  // state: EXTRACTING_DATA
  await deps.store.updateUser(u.tgId, { state: "EXTRACTING_DATA" });
  await deps.tg.sendMessage(chatId, t(lang, "extraction_start"));

  const { report, payloads } = await extractAll(ctx);
  const normalized = buildAcademicData(ctx, payloads);
  const issues = validateAcademicData(normalized.data).issues;

  // save extracted data BEFORE validation status decisions (DATA_SAVED path)
  const sectionLines = report.sections
    .map((s) => {
      const label = s.status === "success" ? t(lang, "section_success") : s.status === "empty" ? t(lang, "section_empty") : t(lang, "section_failed");
      return `${s.key}: ${label}`;
    })
    .join("\n");

  const readiness = extractionReadiness(report);
  const failedKeys = readiness.failed;
  const isTrulyEmpty = report.sections.every((s) => s.status !== "failure");

  if (failedKeys.length > 0) {
    // EXTRACTION_FAILED — do NOT reach READY even though login succeeded
    await deps.store.updateUser(u.tgId, { state: "EXTRACTION_FAILED", extraction: report, academic: normalized.data });
    await deps.tg.sendMessage(chatId, t(lang, "extraction_failed_summary", { report: sectionLines }));
    return { ...u, state: "EXTRACTION_FAILED", extraction: report, academic: normalized.data };
  }

  // DATA_VALIDATED step
  await deps.store.updateUser(u.tgId, { state: "DATA_VALIDATED" });
  if (issues.length > 0) {
    await deps.store.updateUser(u.tgId, { state: "VALIDATION_FAILED" });
    await deps.tg.sendMessage(chatId, t(lang, "validation_failed_summary", { issues: issues.map((i) => i.code).join(", ") }));
    return { ...u, state: "VALIDATION_FAILED", extraction: report, academic: normalized.data };
  }
  if (isTrulyEmpty) {
    // everything succeeded but every section is empty → still READY, flagged
    await deps.tg.sendMessage(chatId, t(lang, "validation_ok_summary") + "\n" + sectionLines);
  }
  // DATA_SAVED → READY
  await deps.store.updateUser(u.tgId, {
    state: "READY",
    extraction: report,
    academic: normalized.data,
    session: { token, obtainedAt: Date.now(), studentId },
  });
  await deps.tg.sendMessage(chatId, dashText(u.lang, normalized.data), { reply_markup: mainMenu(lang) });
  return { ...u, state: "READY", extraction: report, academic: normalized.data };
}

export function dashText(lang: Lang, a: AcademicData): string {
  return t(lang, "dashboard_ready", {
    name: a.fullNameEN || "—",
    level: a.level ?? "—",
    gpa: fmtGpa(a.gpa),
  });
}

// ── update handling ─────────────────────────────────────────────────────────

async function handleLoginAttempt(
  deps: BotDeps,
  u: StoredUser,
  chatId: number,
  identifier: string,
  password: string,
): Promise<void> {
  const lang = u.lang;
  const norm = normalizePortalEmail(identifier);
  if (!norm.ok) {
    await deps.tg.sendMessage(chatId, t(lang, "email_invalid"));
    await deps.store.updateUser(u.tgId, { state: "AWAITING_EMAIL" });
    return;
  }
  await deps.store.updateUser(u.tgId, { state: "AUTHENTICATING", email: identifier.trim().toLowerCase() });
  await deps.tg.sendMessage(chatId, t(lang, "auth_start"));

  const result = await deps.portal.login(identifier, password);
  if (!result.ok || !result.token) {
    const reason =
      result.errorCode === "err_invalid_credentials"
        ? t(lang, "err_invalid_credentials")
        : result.errorCode === "err_portal_down"
          ? t(lang, "err_portal_down")
          : result.errorCode === "err_network"
            ? t(lang, "err_network")
            : t(lang, "err_generic");
    await deps.store.updateUser(u.tgId, { state: "AUTH_FAILED", authError: { code: result.errorCode ?? "err_generic", at: Date.now() } });
    await deps.tg.sendMessage(chatId, t(lang, "login_failed", { reason }) + "\n" + t(lang, "login_failed_retry"));
    await deps.store.updateUser(u.tgId, { state: "AWAITING_PASSWORD" });
    return;
  }

  const studentId = result.studentId ?? "";
  await deps.store.updateUser(u.tgId, { state: "AUTHENTICATED", session: { token: result.token, obtainedAt: Date.now(), studentId } });
  deps.diag.registerSecret(result.token);
  await deps.tg.sendMessage(chatId, t(lang, "login_success"));

  // phase 2: the extraction chain — always, in the same session
  const fresh = (await deps.store.getUser(u.tgId))!;
  await runExtractionPipeline(deps, fresh, chatId, result.token, studentId);
}

async function handleRefresh(deps: BotDeps, u: StoredUser, chatId: number): Promise<void> {
  const lang = u.lang;
  if (!u.session?.token) {
    await deps.tg.sendMessage(chatId, t(lang, "need_relogin"));
    await deps.store.updateUser(u.tgId, { state: "AWAITING_EMAIL" });
    return;
  }
  await deps.tg.sendMessage(chatId, t(lang, "refresh_started"));
  const probe = await deps.portal.api<unknown>(
    `AR_StudentInfo/GetPersonalData?StudentID=${encodeURIComponent(u.session.studentId ?? "")}`,
    { token: u.session.token },
  );
  if (!probe.ok && (probe.status === 401 || probe.status === 403)) {
    // session expired → drop token, ask password again (email stays)
    await deps.store.updateUser(u.tgId, { state: "AWAITING_PASSWORD", session: undefined });
    await deps.tg.sendMessage(chatId, t(lang, "session_expired"));
    return;
  }
  if (probe.errorCode) {
    await deps.tg.sendMessage(chatId, t(lang, "refresh_failed", { reason: t(lang, probe.errorCode as I18nKey) }));
    return;
  }
  await runExtractionPipeline(deps, u, chatId, u.session.token, u.session.studentId ?? "");
  // runExtractionPipeline already sent the dashboard; say done
  await deps.tg.sendMessage(chatId, t(lang, "refresh_done"));
}

async function showDashboard(deps: BotDeps, u: StoredUser, chatId: number): Promise<void> {
  const lang = u.lang;
  if (!u.academic || u.state !== "READY") {
    await deps.tg.sendMessage(chatId, t(lang, "dashboard_restricted", { state: u.state }), { reply_markup: mainMenu(lang) });
    return;
  }
  await deps.tg.sendMessage(chatId, dashText(lang, u.academic), { reply_markup: mainMenu(lang) });
}

// ── per-update dispatch ─────────────────────────────────────────────────────

export async function handleUpdate(deps: BotDeps, update: TgUpdate): Promise<void> {
  const msg = update.message;
  const cb = update.callback_query;
  const chatId = msg?.chat.id ?? cb?.message?.chat.id;
  if (chatId === undefined || chatId === null) return;
  const tgId = String(chatId);
  const fromId = msg?.from?.id ?? cb?.from.id;

  let u = await deps.store.getUser(tgId);
  if (!u) u = await deps.store.updateUser(tgId, {});

  const lang = u.lang;

  // callbacks first (buttons)
  if (cb?.data) {
    const data = cb.data;
    if (cb.message?.message_id !== undefined) {
      await deps.tg.answerCallbackQuery(cb.id);
    }
    const ch = chatId;

    if (data.startsWith("lang:")) {
      const newLang = (data.split(":")[1] ?? "ar") as Lang;
      await deps.store.updateUser(tgId, { lang: newLang, state: u.state === "NEW" ? "LANGUAGE_SET" : u.state, createdAt: u.createdAt });
      u = (await deps.store.getUser(tgId))!;
      if (u.state === "LANGUAGE_SET" || u.state === "AWAITING_EMAIL") {
        await deps.tg.sendMessage(ch, t(newLang, "language_changed") + "\n" + t(newLang, "enter_email"));
        if (u.state === "AWAITING_EMAIL") await deps.store.updateUser(tgId, { state: "AWAITING_EMAIL" });
      } else {
        await showDashboard(deps, u, ch);
      }
      return;
    }

    if (data === "menu:dashboard") {
      await showDashboard(deps, u, ch);
      return;
    }
    if (data === "menu:profile") {
      await deps.tg.sendMessage(ch, formatProfile(u, lang));
      return;
    }
    if (data === "menu:gpa") {
      await deps.tg.sendMessage(ch, formatGpa(u, lang));
      return;
    }
    if (data.startsWith("menu:")) {
      const a = u.academic;
      const section = data.split(":")[1]!;
      if (section === "current") {
        const lines = (a?.subjects.current ?? []).map((s) => formatSubjectLine(s, lang));
        await deps.tg.sendMessage(ch, formatList("current_title", "current_empty", lines, lang, lines.length));
      } else if (section === "available") {
        const lines = (a?.subjects.available ?? []).map((s) => formatSubjectLine(s, lang));
        await deps.tg.sendMessage(ch, formatList("available_title", "available_empty", lines, lang, lines.length));
      } else if (section === "deleted") {
        const lines = (a?.subjects.deleted ?? []).map((s) => formatSubjectLine(s, lang));
        await deps.tg.sendMessage(ch, formatList("deleted_title", "deleted_empty", lines, lang, lines.length));
      } else if (section === "schedule") {
        await deps.tg.sendMessage(ch, formatSchedule(u, lang));
      } else if (section === "plan") {
        await deps.tg.sendMessage(ch, t(lang, "plan_prompt"), { reply_markup: planTargetKeyboard(lang) });
      } else if (section === "assignments") {
        await sendAssignments(deps, u, ch);
      }
      return;
    }
    if (data.startsWith("plan:")) {
      const target = Number(data.split(":")[1]) as PlanTarget;
      await sendPlan(deps, u, ch, target);
      return;
    }
    if (data === "action:refresh") {
      if (BUSY_STATES.has(u.state)) {
        await deps.tg.sendMessage(ch, t(lang, "busy_state", { state: u.state }));
        return;
      }
      await handleRefresh(deps, u, ch);
      return;
    }
    if (data === "action:logout") {
      await deps.store.updateUser(tgId, {
        state: "LANGUAGE_SET",
        session: undefined,
        academic: undefined,
        extraction: undefined,
      });
      await deps.tg.sendMessage(ch, t(lang, "logout_done"));
      await deps.tg.sendMessage(ch, t(lang, "enter_email"));
      return;
    }
    if (data === "action:lang") {
      await deps.tg.sendMessage(ch, t(lang, "welcome_choose_language"), { reply_markup: languageKeyboard() });
      return;
    }
    return;
  }

  // plain text messages
  if (msg?.text) {
    const text = msg.text;
    if (text === "/start") {
      if (!u.academic || u.state === "NEW") {
        await deps.store.updateUser(tgId, { state: u.state === "NEW" ? "NEW" : u.state });
        if (u.state === "NEW") {
          await deps.tg.sendMessage(chatId, t(lang, "welcome_choose_language"), { reply_markup: languageKeyboard() });
          return;
        }
      }
      await showDashboard(deps, u, chatId);
      return;
    }

    // provisioned credentials let /start proceed straight to login
    if (deps.provisionedEmail && deps.provisionedPassword && (u.state === "LANGUAGE_SET" || u.state === "NEW" || u.state === "AWAITING_EMAIL")) {
      await handleLoginAttempt(deps, u, chatId, deps.provisionedEmail, deps.provisionedPassword);
      return;
    }

    if (u.state === "AWAITING_EMAIL") {
      await deps.store.updateUser(tgId, { email: text.trim().toLowerCase(), state: "AWAITING_PASSWORD" });
      await deps.tg.sendMessage(chatId, t(lang, "enter_password"));
      return;
    }
    if (u.state === "AWAITING_PASSWORD") {
      const email = u.email ?? deps.provisionedEmail;
      if (!email) {
        await deps.store.updateUser(tgId, { state: "AWAITING_EMAIL" });
        await deps.tg.sendMessage(chatId, t(lang, "enter_email"));
        return;
      }
      await handleLoginAttempt(deps, u, chatId, email, text);
      return;
    }
    if (u.state === "AUTH_FAILED") {
      const email = u.email ?? deps.provisionedEmail;
      if (!email) {
        await deps.store.updateUser(tgId, { state: "AWAITING_EMAIL" });
        await deps.tg.sendMessage(chatId, t(lang, "enter_email"));
        return;
      }
      await handleLoginAttempt(deps, u, chatId, email, text);
      return;
    }
    await deps.tg.sendMessage(chatId, t(lang, "command_unknown"));
    return;
  }
}

async function sendPlan(deps: BotDeps, u: StoredUser, chatId: number, target: PlanTarget): Promise<void> {
  const lang = u.lang;
  if (!u.academic) {
    await deps.tg.sendMessage(chatId, t(lang, "dashboard_restricted", { state: u.state }));
    return;
  }
  const a = u.academic;
  const result = computePlans({
    available: a.subjects.available,
    passed: a.subjects.past,
    current: a.subjects.current,
    targets: [target],
  });

  const targetRes = result.targets[target]!;
  const label = target === 12 ? t(lang, "plan_target_12") : target === 18 ? t(lang, "plan_target_18") : t(lang, "plan_target_21");

  if (a.subjects.available.length === 0) {
    await deps.tg.sendMessage(chatId, t(lang, "plan_header", { hours: target, label }) + "\n" + t(lang, "plan_empty_no_subjects"));
    return;
  }
  if (!targetRes.feasible) {
    const reasonLines = result.eligibilityIssues
      .slice(0, 8)
      .map((iss) => {
        const k =
          iss.code === "prereq_missing"
            ? t(lang, "plan_issue_prereq", { code: iss.subjectCode })
            : iss.code === "already_passed"
              ? t(lang, "plan_issue_already_passed", { code: iss.subjectCode })
              : iss.code === "already_enrolled"
                ? t(lang, "plan_issue_already_enrolled", { code: iss.subjectCode })
                : "";
        return k || iss.subjectCode;
      });
    await deps.tg.sendMessage(
      chatId,
      t(lang, "plan_header", { hours: target, label }) + "\n" + t(lang, "plan_no_feasible", { hours: target }) + (reasonLines.length ? "\n" + reasonLines.join("\n") : ""),
    );
    return;
  }

  // ranking is the ONLY place AI is allowed
  const ranked = await deps.ranker.rank({ plans: targetRes.plans, subjects: a.subjects.available, academic: a, targetHours: target });
  const chosen = targetRes.plans.find((p) => p.subjectCodes.join("|") === ranked.subjectCodes.join("|")) ?? targetRes.plans[0]!;
  const subjectById = new Map(a.subjects.available.map((s) => [s.code, s]));

  const out = [t(lang, "plan_header", { hours: target, label })];
  out.push(t(lang, "plan_choice_header", { hours: chosen.totalHours }));
  for (const code of chosen.subjectCodes) {
    const s = subjectById.get(code);
    out.push(t(lang, "plan_choice_line", { code, name: s?.nameEN ?? s?.nameAR ?? "", hours: s?.hours ?? 0 }));
  }
  if (ranked.explanation.length) {
    out.push(t(lang, "plan_explanation_header"));
    out.push(...ranked.explanation);
  } else if (ranked.usedFallback) {
    out.push(t(lang, "plan_explanation_header") + "\n" + t(lang, "plan_fallback_note"));
  } else {
    out.push(t(lang, "plan_explanation_header") + "\n" + t(lang, "plan_explanation_none"));
  }
  // alternative plans (deterministic ordering)
  const alternatives = targetRes.plans.filter((p) => p !== chosen).slice(0, 3);
  if (alternatives.length) {
    out.push("");
    out.push(`${alternatives.length} ${lang === "ar" ? "بدائل" : "alternatives"}:`);
    for (const p of alternatives) {
      out.push(`  ${p.subjectCodes.map((c) => subjectById.get(c)?.nameEN ?? c).join(", ")} (${p.totalHours}h)`);
    }
  }
  await deps.tg.sendMessage(chatId, out.join("\n"));
}

async function sendAssignments(deps: BotDeps, u: StoredUser, chatId: number): Promise<void> {
  const lang = u.lang;
  if (!deps.moodle) {
    await deps.tg.sendMessage(chatId, t(lang, "err_moodle", { error: "not_configured" }));
    return;
  }
  const res = await deps.moodle.getAssignments();
  if (!res.ok) {
    await deps.tg.sendMessage(chatId, t(lang, "err_moodle", { error: res.error ?? "unknown" }));
    return;
  }
  const feasibleNum = res.assignments.length;
  if (feasibleNum === 0) {
    await deps.tg.sendMessage(chatId, t(lang, "assign_title", { count: 0 }) + "\n" + t(lang, "assign_empty"));
    return;
  }
  const now = deps.now ? deps.now() : Date.now();
  const lines = res.assignments
    .sort((a, b) => a.dueAt - b.dueAt)
    .slice(0, 15)
    .map((a) => {
      const due = a.dueAt ? new Date(a.dueAt * 1000).toISOString().slice(0, 10) : "—";
      const daysLeft = Math.ceil((a.dueAt * 1000 - now) / 86_400_000);
      const label = daysLeft < 0 ? t(lang, "assign_overdue") : daysLeft === 0 ? t(lang, "reminder_due_today") : t(lang, "reminder_due_in", { days: daysLeft });
      return t(lang, "assign_line", { course: a.courseName || `#${a.courseId}`, name: a.name, due: t(lang, "assign_due_date", { date: due, label }) });
    });
  await deps.tg.sendMessage(chatId, t(lang, "assign_title", { count: res.assignments.length }) + "\n" + lines.join("\n"));
}

/** Periodic reminder pass — dedupe via the stored notified map. */
export async function runReminderPass(deps: BotDeps): Promise<void> {
  if (!deps.moodle && !deps.provisionedEmail) return;
  const now = deps.now ? deps.now() : Date.now();
  const users = await deps.store.allUsers();
  for (const u of users) {
    const lang = u.lang;
    if (u.state !== "READY") continue;
    // per-user Moodle if configured, else the shared one
    if (!u.moodle && !deps.moodle) continue;
    const mc = u.moodle ? createMoodleClient({ baseUrl: u.moodle.baseUrl, token: u.moodle.token, diag: deps.diag }) : deps.moodle!;
    const res = await mc.getAssignments();
    if (!res.ok) continue;
    const { toSend, nextNotified } = decideReminders(res.assignments, (u.notified ?? {}) as NotifiedMap, now, deps.reminderHorizonMs);
    if (toSend.length) {
      for (const item of toSend) {
        const a = item.assignment;
        const dueDate = new Date(a.dueAt * 1000).toISOString().slice(0, 10);
        const title = item.kind === "new" ? t(lang, "reminder_new_title") : t(lang, "reminder_updated_title");
        await deps.tg.sendMessage(
          Number(u.tgId),
          `${title}\n${a.courseName}: ${a.name}\n${t(lang, "assign_due_date", { date: dueDate, label: "⏰" })}`,
        );
      }
      await deps.store.updateUser(u.tgId, { notified: nextNotified });
    }
  }
}
