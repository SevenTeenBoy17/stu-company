import { marketAssets } from "@/lib/market-data";
import { evaluateRun, getRoundQuotesForRun } from "@/lib/simulation";
import type { ScenarioRun } from "@/lib/types";
import { clamp, createId } from "@/lib/utils";

export type AutoInvestStrategy = "steady" | "buyDip" | "momentum";

export type AutoInvestInput = {
  assetId: string;
  amountPerRound: number;
  durationRounds: number;
  strategy: AutoInvestStrategy;
};

export type AutoInvestPlanStatus = "active" | "cancelled" | "completed";

export type AutoInvestPlan = AutoInvestInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
  createdRound: number;
  startRound: number;
  endRound: number;
  status: AutoInvestPlanStatus;
  executedRounds: number[];
  skippedRounds: number[];
  totalInvested: number;
  totalUnits: number;
  averageCost: number;
};

export type AutoInvestPayload = {
  generatedAt: string;
  activePlan?: AutoInvestPlan;
  options: Array<{
    assetId: string;
    symbol: string;
    name: string;
    category: string;
    risk: string;
    currentPrice: number;
    dayChange: number;
    holdingQuantity: number;
    holdingAverageCost?: number;
    description: string;
  }>;
  selected: {
    assetId: string;
    symbol: string;
    name: string;
    strategy: AutoInvestStrategy;
    strategyLabel: string;
    amountPerRound: number;
    durationRounds: number;
    startRound: number;
    endRound: number;
  };
  summary: {
    totalBudget: number;
    executedRounds: number;
    skippedRounds: number;
    totalInvested: number;
    totalUnits: number;
    averageCost: number;
    terminalPrice: number;
    terminalValue: number;
    simulatedReturn: number;
    simulatedReturnRate: number;
    cashAfterPlan: number;
    disciplineScore: number;
    cashSafetyScore: number;
    stageLabel: string;
  };
  schedule: Array<{
    round: number;
    price: number;
    budget: number;
    quantity: number;
    invested: number;
    totalUnits: number;
    averageCost: number;
    cashAfter: number;
    status: "executed" | "skipped";
    note: string;
  }>;
  comparison: {
    lumpSumInvested: number;
    lumpSumUnits: number;
    lumpSumAverageCost: number;
    lumpSumTerminalValue: number;
    lumpSumReturn: number;
    holdingCashValue: number;
    autoInvestEdge: number;
  };
  coach: {
    title: string;
    summary: string;
    concepts: string[];
    nextSteps: string[];
  };
  badges: Array<{
    label: string;
    value: string;
    tone: "brand" | "info" | "warning" | "danger";
  }>;
};

type AutoInvestPlanMeta = {
  kind: "auto_invest_plan";
  plan: Omit<AutoInvestPlan, "status" | "executedRounds" | "skippedRounds" | "totalInvested" | "totalUnits" | "averageCost">;
};

type AutoInvestExecutionMeta = {
  kind: "auto_invest_execution";
  planId: string;
  status: "executed" | "skipped";
  assetId: string;
  price: number;
  quantity: number;
  invested: number;
  budget: number;
};

type AutoInvestCancelMeta = {
  kind: "auto_invest_cancel";
  planId: string;
};

const strategyLabels: Record<AutoInvestStrategy, string> = {
  steady: "固定节奏",
  buyDip: "回撤加码",
  momentum: "趋势跟随",
};

const strategyNotes: Record<AutoInvestStrategy, string> = {
  steady: "每回合投入固定金额，把注意力从择时转向纪律，适合入门训练。",
  buyDip: "价格回撤时略微加码、上涨过快时放慢，训练逆向思考但不盲目抄底。",
  momentum: "趋势向上时小幅加速、走弱时降低投入，训练观察趋势但不满仓冲动。",
};

