"use client";

import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import {
  Bot,
  LoaderCircle,
  Radar,
  Search,
  Sparkles,
  TrendingUp,
  Waves,
} from "lucide-react";

import { dispatchAssistantOpen } from "@/lib/assistant-config";
import { MARKET_REFRESH_INTERVAL_MS } from "@/lib/market-refresh";
import { resolveMarketWatchlistSymbol } from "@/lib/market-watchlist";
import type { MarketBoardPayload, MarketWatchlistSymbol } from "@/lib/types";
import { cn, getMarketMoveClasses } from "@/lib/utils";

const MINI_CHART_WIDTH = 720;
const MINI_CHART_HEIGHT = 200;
const RADAR_SIZE = 260;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = 84;

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
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const line = values
    .map((value, index) => {
      const x = values.length <= 1 ? 0 : (index / (values.length - 1)) * MINI_CHART_WIDTH;
      const y = MINI_CHART_HEIGHT - ((value - min) / range) * MINI_CHART_HEIGHT;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return `${line} L ${MINI_CHART_WIDTH} ${MINI_CHART_HEIGHT} L 0 ${MINI_CHART_HEIGHT} Z`;
}

function buildRadarShape(values: number[]) {
  return (
    values
      .map((score, index) => {
        const angle = (-90 + (360 / values.length) * index) * (Math.PI / 180);
        const radius = (score / 100) * RADAR_RADIUS;
        const x = RADAR_CENTER + Math.cos(angle) * radius;
        const y = RADAR_CENTER + Math.sin(angle) * radius;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ") + " Z"
  );
}

function buildRadarLabel(index: number, total: number, distance: number) {
  const angle = (-90 + (360 / total) * index) * (Math.PI / 180);
  const x = RADAR_CENTER + Math.cos(angle) * distance;
  const y = RADAR_CENTER + Math.sin(angle) * distance;
  return { x, y };
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
      const response = await fetch(`/api/market/board?symbol=${symbol}`, {
        cache: "no-store",
      });
      const nextPayload = (await response.json()) as MarketBoardPayload & { error?: string };

      if (!response.ok || nextPayload.error) {
        throw new Error(nextPayload.error ?? "市场信息刷新失败。");
      }

      setPayload(nextPayload);
      setPayloadCache((current) => ({
        ...current,
        [symbol]: nextPayload,
      }));
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "市场信息刷新失败。");
    }
  }

  useEffect(() => {
    void loadBoard(selectedSymbol);
  }, [selectedSymbol]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadBoard(selectedSymbol);
    }, MARKET_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [selectedSymbol]);

  const filteredWatchlist = useMemo(() => {
    const keyword = deferredSearch.trim().toLowerCase();
    if (!keyword) {
      return payload.watchlist;
    }

    return payload.watchlist.filter((item) => {
      const haystack = `${item.symbol} ${item.name} ${item.companyName}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [deferredSearch, payload.watchlist]);

  const selectedMetricValues = payload.selected.metrics.map((item) => item.score);
  const radarPath = buildRadarShape(selectedMetricValues);
  const linePath = buildLinePath(payload.selected.miniSeries);
  const areaPath = buildAreaPath(payload.selected.miniSeries);

  return (
    <div className="space-y-6 pb-20 sm:pb-24">
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.06)] sm:p-5">
          <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
            <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[#f08a38]">Market Radar</p>
          <h2 className="mt-3 text-[2rem] font-semibold text-slate-950">市场信息</h2>
          <p className="mt-3 text-[15px] leading-8 text-slate-500">
            这里是只读观察台，适合先看主线、再看结构，最后再去问 AI。
          </p>

          <label className="mt-5 flex items-center gap-3 rounded-full border border-slate-200 bg-slate-950/[0.03] px-4 py-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索股票或代码"
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </label>

            </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filteredWatchlist.map((item) => {
              const active = item.symbol === selectedSymbol;

              return (
                <button
                  key={item.symbol}
                  type="button"
                  onClick={() => {
                    const cached = payloadCache[item.symbol];
                    if (cached) {
                      setPayload(cached);
                    }

                    startTransition(() => {
                      setSelectedSymbol(resolveMarketWatchlistSymbol(item.symbol));
                    });
                  }}
                  className={cn(
                    "min-w-0 rounded-[1.35rem] border px-3.5 py-3.5 text-left transition-colors",
                    active
                      ? "border-[#f08a38]/40 bg-[#fff4e9]"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)]"
                        style={{
                          background: `linear-gradient(135deg, ${item.accentColor} 0%, rgba(255,255,255,0.16) 115%)`,
                        }}
                      >
                        {item.monogram}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[1.02rem] font-semibold text-slate-950">{item.name}</p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          {item.symbol}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-semibold text-slate-950">{formatPrice(item.currentPrice)}</p>
                      <p className={cn("mt-1 text-xs font-semibold", getMarketMoveClasses(item.changePercent).text)}>
                        {item.changePercent >= 0 ? "+" : ""}
                        {item.changePercent.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}

            {filteredWatchlist.length === 0 ? (
              <div className="rounded-[1.35rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-[15px] font-semibold text-slate-500">
                没有匹配到对应股票，试试输入 `MU`、`NVDA` 或 `META`。
              </div>
            ) : null}
          </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.16fr)_minmax(340px,0.84fr)]">
        <section className="min-w-0 space-y-6">
          <div className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[#0f1729] text-white shadow-[0_28px_90px_rgba(15,23,42,0.14)]">
            <div className="grid">
              <div className="relative overflow-hidden px-5 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-7">
                <div className="grid-strokes pointer-events-none absolute inset-0 opacity-20" />
                <div
                  className="pointer-events-none absolute -left-8 top-6 h-28 w-28 rounded-full blur-3xl sm:-left-12 sm:top-8 sm:h-40 sm:w-40"
                  style={{ backgroundColor: `${payload.selected.accentColor}25` }}
                />
                <div className="pointer-events-none absolute bottom-0 right-0 h-32 w-32 rounded-full bg-[#6f7ef7]/18 blur-3xl sm:h-44 sm:w-44" />

                <div className="relative z-10">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-[#ffb36d]">AI / Tech Watchlist</p>
                      <div className="mt-3 flex flex-wrap items-end gap-3">
                        <h2 className="text-[2.15rem] font-semibold leading-tight sm:text-[2.45rem] lg:text-[2.7rem]">
                          {payload.selected.name}
                        </h2>
                        <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold text-white/72">
                          {payload.selected.symbol}
                        </span>
                      </div>
                      <p className="mt-3 max-w-2xl text-[15px] leading-8 text-white/74 md:text-base">
                        {payload.selected.summary}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        dispatchAssistantOpen({
                          prompt: `请结合市场信息页，解读 ${payload.selected.name}（${payload.selected.symbol}）当前的价格位置、风险张力和下一步观察重点。`,
                          autoSend: true,
                        })
                      }
                      className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-white/12"
                    >
                      <Bot className="h-4 w-4" />
                      让 AI 解读
                    </button>
                  </div>

                  <div className="mt-6 flex flex-wrap items-end gap-3 sm:gap-4">
                    <p className="text-[2.85rem] font-semibold tracking-tight sm:text-[3.4rem]">
                      {formatPrice(payload.selected.currentPrice)}
                    </p>
                    <p
                      className={cn(
                        "rounded-full px-3 py-1.5 text-sm font-semibold",
                        getMarketMoveClasses(payload.selected.changePercent).darkBadge,
                      )}
                    >
                      {payload.selected.changePercent >= 0 ? "+" : ""}
                      {payload.selected.changePercent.toFixed(2)}%
                    </p>
                    <p className="text-sm text-white/48">{payload.selected.companyName}</p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {payload.selected.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-medium text-white/72"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-white/[0.05] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[15px] font-semibold text-white">价格走势速写</p>
                        <p className="mt-1 text-xs text-white/48">
                          用于帮助学生识别趋势节奏，不作为真实交易信号。
                        </p>
                      </div>
                      <TrendingUp className="h-4 w-4 text-[#ffb36d]" />
                    </div>
                    <div className="mt-4">
                      <svg viewBox={`0 0 ${MINI_CHART_WIDTH} ${MINI_CHART_HEIGHT}`} className="h-44 w-full sm:h-52">
                        <defs>
                          <linearGradient id="market-board-fill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={payload.selected.accentColor} stopOpacity="0.4" />
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
                        <path
                          d={linePath}
                          fill="none"
                          stroke="#fff4e9"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white/96 px-5 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-7">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[1.6rem] bg-slate-950/[0.03] p-5">
                    <p className="text-[15px] font-semibold text-slate-500">教学综合评分</p>
                    <div className="mt-4 flex items-end justify-between gap-4">
                      <p className="text-5xl font-semibold tracking-tight text-slate-950">
                        {payload.selected.score.toFixed(2)}
                      </p>
                      <div className="rounded-full bg-[#fff4e9] px-3 py-1.5 text-sm font-semibold text-[#b96621]">
                        {payload.selected.sectorGroup}
                      </div>
                    </div>
                    <p className="mt-4 text-[15px] leading-8 text-slate-600">{payload.selected.teachingNote}</p>
                  </div>

                  <div className="rounded-[1.6rem] bg-[#fff4e9] p-5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[#f08a38]" />
                      <p className="text-[15px] font-semibold text-slate-950">数据新鲜度</p>
                    </div>
                    <p className="mt-4 text-[15px] leading-8 text-slate-700">{payload.note}</p>
                    <div className="mt-4 rounded-full bg-white px-3 py-2 text-xs font-medium text-slate-600">
                      更新时间：{new Date(payload.asOf).toLocaleString("zh-CN", { hour12: false })}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-[1.02fr_0.98fr]">
                  <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Radar className="h-4 w-4 text-[#f08a38]" />
                      <p className="text-[15px] font-semibold text-slate-950">6维教学观察雷达</p>
                    </div>
                    <div className="mt-4 flex justify-center">
                      <svg
                        viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
                        className="h-60 w-full max-w-[260px] sm:h-72 sm:max-w-[288px]"
                      >
                        {[0.25, 0.5, 0.75, 1].map((ratio) => (
                          <polygon
                            key={ratio}
                            points={selectedMetricValues
                              .map((_, index) => {
                                const point = buildRadarLabel(
                                  index,
                                  selectedMetricValues.length,
                                  RADAR_RADIUS * ratio,
                                );
                                return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
                              })
                              .join(" ")}
                            fill="none"
                            stroke="rgba(15,23,42,0.08)"
                          />
                        ))}
                        {selectedMetricValues.map((_, index) => {
                          const point = buildRadarLabel(index, selectedMetricValues.length, RADAR_RADIUS);
                          return (
                            <line
                              key={`axis-${index}`}
                              x1={RADAR_CENTER}
                              y1={RADAR_CENTER}
                              x2={point.x}
                              y2={point.y}
                              stroke="rgba(15,23,42,0.08)"
                            />
                          );
                        })}
                        <path
                          d={radarPath}
                          fill={`${payload.selected.accentColor}2b`}
                          stroke={payload.selected.accentColor}
                          strokeWidth="3"
                        />
                        <circle cx={RADAR_CENTER} cy={RADAR_CENTER} r="4" fill={payload.selected.accentColor} />
                      </svg>
                    </div>
                  </div>

                  <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Waves className="h-4 w-4 text-[#f08a38]" />
                      <p className="text-[15px] font-semibold text-slate-950">关键字段</p>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {payload.selected.facts.map((fact) => (
                        <div key={fact.label} className="rounded-[1.2rem] bg-slate-950/[0.03] px-4 py-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{fact.label}</p>
                          <p className="mt-2 text-[15px] font-semibold text-slate-950">{fact.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[#f08a38]" />
                      <p className="text-[15px] font-semibold text-slate-950">6维指标拆解</p>
                    </div>
                    <p className="text-xs font-medium text-slate-400">维度文字已移到下方，避免雷达图内拥挤。</p>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {payload.selected.metrics.map((metric) => (
                      <div key={metric.id} className="rounded-[1.2rem] bg-slate-950/[0.03] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[15px] font-semibold text-slate-950">{metric.label}</p>
                          <p className="text-sm font-semibold text-slate-500">{metric.score}</p>
                        </div>
                        <p className="mt-2 text-xs leading-6 text-slate-500">{metric.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="min-w-0 space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0 xl:self-start">
          <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.06)] lg:h-full">
            <p className="text-xs uppercase tracking-[0.22em] text-[#f08a38]">市场概要</p>
            <h3 className="mt-3 text-[1.45rem] font-semibold text-slate-950">观察池排行</h3>
            <div className="mt-4 space-y-3">
              {payload.marketSummary.map((item, index) => (
                <div key={item.symbol} className="rounded-[1.3rem] bg-slate-950/[0.03] px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-semibold text-slate-950">
                        #{index + 1} {item.name}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{item.symbol}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[15px] font-semibold text-slate-950">{item.score.toFixed(2)}</p>
                      <p className={cn("mt-1 text-xs font-semibold", getMarketMoveClasses(item.changePercent).text)}>
                        {item.changePercent >= 0 ? "+" : ""}
                        {item.changePercent.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.06)] lg:h-full">
            <p className="text-xs uppercase tracking-[0.22em] text-[#f08a38]">行业表现</p>
            <h3 className="mt-3 text-[1.45rem] font-semibold text-slate-950">板块热度条</h3>
            <div className="mt-4 space-y-4">
              {payload.sectorPerformance.map((item) => {
                const width = `${Math.min(Math.max(Math.abs(item.changePercent) * 18, 12), 100)}%`;
                return (
                  <div key={item.id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[15px] font-medium text-slate-700">{item.label}</p>
                      <p className={cn("text-sm font-semibold", getMarketMoveClasses(item.changePercent).text)}>
                        {item.changePercent >= 0 ? "+" : ""}
                        {item.changePercent.toFixed(2)}%
                      </p>
                    </div>
                    <div className="mt-2 h-2.5 rounded-full bg-slate-100">
                      <div
                        className={cn("h-full rounded-full", getMarketMoveClasses(item.changePercent).bar)}
                        style={{ width }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">领跑观察：{item.leadSymbol}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.06)] lg:col-span-2">
            <p className="text-xs uppercase tracking-[0.22em] text-[#f08a38]">当日观察</p>
            <h3 className="mt-3 text-[1.45rem] font-semibold text-slate-950">课堂提示</h3>
            <div className="mt-4 space-y-3">
              {payload.observationNotes.map((note, index) => (
                <div key={`note-${index}`} className="rounded-[1.3rem] bg-[#fff4e9] px-4 py-4 text-sm leading-7 text-slate-700">
                  {note}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
        <div
          className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[#0f1729] text-white shadow-[0_28px_90px_rgba(15,23,42,0.12)]"
          style={{
            backgroundImage: `radial-gradient(circle at top left, ${payload.contentCards[0]?.accentColor ?? "#f08a38"}22, transparent 24%), linear-gradient(135deg,#0f1729 0%,#182338 100%)`,
          }}
        >
          {payload.contentCards[0] ? (
            <div className="p-6 md:p-7">
              <p className="text-xs uppercase tracking-[0.24em] text-[#ffb36d]">
                {payload.contentCards[0].sourceLabel}
              </p>
              <h3 className="mt-4 max-w-2xl text-3xl font-semibold">{payload.contentCards[0].title}</h3>
              <p className="mt-4 max-w-2xl text-sm leading-8 text-white/72">{payload.contentCards[0].summary}</p>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4">
          {payload.contentCards.slice(1).map((card) => (
            <div
              key={card.id}
              className="rounded-[1.7rem] border border-slate-200/80 bg-white/92 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.06)]"
            >
              <p className="text-xs uppercase tracking-[0.22em]" style={{ color: card.accentColor }}>
                {card.sourceLabel}
              </p>
              <h3 className="mt-3 text-[1.45rem] font-semibold text-slate-950">{card.title}</h3>
              <p className="mt-3 text-[15px] leading-8 text-slate-600">{card.summary}</p>
            </div>
          ))}
        </div>
      </section>

      {isPending || error ? (
        <div
          className={cn(
            "rounded-[1.5rem] px-4 py-3 text-sm font-medium",
            error ? "bg-amber-50 text-amber-700" : "bg-slate-950/[0.04] text-slate-600",
          )}
        >
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
