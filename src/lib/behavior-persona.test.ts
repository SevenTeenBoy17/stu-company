import { describe, expect, it } from "vitest";

import {
  buildPersonaSignalInput,
  normalizeBehaviorPersona,
  personaInputDigest,
  ruleFallbackPersona,
  type PersonaSignalInput,
} from "@/lib/behavior-persona";
import { advanceSimulationRun, applySimulationAction, createInitialRun } from "@/lib/simulation";
import type { BehaviorPersona, LearningProgressSummary, ScenarioRun } from "@/lib/types";

const TEST_SEED = 20260614;

function freshLearning(overrides: Partial<LearningProgressSummary> = {}): LearningProgressSummary {
  return { completed: 0, total: 6, completedKeys: [], ...overrides };
}

/** Round-1 starter run with no actions. */
function freshRun(): ScenarioRun {
  return createInitialRun("student-persona", "classroom-persona", "行为画像测试沙盘", TEST_SEED);
}

/** A mid-game run: a couple of buys, then a few advanced rounds. */
function midGameRun(): ScenarioRun {
  let run = freshRun();
  run = applySimulationAction(run, {
    type: "trade",
    assetId: "asset-stock",
    side: "buy",
    quantity: 2,
    orderMode: "market",
  });
  run = applySimulationAction(run, {
    type: "trade",
    assetId: "asset-bond",
    side: "buy",
    quantity: 2,
    orderMode: "market",
  });
  for (let i = 0; i < 5; i += 1) {
    run = advanceSimulationRun(run);
  }
  return run;
}

/**
 * A run engineered to fire several adaptive events at once:
 * overtrading (>=4 trades this round) + never_diversified (<=1 holding) +
 * cash_hoarding (>85% cash at round >= 5).
 */
function multiSignalRun(): ScenarioRun {
  const run = freshRun();
  run.currentRound = 9;
  run.holdings = [
    { assetId: "asset-stock", quantity: 1, averageCost: 100 },
  ];
  run.snapshots = [7, 8].map((round) => ({
    round,
    netWorth: 120_000,
    cash: 118_000,
    savings: 0,
    debt: 0,
    riskScore: 60,
    disciplineScore: 70,
    reflection: "测试快照",
  }));
  run.cash = 118_000;
  run.savings = 0;
  // 4 trades in the current round => overtrading (high confidence).
  run.actionLog = [0, 1, 2, 3].map((index) => ({
    id: `trade-${index}`,
    round: 9,
    type: "trade" as const,
    label: `买入股票 ${index}`,
    amount: 100,
    timestamp: "2026-06-14T00:00:00.000Z",
  }));
  return run;
}

describe("buildPersonaSignalInput", () => {
  it("assembles radar, wealth, action counts and adaptive events from a run", () => {
    const run = midGameRun();
    const input = buildPersonaSignalInput(run, freshLearning({ completed: 2, completedKeys: ["m1", "m2"] }));

    expect(input.currentRound).toBe(run.currentRound);
    expect(input.totalRounds).toBe(run.totalRounds);
    expect(input.radar).toHaveLength(6);
    input.radar.forEach((metric) => {
      expect(typeof metric.id).toBe("string");
      expect(Number.isFinite(metric.score)).toBe(true);
    });
    expect(Number.isFinite(input.wealth.netWorth)).toBe(true);
    expect(typeof input.wealth.stageLabel).toBe("string");
    expect(input.actionCounts.trade).toBeGreaterThanOrEqual(2);
    expect(input.actionCounts.learning_completed).toBe(2);
    expect(input.netWorthTrend.length).toBeGreaterThan(0);
    expect(Array.isArray(input.coachNextSteps)).toBe(true);
    expect(input.coachNextSteps!.length).toBeGreaterThan(0);
  });

  it("threads the saved questionnaire score through", () => {
    const run = freshRun();
    const input = buildPersonaSignalInput(run, freshLearning(), 81);
    expect(input.questionnaireScore).toBe(81);
  });
});

