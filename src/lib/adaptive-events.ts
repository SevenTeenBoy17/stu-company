import type { ScenarioRun } from "@/lib/types";

export type BehaviorSignalId =
  | "overtrading"
  | "never_diversified"
  | "revenge_trading"
  | "bond_avoidance"
  | "herd_following"
  | "loss_anchoring"
  | "cash_hoarding"
  | "streak_positive";

export type ConfidenceLevel = "low" | "medium" | "high";

export interface AdaptiveEvent {
  id: BehaviorSignalId;
  title: string;
  message: string;
  teachingPoint: string;
  tone: "warning" | "info" | "positive";
  confidence: ConfidenceLevel;
  /** Whether this signal indicates risk-seeking ("up"), risk-averse ("down"), or a behavioural bias without a clear risk direction ("neutral"). */
  riskDirection: "up" | "down" | "neutral";
}

interface DetectionResult {
  triggered: boolean;
  confidence: ConfidenceLevel;
}

function detectOvertrading(run: ScenarioRun): DetectionResult {
  const recentTrades = run.actionLog.filter(
    (a) => a.type === "trade" && a.round === run.currentRound,
  );
  if (recentTrades.length >= 4) return { triggered: true, confidence: "high" };
  if (recentTrades.length >= 3) return { triggered: true, confidence: "medium" };
  return { triggered: false, confidence: "low" };
}

function detectRevengeTrading(run: ScenarioRun): DetectionResult {
  if (run.currentRound < 3) return { triggered: false, confidence: "low" };

  const prev = run.snapshots.find((s) => s.round === run.currentRound - 1);
  const prevPrev = run.snapshots.find((s) => s.round === run.currentRound - 2);
  if (!prev || !prevPrev) return { triggered: false, confidence: "low" };

  const hadLoss = prev.netWorth < prevPrev.netWorth;
  const tradesAfterLoss = run.actionLog.filter(
    (a) => a.type === "trade" && a.round === run.currentRound,
  ).length;

  if (hadLoss && tradesAfterLoss >= 3) return { triggered: true, confidence: "high" };
  if (hadLoss && tradesAfterLoss >= 2) return { triggered: true, confidence: "medium" };
  return { triggered: false, confidence: "low" };
}

function detectBondAvoidance(run: ScenarioRun): DetectionResult {
  if (run.currentRound < 4) return { triggered: false, confidence: "low" };
  const bondTrades = run.actionLog.filter(
    (a) => a.type === "trade" && a.label.includes("债券"),
  );
  const hasBondHolding = run.holdings.some((h) => h.assetId === "asset-bond");
  if (bondTrades.length === 0 && !hasBondHolding) {
    return { triggered: true, confidence: run.currentRound >= 6 ? "high" : "medium" };
  }
  return { triggered: false, confidence: "low" };
}

function detectNeverDiversified(run: ScenarioRun): DetectionResult {
  if (run.currentRound < 3) return { triggered: false, confidence: "low" };
  if (run.holdings.length <= 1) {
    return { triggered: true, confidence: run.currentRound >= 5 ? "high" : "medium" };
  }
  return { triggered: false, confidence: "low" };
}

function detectCashHoarding(run: ScenarioRun): DetectionResult {
  if (run.currentRound < 5) return { triggered: false, confidence: "low" };
  const latestSnapshot = run.snapshots.at(-1);
  const netWorth = latestSnapshot?.netWorth ?? (run.cash + run.savings);
  const cashLiquidity = run.cash + run.savings;
  const cashRatio = cashLiquidity / Math.max(netWorth, 1);
  if (cashRatio > 0.85) return { triggered: true, confidence: "high" };
  if (cashRatio > 0.7) return { triggered: true, confidence: "medium" };
  return { triggered: false, confidence: "low" };
}

function detectLossAnchoring(run: ScenarioRun): DetectionResult {
  if (run.currentRound < 4 || run.holdings.length === 0) {
    return { triggered: false, confidence: "low" };
  }
  const losingHoldings = run.holdings.filter((h) => {
    const latestSnapshot = run.snapshots.at(-1);
    if (!latestSnapshot) return false;
    return h.averageCost > 0 && latestSnapshot.netWorth < 120_000;
  });
  const roundsHeld = run.actionLog.filter(
    (a) => a.type === "trade" && a.label.includes("卖出"),
  ).length;
  const totalTrades = run.actionLog.filter((a) => a.type === "trade").length;
  if (losingHoldings.length > 0 && totalTrades > 3 && roundsHeld === 0) {
    return { triggered: true, confidence: run.currentRound >= 6 ? "high" : "medium" };
  }
  return { triggered: false, confidence: "low" };
}

function detectHerdFollowing(run: ScenarioRun): DetectionResult {
  if (run.currentRound < 4 || run.holdings.length === 0) {
    return { triggered: false, confidence: "low" };
  }
  const stockHolding = run.holdings.find((h) => h.assetId === "asset-stock");
  const totalValue = run.holdings.reduce((s, h) => s + h.quantity * h.averageCost, 0);
  if (!stockHolding || totalValue === 0) return { triggered: false, confidence: "low" };
  const stockWeight = (stockHolding.quantity * stockHolding.averageCost) / totalValue;
  if (stockWeight > 0.7 && run.currentRound >= 5) {
    return { triggered: true, confidence: "high" };
  }
  if (stockWeight > 0.6) {
    return { triggered: true, confidence: "medium" };
  }
  return { triggered: false, confidence: "low" };
}

