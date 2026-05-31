import {
  buildEventTimeline,
  eventIdForRound,
  eventMarketEffect,
  makeRng,
  resolveEventChoice,
} from "@/lib/event-engine";
import { eventCards, marketAssets, marketRounds } from "@/lib/market-data";
import { currentSeasonSeed } from "@/lib/season";
import type {
  ActionLog,
  EventCard,
  LeaderboardEntry,
  MarketAsset,
  MarketRound,
  ScenarioRun,
  SimulationState,
  UserRecord,
} from "@/lib/types";
import { clamp, createId } from "@/lib/utils";

type SimulationActionInput =
  | {
      type: "trade";
      assetId: string;
      side: "buy" | "sell";
      quantity: number;
      orderMode: "market" | "limit";
    }
  | {
      type: "bank";
      action: "deposit" | "withdraw" | "loan" | "repay";
      amount: number;
    }
  | {
      type: "property";
      action: "buy" | "sell";
    }
  | {
      type: "venture";
      action: "invest";
      amount: number;
    }
  | {
      type: "venture";
      action: "exit";
      amount?: number;
    };

const STARTING_CASH = 120_000;
const PROPERTY_UNIT_PRICE = 24_000;

function getRound(round: number): MarketRound {
  return marketRounds[Math.max(0, Math.min(marketRounds.length - 1, round - 1))];
}

export function getEventCard(eventId: string): EventCard {
  return eventCards.find((event) => event.id === eventId) ?? eventCards[0];
}

/**
 * Event multiplier a run's timeline applies to an asset category in a given round.
 * Returns 1 (neutral) for legacy runs with no `eventTimeline`, preserving the
 * original deterministic market for backward compatibility.
 */
function runEventMultiplier(
  run: ScenarioRun | undefined,
  roundNumber: number,
  category: MarketAsset["category"],
): number {
  if (!run?.eventTimeline) return 1;
  const fallbackEventId = getRound(roundNumber).eventId;
  const eventId = eventIdForRound(run.eventTimeline, roundNumber, fallbackEventId);
  return eventMarketEffect(getEventCard(eventId), category);
}

function quoteAsset(asset: MarketAsset, roundNumber: number, run?: ScenarioRun) {
  const round = getRound(roundNumber);
  const previousRoundNumber = Math.max(1, roundNumber - 1);
  const previousRound = getRound(previousRoundNumber);
  const eventMultiplier = runEventMultiplier(run, roundNumber, asset.category);
  const previousEventMultiplier = runEventMultiplier(run, previousRoundNumber, asset.category);
  const currentPrice = Math.round(
    asset.basePrice * round.assetMultipliers[asset.category] * eventMultiplier,
  );
  const previousPrice = Math.round(
    asset.basePrice * previousRound.assetMultipliers[asset.category] * previousEventMultiplier,
  );
  const dayChange = ((currentPrice - previousPrice) / previousPrice) * 100;

  return {
    ...asset,
    currentPrice,
    dayChange,
  };
}

export function getAssetQuote(asset: MarketAsset, roundNumber: number) {
  return quoteAsset(asset, roundNumber);
}

export function getRoundQuotes(roundNumber: number) {
  return marketAssets.map((asset) => getAssetQuote(asset, roundNumber));
}

/** Run-aware quotes: identical to {@link getRoundQuotes} but applies the run's seeded event effects. */
export function getRoundQuotesForRun(run: ScenarioRun, roundNumber: number) {
  return marketAssets.map((asset) => quoteAsset(asset, roundNumber, run));
}

function getHoldingValue(run: ScenarioRun, roundNumber: number) {
  const quotes = getRoundQuotesForRun(run, roundNumber);

  return run.holdings.reduce((total, holding) => {
    const quote = quotes.find((item) => item.id === holding.assetId);
    return total + (quote ? quote.currentPrice * holding.quantity : 0);
  }, 0);
}

function getPropertyValue(run: ScenarioRun, roundNumber: number) {
  if (!run.propertyUnits) return 0;
  const cycleBoost = 1 + (roundNumber - 1) * 0.024;
  return Math.round(run.propertyUnits * PROPERTY_UNIT_PRICE * cycleBoost);
}

