import { eventIdForRound, eventMarketEffect } from "@/lib/event-engine";
import { eventCards, marketRounds } from "@/lib/market-data";
import type { AssetCategory, EventCard, MarketRound, ScenarioRun } from "@/lib/types";
import { clamp } from "@/lib/utils";

export type MarketTemperatureLevel = "cold" | "cooling" | "balanced" | "warm" | "hot";

export interface MarketTemperatureFactor {
  label: string;
  value: string;
  tone: "positive" | "neutral" | "negative";
}

export interface MarketTemperaturePayload {
  score: number;
  level: MarketTemperatureLevel;
  label: string;
  roundLabel: string;
  headline: string;
  eventTitle: string;
  eventSignal: EventCard["signal"];
  summary: string;
  contrarianHint: string;
  factors: MarketTemperatureFactor[];
}

const CATEGORIES: AssetCategory[] = ["stock", "etf", "bond", "commodity", "fx"];
const RISK_CATEGORIES: AssetCategory[] = ["stock", "etf", "commodity"];

function getRound(roundNumber: number): MarketRound {
  return marketRounds[Math.max(0, Math.min(marketRounds.length - 1, roundNumber - 1))]!;
}

function getEventById(eventId: string) {
  return eventCards.find((event) => event.id === eventId) ?? eventCards[0]!;
}

function signedPercent(value: number) {
  const fixed = value.toFixed(1);
  return `${value >= 0 ? "+" : ""}${fixed}%`;
}

function factorTone(value: number): MarketTemperatureFactor["tone"] {
  if (value > 0.3) return "positive";
  if (value < -0.3) return "negative";
  return "neutral";
}

export function computeMarketTemperatureFromMoves(
  moves: number[],
  context: {
    roundLabel?: string;
    headline?: string;
    eventTitle?: string;
    eventSignal?: EventCard["signal"];
    liquidityBoost?: number;
  } = {},
): MarketTemperaturePayload {
  const safeMoves = moves.length > 0 ? moves : [0];
  const average = safeMoves.reduce((sum, value) => sum + value, 0) / safeMoves.length;
  const positiveCount = safeMoves.filter((value) => value > 0.05).length;
  const negativeCount = safeMoves.filter((value) => value < -0.05).length;
  const directionalCount = positiveCount + negativeCount;
  const risingRatio = directionalCount === 0 ? 0.5 : positiveCount / directionalCount;
  const range = Math.max(...safeMoves) - Math.min(...safeMoves);
  const liquidityBoost = context.liquidityBoost ?? 0;
  const score = clamp(Math.round(50 + average * 3.4 + (risingRatio - 0.5) * 38 + liquidityBoost * 7 - range * 0.25), 8, 96);

  const level: MarketTemperatureLevel =
    score >= 80 ? "hot" : score >= 65 ? "warm" : score <= 25 ? "cold" : score <= 40 ? "cooling" : "balanced";
  const label =
    level === "hot"
      ? "市场过热"
      : level === "warm"
        ? "市场偏热"
        : level === "cold"
          ? "市场过冷"
          : level === "cooling"
            ? "市场降温"
            : "冷热均衡";
  const contrarianHint =
    level === "hot"
      ? "别人贪婪我恐惧：先检查仓位、证据和最坏情况，不把兴奋当能力。"
      : level === "cold"
        ? "别人恐惧我先验证：先看现金垫和基本面，再判断是否只是情绪过度。"
        : level === "warm"
          ? "偏热时先写理由，再决定是否行动；热度不是买入指令。"
          : level === "cooling"
            ? "降温时先保护现金流，再找真正被错杀的机会。"
            : "冷热均衡时适合比较板块分化，而不是急着猜方向。";

  return {
    score,
    level,
    label,
    roundLabel: context.roundLabel ?? "当前回合",
    headline: context.headline ?? "市场情绪处于教学观察模式",
    eventTitle: context.eventTitle ?? "课堂模拟事件",
    eventSignal: context.eventSignal ?? "中性",
    summary: `当前样本平均变化 ${signedPercent(average)}，上涨占比 ${Math.round(risingRatio * 100)}%。这个温度只用于理解情绪，不代表真实买卖建议。`,
    contrarianHint,
    factors: [
      { label: "平均变化", value: signedPercent(average), tone: factorTone(average) },
      { label: "上涨占比", value: `${Math.round(risingRatio * 100)}%`, tone: risingRatio >= 0.6 ? "positive" : risingRatio <= 0.4 ? "negative" : "neutral" },
      { label: "分化幅度", value: `${range.toFixed(1)}%`, tone: range >= 12 ? "negative" : range <= 4 ? "neutral" : "positive" },
    ],
  };
}

export function computeMarketTemperature(
  run: ScenarioRun,
  roundNumber = run.currentRound,
): MarketTemperaturePayload {
  const round = getRound(roundNumber);
  const previousRound = getRound(Math.max(1, roundNumber - 1));
  const eventId = eventIdForRound(run.eventTimeline, roundNumber, round.eventId);
  const previousEventId = eventIdForRound(run.eventTimeline, Math.max(1, roundNumber - 1), previousRound.eventId);
  const event = getEventById(eventId);
  const previousEvent = getEventById(previousEventId);

  const moves = CATEGORIES.map((category) => {
    const current = round.assetMultipliers[category] * eventMarketEffect(event, category);
    const previous = previousRound.assetMultipliers[category] * eventMarketEffect(previousEvent, category);
    return ((current - previous) / previous) * 100;
  });

  const payload = computeMarketTemperatureFromMoves(moves, {
    roundLabel: `第 ${roundNumber} 回合 · ${round.theme}`,
    headline: round.headline,
    eventTitle: event.title,
    eventSignal: event.signal,
    liquidityBoost: round.liquidityBoost,
  });
  const riskMoves = CATEGORIES.map((category, index) => ({ category, value: moves[index] ?? 0 }))
    .filter((item) => RISK_CATEGORIES.includes(item.category));
  const riskAverage = riskMoves.reduce((sum, item) => sum + item.value, 0) / Math.max(riskMoves.length, 1);

  return {
    ...payload,
    factors: [
      ...payload.factors,
      { label: "风险资产", value: signedPercent(riskAverage), tone: factorTone(riskAverage) },
    ],
  };
}