describe("ruleFallbackPersona", () => {
  it("returns a complete, valid, low-confidence persona for a fresh run", () => {
    const run = freshRun();
    const input = buildPersonaSignalInput(run, freshLearning());
    const persona = ruleFallbackPersona(input);

    expect(["defensive", "steady", "balanced", "growth"]).toContain(persona.band);
    expect(persona.confidence).toBe("low");
    expect(persona.label.length).toBeGreaterThan(0);
    expect(persona.archetype.length).toBeGreaterThan(0);
    expect(persona.summary.length).toBeGreaterThan(0);
    expect(persona.evidence.length).toBeGreaterThan(0);
    expect(persona.nextSteps.length).toBeGreaterThan(0);
  });

  it("returns a medium-confidence persona for a mid-game run", () => {
    const run = midGameRun();
    const input = buildPersonaSignalInput(run, freshLearning({ completed: 1 }));
    const persona = ruleFallbackPersona(input);

    expect(persona.confidence).toBe("medium");
    expect(persona.evidence.length).toBeGreaterThan(0);
    expect(persona.nextSteps.length).toBeGreaterThan(0);
    expect(persona.nextSteps).toEqual(input.coachNextSteps);
  });

  it("reflects triggered adaptive events in the evidence for a multi-signal run", () => {
    const run = multiSignalRun();
    const input = buildPersonaSignalInput(run, freshLearning());

    // The engineered run must actually trigger adaptive events.
    expect(input.adaptiveEvents.length).toBeGreaterThan(0);
    const triggeredPoints = input.adaptiveEvents.map((event) => event.teachingPoint);

    const persona = ruleFallbackPersona(input);
    expect(persona.confidence).toBe("high");
    // Evidence is drawn from the triggered events' teaching points.
    const overlap = persona.evidence.filter((line) => triggeredPoints.includes(line));
    expect(overlap.length).toBeGreaterThan(0);
    expect(persona.evidence.length).toBeLessThanOrEqual(3);
  });

  it("always produces a valid persona even with a hand-built input lacking coach steps", () => {
    const input: PersonaSignalInput = {
      currentRound: 9,
      totalRounds: 12,
      adaptiveEvents: [],
      radar: [
        { id: "cash-safety", label: "资金安全", score: 70 },
        { id: "position-discipline", label: "仓位纪律", score: 65 },
        { id: "risk-control", label: "风险控制", score: 40 },
        { id: "diversification", label: "配置分散", score: 55 },
        { id: "growth-option", label: "成长弹性", score: 60 },
        { id: "review-execution", label: "复盘执行", score: 62 },
      ],
      wealth: {
        riskScore: 72,
        disciplineScore: 60,
        diversificationScore: 50,
        netWorth: 130_000,
        stageLabel: "策略成长期",
      },
      actionCounts: { trade: 14 },
      netWorthTrend: [120_000, 125_000, 130_000],
    };

    const persona = ruleFallbackPersona(input);
    expect(persona.confidence).toBe("high");
    expect(persona.nextSteps.length).toBeGreaterThan(0);
    expect(persona.evidence.length).toBeGreaterThan(0);
  });
});

