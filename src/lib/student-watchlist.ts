import { getMarketMetadata, isMarketWatchlistSymbol } from "@/lib/market-watchlist";
import type {
  ActionLog,
  MarketBoardPayload,
  MarketWatchlistSymbol,
  ScenarioRun,
  TickerTapeItem,
} from "@/lib/types";
import { clamp, createId } from "@/lib/utils";

export type StudentWatchlistAction = "add" | "remove";

export type StudentWatchlistActionInput = {
  symbol: MarketWatchlistSymbol;
  action: StudentWatchlistAction;
  reason?: string;
};

export type StudentWatchlistItem = TickerTapeItem & {
  reason: string;
  addedAt: string;
  riskLabel: string;
  concept: string;
};

export type StudentMarketTemperature = {
  level: "hot" | "balanced" | "cooling";
  label: string;
  score: number;
  summary: string;
};

export type StudentDailyMarketBrief = {
  title: string;
  summary: string;
  focusSymbol: MarketWatchlistSymbol;
  question: string;
};

export type StudentWatchlistPayload = {
  asOf: string;
  items: StudentWatchlistItem[];
  suggested: StudentWatchlistItem[];
  historyCount: number;
  temperature: StudentMarketTemperature;
  dailyBrief: StudentDailyMarketBrief;
};

type WatchlistState = {
  symbol: MarketWatchlistSymbol;
  reason: string;
  addedAt: string;
};

function isWatchlistLog(entry: ActionLog) {
  return entry.type === "watchlist" && entry.meta?.kind === "watchlist_action";
}

function normalizeReason(reason?: string) {
  const trimmed = reason?.trim();
  return trimmed && trimmed.length > 0 ? trimmed.slice(0, 120) : "先加入自选，下一次复盘时补充观察理由。";
}

function quoteBySymbol(market: MarketBoardPayload, symbol: MarketWatchlistSymbol) {
  return market.watchlist.find((item) => item.symbol === symbol) ?? market.watchlist[0];
}

function conceptFor(symbol: MarketWatchlistSymbol, changePercent: number) {
  const metadata = getMarketMetadata(symbol);
  if (Math.abs(changePercent) >= 4) return "波动与仓位";
  if (metadata.sectorGroup.includes("半导体")) return "景气周期";
  if (metadata.sectorGroup.includes("云") || metadata.sectorGroup.includes("AI")) return "平台护城河";
  if (metadata.sectorGroup.includes("汽车")) return "叙事与兑现";
  return "板块联动";
}

function riskLabelFor(changePercent: number) {
  const abs = Math.abs(changePercent);
  if (abs >= 4) return "高波动";
  if (abs >= 1.5) return "中等波动";
  return "低波动";
}

function buildItem(
  market: MarketBoardPayload,
  state: WatchlistState,
): StudentWatchlistItem {
  const quote = quoteBySymbol(market, state.symbol);
  const metadata = getMarketMetadata(state.symbol);

  return {
    symbol: state.symbol,
    code: quote?.code ?? metadata.code,
    name: quote?.name ?? metadata.name,
    companyName: quote?.companyName ?? metadata.companyName,
    currentPrice: quote?.currentPrice ?? metadata.fallbackPrice,
    changePercent: quote?.changePercent ?? metadata.fallbackChange,
    source: quote?.source ?? "fallback",
    accentColor: quote?.accentColor ?? metadata.accentColor,
    monogram: quote?.monogram ?? metadata.monogram,
    reason: state.reason,
    addedAt: state.addedAt,
    riskLabel: riskLabelFor(quote?.changePercent ?? metadata.fallbackChange),
    concept: conceptFor(state.symbol, quote?.changePercent ?? metadata.fallbackChange),
  };
}

function readWatchlistState(run: ScenarioRun) {
  const state = new Map<MarketWatchlistSymbol, WatchlistState>();
  const logs = [...run.actionLog].filter(isWatchlistLog).reverse();

  for (const entry of logs) {
    const action = entry.meta?.action;
    const rawSymbol = entry.meta?.symbol;
    if (typeof rawSymbol !== "string" || !isMarketWatchlistSymbol(rawSymbol)) continue;

    if (action === "remove") {
      state.delete(rawSymbol);
      continue;
    }

    if (action === "add") {
      const rawReason = entry.meta?.reason;
      state.set(rawSymbol, {
        symbol: rawSymbol,
        reason: normalizeReason(typeof rawReason === "string" ? rawReason : undefined),
        addedAt: entry.timestamp,
      });
    }
  }

  return state;
}