function getVentureValue(run: ScenarioRun, roundNumber: number) {
  if (!run.ventureStake) return 0;
  const trajectory = [1, 1.02, 0.98, 1.08, 1.12, 1.18, 1.1, 1.15, 1.24, 1.28, 1.32, 1.36];
  return Math.round(run.ventureStake * trajectory[Math.max(0, roundNumber - 1)]);
}

function createReflection(run: ScenarioRun, roundNumber: number, netWorth: number, riskScore: number) {
  const round = getRound(roundNumber);
  const tradesThisRound = run.actionLog.filter((entry) => entry.round === roundNumber && entry.type === "trade").length;

  if (riskScore > 72) {
    return `第 ${roundNumber} 回合的 ${round.theme} 环境下，你的仓位偏激进。先把现金流和集中度拉回到更舒适的位置，再追求排名。`;
  }

  if (tradesThisRound >= 3) {
    return `你在 ${round.theme} 阶段出手频率较高，记得把每次操作和最初假设对齐，避免被短期波动牵着走。`;
  }

  if (netWorth > STARTING_CASH * 1.08) {
    return `你的节奏感不错，尤其是在 ${round.headline} 的背景下仍保持了组合稳定性。接下来重点关注回撤控制。`;
  }

  return `${round.summary} 当前更重要的是先明确策略主线，再让资产配置为你的判断服务。`;
}

function computeDisciplineScore(run: ScenarioRun, roundNumber: number) {
  const trades = run.actionLog.filter((entry) => entry.type === "trade").length;
  const leveragePenalty = Math.round(run.debt / 10_000) * 2;
  const overtradePenalty = Math.max(0, trades - roundNumber) * 2;
  const cashBufferBonus = run.cash > 25_000 ? 6 : 0;
  return clamp(76 - leveragePenalty - overtradePenalty + cashBufferBonus, 42, 96);
}

export function evaluateRun(run: ScenarioRun, roundNumber = run.currentRound) {
  const holdingsValue = getHoldingValue(run, roundNumber);
  const propertyValue = getPropertyValue(run, roundNumber);
  const ventureValue = getVentureValue(run, roundNumber);
  const totalAssets = run.cash + run.savings + holdingsValue + propertyValue + ventureValue;
  const netWorth = totalAssets - run.debt;
  const quotes = getRoundQuotesForRun(run, roundNumber);
  const concentration = run.holdings.length
    ? Math.max(
        ...run.holdings.map((holding) => {
          const quote = quotes.find((asset) => asset.id === holding.assetId);
          return quote ? quote.currentPrice * holding.quantity : 0;
        }),
      ) / Math.max(holdingsValue, 1)
    : 0;
  const riskScore = clamp(
    38 +
      concentration * 22 +
      (run.debt / Math.max(netWorth, 1)) * 28 +
      (holdingsValue / Math.max(totalAssets, 1)) * 18 +
      (run.ventureStake / Math.max(totalAssets, 1)) * 10,
    24,
    95,
  );
  const disciplineScore = computeDisciplineScore(run, roundNumber);

  return {
    netWorth: Math.round(netWorth),
    holdingsValue,
    propertyValue,
    ventureValue,
    riskScore: Math.round(riskScore),
    disciplineScore,
    reflection: createReflection(run, roundNumber, netWorth, riskScore),
  };
}

function appendAction(run: ScenarioRun, entry: Omit<ActionLog, "id" | "timestamp">) {
  run.actionLog.unshift({
    ...entry,
    id: createId("log"),
    timestamp: new Date().toISOString(),
  });
}

function upsertHolding(run: ScenarioRun, assetId: string, quantityDelta: number, price: number) {
  const current = run.holdings.find((holding) => holding.assetId === assetId);

  if (!current && quantityDelta > 0) {
    run.holdings.push({
      assetId,
      quantity: quantityDelta,
      averageCost: price,
    });
    return;
  }

  if (!current) return;

  if (quantityDelta > 0) {
    const nextQuantity = current.quantity + quantityDelta;
    current.averageCost = Math.round(
      (current.averageCost * current.quantity + price * quantityDelta) / nextQuantity,
    );
    current.quantity = nextQuantity;
    return;
  }

  current.quantity += quantityDelta;
  if (current.quantity <= 0) {
    run.holdings = run.holdings.filter((holding) => holding.assetId !== assetId);
  }
}