describe("normalizeBehaviorPersona", () => {
  const fallback: BehaviorPersona = {
    band: "steady",
    label: "兜底稳健者",
    archetype: "兜底原型",
    summary: "兜底总结。",
    evidence: ["兜底证据 A", "兜底证据 B"],
    nextSteps: ["兜底动作 1"],
    confidence: "medium",
  };

  it("uses parsed values when the JSON is valid", () => {
    const text = `这里是模型解释：\n{
      "band": "growth",
      "label": "进取挑战者",
      "archetype": "敢冲榜",
      "summary": "你倾向于追逐成长。",
      "evidence": ["频繁交易", "现金比例偏低"],
      "nextSteps": ["先写买入理由", "设置回撤线"],
      "confidence": "high"
    }`;
    const persona = normalizeBehaviorPersona(text, fallback);

    expect(persona.band).toBe("growth");
    expect(persona.label).toBe("进取挑战者");
    expect(persona.archetype).toBe("敢冲榜");
    expect(persona.summary).toBe("你倾向于追逐成长。");
    expect(persona.evidence).toEqual(["频繁交易", "现金比例偏低"]);
    expect(persona.nextSteps).toEqual(["先写买入理由", "设置回撤线"]);
    expect(persona.confidence).toBe("high");
  });

  it("extracts the first balanced object even when wrapped in a code fence and trailing prose", () => {
    const text = "```json\n{\"band\":\"balanced\",\"label\":\"均衡者\"}\n```\n之后还有一些无关文字。";
    const persona = normalizeBehaviorPersona(text, fallback);
    expect(persona.band).toBe("balanced");
    expect(persona.label).toBe("均衡者");
    // Missing fields fall back.
    expect(persona.archetype).toBe(fallback.archetype);
    expect(persona.confidence).toBe(fallback.confidence);
  });

  it("returns the fallback unchanged for empty, garbage or non-JSON text", () => {
    expect(normalizeBehaviorPersona("", fallback)).toEqual(fallback);
    expect(normalizeBehaviorPersona("完全没有 JSON 的一段话", fallback)).toEqual(fallback);
    expect(normalizeBehaviorPersona("{ this is not : valid json ]", fallback)).toEqual(fallback);
  });

  it("keeps valid fields and falls back per-field on partial / invalid input", () => {
    const text = `{
      "band": "not-a-band",
      "label": "只有标签是新的",
      "summary": "",
      "evidence": [],
      "confidence": "ultra"
    }`;
    const persona = normalizeBehaviorPersona(text, fallback);

    // Invalid band/confidence fall back.
    expect(persona.band).toBe(fallback.band);
    expect(persona.confidence).toBe(fallback.confidence);
    // Valid label kept.
    expect(persona.label).toBe("只有标签是新的");
    // Empty summary / empty evidence fall back.
    expect(persona.summary).toBe(fallback.summary);
    expect(persona.evidence).toEqual(fallback.evidence);
    // Missing archetype / nextSteps fall back.
    expect(persona.archetype).toBe(fallback.archetype);
    expect(persona.nextSteps).toEqual(fallback.nextSteps);
  });

  it("never throws on adversarial input", () => {
    const inputs = ["{", "}", "{{{", '{"evidence": "not-an-array"}', "null", "[]", "{\"band\": 5}"];
    for (const raw of inputs) {
      expect(() => normalizeBehaviorPersona(raw, fallback)).not.toThrow();
      const persona = normalizeBehaviorPersona(raw, fallback);
      expect(["defensive", "steady", "balanced", "growth"]).toContain(persona.band);
    }
  });
});

// ---------------------------------------------------------------------------
// Band truth table (F1-2) — these encode the PRINCIPLE that the top-level band
// must read behavior in the RIGHT direction: defensive signals (cash hoarding)
// pull DOWN, aggressive signals (overtrading / concentration / leverage) push
// UP, and the questionnaire is only a tie-break that can never flip a clear
// behavior band. Assertions are directional (behavior → band), not pinned to
// arbitrary scores, so the formula is judged on its logic, not on magic numbers.
// ---------------------------------------------------------------------------

/**
 * (a) Pure cash-hoarder: mostly cash/savings, ~0 trades, advanced several rounds
 * so `cash_hoarding` triggers (cashRatio > 0.85 at round >= 5). The defensive
 * signal must win — a zero-risk hoarder is NOT a "均衡配置者".
 */
function cashHoarderRun(): ScenarioRun {
  let run = freshRun();
  // Park almost everything in savings so cash + savings stays ~100% of net worth.
  run = applySimulationAction(run, { type: "bank", action: "deposit", amount: 90_000 });
  // No trades at all; just let the rounds tick past the cash_hoarding threshold.
  for (let i = 0; i < 6; i += 1) {
    run = advanceSimulationRun(run);
  }
  return run;
}

/**
 * (b) YOLO all-in gambler: a loan for leverage, then one asset bought with a big
 * position and a high trade frequency. Concentrated + leveraged + frequent.
 */
