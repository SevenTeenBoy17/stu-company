import type { SimulationState, TutorRadarMetric, TutorRadarPayload } from "@/lib/types";
import { clamp } from "@/lib/utils";

const RADAR_PROMPT_TEMPLATE = [
  "任务：根据学生经济沙盘当前数据生成 6 维雷达图指标。",
  "输出必须是 JSON，不要 Markdown，不要解释。",
  "字段：summary: string; metrics: Array<{ id, label, score, note }>",
  "固定 6 个维度：资金安全、仓位纪律、风险控制、配置分散、成长弹性、复盘执行。",
  "score 为 0-100 的整数；note 使用 12 字以内中文短句。",
  "语气面向中学生，强调模拟盘、风险意识、现金流和复盘习惯。",
].join("\n");

export function getTutorRadarPromptTemplate() {
  return RADAR_PROMPT_TEMPLATE;
}

function getHoldingsValue(state: SimulationState) {
  return state.market.assets.reduce((total, asset) => {
    const holding = state.run.holdings.find((item) => item.assetId === asset.id);
    return total + (holding ? holding.quantity * asset.currentPrice : 0);
  }, 0);
}

function getConcentrationScore(state: SimulationState, holdingsValue: number) {
  if (holdingsValue <= 0 || state.run.holdings.length === 0) return 58;

  const maxPosition = Math.max(
    ...state.run.holdings.map((holding) => {
      const asset = state.market.assets.find((item) => item.id === holding.assetId);
      return asset ? asset.currentPrice * holding.quantity : 0;
    }),
  );
  const concentration = maxPosition / Math.max(holdingsValue, 1);
  const categoryCount = new Set(
    state.run.holdings
      .map((holding) => state.market.assets.find((asset) => asset.id === holding.assetId)?.category)
      .filter(Boolean),
  ).size;

  return Math.round(clamp(74 + categoryCount * 5 - concentration * 34, 28, 96));
}

export function buildTutorRadarPayload(
  state: SimulationState,
  provider: TutorRadarPayload["provider"] = "fallback",
  baseUrl?: string,
  // 水合确定性：SSR 与客户端首帧各调用一次本函数，asOf 若各自 new Date() 会在跨分钟边界时
  // 渲染文本不一致（内测 rank2 实锤的 /student 水合告警源之一）。调用方可传服务端时刻。
  asOf?: string,
): TutorRadarPayload {
  const latestSnapshot = state.run.snapshots.at(-1);
  const netWorth = latestSnapshot?.netWorth ?? state.run.cash + state.run.savings;
  const holdingsValue = getHoldingsValue(state);
  const cashRatio = (state.run.cash / Math.max(netWorth, 1)) * 100;
  const savingsRatio = (state.run.savings / Math.max(netWorth, 1)) * 100;
  const debtRatio = (state.run.debt / Math.max(netWorth, 1)) * 100;
  const ventureRatio = (state.run.ventureStake / Math.max(netWorth, 1)) * 100;
  const holdingsRatio = (holdingsValue / Math.max(netWorth, 1)) * 100;
  const actionDensity = state.run.actionLog.length / Math.max(state.run.currentRound, 1);
  const riskScore = latestSnapshot?.riskScore ?? 55;
  const disciplineScore = latestSnapshot?.disciplineScore ?? 72;

  const metrics: TutorRadarMetric[] = [
    {
      id: "cash-safety",
      label: "资金安全",
      score: Math.round(clamp(50 + cashRatio * 0.62 + savingsRatio * 0.28 - debtRatio * 0.72, 24, 96)),
      note: cashRatio > 35 ? "现金缓冲充足" : "留足现金垫",
    },
    {
      id: "position-discipline",
      label: "仓位纪律",
      score: Math.round(clamp(disciplineScore, 24, 96)),
      note: disciplineScore >= 80 ? "执行较稳定" : "减少冲动操作",
    },
    {
      id: "risk-control",
      label: "风险控制",
      score: Math.round(clamp(106 - riskScore, 22, 96)),
      note: riskScore > 65 ? "回撤压力偏高" : "风险相对可控",
    },
    {
      id: "diversification",
      label: "配置分散",
      score: getConcentrationScore(state, holdingsValue),
      note: state.run.holdings.length >= 3 ? "分散度较好" : "可增加分散",
    },
    {
      id: "growth-option",
      label: "成长弹性",
      score: Math.round(clamp(46 + ventureRatio * 1.1 + holdingsRatio * 0.28, 26, 94)),
      note: ventureRatio > 6 ? "成长敞口存在" : "弹性仍可观察",
    },
    {
      id: "review-execution",
      label: "复盘执行",
      score: Math.round(clamp(58 + state.run.snapshots.length * 4 - Math.max(0, actionDensity - 1.4) * 7, 30, 96)),
      note: actionDensity > 1.5 ? "控制出手频率" : "复盘节奏良好",
    },
  ];

  const weakest = [...metrics].sort((left, right) => left.score - right.score)[0];
  const strongest = [...metrics].sort((left, right) => right.score - left.score)[0];

  return {
    asOf: asOf ?? new Date().toISOString(),
    provider,
    baseUrl,
    summary: `当前最强项是「${strongest.label}」，最需要补课的是「${weakest.label}」。下一步适合先稳定现金与风险边界，再决定是否扩大仓位。`,
    metrics,
  };
}

export function buildTutorRadarContext(state: SimulationState) {
  const latestSnapshot = state.run.snapshots.at(-1);
  const holdingsValue = getHoldingsValue(state);

  return [
    `学生：${state.user.name} / ${state.user.title}`,
    `当前回合：${state.run.currentRound}/${state.run.totalRounds}`,
    `市场主题：${state.market.round.theme}`,
    `事件：${state.market.event.title} - ${state.market.event.description}`,
    `净值：${latestSnapshot?.netWorth ?? "未知"}`,
    `现金：${state.run.cash}`,
    `储蓄：${state.run.savings}`,
    `债务：${state.run.debt}`,
    `持仓市值：${holdingsValue}`,
    `房产数量：${state.run.propertyUnits}`,
    `创业投入：${state.run.ventureStake}`,
    `风险分：${latestSnapshot?.riskScore ?? "未知"}`,
    `纪律分：${latestSnapshot?.disciplineScore ?? "未知"}`,
    `最近动作：${state.run.actionLog.slice(0, 6).map((item) => `${item.label} / ${item.amount}`).join("；") || "暂无"}`,
  ].join("\n");
}
