/**
 * AI layer — ordering and explanation ONLY. All verification and plan
 * computation happens in the deterministic engine (src/domain/engine.ts).
 * The AI never receives passwords, tokens, or emails.
 */

import type { Diag } from "../diag/logger.ts";
import type { AcademicData } from "../domain/academic.ts";
import { rankPlansDeterministically, type SubjectPlan } from "../domain/engine.ts";
import type { Subject } from "../domain/academic.ts";

export interface RankInput {
  plans: SubjectPlan[];
  subjects: Subject[];
  academic: AcademicData;
  targetHours: number;
}

export interface RankOutput {
  /** ordered subject codes of the chosen plan */
  subjectCodes: string[];
  /** human explanation lines (already localized by the caller) */
  explanation: string[];
  /** true when the deterministic fallback was used */
  usedFallback: boolean;
}

export interface Ranker {
  rank(input: RankInput): Promise<RankOutput>;
}

/** Deterministic fallback — always available, no keys needed. */
export class DeterministicRanker implements Ranker {
  async rank(input: RankInput): Promise<RankOutput> {
    const ordered = rankPlansDeterministically(input.plans, input.subjects);
    const best = ordered[0];
    if (!best) return { subjectCodes: [], explanation: [], usedFallback: true };
    return {
      subjectCodes: best.subjectCodes,
      explanation: [],
      usedFallback: true,
    };
  }
}

export interface OpenAiRankerOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  diag: Diag;
  fetchImpl?: typeof fetch;
}

/**
 * OpenAI-compatible chat-completions ranker. Input is sanitized academic
 * data only (subject codes/names/hours/prereqs). On any failure it falls
 * back to the deterministic ranker.
 */
export class OpenAiRanker implements Ranker {
  private readonly fallback = new DeterministicRanker();
  private readonly opts: OpenAiRankerOptions;

  constructor(opts: OpenAiRankerOptions) {
    this.opts = opts;
  }

  async rank(input: RankInput): Promise<RankOutput> {
    const { baseUrl, apiKey, model, diag } = this.opts;
    const fetchImpl = this.opts.fetchImpl ?? fetch;
    const subjectById = new Map(input.subjects.map((s) => [s.code, s]));

    const lines = input.plans.map((p, i) => {
      const names = p.subjectCodes.map((c) => {
        const s = subjectById.get(c);
        return s ? `${c} (${s.nameEN ?? s.nameAR ?? ""}, ${s.hours}h)` : c;
      });
      return `Plan ${i + 1}: [${names.join(", ")}] = ${p.totalHours}h`;
    });

    const system =
      "You are a university course-registration advisor. You receive feasible " +
      "registration plans (already verified for prerequisites and time conflicts) " +
      "and must return ONLY JSON: {\"planIndex\": number, \"reason\": string}. " +
      "Pick the single best plan for the student and give a concise reason in the " +
      "student's language. Never mention prerequisites or conflicts that do not exist.";

    const user =
      `Student level: ${input.academic.level ?? "unknown"}; GPA: ${input.academic.gpa ?? "n/a"}; ` +
      `target total hours: ${input.targetHours}.\n\nAvailable feasible plans:\n` +
      lines.join("\n");

    try {
      const res = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content;
      if (!content) throw new Error("AI empty response");
      const parsed = JSON.parse(content) as { planIndex?: number; reason?: string };
      const idx = Number(parsed.planIndex);
      const plan = input.plans[idx];
      if (!plan) throw new Error("AI bad plan index");
      return {
        subjectCodes: plan.subjectCodes,
        explanation: parsed.reason ? [parsed.reason] : [],
        usedFallback: false,
      };
    } catch (err) {
      diag.warn("ai.rank.fallback", { error: String(err) });
      return this.fallback.rank(input);
    }
  }
}

export function createRanker(opts: {
  baseUrl?: string;
  apiKey?: string;
  model: string;
  diag: Diag;
}): Ranker {
  if (opts.baseUrl && opts.apiKey) {
    return new OpenAiRanker({ baseUrl: opts.baseUrl, apiKey: opts.apiKey, model: opts.model, diag: opts.diag });
  }
  return new DeterministicRanker();
}