function commitSnapshot(run: ScenarioRun) {
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
}

export function createInitialRun(
  userId: string,
  classroomId: string,
  scenarioName = "春季校内试点",
  // Default to the current weekly season seed so all new runs this week share the
  // same market (fair global leaderboard). Pass an explicit seed for off-season
  // practice (e.g. Premium replay) or deterministic tests.
  seed: number = currentSeasonSeed(),
) {
  const totalRounds = 12;
  const eventTimeline = buildEventTimeline(seed, totalRounds);
  const firstEventId = eventIdForRound(eventTimeline, 1, getRound(1).eventId);

  const run: ScenarioRun = {
    id: createId("run"),
    userId,
    classroomId,
    scenarioName,
    currentRound: 1,
    totalRounds,
    cash: STARTING_CASH,
    savings: 0,
    debt: 0,
    propertyUnits: 0,
    propertyBasis: 0,
    ventureStake: 0,
    ventureBasis: 0,
    holdings: [],
    eventHistory: [firstEventId],
    actionLog: [],
    snapshots: [],
    lastInsight: "欢迎来到 Mr.Brown 经济沙盘，先建立有呼吸感的组合，再逐步扩大胜率。",
    seed,
    eventTimeline,
  };

  commitSnapshot(run);
  return run;
}

export function applySimulationAction(run: ScenarioRun, action: SimulationActionInput) {
  const nextRun = structuredClone(run);
  const roundQuotes = getRoundQuotesForRun(nextRun, nextRun.currentRound);

  if (action.type === "trade") {
    const quote = roundQuotes.find((asset) => asset.id === action.assetId);
    if (!quote) {
      throw new Error("未找到对应资产。");
    }
    const quantity = Math.max(1, Math.floor(action.quantity));
    const notional = quote.currentPrice * quantity;

    if (action.side === "buy") {
      if (nextRun.cash < notional) {
        throw new Error("可用现金不足，请先降低数量或补充流动性。");
      }
      nextRun.cash -= notional;
      upsertHolding(nextRun, action.assetId, quantity, quote.currentPrice);
      appendAction(nextRun, {
        round: nextRun.currentRound,
        type: "trade",
        label: `买入 ${quote.name} × ${quantity}（${action.orderMode === "market" ? "市价" : "限价"}）`,
        amount: -notional,
      });
    } else {
      const holding = nextRun.holdings.find((item) => item.assetId === action.assetId);
      if (!holding || holding.quantity < quantity) {
        throw new Error("持仓数量不足，无法完成卖出。");
      }
      nextRun.cash += notional;
      upsertHolding(nextRun, action.assetId, -quantity, quote.currentPrice);
      appendAction(nextRun, {
        round: nextRun.currentRound,
        type: "trade",
        label: `卖出 ${quote.name} × ${quantity}`,
        amount: notional,
      });
    }
  }

  if (action.type === "bank") {
    const amount = Math.max(500, Math.round(action.amount));

    if (action.action === "deposit") {
      if (nextRun.cash < amount) throw new Error("现金不足，无法转入储蓄。");
      nextRun.cash -= amount;
      nextRun.savings += amount;
      appendAction(nextRun, {
        round: nextRun.currentRound,
        type: "bank",
        label: `转入稳健储蓄 ${amount}`,
        amount: -amount,
      });
    }

    if (action.action === "withdraw") {
      if (nextRun.savings < amount) throw new Error("储蓄余额不足。");
      nextRun.savings -= amount;
      nextRun.cash += amount;
      appendAction(nextRun, {
        round: nextRun.currentRound,
        type: "bank",
        label: `从储蓄取出 ${amount}`,
        amount,
      });
    }

    if (action.action === "loan") {
      nextRun.cash += amount;
      nextRun.debt += amount;
      appendAction(nextRun, {
        round: nextRun.currentRound,
        type: "bank",
        label: `新增教学贷款 ${amount}`,
        amount,
      });
    }

    if (action.action === "repay") {
      const repayAmount = Math.min(amount, nextRun.debt);
      if (nextRun.cash < repayAmount) throw new Error("现金不足，无法还款。");
      nextRun.cash -= repayAmount;
      nextRun.debt -= repayAmount;
      appendAction(nextRun, {
        round: nextRun.currentRound,
        type: "bank",
        label: `偿还贷款 ${repayAmount}`,
        amount: -repayAmount,
      });
    }
  }

  if (action.type === "property") {
    if (action.action === "buy") {
      if (nextRun.cash < PROPERTY_UNIT_PRICE) {
        throw new Error("现金不足，无法完成房产配置。");
      }
      nextRun.cash -= PROPERTY_UNIT_PRICE;
      nextRun.propertyUnits += 1;
      nextRun.propertyBasis += PROPERTY_UNIT_PRICE;
      appendAction(nextRun, {
        round: nextRun.currentRound,
        type: "property",
        label: "购入一套模拟房产",
        amount: -PROPERTY_UNIT_PRICE,
      });
    } else {
      if (!nextRun.propertyUnits) throw new Error("当前没有可出售的房产仓位。");
      const currentValue = Math.round(getPropertyValue(nextRun, nextRun.currentRound) / nextRun.propertyUnits);
      nextRun.cash += currentValue;
      nextRun.propertyUnits -= 1;
      nextRun.propertyBasis = Math.max(0, nextRun.propertyBasis - PROPERTY_UNIT_PRICE);
      appendAction(nextRun, {
        round: nextRun.currentRound,
        type: "property",
        label: "卖出一套模拟房产",
        amount: currentValue,
      });
    }
  }

  if (action.type === "venture") {
    if (action.action === "invest") {
      const amount = Math.max(2_000, Math.round(action.amount));
      if (nextRun.cash < amount) throw new Error("现金不足，无法投入创业项目。");
      nextRun.cash -= amount;
      nextRun.ventureStake += amount;
      nextRun.ventureBasis += amount;
      appendAction(nextRun, {
        round: nextRun.currentRound,
        type: "venture",
        label: `加码创业项目 ${amount}`,
        amount: -amount,
      });
    } else {
      if (!nextRun.ventureStake) throw new Error("当前没有创业项目可退出。");
      const amount = Math.max(2_000, Math.round(action.amount ?? nextRun.ventureStake));
      const currentValue = Math.min(getVentureValue(nextRun, nextRun.currentRound), amount);
      nextRun.cash += currentValue;
      nextRun.ventureStake = Math.max(0, nextRun.ventureStake - amount);
      appendAction(nextRun, {
        round: nextRun.currentRound,
        type: "venture",
        label: `部分退出创业项目 ${currentValue}`,
        amount: currentValue,
      });
    }
  }

  commitSnapshot(nextRun);
  return nextRun;
}