function yoloRun(): ScenarioRun {
  let run = freshRun();
  run = applySimulationAction(run, { type: "bank", action: "loan", amount: 100_000 });
  // Many buys of a single asset this round → overtrading + never_diversified.
  for (let i = 0; i < 8; i += 1) {
    run = applySimulationAction(run, {
      type: "trade",
      assetId: "asset-stock",
      side: "buy",
      quantity: 4,
      orderMode: "market",
    });
  }
  return run;
}

/**
 * (c) Maximally diversified: spread across 4+ asset classes with real growth
 * exposure, so the diversification score is high. Should never read defensive.
 */
function diversifiedRun(): ScenarioRun {
  let run = freshRun();
  // Heavy enough buys (asset unit prices are ~64–112) to deploy most of the
  // 120k cash across 6 asset classes, so the cash ratio falls well below the
  // hoarding threshold and the holdings genuinely dominate the allocation.
  const buys: Array<{ assetId: string; quantity: number }> = [
    { assetId: "asset-stock", quantity: 200 },
    { assetId: "asset-etf", quantity: 200 },
    { assetId: "asset-bond", quantity: 200 },
    { assetId: "asset-commodity", quantity: 200 },
    { assetId: "asset-fx", quantity: 200 },
    { assetId: "asset-gold", quantity: 100 },
  ];
  for (const buy of buys) {
    run = applySimulationAction(run, {
      type: "trade",
      assetId: buy.assetId,
      side: "buy",
      quantity: buy.quantity,
      orderMode: "market",
    });
  }
  for (let i = 0; i < 4; i += 1) {
    run = advanceSimulationRun(run);
  }
  return run;
}

/**
 * (d) Revenge high-frequency trader: trades heavily every round, including right
 * after a loss. High trade intensity + overtrading.
 */
function revengeRun(): ScenarioRun {
  let run = freshRun();
  // Round 1: buy a big concentrated stock position.
  for (let i = 0; i < 4; i += 1) {
    run = applySimulationAction(run, {
      type: "trade",
      assetId: "asset-stock",
      side: "buy",
      quantity: 3,
      orderMode: "market",
    });
  }
  // Churn for several rounds: sell + rebuy every round → high frequency.
  for (let r = 0; r < 5; r += 1) {
    run = advanceSimulationRun(run);
    run = applySimulationAction(run, {
      type: "trade",
      assetId: "asset-stock",
      side: "sell",
      quantity: 2,
      orderMode: "market",
    });
    run = applySimulationAction(run, {
      type: "trade",
      assetId: "asset-stock",
      side: "buy",
      quantity: 2,
      orderMode: "market",
    });
    run = applySimulationAction(run, {
      type: "trade",
      assetId: "asset-etf",
      side: "buy",
      quantity: 1,
      orderMode: "market",
    });
  }
  return run;
}

