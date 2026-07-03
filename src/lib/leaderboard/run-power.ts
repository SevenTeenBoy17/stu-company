/**
 * Adapter: a real ScenarioRun -> PowerScoreInput. Reuses the same metric math
 * the history review shows students (peak-tracking max drawdown, per-round
 * discipline) so the leaderboard score and the history page never disagree.
 *
 * Learning progress is passed in (it lives outside the run). Until the learning
 * tracker is wired it defaults to 0/0, so the learning component contributes 0
 * for everyone — fair, and the transparency panel (decision 1) surfaces it as a
 * visible "complete lessons to raise this" lever rather than hidden weighting.
 */
import { STARTING_CASH } from "@/lib/simulation";
import type { ScenarioRun } from "@/lib/types";

import { computePowerScore, type PowerScoreInput, type PowerScoreResult } from "./power-score";

export interface LearningProgress {
  completed: number;
  total: number;
}

/** Population standard deviation; 0 for fewer than 2 samples. */
function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function runToPowerInput(
  run: ScenarioRun,
  learning: LearningProgress = { completed: 0, total: 0 },
): PowerScoreInput {
  const snaps = run.snapshots ?? [];
  const lastNetWorth = run.netWorth ?? snaps.at(-1)?.netWorth ?? STARTING_CASH;

  // Round-over-round returns drive the volatility used for risk-adjusted return.
  const returns: number[] = [];
  for (let i = 1; i < snaps.length; i += 1) {
    const prev = snaps[i - 1].netWorth;
    if (prev > 0) returns.push((snaps[i].netWorth - prev) / prev);
  }

  // Peak-tracking max drawdown (%), identical to history-review buildMetrics.
  let peak = snaps[0]?.netWorth ?? STARTING_CASH;
  let maxDrawdownPct = 0;
  for (const s of snaps) {
    peak = Math.max(peak, s.netWorth);
    // 回撤按定义封顶 100%（净值为负的极端杠杆局不应产生 >100% 的无意义读数）。
    if (peak > 0) maxDrawdownPct = Math.min(100, Math.max(maxDrawdownPct, ((peak - s.netWorth) / peak) * 100));
  }

  return {
    startCapital: STARTING_CASH,
    netWorth: lastNetWorth,
    returnVolatility: stddev(returns),
    disciplineScore: snaps.at(-1)?.disciplineScore ?? 0,
    maxDrawdownPct,
    learningCompleted: learning.completed,
    learningTotal: learning.total,
  };
}

/** Convenience: run -> {power, components} in one call. */
export function computeRunPower(run: ScenarioRun, learning?: LearningProgress): PowerScoreResult {
  return computePowerScore(runToPowerInput(run, learning));
}
