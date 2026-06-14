import { marketAssets } from "@/lib/market-data";
import { getMarketMetadata, isMarketWatchlistSymbol } from "@/lib/market-watchlist";
import type { MarketWatchlistSymbol, ScenarioRun } from "@/lib/types";
import { clamp } from "@/lib/utils";

export type PeerHeatSource = "holding" | "watchlist";

export interface PeerHeatItem {
  symbol: string;
  name: string;
  count: number;
  ratio: number;
  source: PeerHeatSource;
  concept: string;
  coachNote: string;
}

export interface PeerHeatPayload {
  classroomName: string;
  totalStudents: number;
  generatedAt: string;
  headline: string;
  summary: string;
  privacyNote: string;
  items: PeerHeatItem[];
  sourceMix: {
    holdings: number;
    watchlist: number;
  };
}

const SIM_ASSET_META = new Map(
  marketAssets.map((asset) => [
    asset.id,
    {
      symbol: asset.symbol,
      name: asset.name,
      concept:
        asset.category === "stock"
          ? "成长与波动"
          : asset.category === "etf"
            ? "分散配置"
            : asset.category === "bond"
              ? "稳健防守"
              : asset.category === "commodity"
                ? "周期与供需"
                : "汇率对冲",
    },
  ]),
);

function currentWatchlistSymbols(run: ScenarioRun) {
  const state = new Set<MarketWatchlistSymbol>();
  const logs = [...run.actionLog]
    .filter((entry) => entry.type === "watchlist" && entry.meta?.kind === "watchlist_action")
    .reverse();

  for (const entry of logs) {
    const rawSymbol = entry.meta?.symbol;
    const action = entry.meta?.action;
    if (typeof rawSymbol !== "string" || !isMarketWatchlistSymbol(rawSymbol)) continue;

    if (action === "remove") {
      state.delete(rawSymbol);
    } else if (action === "add") {
      state.add(rawSymbol);
    }
  }

  return state;
}

function addSignal(
  map: Map<string, Omit<PeerHeatItem, "ratio">>,
  symbol: string,
  name: string,
  source: PeerHeatSource,
  concept: string,
) {
  const key = `${source}:${symbol}`;
  const current = map.get(key);
  if (current) {
    current.count += 1;
    return;
  }

  map.set(key, {
    symbol,
    name,
    count: 1,
    source,
    concept,
    coachNote:
      source === "watchlist"
        ? "这是同学们加入自选观察的聚合热度，热门不等于适合你，先写自己的理由。"
        : "这是班级模拟持有的聚合热度，只显示人数，不显示任何同学的具体仓位。",
  });
}

export function buildPeerHeatPayload(
  classroomRuns: ScenarioRun[],
  currentRun: ScenarioRun,
  classroomName = "当前班级",
  now = new Date(),
): PeerHeatPayload {
  const relatedRuns = classroomRuns.filter((run) => run.classroomId === currentRun.classroomId);
  const runs = relatedRuns.length > 0 ? relatedRuns : [currentRun];
  const totalStudents = runs.length;
  const signals = new Map<string, Omit<PeerHeatItem, "ratio">>();

  for (const run of runs) {
    const holdingSymbols = new Set<string>();
    for (const holding of run.holdings) {
      if (holding.quantity <= 0) continue;
      const meta = SIM_ASSET_META.get(holding.assetId);
      if (!meta || holdingSymbols.has(meta.symbol)) continue;
      holdingSymbols.add(meta.symbol);
      addSignal(signals, meta.symbol, meta.name, "holding", meta.concept);
    }

    for (const symbol of currentWatchlistSymbols(run)) {
      const metadata = getMarketMetadata(symbol);
      addSignal(signals, symbol, metadata.name, "watchlist", metadata.sectorGroup);
    }
  }

  const items = Array.from(signals.values())
    .map((item) => ({
      ...item,
      ratio: clamp(Math.round((item.count / Math.max(totalStudents, 1)) * 100), 0, 100),
    }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "zh-CN"))
    .slice(0, 6);

  const holdingSignals = items.filter((item) => item.source === "holding").length;
  const watchlistSignals = items.filter((item) => item.source === "watchlist").length;
  const top = items[0];

  return {
    classroomName,
    totalStudents,
    generatedAt: now.toISOString(),
    headline: top ? `本班最热观察：${top.name}` : "本班热度还在形成中",
    summary: top
      ? `${top.count} 位同学正在模拟持有或观察 ${top.name}。这是一条社会认同信号，不是买入建议。`
      : "当同学们开始持有资产或加入自选观察后，这里会显示脱敏聚合热度。",
    privacyNote: "只展示班级聚合人数，不显示姓名、账号标识、持仓数量或具体金额。",
    items,
    sourceMix: {
      holdings: holdingSignals,
      watchlist: watchlistSignals,
    },
  };
}