describe("behavior persona — band truth table (F1-2)", () => {
  it("(a) a pure cash-hoarder reads as defensive, not balanced", () => {
    const run = cashHoarderRun();
    const input = buildPersonaSignalInput(run, freshLearning());
    // Sanity: the engineered run actually fires the defensive cash_hoarding card.
    expect(input.adaptiveEvents.some((event) => event.id === "cash_hoarding")).toBe(true);

    const persona = ruleFallbackPersona(input);
    expect(persona.band).toBe("defensive");
  });

  it("(b) a YOLO all-in gambler reads as growth", () => {
    const run = yoloRun();
    const input = buildPersonaSignalInput(run, freshLearning());
    const persona = ruleFallbackPersona(input);
    expect(persona.band).toBe("growth");
  });

  it("(c) a maximally diversified player never reads as defensive", () => {
    const run = diversifiedRun();
    const input = buildPersonaSignalInput(run, freshLearning());
    expect(input.wealth.diversificationScore).toBeGreaterThanOrEqual(72);

    const persona = ruleFallbackPersona(input);
    expect(persona.band).not.toBe("defensive");
    expect(["steady", "balanced"]).toContain(persona.band);
  });

  it("(d) a revenge high-frequency trader reads as growth", () => {
    const run = revengeRun();
    const input = buildPersonaSignalInput(run, freshLearning());
    const persona = ruleFallbackPersona(input);
    expect(persona.band).toBe("growth");
  });

  it("(e) a do-nothing player at round 1 is low-confidence and never growth", () => {
    const run = freshRun();
    const input = buildPersonaSignalInput(run, freshLearning());
    const persona = ruleFallbackPersona(input);
    expect(persona.confidence).toBe("low");
    expect(persona.band).not.toBe("growth");
  });

  it("(f) a degenerate hand-built input yields a valid band with no NaN", () => {
    const input: PersonaSignalInput = {
      currentRound: 0,
      totalRounds: 12,
      adaptiveEvents: [],
      radar: [],
      wealth: {
        riskScore: Number.NaN,
        disciplineScore: Number.NaN,
        diversificationScore: Number.NaN,
        netWorth: 0,
        stageLabel: "",
      },
      actionCounts: {},
      netWorthTrend: [],
    };
    const persona = ruleFallbackPersona(input);
    expect(["defensive", "steady", "balanced", "growth"]).toContain(persona.band);
  });

  it("(g) a conservative questionnaire cannot flip a clear growth behavior band", () => {
    const run = yoloRun();
    const baseInput = buildPersonaSignalInput(run, freshLearning());
    const withoutQuestionnaire = ruleFallbackPersona(baseInput);
    expect(withoutQuestionnaire.band).toBe("growth");

    // A maximally conservative questionnaire score must NOT drag the clear
    // behavior-derived "growth" band down — behavior is more accurate.
    const withConservativeQuestionnaire = ruleFallbackPersona({
      ...baseInput,
      questionnaireScore: 20,
    });
    expect(withConservativeQuestionnaire.band).toBe("growth");
  });

  it("(g') a bullish questionnaire cannot flip a clear defensive band either", () => {
    const run = cashHoarderRun();
    const baseInput = buildPersonaSignalInput(run, freshLearning());
    expect(ruleFallbackPersona(baseInput).band).toBe("defensive");

    // A maximally aggressive questionnaire score must NOT drag the clear
    // behavior-derived "defensive" band up — the tie-break is capped at ±3.
    const withBullishQuestionnaire = ruleFallbackPersona({
      ...baseInput,
      questionnaireScore: 95,
    });
    expect(withBullishQuestionnaire.band).toBe("defensive");
  });
});

// ---------------------------------------------------------------------------
// Band resolution (no over-clamp) — adversarial generalization guard. The
// defensive short-circuit must not collapse the band to defensive-or-growth:
// moderate/steady and diversified-with-a-cash-buffer players must remain
// REACHABLE in steady/balanced. These FAIL against the over-clamping
// short-circuit (`|| cashHoarding` plus the near-vacuous
// riskControl<=70 && tradeIntensity<=0.6 && growthOption<=55 conjunction) and
// PASS once the discriminators are tightened.
// ---------------------------------------------------------------------------

/**
 * A MODERATE/STEADY player: a few modest trades spread across 3 asset classes,
 * leaving roughly half the starting cash in reserve. Not concentrated, not
 * leveraged — the textbook "steady" profile that the over-clamp wrongly forces
 * into defensive.
 */
function moderateSteadyRun(): ScenarioRun {
  let run = freshRun();
  // Deploy ~60k of the 120k starting cash across 3 classes → ~50% cash buffer.
  const buys: Array<{ assetId: string; quantity: number }> = [
    { assetId: "asset-stock", quantity: 180 }, // ~20k
    { assetId: "asset-etf", quantity: 240 }, // ~20k
    { assetId: "asset-bond", quantity: 200 }, // ~20k
  ];
  for (const buy of buys) {
    run = applySimulationAction(run, {
      type: "trade",
      assetId: buy.assetId,
      side: "buy",
      quantity: buy.quantity,
      orderMode: "market",
    });
  }
  for (let i = 0; i < 4; i += 1) {
    run = advanceSimulationRun(run);
  }
  return run;
}

