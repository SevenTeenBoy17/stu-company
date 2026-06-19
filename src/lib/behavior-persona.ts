import { buildWealthSummary } from "@/lib/allocation";
import { detectAdaptiveEvents, type AdaptiveEvent, type ConfidenceLevel } from "@/lib/adaptive-events";
import { bandFromScore, buildRiskProfilePayload } from "@/lib/risk-profile";
import { buildSimulationState } from "@/lib/simulation";
import { buildTutorRadarPayload } from "@/lib/tutor-radar";
import type {
  BehaviorPersona,
  Classroom,
  LearningProgressSummary,
  ScenarioRun,
  TutorRadarMetric,
  UserRecord,
} from "@/lib/types";
import { clamp } from "@/lib/utils";

/**
 * A2b — pure logic that turns a student's *real* behavior into an investment
 * personality (`BehaviorPersona`). No DB, no network, no `Date.now`, no
 * `Math.random`. Mirrors the 理财 layer convention: pure-core + sibling
 * `*.test.ts`. Later consumed by A2c (ai.ts) and A2d (route).
 */

const PERSONA_BANDS = ["defensive", "steady", "balanced", "growth"] as const;
type PersonaBand = BehaviorPersona["band"];

const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;

/** Triggered adaptive event, compacted to the salient signal fields. */
export interface PersonaAdaptiveSignal {
  id: string;
  title: string;
  teachingPoint: string;
  confidence: ConfidenceLevel;
  tone: AdaptiveEvent["tone"];
  /**
   * The risk DIRECTION this signal pushes the band toward: "up" = aggressive /
   * risk-seeking, "down" = defensive / risk-averse, "neutral" = a behavioural
   * bias with no clear risk direction. The SIGN of an event's contribution to
   * {@link behaviorScore} comes from this field (not `tone`), so a defensive
   * signal like `cash_hoarding` correctly pulls the score DOWN.
   */
  riskDirection: AdaptiveEvent["riskDirection"];
}

/** The 6-dim tutor-radar metric reduced to its load-bearing fields. */
export interface PersonaRadarMetric {
  id: string;
  label: string;
  score: number;
}

export interface PersonaWealthSignal {
  riskScore: number;
  disciplineScore: number;
  diversificationScore: number;
  netWorth: number;
  stageLabel: string;
}

/**
 * Structured behavioral input assembled from a run. Pure data — safe to hash
 * (see {@link personaInputDigest}) and to feed an AI prompt (A2c).
 */
export interface PersonaSignalInput {
  currentRound: number;
  totalRounds: number;
  adaptiveEvents: PersonaAdaptiveSignal[];
  radar: PersonaRadarMetric[];
  wealth: PersonaWealthSignal;
  actionCounts: Record<string, number>;
  netWorthTrend: number[];
  questionnaireScore?: number;
  /**
   * Coaching next-steps reused from the public `buildRiskProfilePayload`
   * (which internally runs the private `coachNextSteps`). Assembled in
   * {@link buildPersonaSignalInput} because that is where the run is available;
   * {@link ruleFallbackPersona} prefers these and falls back to a deterministic
   * local set when the input was hand-built without them.
   */
  coachNextSteps?: string[];
}

/**
 * Count run actions by type. `countActions` is NOT exported from quests.ts, so
 * we keep a local, dependency-light helper here (do not modify quests.ts).
 */
function countActionsByType(actionLog: ScenarioRun["actionLog"]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of actionLog) {
    counts[entry.type] = (counts[entry.type] ?? 0) + 1;
  }
  return counts;
}

/**
 * Build a minimal `SimulationState` from a run so we can reuse the pure radar
 * metrics from {@link buildTutorRadarPayload}. The radar's 6 scores only read
 * `state.run` + `state.market.assets`; the stub user/classroom never surface in
 * the metrics we keep. `buildSimulationState` is pure (no IO); the only `Date`
 * usage inside the radar builder is `asOf`, which we discard.
 */