function normalizeInput(run: ScenarioRun, input?: Partial<AutoInvestInput>): AutoInvestInput {
  const fallbackAsset =
    input?.assetId && marketAssets.some((asset) => asset.id === input.assetId)
      ? input.assetId
      : run.holdings[0]?.assetId ?? "asset-etf";
  const maxAmount = Math.max(500, run.cash);
  const amountPerRound = Math.round(clamp(Number(input?.amountPerRound ?? 3000), 500, maxAmount));
  const remainingRounds = Math.max(1, run.totalRounds - run.currentRound + 1);
  const durationRounds = Math.round(
    clamp(Number(input?.durationRounds ?? Math.min(6, remainingRounds)), 1, remainingRounds),
  );
  const strategy = ["steady", "buyDip", "momentum"].includes(String(input?.strategy))
    ? (input?.strategy as AutoInvestStrategy)
    : "steady";

  return { assetId: fallbackAsset, amountPerRound, durationRounds, strategy };
}

function budgetForStrategy(
  strategy: AutoInvestStrategy,
  baseAmount: number,
  price: number,
  previousPrice: number,
) {
  if (strategy === "steady") return baseAmount;
  const change = previousPrice > 0 ? (price - previousPrice) / previousPrice : 0;

  if (strategy === "buyDip") {
    if (change <= -0.035) return Math.round(baseAmount * 1.28);
    if (change >= 0.045) return Math.round(baseAmount * 0.72);
    return baseAmount;
  }

  if (change >= 0.03) return Math.round(baseAmount * 1.18);
  if (change <= -0.035) return Math.round(baseAmount * 0.76);
  return baseAmount;
}

function explainRound(
  status: "executed" | "skipped",
  strategy: AutoInvestStrategy,
  price: number,
  previousPrice: number,
) {
  if (status === "skipped") {
    return "现金不足或预算买不到一份，本回合跳过，先保护安全垫。";
  }

  const change = previousPrice > 0 ? ((price - previousPrice) / previousPrice) * 100 : 0;
  if (strategy === "steady") return "固定节奏执行，把注意力从猜涨跌转向守规则。";
  if (strategy === "buyDip") {
    return change < 0 ? "价格回撤，本轮按规则略微加码。" : "价格偏强，本轮保持克制。";
  }
  return change > 0 ? "趋势仍在，本轮按规则小幅加速。" : "趋势走弱，本轮降低冲动投入。";
}

function buildOptions(run: ScenarioRun) {
  const quotes = getRoundQuotesForRun(run, run.currentRound);
  return marketAssets.map((asset) => {
    const quote = quotes.find((item) => item.id === asset.id);
    const holding = run.holdings.find((item) => item.assetId === asset.id);
    return {
      assetId: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      category: asset.category,
      risk: asset.risk,
      currentPrice: quote?.currentPrice ?? asset.basePrice,
      dayChange: quote?.dayChange ?? 0,
      holdingQuantity: holding?.quantity ?? 0,
      holdingAverageCost: holding?.averageCost,
      description: asset.description,
    };
  });
}

function metaKind(meta: Record<string, unknown> | undefined) {
  return typeof meta?.kind === "string" ? meta.kind : "";
}

function isPlanMeta(meta: Record<string, unknown> | undefined): meta is AutoInvestPlanMeta {
  const plan = meta?.plan as Partial<AutoInvestPlan> | undefined;
  return (
    metaKind(meta) === "auto_invest_plan" &&
    typeof plan?.id === "string" &&
    typeof plan.assetId === "string" &&
    typeof plan.amountPerRound === "number" &&
    typeof plan.durationRounds === "number" &&
    typeof plan.startRound === "number" &&
    typeof plan.endRound === "number"
  );
}

function isExecutionMeta(meta: Record<string, unknown> | undefined): meta is AutoInvestExecutionMeta {
  return (
    metaKind(meta) === "auto_invest_execution" &&
    typeof meta?.planId === "string" &&
    (meta.status === "executed" || meta.status === "skipped")
  );
}

