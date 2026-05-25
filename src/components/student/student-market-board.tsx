"use client";

import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import {
  Activity,
  Bot,
  Layers3,
  LoaderCircle,
  Newspaper,
  PieChart,
  Radar,
  Search,
  Sparkles,
  Trophy,
  Waves,
} from "lucide-react";

import { dispatchAssistantOpen } from "@/lib/assistant-config";
import { MARKET_REFRESH_INTERVAL_MS } from "@/lib/market-refresh";
import { resolveMarketWatchlistSymbol } from "@/lib/market-watchlist";
import type { MarketBoardPayload, MarketWatchlistSymbol } from "@/lib/types";
import { cn, getMarketMoveClasses } from "@/lib/utils";

const MINI_CHART_WIDTH = 720;
const MINI_CHART_HEIGHT = 220;
const RADAR_SIZE = 260;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = 92;

function formatPrice(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: value >= 100 ? 2 : 3,
    maximumFractionDigits: value >= 100 ? 2 : 3,
  });
}

function buildLinePath(values: number[]) {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = values.length <= 1 ? 0 : (index / (values.length - 1)) * MINI_CHART_WIDTH;
      const y = MINI_CHART_HEIGHT - ((value - min) / range) * MINI_CHART_HEIGHT;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildAreaPath(values: number[]) {
  if (values.length === 0) return "";
  return `${buildLinePath(values)} L ${MINI_CHART_WIDTH} ${MINI_CHART_HEIGHT} L 0 ${MINI_CHART_HEIGHT} Z`;
}

function buildRadarPoint(index: number, total: number, distance: number) {
  const angle = (-90 + (360 / total) * index) * (Math.PI / 180);
  return {
    x: RADAR_CENTER + Math.cos(angle) * distance,
    y: RADAR_CENTER + Math.sin(angle) * distance,
  };
}

function buildRadarShape(values: number[]) {
  if (values.length === 0) return "";
  return (
    values
      .map((score, index) => {
        const point = buildRadarPoint(index, values.length, (score / 100) * RADAR_RADIUS);
        return `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
      })
      .join(" ") + " Z"
  );
}

function buildDonutGradient(items: Array<{ color: string; weight: number }>) {
  let cursor = 0;
  const stops = items.map((item) => {
    const start = cursor;
    cursor += item.weight;
    return `${item.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

export function StudentMarketBoard({ initialPayload }: { initialPayload: MarketBoardPayload }) {
  const [payload, setPayload] = useState(initialPayload);
  const [payloadCache, setPayloadCache] = useState<Record<string, MarketBoardPayload>>({
    [initialPayload.selected.symbol]: initialPayload,
  });
  const [selectedSymbol, setSelectedSymbol] = useState<MarketWatchlistSymbol>(initialPayload.selected.symbol);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const deferredSearch = useDeferredValue(search);

  async function loadBoard(symbol: MarketWatchlistSymbol) {
    try {
      const response = await fetch(`/api/market/board?symbol=${symbol}`, { cache: "no-store" });
      const nextPayload = (await response.json()) as MarketBoardPayload & { error?: string };

      if (!response.ok || nextPayload.error) {
        throw new Error(nextPayload.error ?? "市场信息刷新失败。");
      }

      setPayload(nextPayload);
      setPayloadCache((current) => ({ ...current, [symbol]: nextPayload }));
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "市场信息刷新失败。");
    }
  }

  useEffect(() => {
    void loadBoard(selectedSymbol);
  }, [selectedSymbol]);

  useEffect(() => {
    const timer = window.setInterval(() => void loadBoard(selectedSymbol), MARKET_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [selectedSymbol]);

  const filteredWatchlist = useMemo(() => {
    const keyword = deferredSearch.trim().toLowerCase();
    if (!keyword) return payload.watchlist;
    return payload.watchlist.filter((item) =>
      `${item.symbol} ${item.name} ${item.companyName}`.toLowerCase().includes(keyword),
    );
  }, [deferredSearch, payload.watchlist]);

  const selectedMetricValues = payload.selected.metrics.map((item) => item.score);
  const radarPath = buildRadarShape(selectedMetricValues);
  const linePath = buildLinePath(payload.selected.miniSeries);
  const areaPath = buildAreaPath(payload.selected.miniSeries);
  const sectorTotal = payload.sectorPerformance.reduce(
    (total, item) => total + Math.max(Math.abs(item.changePercent), 0.4),
    0,
  );
  const sectorSlices = payload.sectorPerformance.map((item, index) => ({
    ...item,
    color: ["#f08a38", "#d43c33", "#0f9d58", "#6f7ef7", "#f59e0b", "#64748b"][index % 6],
    weight: (Math.max(Math.abs(item.changePercent), 0.4) / sectorTotal) * 100,
  }));

  return (
    <div className="space-y-6 pb-24">
      <section className="panel rounded-[2rem] p-5 sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-500">Market Radar</p>
            <h2 className="mt-3 text-3xl font-black text-slate-950 md:text-4xl">市场信息</h2>
            <p className="mt-3 text-base leading-8 text-slate-600">
              这里是只读观察台，先看主线，再看结构，最后再去问 AI。
            </p>
            <label className="mt-5 flex min-h-12 items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索股票或代码"
                className="w-full bg-transparent text-base font-semibold text-slate-950 outline-none placeholder:text-slate-400"
              />
            </label>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            {filteredWatchlist.map((item) => {
              const active = item.symbol === selectedSymbol;
              return (
                <button
                  key={item.symbol}
                  type="button"
                  onClick={() => {
                    const cached = payloadCache[item.symbol];
                    if (cached) setPayload(cached);
                    startTransition(() => setSelectedSymbol(resolveMarketWatchlistSymbol(item.symbol)));
                  }}
                  className={cn(
                    "min-w-0 rounded-[1.5rem] border px-4 py-4 text-left transition-all duration-200",
                    active
                      ? "border-orange-400 bg-orange-50 shadow-[0_18px_44px_rgba(240,138,56,0.16)]"
                      : "border-slate-200 bg-white hover:border-orange-300 hover:bg-slate-50",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-black text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)]"
                        style={{
                          background: `linear-gradient(135deg, ${item.accentColor} 0%, rgba(255,255,255,0.16) 115%)`,
                        }}
                      >
                        {item.monogram}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-base font-black text-slate-950">{item.name}</p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                          {item.symbol}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-black text-slate-950">{formatPrice(item.currentPrice)}</p>
                      <p className={cn("mt-1 text-xs font-black", getMarketMoveClasses(item.changePercent).text)}>
                        {item.changePercent >= 0 ? "+" : ""}
                        {item.changePercent.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 text-white shadow-[0_28px_90px_rgba(15,23,42,0.14)]">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1.14fr)_minmax(330px,0.86fr)]">
            <div className="relative min-w-0 overflow-hidden p-5 sm:p-6 lg:p-7">
              <div className="grid-strokes pointer-events-none absolute inset-0 opacity-20" />
              <div
                className="pointer-events-none absolute -left-10 top-8 h-44 w-44 rounded-full blur-3xl"
                style={{ backgroundColor: `${payload.selected.accentColor}28` }}
              />
              <div className="relative z-10">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-300">AI / Tech Watchlist</p>
                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      <h2 className="text-[2.35rem] font-black leading-tight sm:text-[3rem]">{payload.selected.name}</h2>
                      <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1 text-xs font-bold text-white/72">
                        {payload.selected.symbol}
                      </span>
                    </div>
                    <p className="mt-3 max-w-2xl text-base leading-8 text-white/76">{payload.selected.summary}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      dispatchAssistantOpen({
                        prompt: `请结合市场信息页，解读 ${payload.selected.name}（${payload.selected.symbol}）当前的价格位置、风险张力和下一步观察重点。`,
                        autoSend: true,
                      })
                    }
                    className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/12 bg-white/10 px-4 text-base font-bold text-white transition-colors hover:bg-white/15"
                  >
                    <Bot className="h-4 w-4" />
                    让 AI 解读
                  </button>
                </div>

                <div className="mt-7 flex flex-wrap items-end gap-4">
                  <p className="text-[3rem] font-black tracking-tight sm:text-[4rem]">
                    {formatPrice(payload.selected.currentPrice)}
                  </p>
                  <p className={cn("rounded-full px-3 py-1.5 text-base font-black", getMarketMoveClasses(payload.selected.changePercent).darkBadge)}>
                    {payload.selected.changePercent >= 0 ? "+" : ""}
                    {payload.selected.changePercent.toFixed(2)}%
                  </p>
                  <p className="text-sm font-semibold text-white/50">{payload.selected.companyName}</p>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {payload.selected.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-white/72">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-7 rounded-[2rem] border border-white/10 bg-white/[0.05] p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-black text-white">价格趋势速写</p>
                      <p className="mt-1 text-sm font-semibold text-white/50">用于帮助学生识别趋势节奏，不作为真实交易信号。</p>
                    </div>
                    <Activity className="h-5 w-5 text-orange-300" />
                  </div>
                  <svg viewBox={`0 0 ${MINI_CHART_WIDTH} ${MINI_CHART_HEIGHT}`} className="mt-4 h-52 w-full">
                    <defs>
                      <linearGradient id="market-board-fill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={payload.selected.accentColor} stopOpacity="0.42" />
                        <stop offset="100%" stopColor={payload.selected.accentColor} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
                      <line
                        key={ratio}
                        x1="0"
                        x2={MINI_CHART_WIDTH}
                        y1={MINI_CHART_HEIGHT * ratio}
                        y2={MINI_CHART_HEIGHT * ratio}
                        stroke="rgba(255,255,255,0.08)"
                        strokeDasharray="4 8"
                      />
                    ))}
                    <path d={areaPath} fill="url(#market-board-fill)" />
                    <path d={linePath} fill="none" stroke="#fff4e9" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="grid content-start gap-4 bg-white p-5 text-slate-950 sm:p-6 lg:p-7">
              <div className="rounded-[1.5rem] bg-slate-50 p-5">
                <p className="text-sm font-bold text-slate-500">教学综合评分</p>
                <div className="mt-4 flex items-end justify-between gap-4">
                  <p className="text-[3.5rem] font-black tracking-tight text-slate-950">{payload.selected.score.toFixed(2)}</p>
                  <div className="rounded-full bg-orange-50 px-3 py-1.5 text-sm font-black text-orange-700">
                    {payload.selected.sectorGroup}
                  </div>
                </div>
                <p className="mt-4 text-base leading-8 text-slate-600">{payload.selected.teachingNote}</p>
              </div>

              <div className="rounded-[1.5rem] bg-orange-50 p-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-orange-500" />
                  <p className="text-base font-black text-slate-950">数据新鲜度</p>
                </div>
                <p className="mt-4 text-base leading-8 text-slate-600">{payload.note}</p>
                <div className="mt-4 rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-500">
                  更新时间：{new Date(payload.asOf).toLocaleString("zh-CN", { hour12: false })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="panel rounded-[2rem] p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-500">Snapshot</p>
          <h3 className="mt-3 text-2xl font-black text-slate-950">关键字段</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
            {payload.selected.facts.map((fact) => (
              <div key={fact.label} className="rounded-[1.5rem] bg-slate-50 px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{fact.label}</p>
                <p className="mt-2 text-lg font-black text-slate-950">{fact.value}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="panel rounded-[2rem] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Radar className="h-5 w-5 text-orange-500" />
              <h3 className="text-2xl font-black text-slate-950">6维教学观察雷达</h3>
            </div>
            <p className="text-sm font-bold text-slate-400">文字说明移到右侧，避免图内拥挤。</p>
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
            <div className="flex items-center justify-center rounded-[2rem] bg-slate-50 p-4">
              <svg viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`} className="h-72 w-full max-w-[300px]">
                {[0.25, 0.5, 0.75, 1].map((ratio) => (
                  <polygon
                    key={ratio}
                    points={selectedMetricValues
                      .map((_, index) => {
                        const point = buildRadarPoint(index, selectedMetricValues.length, RADAR_RADIUS * ratio);
                        return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
                      })
                      .join(" ")}
                    fill="none"
                    stroke="rgba(15,23,42,0.1)"
                  />
                ))}
                {selectedMetricValues.map((_, index) => {
                  const point = buildRadarPoint(index, selectedMetricValues.length, RADAR_RADIUS);
                  return (
                    <line
                      key={`axis-${index}`}
                      x1={RADAR_CENTER}
                      y1={RADAR_CENTER}
                      x2={point.x}
                      y2={point.y}
                      stroke="rgba(15,23,42,0.1)"
                    />
                  );
                })}
                <path d={radarPath} fill={`${payload.selected.accentColor}2b`} stroke={payload.selected.accentColor} strokeWidth="3" />
                <circle cx={RADAR_CENTER} cy={RADAR_CENTER} r="4" fill={payload.selected.accentColor} />
              </svg>
            </div>
            <div className="grid min-w-0 gap-3">
              {payload.selected.metrics.map((metric) => (
                <div key={metric.id} className="rounded-[1.5rem] bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-base font-black text-slate-950">{metric.label}</p>
                    <p className="text-lg font-black text-orange-700">{metric.score}</p>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-7 text-slate-600">{metric.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel rounded-[2rem] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-orange-500" />
            <h3 className="text-2xl font-black text-slate-950">观察池结构拆解</h3>
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="relative mx-auto flex h-56 w-56 items-center justify-center rounded-full">
              <div className="absolute inset-0 rounded-full shadow-inner" style={{ background: buildDonutGradient(sectorSlices) }} />
              <div className="relative flex h-32 w-32 flex-col items-center justify-center rounded-full bg-white text-center shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
                <span className="text-xs font-bold text-slate-400">AI/科技</span>
                <span className="mt-1 text-2xl font-black text-slate-950">10</span>
                <span className="text-xs font-bold text-slate-400">观察标的</span>
              </div>
            </div>
            <div className="space-y-3">
              {sectorSlices.map((item) => (
                <div key={item.id} className="rounded-[1.5rem] bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <p className="text-base font-black text-slate-950">{item.label}</p>
                    </div>
                    <p className={cn("text-sm font-black", getMarketMoveClasses(item.changePercent).text)}>
                      {item.changePercent >= 0 ? "+" : ""}
                      {item.changePercent.toFixed(2)}%
                    </p>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-500">领跑观察：{item.leadSymbol}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="panel rounded-[2rem] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-orange-500" />
            <h3 className="text-2xl font-black text-slate-950">观察池排行</h3>
          </div>
          <div className="mt-5 space-y-3">
            {payload.marketSummary.map((item, index) => (
              <div key={item.symbol} className="rounded-[1.5rem] bg-slate-50 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-black text-slate-950">#{index + 1} {item.name}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{item.symbol}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black text-slate-950">{item.score.toFixed(2)}</p>
                    <p className={cn("mt-1 text-xs font-black", getMarketMoveClasses(item.changePercent).text)}>
                      {item.changePercent >= 0 ? "+" : ""}
                      {item.changePercent.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel rounded-[2rem] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Layers3 className="h-5 w-5 text-orange-500" />
            <h3 className="text-2xl font-black text-slate-950">板块热度条</h3>
          </div>
          <div className="mt-5 space-y-5">
            {payload.sectorPerformance.map((item) => {
              const width = `${Math.min(Math.max(Math.abs(item.changePercent) * 18, 12), 100)}%`;
              return (
                <div key={item.id}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-base font-bold text-slate-950">{item.label}</p>
                    <p className={cn("text-sm font-black", getMarketMoveClasses(item.changePercent).text)}>
                      {item.changePercent >= 0 ? "+" : ""}
                      {item.changePercent.toFixed(2)}%
                    </p>
                  </div>
                  <div className="mt-2 h-3 rounded-full bg-slate-100">
                    <div className={cn("h-full rounded-full", getMarketMoveClasses(item.changePercent).bar)} style={{ width }} />
                  </div>
                  <p className="mt-2 text-xs font-bold text-slate-400">领跑观察：{item.leadSymbol}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel rounded-[2rem] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Waves className="h-5 w-5 text-orange-500" />
            <h3 className="text-2xl font-black text-slate-950">课堂提示</h3>
          </div>
          <div className="mt-5 space-y-3">
            {payload.observationNotes.map((note, index) => (
              <div key={`note-${index}`} className="rounded-[1.5rem] bg-orange-50 px-4 py-4 text-base font-semibold leading-8 text-slate-600">
                {note}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
        <div
          className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 text-white shadow-[0_28px_90px_rgba(15,23,42,0.12)]"
          style={{
            backgroundImage: `radial-gradient(circle at top left, ${payload.contentCards[0]?.accentColor ?? "#f08a38"}22, transparent 24%), linear-gradient(135deg,#0f1729 0%,#182338 100%)`,
          }}
        >
          {payload.contentCards[0] ? (
            <div className="p-6 md:p-7">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-300">{payload.contentCards[0].sourceLabel}</p>
              <h3 className="mt-4 max-w-2xl text-3xl font-black">{payload.contentCards[0].title}</h3>
              <p className="mt-4 max-w-2xl text-base font-semibold leading-8 text-white/72">{payload.contentCards[0].summary}</p>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4">
          {payload.contentCards.slice(1).map((card) => (
            <div key={card.id} className="panel rounded-[2rem] p-5">
              <div className="flex items-center gap-2">
                <Newspaper className="h-4 w-4" style={{ color: card.accentColor }} />
                <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: card.accentColor }}>
                  {card.sourceLabel}
                </p>
              </div>
              <h3 className="mt-3 text-2xl font-black text-slate-950">{card.title}</h3>
              <p className="mt-3 text-base font-semibold leading-8 text-slate-600">{card.summary}</p>
            </div>
          ))}
        </div>
      </section>

      {isPending || error ? (
        <div className={cn("rounded-[1.5rem] px-4 py-3 text-sm font-bold", error ? "bg-orange-50 text-orange-700" : "bg-slate-50 text-slate-600")}>
          {error ? (
            error
          ) : (
            <span className="inline-flex items-center gap-2">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              正在刷新市场信息...
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