function radarMetricsForRun(run: ScenarioRun): PersonaRadarMetric[] {
  const user: UserRecord = {
    id: run.userId,
    email: "persona-signal@brownzone.local",
    passwordHash: "stub",
    role: "student",
    name: "行为画像学生",
    title: "行为观察对象",
    classroomId: run.classroomId,
  };
  const classroom: Classroom = {
    id: run.classroomId,
    name: "行为画像测算班",
    region: "成都",
    teacherId: "persona-teacher",
    challengeTheme: "行为画像",
    schoolRank: 1,
  };

  const state = buildSimulationState(user, classroom, run, [run], [user]);
  const payload = buildTutorRadarPayload(state);
  return payload.metrics.map((metric: TutorRadarMetric) => ({
    id: metric.id,
    label: metric.label,
    score: metric.score,
  }));
}

export function buildPersonaSignalInput(
  run: ScenarioRun,
  learning: LearningProgressSummary,
  savedQuestionnaireScore?: number,
): PersonaSignalInput {
  const adaptive = detectAdaptiveEvents(run);
  const wealth = buildWealthSummary(run);
  const radar = radarMetricsForRun(run);

  // `learning` is part of the behavioral picture even when adaptive events are
  // silent; fold it into the action-count map so the digest reflects it.
  const actionCounts = countActionsByType(run.actionLog);
  actionCounts.learning_completed = learning.completed;

  // Reuse coaching from the public risk-profile payload (internally runs the
  // private `coachNextSteps`) instead of re-deriving it here.
  const coachNextSteps = buildRiskProfilePayload(run).coach.nextSteps;

  return {
    currentRound: run.currentRound,
    totalRounds: run.totalRounds,
    adaptiveEvents: adaptive.map((event) => ({
      id: event.id,
      title: event.title,
      teachingPoint: event.teachingPoint,
      confidence: event.confidence,
      tone: event.tone,
      riskDirection: event.riskDirection,
    })),
    radar,
    wealth: {
      riskScore: wealth.riskScore,
      disciplineScore: wealth.disciplineScore,
      diversificationScore: wealth.diversificationScore,
      netWorth: wealth.netWorth,
      stageLabel: wealth.stageLabel,
    },
    actionCounts,
    netWorthTrend: run.snapshots.map((snapshot) => snapshot.netWorth),
    questionnaireScore: savedQuestionnaireScore,
    coachNextSteps,
  };
}

/**
 * Band → label/archetype map. Labels are behavior-flavored, distinct from the
 * questionnaire labels used by `bandFromScore` in risk-profile.ts.
 */
const BAND_PRESET: Record<PersonaBand, { label: string; archetype: string }> = {
  defensive: { label: "稳健守门员", archetype: "先守安全垫，再谈进攻" },
  steady: { label: "稳健探索者", archetype: "一脚安全垫，一脚试新仓" },
  balanced: { label: "均衡配置者", archetype: "用分散换长期通关率" },
  growth: { label: "进取挑战者", archetype: "敢于进攻，但要装好刹车" },
};

/**
 * Tone is now a SEVERITY magnitude only — how strong a signal a triggered event
 * is — never a direction. The direction (sign) comes from `riskDirection`:
 * a warning is a louder signal than an info, regardless of which way it points.
 */
const TONE_SEVERITY: Record<AdaptiveEvent["tone"], number> = {
  warning: 16,
  info: 11,
  positive: 10,
};

/**
 * Sign each event contributes to the risk axis. "up" = aggressive (push score
 * up), "down" = defensive (push score down), "neutral" = no risk-direction
 * contribution. This is the heart of the fix: `cash_hoarding` is "down", so it
 * SUBTRACTS instead of (as before) adding via its info tone.
 */
const RISK_DIRECTION_SIGN: Record<AdaptiveEvent["riskDirection"], number> = {
  up: 1,
  down: -1,
  neutral: 0,
};

const CONFIDENCE_WEIGHT: Record<ConfidenceLevel, number> = {
  low: 0.4,
  medium: 0.7,
  high: 1,
};