/**
 * A WELL-DIVERSIFIED player WITH a cash buffer: spread across 4+ asset classes
 * but with small positions, so ~70%+ of the large starting balance stays in
 * cash. This is the EXACT over-clamp case — `cash_hoarding` fires (cash > 70%)
 * even though the player is genuinely diversified, so the old `|| cashHoarding`
 * clamp wrongly drags a diversified player to defensive.
 */
function diversifiedWithBufferRun(): ScenarioRun {
  let run = freshRun();
  // Small positions across 4 classes → only ~30k deployed, ~75% cash buffer.
  const buys: Array<{ assetId: string; quantity: number }> = [
    { assetId: "asset-stock", quantity: 70 }, // ~8k
    { assetId: "asset-etf", quantity: 90 }, // ~7.6k
    { assetId: "asset-bond", quantity: 80 }, // ~8.2k
    { assetId: "asset-gold", quantity: 70 }, // ~6.9k
  ];
  for (const buy of buys) {
    run = applySimulationAction(run, {
      type: "trade",
      assetId: buy.assetId,
      side: "buy",
      quantity: buy.quantity,
      orderMode: "market",
    });
  }
  for (let i = 0; i < 5; i += 1) {
    run = advanceSimulationRun(run);
  }
  return run;
}

describe("behavior persona — band resolution (no over-clamp)", () => {
  it("a moderate/steady player is not over-clamped to defensive (stays steady/balanced)", () => {
    const run = moderateSteadyRun();
    const input = buildPersonaSignalInput(run, freshLearning({ completed: 1 }));
    const persona = ruleFallbackPersona(input);

    // The over-clamp wrongly forced this profile to defensive; after the fix it
    // must land in the reachable middle bands.
    expect(persona.band).not.toBe("defensive");
    expect(persona.band).not.toBe("growth");
    expect(["steady", "balanced"]).toContain(persona.band);
  });

  it("a well-diversified player WITH a cash buffer is not over-clamped to defensive", () => {
    const run = diversifiedWithBufferRun();
    const input = buildPersonaSignalInput(run, freshLearning());

    // Sanity: this is genuinely the over-clamp case — a cash buffer above the
    // 70% hoarding threshold (medium-confidence cash_hoarding may fire) on a
    // diversified player.
    const cashEvent = input.adaptiveEvents.find((event) => event.id === "cash_hoarding");
    if (cashEvent) {
      expect(cashEvent.confidence).not.toBe("high");
    }

    const persona = ruleFallbackPersona(input);
    expect(persona.band).not.toBe("defensive");
  });
});

describe("personaInputDigest", () => {
  it("is stable for the same input", () => {
    const run = midGameRun();
    const input = buildPersonaSignalInput(run, freshLearning({ completed: 2 }));
    expect(personaInputDigest(input)).toBe(personaInputDigest(input));
  });

  it("is deterministic across two freshly assembled identical inputs", () => {
    const a = buildPersonaSignalInput(midGameRun(), freshLearning({ completed: 2 }));
    const b = buildPersonaSignalInput(midGameRun(), freshLearning({ completed: 2 }));
    expect(personaInputDigest(a)).toBe(personaInputDigest(b));
  });

  it("changes when a salient signal changes", () => {
    const run = midGameRun();
    const base = buildPersonaSignalInput(run, freshLearning({ completed: 2 }));
    const baseDigest = personaInputDigest(base);

    // Different current round.
    expect(personaInputDigest({ ...base, currentRound: base.currentRound + 1 })).not.toBe(baseDigest);
    // Different action counts.
    expect(
      personaInputDigest({ ...base, actionCounts: { ...base.actionCounts, trade: (base.actionCounts.trade ?? 0) + 5 } }),
    ).not.toBe(baseDigest);
    // Different questionnaire score.
    expect(personaInputDigest({ ...base, questionnaireScore: 95 })).not.toBe(baseDigest);
  });
});