function isCancelMeta(meta: Record<string, unknown> | undefined): meta is AutoInvestCancelMeta {
  return metaKind(meta) === "auto_invest_cancel" && typeof meta?.planId === "string";
}

function scheduledRounds(plan: Pick<AutoInvestPlan, "startRound" | "endRound">) {
  const rounds: number[] = [];
  for (let round = plan.startRound; round <= plan.endRound; round += 1) {
    rounds.push(round);
  }
  return rounds;
}

function appendAutoInvestLog(
  run: ScenarioRun,
  entry: {
    round: number;
    label: string;
    amount: number;
    meta: AutoInvestPlanMeta | AutoInvestExecutionMeta | AutoInvestCancelMeta;
    now?: Date;
  },
) {
  run.actionLog.unshift({
    id: createId("log"),
    round: entry.round,
    type: "auto_invest",
    label: entry.label,
    amount: entry.amount,
    timestamp: (entry.now ?? new Date()).toISOString(),
    meta: entry.meta,
  });
}

function upsertAutoInvestHolding(run: ScenarioRun, assetId: string, quantityDelta: number, price: number) {
  const current = run.holdings.find((holding) => holding.assetId === assetId);
  if (!current && quantityDelta > 0) {
    run.holdings.push({ assetId, quantity: quantityDelta, averageCost: price });
    return;
  }
  if (!current || quantityDelta <= 0) return;

  const nextQuantity = current.quantity + quantityDelta;
  current.averageCost = Math.round(
    (current.averageCost * current.quantity + price * quantityDelta) / nextQuantity,
  );
  current.quantity = nextQuantity;
}

function refreshAutoInvestSnapshot(run: ScenarioRun) {
  const evaluated = evaluateRun(run, run.currentRound);
  const snapshot = {
    round: run.currentRound,
    netWorth: evaluated.netWorth,
    cash: run.cash,
    savings: run.savings,
    debt: run.debt,
    riskScore: evaluated.riskScore,
    disciplineScore: evaluated.disciplineScore,
    reflection: evaluated.reflection,
  };
  const existing = run.snapshots.find((item) => item.round === run.currentRound);
  if (existing) {
    Object.assign(existing, snapshot);
  } else {
    run.snapshots.push(snapshot);
  }
  run.lastInsight = evaluated.reflection;
  run.netWorth = evaluated.netWorth;
}

export function getLatestAutoInvestPlan(run: ScenarioRun): AutoInvestPlan | null {
  const planEntry = run.actionLog.find((entry) => entry.type === "auto_invest" && isPlanMeta(entry.meta));
  if (!planEntry || !isPlanMeta(planEntry.meta)) return null;

  const basePlan = planEntry.meta.plan;
  const executions = run.actionLog
    .filter((entry) => entry.type === "auto_invest" && isExecutionMeta(entry.meta) && entry.meta.planId === basePlan.id)
    .map((entry) => {
      const meta = entry.meta as AutoInvestExecutionMeta;
      return {
        round: entry.round,
        amount: Math.abs(entry.amount),
        quantity: meta.quantity,
        status: meta.status,
      };
    });
  const cancelled = run.actionLog.some(
    (entry) => entry.type === "auto_invest" && isCancelMeta(entry.meta) && entry.meta.planId === basePlan.id,
  );
  const executedRounds = executions.filter((item) => item.status === "executed").map((item) => item.round);
  const skippedRounds = executions.filter((item) => item.status === "skipped").map((item) => item.round);
  const processedRounds = new Set([...executedRounds, ...skippedRounds]);
  const completed =
    scheduledRounds(basePlan).every((round) => processedRounds.has(round)) || run.currentRound > basePlan.endRound;
  const totalInvested = executions.reduce((sum, item) => sum + item.amount, 0);
  const totalUnits = executions.reduce((sum, item) => sum + item.quantity, 0);
  const latestRelated = run.actionLog.find((entry) => {
    if (entry.type !== "auto_invest") return false;
    if (isPlanMeta(entry.meta)) return entry.meta.plan.id === basePlan.id;
    if (isExecutionMeta(entry.meta)) return entry.meta.planId === basePlan.id;
    if (isCancelMeta(entry.meta)) return entry.meta.planId === basePlan.id;
    return false;
  });

  return {
    ...basePlan,
    status: cancelled ? "cancelled" : completed ? "completed" : "active",
    executedRounds,
    skippedRounds,
    totalInvested,
    totalUnits,
    averageCost: totalUnits > 0 ? Math.round(totalInvested / totalUnits) : 0,
    updatedAt: latestRelated?.timestamp ?? basePlan.updatedAt,
  };
}