function radarScore(input: PersonaSignalInput, id: string, fallback: number): number {
  const value = input.radar.find((metric) => metric.id === id)?.score;
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Deterministic behavior score (0–100). Higher = more risk-seeking / aggressive
 * behavior. The SIGN of every contribution is direction-aware:
 *
 *  - The radar's risk-control / diversification dimensions anchor a base around
 *    50 (weak control / low diversification reads as more aggressive).
 *  - Each triggered adaptive event moves the score by its `riskDirection` SIGN
 *    × tone SEVERITY × confidence — so aggressive signals (overtrading,
 *    concentration, herd-following) push UP, defensive signals (cash hoarding)
 *    push DOWN, and direction-less biases (loss anchoring, positive streak)
 *    contribute ~0 to the risk axis.
 *  - Two guardrails keep the band honest:
 *      * a DEFENSIVE short-circuit caps the score into the defensive band when a
 *        player is clearly risk-averse (low risk-control + low trade intensity +
 *        low growth exposure, or an outright cash-hoarding signal), so the base
 *        anchor can't strand a pure hoarder in "balanced".
 *      * a CONCENTRATION / LEVERAGE floor lifts the score to at least the
 *        balanced band for a concentrated or leveraged player — they are never
 *        "defensive".
 *  - The questionnaire is a TIE-BREAK only: it may nudge the final score by at
 *    most ±3 and can never flip a clear behavior band.
 */
function behaviorScore(input: PersonaSignalInput): number {
  const riskControl = radarScore(input, "risk-control", 60);
  const diversification = radarScore(input, "diversification", 60);
  const growthOption = radarScore(input, "growth-option", 50);
  const discipline = radarScore(input, "position-discipline", input.wealth.disciplineScore);
  const safeDiscipline = Number.isFinite(discipline) ? discipline : 60;

  // Base around the inverse of risk-control + diversification: weak control /
  // low diversification reads as more aggressive behavior.
  let score = 50 + (100 - riskControl) * 0.28 + (100 - diversification) * 0.18 - (safeDiscipline - 60) * 0.12;

  // Direction-aware event scoring: SIGN from riskDirection, MAGNITUDE from tone
  // severity × confidence. Neutral-direction events add 0 to the risk axis.
  for (const event of input.adaptiveEvents) {
    const sign = RISK_DIRECTION_SIGN[event.riskDirection] ?? 0;
    if (sign === 0) continue;
    const severity = TONE_SEVERITY[event.tone] ?? 11;
    const weight = CONFIDENCE_WEIGHT[event.confidence] ?? 0.7;
    score += sign * severity * weight;
  }

  // Trade intensity directly shifts the aggression read (over-trading = up,
  // near-zero trading = down).
  const trades = input.actionCounts.trade ?? 0;
  const tradeIntensity = trades / Math.max(input.currentRound, 1);
  score += clamp((tradeIntensity - 1.2) * 8, -8, 14);

  // --- Guardrail 1: concentration / leverage floor -------------------------
  // A concentrated (low diversification or a high-confidence herd-following
  // signal) or leveraged (low risk-control reflecting heavy debt) player is
  // never defensive: floor them at the balanced band.
  const herdConcentration = input.adaptiveEvents.some(
    (event) => event.id === "herd_following" && event.confidence === "high",
  );
  const concentratedOrLeveraged = herdConcentration || diversification <= 40 || riskControl <= 30;
  if (concentratedOrLeveraged) {
    // 66 keeps the band ≥ balanced even after the ±3 questionnaire nudge
    // (66 − 3 = 63 > 62, the steady boundary).
    score = Math.max(score, 66);
  }

  // --- Guardrail 2: defensive short-circuit --------------------------------
  // A clearly risk-averse player (weak risk-control AND low trade intensity AND
  // low growth exposure), or an outright cash-hoarding signal, must land in the
  // defensive band — the base-50 anchor must not keep them in balanced.
  const cashHoarding = input.adaptiveEvents.some((event) => event.id === "cash_hoarding");
  const lowRiskControl = riskControl <= 70;
  const lowTradeIntensity = tradeIntensity <= 0.6;
  const lowGrowthExposure = growthOption <= 55;
  const clearlyDefensive =
    !concentratedOrLeveraged &&
    ((lowRiskControl && lowTradeIntensity && lowGrowthExposure) || cashHoarding);
  if (clearlyDefensive) {
    // 35 keeps the band defensive even after the ±3 questionnaire nudge
    // (35 + 3 = 38 ≤ 38, the defensive boundary).
    score = Math.min(score, 35);
  }

  // --- Questionnaire: tie-break only (decision §6.1) -----------------------
  // The questionnaire may move the final score by AT MOST ±3 and must never flip
  // a clear behavior band — behavior is more accurate than the questionnaire.
  if (typeof input.questionnaireScore === "number" && Number.isFinite(input.questionnaireScore)) {
    score += clamp(input.questionnaireScore - score, -3, 3);
  }

  return Math.round(clamp(Number.isFinite(score) ? score : 50, 0, 100));
}

function confidenceForRound(currentRound: number): BehaviorPersona["confidence"] {
  if (currentRound < 3) return "low";
  if (currentRound < 8) return "medium";
  return "high";
}

/**
 * Deterministic, AI-free persona. Always returns a complete, valid
 * `BehaviorPersona`. Used as the guaranteed baseline and as the fallback that
 * {@link normalizeBehaviorPersona} repairs an AI response against.
 */
export function ruleFallbackPersona(input: PersonaSignalInput): BehaviorPersona {
  const score = behaviorScore(input);
  const band = bandFromScore(score).band;
  const preset = BAND_PRESET[band];

  // Evidence = teaching points (fallback to titles) of the top 2–3 triggered
  // adaptive events, ordered high → medium → low confidence.
  const orderedEvents = [...input.adaptiveEvents].sort(
    (left, right) => CONFIDENCE_WEIGHT[right.confidence] - CONFIDENCE_WEIGHT[left.confidence],
  );
  const evidence = orderedEvents
    .slice(0, 3)
    .map((event) => event.teachingPoint.trim() || event.title.trim())
    .filter((text) => text.length > 0);

  if (evidence.length === 0) {
    evidence.push(
      `目前 ${input.currentRound}/${input.totalRounds} 回合还没有触发明显的行为信号，可以多积累几回合再复盘。`,
    );
  }

  const topSignalTitle = orderedEvents[0]?.title.trim();
  const summary = topSignalTitle
    ? `处于「${input.wealth.stageLabel}」，最近最值得注意的行为信号是「${topSignalTitle}」。`
    : `处于「${input.wealth.stageLabel}」，目前操作还比较克制，继续把好习惯保持成连续动作。`;

  // nextSteps: prefer the coaching reused (via the public risk-profile payload)
  // in buildPersonaSignalInput; fall back to a deterministic local set when the
  // input was hand-built without it.
  const nextSteps =
    input.coachNextSteps && input.coachNextSteps.length > 0
      ? input.coachNextSteps
      : fallbackNextSteps(input, band);

  return {
    band,
    label: preset.label,
    archetype: preset.archetype,
    summary,
    evidence,
    nextSteps,
    confidence: confidenceForRound(input.currentRound),
  };
}

/**
 * Deterministic next-steps when the input carries no reused coaching (e.g. a
 * hand-built `PersonaSignalInput`). Three short Chinese steps keyed off the band
 * and the wealth signals, mirroring the cadence of risk-profile's coach.
 */
function fallbackNextSteps(input: PersonaSignalInput, band: PersonaBand): string[] {
  const steps: string[] = [];

  if (band === "growth") {
    steps.push("下一次出手前先写下买入理由和最大可接受回撤，给进攻装上刹车。");
  } else if (band === "defensive") {
    steps.push("安全垫已经够厚，可以用 1-2 个小仓位做学习实验，而不是一直观望。");
  } else {
    steps.push("保持分批与复盘的节奏，用小仓位验证想法，避免情绪化追涨。");
  }

  if (input.wealth.diversificationScore < 72) {
    steps.push("降低集中度：把单一资产的占比控制在组合里更可承受的位置。");
  } else {
    steps.push("分散度基本达标：继续记录每次调仓理由，而不是只看短期涨跌。");
  }

  if (input.wealth.riskScore >= 68) {
    steps.push("沙盘风险分偏高，本回合最值得练的是降风险，而不是追求更高收益。");
  } else {
    steps.push("选择一个概念复盘：安全垫、分散、回撤或从众偏差，不要同时学太多。");
  }

  return steps.slice(0, 3);
}

// ---------------------------------------------------------------------------
// normalizeBehaviorPersona — tolerant AI-text → BehaviorPersona repair.
// Mirrors the robustness of `normalizeRadarPayload` in ai.ts: extract the first
// balanced JSON object, parse it, then keep each field only when it is the right
// type/shape (and a valid union member for band/confidence); otherwise take the
// field from `fallback`. NEVER throws.
// ---------------------------------------------------------------------------

/**
 * Own small JSON-object extractor (do NOT import private helpers from ai.ts —
 * keep this module dependency-light and free of ai.ts circular imports).
 * Prefers a fenced ```json block; otherwise finds the first *balanced* `{...}`.
 */
function extractFirstJsonObject(text: string): string | null {
  if (typeof text !== "string" || text.length === 0) return null;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced && fenced.startsWith("{")) return fenced;

  const start = text.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function sanitizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const cleaned = value
    .filter(isNonEmptyString)
    .map((item) => (item as string).trim());
  return cleaned.length > 0 ? cleaned : null;
}

