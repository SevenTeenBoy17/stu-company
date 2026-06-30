/**
 * Financial learning score — the transparent growth-board metric.
 *
 * Decision 1: ranks decision QUALITY, not luck. A composite of risk-adjusted
 * return, discipline, drawdown control, learning completion, and growth — so a
 * disciplined steady investor out-ranks a reckless gambler who got lucky
 * (anti-YOLO). Components are returned for the transparency panel that MUST
 * show students how the score is built and the weights (decision 1).
 *
 * Pure + tunable: normalization constants are gray-launchable; this module has
 * no DB / IO so it is fully unit-testable. The adapter that maps a sim run to
 * `PowerScoreInput` lives elsewhere.
 */
export interface PowerScoreInput {
  startCapital: number; // 起始本金（如 120000）
  netWorth: number; // 当前/终值净值
  returnVolatility: number; // 回合收益波动（>=0；越大风险越高）
  disciplineScore: number; // 纪律分 0..100（已有）
  maxDrawdownPct: number; // 最大回撤 %（0..100，越小越好）
  learningCompleted: number; // 已完成学习项数
  learningTotal: number; // 学习项总数
}

export interface PowerComponents {
  riskAdjReturn: number; // 0..1
  discipline: number; // 0..1
  drawdown: number; // 0..1
  learning: number; // 0..1
  growth: number; // 0..1
}

/** 权重（决策 1：在透明面板里展示给学生）。总和 = 1.0。 */
export const POWER_WEIGHTS = {
  riskAdjReturn: 0.3,
  discipline: 0.25,
  drawdown: 0.2,
  learning: 0.15,
  growth: 0.1,
} as const satisfies Record<keyof PowerComponents, number>;

/** 可调归一化常量（先灰度，再依分布标定）。 */
export const POWER_TUNING = {
  epsilon: 1e-6,
  riskAdjReturnCap: 2, // 风险调整后收益映射到 [-cap, +cap] -> [0,1]（0 收益≈中位）
  drawdownCapPct: 50, // 回撤达到 50% 记 0 分
  growthCapReturn: 1, // 收益率达到 +100% 记满分
  maxPower: 2000,
} as const;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** 五个 0..1 分项（供透明面板 / 雷达展示）。 */
export function powerComponents(input: PowerScoreInput): PowerComponents {
  const totalReturn = input.netWorth / Math.max(input.startCapital, POWER_TUNING.epsilon) - 1;
  const riskAdj = totalReturn / Math.max(input.returnVolatility, POWER_TUNING.epsilon);

  // By design, total return feeds BOTH riskAdjReturn (.30, return per unit of
  // volatility) and growth (.10, raw return). The overlap is intentional — it
  // rewards return while weighting it more heavily when achieved with low
  // volatility — and is surfaced transparently in the composition panel.
  return {
    riskAdjReturn: clamp01(
      (riskAdj + POWER_TUNING.riskAdjReturnCap) / (2 * POWER_TUNING.riskAdjReturnCap),
    ),
    discipline: clamp01(input.disciplineScore / 100),
    drawdown: clamp01(1 - input.maxDrawdownPct / POWER_TUNING.drawdownCapPct),
    learning: input.learningTotal <= 0 ? 0 : clamp01(input.learningCompleted / input.learningTotal),
    growth: clamp01(totalReturn / POWER_TUNING.growthCapReturn),
  };
}

/** 合成学习积分（0..maxPower）+ 分项（透明展示）。 */
export interface PowerScoreResult {
  power: number;
  components: PowerComponents;
}

export function computePowerScore(input: PowerScoreInput): PowerScoreResult {
  const components = powerComponents(input);
  const raw =
    POWER_WEIGHTS.riskAdjReturn * components.riskAdjReturn +
    POWER_WEIGHTS.discipline * components.discipline +
    POWER_WEIGHTS.drawdown * components.drawdown +
    POWER_WEIGHTS.learning * components.learning +
    POWER_WEIGHTS.growth * components.growth;

  return { power: Math.round(clamp01(raw) * POWER_TUNING.maxPower), components };
}