export function getActiveAutoInvestPlan(run: ScenarioRun): AutoInvestPlan | null {
  const plan = getLatestAutoInvestPlan(run);
  return plan?.status === "active" ? plan : null;
}

export function createAutoInvestPlan(
  run: ScenarioRun,
  input: Partial<AutoInvestInput>,
  now = new Date(),
): ScenarioRun {
  if (run.currentRound >= run.totalRounds) {
    throw new Error("当前赛季已经结束，无法创建新的定投计划。");
  }
  if (getActiveAutoInvestPlan(run)) {
    throw new Error("已有一个正在执行的定投计划，请先取消后再创建新计划。");
  }

  const nextRun = structuredClone(run);
  const normalized = normalizeInput(nextRun, input);
  const remainingRounds = Math.max(1, nextRun.totalRounds - nextRun.currentRound);
  const durationRounds = Math.min(normalized.durationRounds, remainingRounds);
  const startRound = nextRun.currentRound + 1;
  const endRound = Math.min(nextRun.totalRounds, startRound + durationRounds - 1);
  const asset = marketAssets.find((item) => item.id === normalized.assetId) ?? marketAssets[0];
  const createdAt = now.toISOString();
  const plan: AutoInvestPlanMeta["plan"] = {
    id: createId("aip"),
    assetId: asset.id,
    amountPerRound: normalized.amountPerRound,
    durationRounds,
    strategy: normalized.strategy,
    createdAt,
    updatedAt: createdAt,
    createdRound: nextRun.currentRound,
    startRound,
    endRound,
  };

  appendAutoInvestLog(nextRun, {
    round: nextRun.currentRound,
    label: `创建定投计划：${asset.name}，每回合 ${normalized.amountPerRound}，第 ${startRound}-${endRound} 回合执行`,
    amount: 0,
    now,
    meta: { kind: "auto_invest_plan", plan },
  });
  return nextRun;
}

export function cancelAutoInvestPlan(run: ScenarioRun, now = new Date()): ScenarioRun {
  const plan = getActiveAutoInvestPlan(run);
  if (!plan) {
    throw new Error("当前没有正在执行的定投计划。");
  }
  const nextRun = structuredClone(run);
  appendAutoInvestLog(nextRun, {
    round: nextRun.currentRound,
    label: `取消定投计划：已执行 ${plan.executedRounds.length} 回合，保留已有持仓并停止后续自动买入`,
    amount: 0,
    now,
    meta: { kind: "auto_invest_cancel", planId: plan.id },
  });
  return nextRun;
}

