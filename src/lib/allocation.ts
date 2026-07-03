import { marketAssets } from "@/lib/market-data";
import { evaluateRun, getRoundQuotesForRun, STARTING_CASH } from "@/lib/simulation";
import type { AssetCategory, ScenarioRun } from "@/lib/types";
import { clamp } from "@/lib/utils";

export type WealthAllocationKey =
  | "cash"
  | "savings"
  | "stock"
  | "etf"
  | "bond"
  | "commodity"
  | "fx"
  | "property"
  | "venture";

export type WealthAllocationSlice = {
  id: WealthAllocationKey;
  label: string;
  value: number;
  weight: number;
  color: string;
  riskBand: "liquid" | "stable" | "growth" | "real" | "venture";
  hint: string;
};

export type WealthSummary = {
  netWorth: number;
  grossAssets: number;
  roundReturn: number;
  roundReturnRate: number;
  cumulativeReturn: number;
  cumulativeReturnRate: number;
  cash: number;
  savings: number;
  debt: number;
  riskScore: number;
  disciplineScore: number;
  diversificationScore: number;
  stageLabel: string;
  allocation: WealthAllocationSlice[];
  targetAllocation: Array<{
    label: string;
    current: number;
    target: number;
    gap: number;
  }>;
  trend: Array<{
    round: number;
    netWorth: number;
  }>;
  zones: Array<{
    id: string;
    title: string;
    value: number;
    weight: number;
    summary: string;
  }>;
  missions: Array<{
    id: string;
    title: string;
    status: "done" | "doing" | "watch";
    progress: number;
    reward: string;
  }>;
  coaching: {
    title: string;
    summary: string;
    nextSteps: string[];
  };
};

const allocationMeta: Record<
  WealthAllocationKey,
  Pick<WealthAllocationSlice, "label" | "color" | "riskBand" | "hint">
> = {
  cash: {
    label: "可用现金",
    color: "var(--ink-700)",
    riskBand: "liquid",
    hint: "应急缓冲，负责给下一回合留下选择权。",
  },
  savings: {
    label: "稳健储蓄",
    color: "var(--info-500)",
    riskBand: "stable",
    hint: "低波动压舱石，适合做安全垫。",
  },
  stock: {
    label: "股票",
    color: "var(--up-500)",
    riskBand: "growth",
    hint: "高弹性资产，涨跌都更考验纪律。",
  },
  etf: {
    label: "ETF",
    color: "var(--brand)",
    riskBand: "growth",
    hint: "一篮子持有，适合理解分散投资。",
  },
  bond: {
    label: "债券",
    color: "var(--down-500)",
    riskBand: "stable",
    hint: "收益较稳，用来降低组合波动。",
  },
  commodity: {
    label: "商品",
    color: "var(--warning-500)",
    riskBand: "real",
    hint: "受供需和通胀影响，适合学习周期。",
  },
  fx: {
    label: "汇率对冲",
    color: "var(--info-400)",
    riskBand: "real",
    hint: "感受汇率变化与全球资金流。",
  },
  property: {
    label: "模拟房产",
    color: "var(--amber-700)",
    riskBand: "real",
    hint: "大额、低流动性资产，不能只看升值。",
  },
  venture: {
    label: "创业项目",
    color: "var(--error-400)",
    riskBand: "venture",
    hint: "高不确定性投入，适合训练仓位控制。",
  },
};

function safeRate(delta: number, base: number) {
  if (!Number.isFinite(base) || Math.abs(base) < 1) return 0;
  return (delta / base) * 100;
}

function addValue(values: Map<WealthAllocationKey, number>, key: WealthAllocationKey, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  values.set(key, (values.get(key) ?? 0) + Math.round(amount));
}

function categoryToKey(category: AssetCategory): WealthAllocationKey {
  return category;
}

export function computeDiversificationScore(slices: WealthAllocationSlice[], debt: number, netWorth: number) {
  const positive = slices.filter((slice) => slice.value > 0);
  if (positive.length === 0) return 45;

  const hhi = positive.reduce((sum, slice) => sum + (slice.weight / 100) ** 2, 0);
  const categoryBonus = Math.min(18, positive.length * 3);
  const debtPenalty = clamp((debt / Math.max(netWorth, 1)) * 35, 0, 22);
  const score = 100 - hhi * 86 + categoryBonus - debtPenalty;
  return Math.round(clamp(score, 32, 96));
}