/** E3: the decision card (if any) the run is currently facing. */
export function getActiveDecisionCard(run: ScenarioRun): EventCard | null {
  const round = getRound(run.currentRound);
  const eventId = eventIdForRound(run.eventTimeline, run.currentRound, round.eventId);
  const event = getEventCard(eventId);
  if (!event.choices?.length) return null;
  const alreadyChose = run.actionLog.some(
    (entry) => entry.type === "event" && entry.round === run.currentRound,
  );
  return alreadyChose ? null : event;
}

/**
 * E3: apply a decision-card choice. The chosen outcome is resolved into a cash
 * consequence (seeded → reproducible) and logged. One decision per round.
 */
export function applyEventChoice(run: ScenarioRun, choiceId: string): ScenarioRun {
  const nextRun = structuredClone(run);
  const round = getRound(nextRun.currentRound);
  const eventId = eventIdForRound(nextRun.eventTimeline, nextRun.currentRound, round.eventId);
  const event = getEventCard(eventId);

  if (!event.choices?.length) {
    throw new Error("当前事件没有可做的选择。");
  }
  const alreadyChose = nextRun.actionLog.some(
    (entry) => entry.type === "event" && entry.round === nextRun.currentRound,
  );
  if (alreadyChose) {
    throw new Error("本回合的事件选择已经做过了。");
  }
  const choice = event.choices.find((item) => item.id === choiceId);
  if (!choice) {
    throw new Error("无效的事件选择。");
  }

  const netWorth = evaluateRun(nextRun, nextRun.currentRound).netWorth;
  const rng = makeRng((nextRun.seed ?? 1) + nextRun.currentRound * 1000);
  const { cashDelta } = resolveEventChoice(netWorth, choice.outcome, rng);

  const cashBefore = nextRun.cash;
  nextRun.cash = Math.max(0, nextRun.cash + cashDelta);
  // Log the REALIZED change (cash is floored at 0), so history/AI narratives
  // don't overstate a loss larger than the student's available cash.
  const realized = nextRun.cash - cashBefore;
  appendAction(nextRun, {
    round: nextRun.currentRound,
    type: "event",
    label: `事件决策：${choice.label} — ${choice.teachingPoint}`,
    amount: realized,
  });
  commitSnapshot(nextRun);
  return nextRun;
}