export function executeAutoInvestForRound(run: ScenarioRun, now = new Date()): ScenarioRun {
  const plan = getActiveAutoInvestPlan(run);
  if (!plan) return run;
  if (run.currentRound < plan.startRound || run.currentRound > plan.endRound) return run;
  if ([...plan.executedRounds, ...plan.skippedRounds].includes(run.currentRound)) return run;

  const nextRun = structuredClone(run);
  const asset = marketAssets.find((item) => item.id === plan.assetId);
  if (!asset) return nextRun;

  const quote = getRoundQuotesForRun(nextRun, nextRun.currentRound).find((item) => item.id === asset.id);
  const previousQuote = getRoundQuotesForRun(nextRun, Math.max(1, nextRun.currentRound - 1)).find(
    (item) => item.id === asset.id,
  );
  const price = quote?.currentPrice ?? asset.basePrice;
  const previousPrice = previousQuote?.currentPrice ?? asset.basePrice;
  const budget = Math.min(nextRun.cash, budgetForStrategy(plan.strategy, plan.amountPerRound, price, previousPrice));
  const quantity = Math.max(0, Math.floor(budget / Math.max(price, 1)));
  const invested = quantity * price;
  const status: "executed" | "skipped" = invested > 0 ? "executed" : "skipped";

  if (status === "executed") {
    nextRun.cash -= invested;
    upsertAutoInvestHolding(nextRun, asset.id, quantity, price);
  }

  appendAutoInvestLog(nextRun, {
    round: nextRun.currentRound,
    label:
      status === "executed"
        ? `定投机器人执行：买入 ${asset.name} × ${quantity}，价格 ${price}`
        : `定投机器人跳过：现金不足以按计划买入 ${asset.name}`,
    amount: -invested,
    now,
    meta: {
      kind: "auto_invest_execution",
      planId: plan.id,
      status,
      assetId: asset.id,
      price,
      quantity,
      invested,
      budget,
    },
  });
  refreshAutoInvestSnapshot(nextRun);
  return nextRun;
}