export function normalizeBehaviorPersona(rawText: string, fallback: BehaviorPersona): BehaviorPersona {
  try {
    const json = extractFirstJsonObject(rawText);
    if (!json) return fallback;

    const parsed = JSON.parse(json) as Partial<BehaviorPersona>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return fallback;
    }

    const band =
      typeof parsed.band === "string" && (PERSONA_BANDS as readonly string[]).includes(parsed.band)
        ? (parsed.band as PersonaBand)
        : fallback.band;

    const confidence =
      typeof parsed.confidence === "string" &&
      (CONFIDENCE_LEVELS as readonly string[]).includes(parsed.confidence)
        ? (parsed.confidence as BehaviorPersona["confidence"])
        : fallback.confidence;

    return {
      band,
      label: isNonEmptyString(parsed.label) ? parsed.label.trim() : fallback.label,
      archetype: isNonEmptyString(parsed.archetype) ? parsed.archetype.trim() : fallback.archetype,
      summary: isNonEmptyString(parsed.summary) ? parsed.summary.trim() : fallback.summary,
      evidence: sanitizeStringArray(parsed.evidence) ?? fallback.evidence,
      nextSteps: sanitizeStringArray(parsed.nextSteps) ?? fallback.nextSteps,
      confidence,
    };
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// personaInputDigest — stable, deterministic fingerprint of the salient signals.
// Same input → same digest; changed behavior → different digest. No Math.random,
// no Date. FNV-1a over a canonical JSON string.
// ---------------------------------------------------------------------------

/** FNV-1a 32-bit hash, returned as an 8-char lowercase hex string. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    // 32-bit FNV prime multiply via shifts to stay in 32-bit range.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function personaInputDigest(input: PersonaSignalInput): string {
  const canonical = {
    currentRound: input.currentRound,
    totalRounds: input.totalRounds,
    eventIds: input.adaptiveEvents.map((event) => `${event.id}:${event.confidence}`).sort(),
    radar: input.radar.map((metric) => `${metric.id}=${Math.round(metric.score)}`).sort(),
    wealth: [
      Math.round(input.wealth.riskScore),
      Math.round(input.wealth.disciplineScore),
      Math.round(input.wealth.diversificationScore),
      Math.round(input.wealth.netWorth),
      input.wealth.stageLabel,
    ],
    actions: Object.entries(input.actionCounts)
      .map(([key, value]) => `${key}=${value}`)
      .sort(),
    trend: input.netWorthTrend.map((value) => Math.round(value)),
    questionnaireScore:
      typeof input.questionnaireScore === "number" ? Math.round(input.questionnaireScore) : null,
  };

  return fnv1a(JSON.stringify(canonical));
}