export function buildWealthSummary(run: ScenarioRun): WealthSummary {
  const evaluation = evaluateRun(run, run.currentRound);
  const values = new Map<WealthAllocationKey, number>();
  const quotes = getRoundQuotesForRun(run, run.currentRound);

  addValue(values, "cash", run.cash);
  addValue(values, "savings", run.savings);
  addValue(values, "property", evaluation.propertyValue);
  addValue(values, "venture", evaluation.ventureValue);

  for (const holding of run.holdings) {
    const quote = quotes.find((item) => item.id === holding.assetId);
    const asset = marketAssets.find((item) => item.id === holding.assetId);
    if (!quote || !asset) continue;
    addValue(values, categoryToKey(asset.category), quote.currentPrice * holding.quantity);
  }

  const grossAssets = Array.from(values.values()).reduce((sum, value) => sum + value, 0);
  const allocation = Array.from(values.entries())
    .map(([id, value]) => ({
      id,
      value,
      weight: grossAssets > 0 ? (value / grossAssets) * 100 : 0,
      ...allocationMeta[id],
    }))
    .sort((left, right) => right.value - left.value);

  const lastSnapshot = run.snapshots.at(-1);
  const previousSnapshot = run.snapshots.at(-2);
  const previousNetWorth = previousSnapshot?.netWorth ?? STARTING_CASH;
  const currentNetWorth = lastSnapshot?.netWorth ?? evaluation.netWorth;
  const roundReturn = currentNetWorth - previousNetWorth;
  const cumulativeReturn = currentNetWorth - STARTING_CASH;
  const diversificationScore = computeDiversificationScore(allocation, run.debt, currentNetWorth);

  const liquidWeight = allocation
    .filter((slice) => slice.riskBand === "liquid" || slice.riskBand === "stable")
    .reduce((sum, slice) => sum + slice.weight, 0);
  const growthWeight = allocation
    .filter((slice) => slice.riskBand === "growth")
    .reduce((sum, slice) => sum + slice.weight, 0);
  const realWeight = allocation
    .filter((slice) => slice.riskBand === "real" || slice.riskBand === "venture")
    .reduce((sum, slice) => sum + slice.weight, 0);

  const target =
    evaluation.riskScore >= 68
      ? { liquid: 34, growth: 42, real: 24 }
      : evaluation.riskScore >= 50
        ? { liquid: 42, growth: 36, real: 22 }
        : { liquid: 54, growth: 28, real: 18 };

  const targetAllocation = [
    { label: "安全垫", current: liquidWeight, target: target.liquid, gap: liquidWeight - target.liquid },
    { label: "成长资产", current: growthWeight, target: target.growth, gap: growthWeight - target.growth },
    { label: "实物与探索", current: realWeight, target: target.real, gap: realWeight - target.real },
  ];

  const stageLabel =
    diversificationScore >= 78
      ? "均衡探索期"
      : evaluation.riskScore >= 70
        ? "风险降温期"
        : liquidWeight < 28
          ? "安全垫修复期"
          : "策略成长期";

  const zones = [
    {
      id: "liquid",
      title: "安全垫",
      value: run.cash + run.savings,
      weight: liquidWeight,
      summary: "现金和储蓄决定你能否扛住突发事件。",
    },
    {
      id: "growth",
      title: "成长引擎",
      value: allocation
        .filter((slice) => slice.riskBand === "growth")
        .reduce((sum, slice) => sum + slice.value, 0),
      weight: growthWeight,
      summary: "股票和 ETF 负责收益弹性，也最考验情绪。",
    },
    {
      id: "real",
      title: "生活资产",
      value: allocation
        .filter((slice) => slice.riskBand === "real" || slice.riskBand === "venture")
        .reduce((sum, slice) => sum + slice.value, 0),
      weight: realWeight,
      summary: "房产、商品、汇率和创业让沙盘更接近真实生活。",
    },
  ];

  const debtRatio = run.debt / Math.max(currentNetWorth, 1);
  const missions: WealthSummary["missions"] = [
    {
      id: "buffer",
      title: "保留 20% 以上安全垫",
      status: liquidWeight >= 20 ? "done" : "doing",
      progress: clamp(liquidWeight / 20, 0, 1),
      reward: "降低被迫卖出的概率",
    },
    {
      id: "diversify",
      title: "分散度评分达到 75",
      status: diversificationScore >= 75 ? "done" : "doing",
      progress: clamp(diversificationScore / 75, 0, 1),
      reward: "解锁更稳的组合视角",
    },
    {
      id: "debt",
      title: "负债率低于 15%",
      status: debtRatio <= 0.15 ? "done" : "watch",
      progress: clamp(1 - run.debt / Math.max(currentNetWorth * 0.15, 1), 0, 1),
      reward: "避免杠杆吞掉收益",
    },
  ];

  const nextSteps = [
    liquidWeight < target.liquid
      ? "先补安全垫：下一回合优先把现金或储蓄提高到建议区间附近。"
      : "安全垫基本够用：可以用小仓位继续观察成长资产，不急着一次押满。",
    diversificationScore < 72
      ? "降低集中度：把单一资产的影响控制在组合里更可承受的位置。"
      : "保持分散纪律：继续记录每次调仓理由，而不是只看短期涨跌。",
    run.debt > 0
      ? "检查负债成本：债务会在每回合滚动增加，收益判断要先扣掉利息。"
      : "没有明显负债压力：可以把注意力放在节奏、复盘和学习任务上。",
  ];

  return {
    netWorth: currentNetWorth,
    grossAssets,
    roundReturn,
    roundReturnRate: safeRate(roundReturn, previousNetWorth),
    cumulativeReturn,
    cumulativeReturnRate: safeRate(cumulativeReturn, STARTING_CASH),
    cash: run.cash,
    savings: run.savings,
    debt: run.debt,
    riskScore: evaluation.riskScore,
    disciplineScore: evaluation.disciplineScore,
    diversificationScore,
    stageLabel,
    allocation,
    targetAllocation,
    trend: run.snapshots.map((snapshot) => ({
      round: snapshot.round,
      netWorth: snapshot.netWorth,
    })),
    zones,
    missions,
    coaching: {
      title: `${stageLabel}：先看安全垫，再看收益弹性`,
      summary:
        "这张图不是让你追求最高收益，而是把现实理财里的现金流、分散、负债和长期纪律放在同一张地图上。",
      nextSteps,
    },
  };
}