export function buildAutoInvestPayload(
  run: ScenarioRun,
  input?: Partial<AutoInvestInput>,
  now = new Date(),
): AutoInvestPayload {
  const activePlan = getLatestAutoInvestPlan(run) ?? undefined;
  const plan = normalizeInput(run, input ?? activePlan);
  const options = buildOptions(run);
  const asset = marketAssets.find((item) => item.id === plan.assetId) ?? marketAssets[0];
  const startRound = run.currentRound;
  const endRound = Math.min(run.totalRounds, startRound + plan.durationRounds - 1);
  const schedule: AutoInvestPayload["schedule"] = [];

  let remainingCash = run.cash;
  let totalInvested = 0;
  let totalUnits = 0;
  let averageCost = 0;
  let previousPrice =
    getRoundQuotesForRun(run, Math.max(1, startRound - 1)).find((quote) => quote.id === asset.id)?.currentPrice ??
    asset.basePrice;

  for (let round = startRound; round <= endRound; round += 1) {
    const quote = getRoundQuotesForRun(run, round).find((item) => item.id === asset.id);
    const price = quote?.currentPrice ?? asset.basePrice;
    const budget = Math.min(remainingCash, budgetForStrategy(plan.strategy, plan.amountPerRound, price, previousPrice));
    const quantity = Math.max(0, Math.floor(budget / Math.max(price, 1)));
    const invested = quantity * price;
    const status: "executed" | "skipped" = invested > 0 ? "executed" : "skipped";

    if (status === "executed") {
      remainingCash -= invested;
      averageCost =
        totalUnits + quantity > 0
          ? Math.round((averageCost * totalUnits + invested) / (totalUnits + quantity))
          : price;
      totalUnits += quantity;
      totalInvested += invested;
    }

    schedule.push({
      round,
      price,
      budget,
      quantity,
      invested,
      totalUnits,
      averageCost,
      cashAfter: remainingCash,
      status,
      note: explainRound(status, plan.strategy, price, previousPrice),
    });

    previousPrice = price;
  }

  const terminalPrice =
    getRoundQuotesForRun(run, endRound).find((quote) => quote.id === asset.id)?.currentPrice ?? asset.basePrice;
  const terminalValue = Math.round(totalUnits * terminalPrice);
  const simulatedReturn = terminalValue - totalInvested;
  const simulatedReturnRate = totalInvested > 0 ? (simulatedReturn / totalInvested) * 100 : 0;
  const totalBudget = plan.amountPerRound * plan.durationRounds;
  const executedRounds = schedule.filter((item) => item.status === "executed").length;
  const skippedRounds = schedule.length - executedRounds;
  const startingPrice =
    getRoundQuotesForRun(run, startRound).find((quote) => quote.id === asset.id)?.currentPrice ?? asset.basePrice;
  const lumpSumBudget = Math.min(run.cash, totalBudget);
  const lumpSumUnits = Math.floor(lumpSumBudget / Math.max(startingPrice, 1));
  const lumpSumInvested = lumpSumUnits * startingPrice;
  const lumpSumTerminalValue = lumpSumUnits * terminalPrice;
  const lumpSumReturn = lumpSumTerminalValue - lumpSumInvested;
  const autoInvestEdge = terminalValue - lumpSumTerminalValue + (lumpSumBudget - totalInvested);
  const cashSafetyScore = Math.round(
    clamp((remainingCash / Math.max(run.cash, 1)) * 70 + 18 - skippedRounds * 4, 12, 96),
  );
  const disciplineScore = Math.round(clamp(54 + executedRounds * 7 + plan.durationRounds * 3 - skippedRounds * 8, 30, 98));
  const evaluation = evaluateRun(run);
  const stageLabel =
    skippedRounds > 0
      ? "先补现金垫"
      : disciplineScore >= 84
        ? "纪律成型"
        : plan.strategy === "steady"
          ? "节奏训练"
          : "规则试验";

  const nextSteps = [
    `把每回合金额控制在当前现金的 ${Math.round((plan.amountPerRound / Math.max(run.cash, 1)) * 100)}% 左右，避免一开始就耗尽选择权。`,
    simulatedReturn >= 0
      ? "这次模拟说明长期纪律有机会平滑波动，但仍要观察事件变化，而不是把定投当成稳赚。"
      : "这次模拟出现浮亏，正适合复盘：亏损来自买贵了、周期太短，还是标的本身波动太强？",
    evaluation.riskScore >= 68
      ? "你的组合风险分偏高，定投前先确认现金垫和债务压力，否则定投会变成新的流动性负担。"
      : "当前风险分允许做小额定投训练，可以把重点放在记录理由和坚持规则。",
  ];

  return {
    generatedAt: now.toISOString(),
    activePlan,
    options,
    selected: {
      assetId: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      strategy: plan.strategy,
      strategyLabel: strategyLabels[plan.strategy],
      amountPerRound: plan.amountPerRound,
      durationRounds: plan.durationRounds,
      startRound,
      endRound,
    },
    summary: {
      totalBudget,
      executedRounds,
      skippedRounds,
      totalInvested,
      totalUnits,
      averageCost,
      terminalPrice,
      terminalValue,
      simulatedReturn,
      simulatedReturnRate,
      cashAfterPlan: remainingCash,
      disciplineScore,
      cashSafetyScore,
      stageLabel,
    },
    schedule,
    comparison: {
      lumpSumInvested,
      lumpSumUnits,
      lumpSumAverageCost: startingPrice,
      lumpSumTerminalValue,
      lumpSumReturn,
      holdingCashValue: lumpSumBudget,
      autoInvestEdge,
    },
    coach: {
      title: `${strategyLabels[plan.strategy]}：用规则替代冲动`,
      summary: strategyNotes[plan.strategy],
      concepts: ["平均成本法", "现金安全垫", "机会成本", "纪律型投资"],
      nextSteps,
    },
    badges: [
      { label: "计划阶段", value: stageLabel, tone: "brand" },
      { label: "执行回合", value: `${executedRounds}/${schedule.length}`, tone: skippedRounds > 0 ? "warning" : "info" },
      { label: "纪律分", value: String(disciplineScore), tone: disciplineScore >= 80 ? "brand" : "warning" },
      { label: "安全垫", value: String(cashSafetyScore), tone: cashSafetyScore >= 70 ? "info" : "danger" },
    ],
  };
}