export function advanceSimulationRun(run: ScenarioRun) {
  const nextRun = structuredClone(run);

  if (nextRun.currentRound >= nextRun.totalRounds) {
    commitSnapshot(nextRun);
    return nextRun;
  }

  const currentRound = getRound(nextRun.currentRound);
  nextRun.savings = Math.round(nextRun.savings * (1.012 + currentRound.liquidityBoost / 100));
  nextRun.debt = Math.round(nextRun.debt * 1.018);
  nextRun.currentRound += 1;
  nextRun.eventHistory.unshift(
    eventIdForRound(nextRun.eventTimeline, nextRun.currentRound, getRound(nextRun.currentRound).eventId),
  );
  appendAction(nextRun, {
    round: nextRun.currentRound,
    type: "advance",
    label: `推进到第 ${nextRun.currentRound} 回合`,
    amount: 0,
  });
  commitSnapshot(nextRun);

  return nextRun;
}

export function buildLeaderboard(runs: ScenarioRun[], users: UserRecord[]): LeaderboardEntry[] {
  return runs
    .map((run) => {
      const user = users.find((item) => item.id === run.userId);
      const snapshot = run.snapshots.at(-1) ?? run.snapshots[0];
      return {
        userId: run.userId,
        classroomId: run.classroomId,
        name: user?.name ?? "匿名玩家",
        netWorth: snapshot?.netWorth ?? evaluateRun(run).netWorth,
        disciplineScore: snapshot?.disciplineScore ?? evaluateRun(run).disciplineScore,
        rank: 0,
      };
    })
    .sort((left, right) => right.netWorth - left.netWorth)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

/**
 * Premium "deep report": a deterministic investor-personality label derived from
 * the run's behaviour (risk, discipline, activity, concentration). Pure — no AI
 * call — so it is reproducible and gated to Premium via features.deepAiReport.
 */
export function deriveInvestorPersona(run: ScenarioRun): { label: string; summary: string } {
  const { riskScore, disciplineScore } = evaluateRun(run);
  const trades = run.actionLog.filter((entry) => entry.type === "trade").length;
  const holdings = run.holdings.length;

  if (riskScore >= 70) {
    return { label: "进取冒险家", summary: "你偏好高风险高回报，记得用分散和现金垫守住下行风险。" };
  }
  if (trades <= 2) {
    return { label: "谨慎观望者", summary: "你出手谨慎，适度尝试小仓位能更快积累判断经验。" };
  }
  if (holdings <= 1) {
    return { label: "集中押注者", summary: "你倾向集中持有，注意「鸡蛋别放一个篮子」的分散原则。" };
  }
  if (disciplineScore >= 70) {
    return { label: "稳健规划者", summary: "你纪律性强、回撤可控，继续保持复盘和止盈止损的习惯。" };
  }
  return { label: "均衡成长型", summary: "你的攻守较为平衡，可在不同市场环境里继续打磨节奏。" };
}

/**
 * P2 retention: the current and best run of consecutive net-worth gains across
 * snapshots. Drives a "🔥 连胜 N 回合" badge.
 */
export function computeStreak(run: ScenarioRun): { current: number; best: number } {
  const snapshots = [...run.snapshots].sort((a, b) => a.round - b.round);
  let current = 0;
  let best = 0;
  for (let i = 1; i < snapshots.length; i++) {
    if (snapshots[i].netWorth > snapshots[i - 1].netWorth) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return { current, best };
}

/** P2 growth: a copyable share card built from the student's investor persona. */
export function buildPersonaShareText(
  persona: { label: string; summary: string },
  run: ScenarioRun,
): string {
  const netWorth = run.snapshots.at(-1)?.netWorth ?? 0;
  const streak = computeStreak(run).current;
  return [
    `我在 Mr.Brown 经济沙盘的投资人格是「${persona.label}」！`,
    persona.summary,
    `第 ${run.currentRound} 回合 · 模拟净值 ￥${netWorth.toLocaleString()} · 连胜 ${streak} 回合`,
    "来挑战你的财商，看看你是哪种投资人格 👉",
  ].join("\n");
}

/**
 * P2 global weekly season leaderboard: rank only the runs that used this week's
 * season seed (a fair, like-for-like market) by net worth.
 */
export function buildSeasonLeaderboard(
  runs: ScenarioRun[],
  users: UserRecord[],
  now: Date = new Date(),
): LeaderboardEntry[] {
  const seed = currentSeasonSeed(now);
  return buildLeaderboard(
    runs.filter((run) => run.seed === seed),
    users,
  );
}

export function buildBehaviorSignals(run: ScenarioRun) {
  const trades = run.actionLog.filter((entry) => entry.type === "trade").length;
  const bankActions = run.actionLog.filter((entry) => entry.type === "bank").length;
  const ventureActions = run.actionLog.filter((entry) => entry.type === "venture").length;
  const latestSnapshot = run.snapshots.at(-1);

  return [
    {
      label: latestSnapshot && latestSnapshot.riskScore > 70 ? "仓位偏激进" : "风险控制稳定",
      tone: latestSnapshot && latestSnapshot.riskScore > 70 ? "warning" : "positive",
    },
    {
      label: trades > 8 ? "交易频率偏高" : "交易节奏克制",
      tone: trades > 8 ? "warning" : "positive",
    },
    {
      label: bankActions >= 2 ? "有现金管理意识" : "现金规划待加强",
      tone: bankActions >= 2 ? "positive" : "neutral",
    },
    {
      label: ventureActions >= 1 ? "愿意尝试经营视角" : "仍以投资者视角为主",
      tone: ventureActions >= 1 ? "positive" : "neutral",
    },
  ];
}

export function buildSimulationState(
  user: UserRecord,
  classroom: SimulationState["classroom"],
  run: ScenarioRun,
  runs: ScenarioRun[],
  users: UserRecord[],
): SimulationState {
  const round = getRound(run.currentRound);
  const eventId = eventIdForRound(run.eventTimeline, run.currentRound, round.eventId);
  return {
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      title: user.title,
    },
    classroom,
    run,
    market: {
      round,
      assets: getRoundQuotesForRun(run, run.currentRound),
      event: getEventCard(eventId),
    },
    leaderboard: buildLeaderboard(runs, users).filter((entry) => entry.classroomId === classroom.id),
  };
}

export function buildGrowthReport(run: ScenarioRun, studentUserId: string, parentUserId: string) {
  const lastSnapshot = run.snapshots.at(-1) ?? run.snapshots[0];

  return {
    studentUserId,
    parentUserId,
    netWorthTrend: run.snapshots.map((item) => item.netWorth),
    competencies: [
      { label: "理性决策", value: clamp(lastSnapshot.disciplineScore + 3, 45, 98) },
      { label: "风险控制", value: clamp(100 - lastSnapshot.riskScore, 38, 95) },
      { label: "计划执行", value: clamp(72 + Math.min(run.currentRound, 12), 42, 96) },
      { label: "复盘韧性", value: clamp(68 + run.snapshots.length * 2, 40, 94) },
    ],
    teacherComment:
      "在本阶段试点中，这位同学能逐步从情绪交易转向结构化配置，建议继续强化现金流与止盈止损纪律。",
    aiSummary:
      lastSnapshot.riskScore > 70
        ? "孩子的参与度很高，但在高波动阶段容易放大仓位。建议优先稳定节奏，而不是追逐短期排名。"
        : "孩子在近期回合中表现出较好的策略稳定性，已经能主动利用储蓄与分散配置降低回撤。",
  };
}