function buildTemperature(market: MarketBoardPayload): StudentMarketTemperature {
  const changes = market.watchlist.map((item) => item.changePercent);
  const average = changes.reduce((sum, value) => sum + value, 0) / Math.max(changes.length, 1);
  const rising = changes.filter((value) => value > 0).length;
  const falling = changes.filter((value) => value < 0).length;
  const score = clamp(Math.round(50 + average * 9 + (rising - falling) * 3), 8, 96);

  if (score >= 68) {
    return {
      level: "hot",
      label: "市场偏热",
      score,
      summary: `观察池里上涨样本更多，平均涨跌约 ${average >= 0 ? "+" : ""}${average.toFixed(2)}%。适合练习“热度高时先写理由”。`,
    };
  }

  if (score <= 38) {
    return {
      level: "cooling",
      label: "市场降温",
      score,
      summary: `观察池里回落样本变多，平均涨跌约 ${average >= 0 ? "+" : ""}${average.toFixed(2)}%。适合练习现金垫和反向验证。`,
    };
  }

  return {
    level: "balanced",
    label: "冷热均衡",
    score,
    summary: `上涨与回落样本相对均衡，平均涨跌约 ${average >= 0 ? "+" : ""}${average.toFixed(2)}%。适合比较板块分化。`,
  };
}

function buildDailyBrief(market: MarketBoardPayload): StudentDailyMarketBrief {
  const strongest = [...market.watchlist].sort((left, right) => right.changePercent - left.changePercent)[0];
  const weakest = [...market.watchlist].sort((left, right) => left.changePercent - right.changePercent)[0];
  const focus = strongest ?? market.watchlist[0];
  const focusMetadata = getMarketMetadata(focus.symbol);

  return {
    title: `今日必看：${focus.name} 与 ${focusMetadata.sectorGroup}`,
    summary: weakest
      ? `${focus.name} 当前表现靠前，${weakest.name} 相对承压。不要只看谁涨得多，要解释“为什么这个板块被资金关注”。`
      : `${focus.name} 当前最值得观察。先写一个原因，再决定是否要问 AI 做二次解释。`,
    focusSymbol: focus.symbol,
    question: `如果你只能把一只股票加入自选，${focus.name} 的观察理由应该写“行业热度”“价格动量”还是“AI相关度”？`,
  };
}

export function buildStudentWatchlistPayload(
  run: ScenarioRun,
  market: MarketBoardPayload,
): StudentWatchlistPayload {
  const selected = readWatchlistState(run);
  const selectedItems = Array.from(selected.values()).map((item) => buildItem(market, item));
  const selectedSymbols = new Set(selectedItems.map((item) => item.symbol));
  const suggested = market.watchlist
    .filter((item) => !selectedSymbols.has(item.symbol))
    .slice()
    .sort((left, right) => Math.abs(right.changePercent) - Math.abs(left.changePercent))
    .slice(0, 4)
    .map((item) =>
      buildItem(market, {
        symbol: item.symbol,
        reason: "系统建议：今天波动或主题较明显，适合先加入自选写观察理由。",
        addedAt: market.asOf,
      }),
    );

  return {
    asOf: market.asOf,
    items: selectedItems,
    suggested,
    historyCount: run.actionLog.filter(isWatchlistLog).length,
    temperature: buildTemperature(market),
    dailyBrief: buildDailyBrief(market),
  };
}

export function createStudentWatchlistAction(
  run: ScenarioRun,
  input: StudentWatchlistActionInput,
) {
  const metadata = getMarketMetadata(input.symbol);
  const actionLabel = input.action === "add" ? "加入" : "移除";
  const entry: ActionLog = {
    id: createId("watch"),
    round: run.currentRound,
    type: "watchlist",
    label: `${actionLabel}自选观察：${metadata.name}（${input.symbol}）`,
    amount: 0,
    timestamp: new Date().toISOString(),
    meta: {
      kind: "watchlist_action",
      action: input.action,
      symbol: input.symbol,
      reason: normalizeReason(input.reason),
    },
  };

  return {
    entry,
    run: {
      ...run,
      actionLog: [entry, ...run.actionLog],
    } satisfies ScenarioRun,
  };
}