function detectPositiveStreak(run: ScenarioRun): DetectionResult {
  if (run.snapshots.length < 3) return { triggered: false, confidence: "low" };
  const recent = run.snapshots.slice(-3);
  const allUp = recent.every((s, i) => {
    if (i === 0) return true;
    return s.netWorth > recent[i - 1].netWorth;
  });
  if (allUp) return { triggered: true, confidence: "medium" };
  return { triggered: false, confidence: "low" };
}

const EVENT_CATALOG: Record<BehaviorSignalId, Omit<AdaptiveEvent, "confidence">> = {
  overtrading: {
    id: "overtrading",
    title: "交易所提醒：操作频率较高",
    message: "你这个回合的交易次数超过了多数同学。频繁买卖会增加决策噪音，试着先想清楚再出手。",
    teachingPoint: "过度交易往往源于情绪而非策略，真正的高手交易次数比你想象的少。",
    tone: "warning",
    riskDirection: "up",
  },
  never_diversified: {
    id: "never_diversified",
    title: "教练观察：你的组合比较集中",
    message: "目前你只持有一种资产。想象把所有鸡蛋放在一个篮子里 — 如果篮子掉了呢？",
    teachingPoint: "分散投资是降低风险最基本的方法，试试把资金分配到不同类型的资产上。",
    tone: "info",
    riskDirection: "up",
  },
  revenge_trading: {
    id: "revenge_trading",
    title: "Mr.Brown 提示：注意报复性交易",
    message: "上回合亏损后你立刻加大了操作力度。这种冲动叫「报复性交易」，通常会让情况更糟。",
    teachingPoint: "亏损后的正确做法是先暂停、复盘原因，再决定下一步，而不是急着「赚回来」。",
    tone: "warning",
    riskDirection: "up",
  },
  bond_avoidance: {
    id: "bond_avoidance",
    title: "新闻速递：近期债券收益率创新高",
    message: "你还没有尝试过债券。债券虽然涨得慢，但在市场下跌时能当你的安全垫。",
    teachingPoint: "债券是组合里的「稳定器」，很多专业投资者都会配置一部分来降低整体波动。",
    tone: "info",
    // "up" because never diversifying into bonds signals concentration risk
    // (the player is all-equity/all-cash) — not because bonds themselves are
    // a risk-seeking asset.
    riskDirection: "up",
  },
  herd_following: {
    id: "herd_following",
    title: "数据速览：你和多数同学的选择一样",
    message: "你的持仓和排行榜前几名非常相似。跟着大家走感觉安全，但这也意味着如果大家错了，你也会一起错。",
    teachingPoint: "这叫「羊群效应」。独立思考比跟风更重要 — 想想你买这个的理由是什么。",
    tone: "info",
    riskDirection: "up",
  },
  loss_anchoring: {
    id: "loss_anchoring",
    title: "教练观察：你是否在等待「回本」?",
    message: "有一些亏损的持仓你一直没有卖出。如果你是因为「不想承认亏了」而继续持有，这叫锚定效应。",
    teachingPoint: "判断是否卖出应该看「现在这笔钱放哪里更好」，而不是「我买的时候花了多少」。",
    tone: "warning",
    riskDirection: "neutral",
  },
  cash_hoarding: {
    id: "cash_hoarding",
    title: "市场观察：你的现金比例偏高",
    message: "你目前超过 70% 的资产是现金和储蓄。虽然安全，但长期来看通货膨胀会让现金的购买力慢慢变少。",
    teachingPoint: "这叫「机会成本」— 什么都不做也是一种选择，而且可能不是最优的选择。",
    tone: "info",
    riskDirection: "down",
  },
  streak_positive: {
    id: "streak_positive",
    title: "恭喜！连续三轮增长",
    message: "你的净值已经连续三回合上涨，节奏感很好！但别忘了设置你的「舒适回撤线」— 涨多了也要注意保护收益。",
    teachingPoint: "止盈和止损一样重要，真正的纪律是赚到了也能冷静思考下一步。",
    tone: "positive",
    riskDirection: "neutral",
  },
};

export function detectAdaptiveEvents(run: ScenarioRun): AdaptiveEvent[] {
  const detectors: Array<[BehaviorSignalId, () => DetectionResult]> = [
    ["overtrading", () => detectOvertrading(run)],
    ["revenge_trading", () => detectRevengeTrading(run)],
    ["never_diversified", () => detectNeverDiversified(run)],
    ["bond_avoidance", () => detectBondAvoidance(run)],
    ["cash_hoarding", () => detectCashHoarding(run)],
    ["herd_following", () => detectHerdFollowing(run)],
    ["loss_anchoring", () => detectLossAnchoring(run)],
    ["streak_positive", () => detectPositiveStreak(run)],
  ];

  const results: AdaptiveEvent[] = [];

  for (const [id, detect] of detectors) {
    const result = detect();
    if (result.triggered && result.confidence !== "low") {
      results.push({ ...EVENT_CATALOG[id], confidence: result.confidence });
    }
  }

  // CLT constraint: max 1 warning + 1 info/positive per round
  const warnings = results.filter((e) => e.tone === "warning");
  const others = results.filter((e) => e.tone !== "warning");

  const topWarning = warnings.sort((a, b) =>
    a.confidence === "high" ? -1 : b.confidence === "high" ? 1 : 0,
  )[0];
  const topOther = others.sort((a, b) =>
    a.confidence === "high" ? -1 : b.confidence === "high" ? 1 : 0,
  )[0];

  return [topWarning, topOther].filter((e): e is AdaptiveEvent => Boolean(e));
}
