"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { PointerEvent } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  Activity,
  BookmarkCheck,
  Bot,
  Layers3,
  LoaderCircle,
  Newspaper,
  PieChart,
  Plus,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  ThermometerSun,
  Trophy,
  UsersRound,
  Waves,
  X,
} from "lucide-react";

import { dispatchAssistantOpen } from "@/lib/assistant-config";
import { MARKET_REFRESH_INTERVAL_MS } from "@/lib/market-refresh";
import { resolveMarketWatchlistSymbol } from "@/lib/market-watchlist";
import type { PeerHeatPayload } from "@/lib/peer-heat";
import type { StudentWatchlistPayload } from "@/lib/student-watchlist";
import type { MarketBoardPayload, MarketKlineCandle, MarketWatchlistSymbol } from "@/lib/types";
import { cn, formatDateLabel, getMarketMoveClasses } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

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

function buildCandleGeometry(candles: MarketKlineCandle[]) {
  const visible = candles.slice(-18);
  if (visible.length === 0) return [];

  const lows = visible.map((item) => item.low);
  const highs = visible.map((item) => item.high);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const range = max - min || 1;
  const slot = MINI_CHART_WIDTH / visible.length;
  const bodyWidth = Math.min(22, Math.max(9, slot * 0.42));
  const yFor = (value: number) => MINI_CHART_HEIGHT - ((value - min) / range) * MINI_CHART_HEIGHT;

  return visible.map((item, index) => {
    const centerX = slot * index + slot / 2;
    const openY = yFor(item.open);
    const closeY = yFor(item.close);
    const highY = yFor(item.high);
    const lowY = yFor(item.low);

    return {
      key: `${item.time}-${index}`,
      centerX,
      x: centerX - bodyWidth / 2,
      width: bodyWidth,
      highY,
      lowY,
      bodyY: Math.min(openY, closeY),
      bodyHeight: Math.max(Math.abs(openY - closeY), 4),
      up: item.close >= item.open,
    };
  });
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

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function StudentMarketBoard({
  initialPayload,
  initialWatchlistPayload,
  initialPeerHeatPayload,
}: {
  initialPayload: MarketBoardPayload;
  initialWatchlistPayload: StudentWatchlistPayload;
  initialPeerHeatPayload: PeerHeatPayload;
}) {
  const marketBoardRef = useRef<HTMLDivElement>(null);
  const [payload, setPayload] = useState(initialPayload);
  const [payloadCache, setPayloadCache] = useState<Record<string, MarketBoardPayload>>({
    [initialPayload.selected.symbol]: initialPayload,
  });
  const [selectedSymbol, setSelectedSymbol] = useState<MarketWatchlistSymbol>(initialPayload.selected.symbol);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [studentWatchlist, setStudentWatchlist] = useState<StudentWatchlistPayload | null>(initialWatchlistPayload);
  const [peerHeat, setPeerHeat] = useState<PeerHeatPayload>(initialPeerHeatPayload);
  const [peerHeatError, setPeerHeatError] = useState<string | null>(null);
  const [watchReason, setWatchReason] = useState("");
  const [watchlistPending, setWatchlistPending] = useState(false);
  const [watchlistMessage, setWatchlistMessage] = useState<string | null>(null);
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

  const loadStudentWatchlist = useCallback(async (symbol: MarketWatchlistSymbol) => {
    try {
      const response = await fetch(`/api/student/watchlist?symbol=${symbol}`, { cache: "no-store" });
      const nextPayload = (await response.json()) as { payload?: StudentWatchlistPayload; error?: string; message?: string };
      if (!response.ok || !nextPayload.payload) {
        throw new Error(nextPayload.message ?? nextPayload.error ?? "自选观察刷新失败。");
      }
      setStudentWatchlist(nextPayload.payload);
      setWatchlistMessage(null);
    } catch (nextError) {
      setWatchlistMessage(nextError instanceof Error ? nextError.message : "自选观察刷新失败。");
    }
  }, []);

  const loadPeerHeat = useCallback(async () => {
    try {
      const response = await fetch("/api/market/peer-heat", { cache: "no-store" });
      const nextPayload = (await response.json()) as { payload?: PeerHeatPayload; error?: string; message?: string };
      if (!response.ok || !nextPayload.payload) {
        throw new Error(nextPayload.message ?? nextPayload.error ?? "同学热度刷新失败。");
      }
      setPeerHeat(nextPayload.payload);
      setPeerHeatError(null);
    } catch (nextError) {
      setPeerHeatError(nextError instanceof Error ? nextError.message : "同学热度刷新失败。");
    }
  }, []);

  async function updateWatchlist(action: "add" | "remove", symbol: MarketWatchlistSymbol = selectedSymbol) {
    setWatchlistPending(true);
    setWatchlistMessage(null);
    try {
      const response = await fetch("/api/student/watchlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbol,
          action,
          reason: action === "add" ? watchReason : "从自选观察移除，等待下一次比较。",
        }),
      });
      const nextPayload = (await response.json()) as {
        payload?: StudentWatchlistPayload;
        message?: string;
        error?: string;
      };
      if (!response.ok || !nextPayload.payload) {
        throw new Error(nextPayload.message ?? nextPayload.error ?? "自选观察更新失败。");
      }
      setStudentWatchlist(nextPayload.payload);
      setWatchlistMessage(nextPayload.message ?? "自选观察已更新。");
      if (action === "add") setWatchReason("");
    } catch (nextError) {
      setWatchlistMessage(nextError instanceof Error ? nextError.message : "自选观察更新失败。");
    } finally {
      setWatchlistPending(false);
    }
  }

  useEffect(() => {
    void loadBoard(selectedSymbol);
  }, [selectedSymbol]);

  useEffect(() => {
    void loadStudentWatchlist(selectedSymbol);
  }, [loadStudentWatchlist, selectedSymbol]);

  useEffect(() => {
    void loadPeerHeat();
  }, [loadPeerHeat]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadBoard(selectedSymbol);
      void loadPeerHeat();
    }, MARKET_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadPeerHeat, selectedSymbol]);

  const filteredWatchlist = useMemo(() => {
    const keyword = deferredSearch.trim().toLowerCase();
    if (!keyword) return payload.watchlist;
    return payload.watchlist.filter((item) =>
      `${item.symbol} ${item.name} ${item.companyName}`.toLowerCase().includes(keyword),
    );
  }, [deferredSearch, payload.watchlist]);

  const selectedMetricValues = payload.selected.metrics.map((item) => item.score);
  const selectedInStudentWatchlist = studentWatchlist?.items.some((item) => item.symbol === selectedSymbol) ?? false;
  const radarPath = buildRadarShape(selectedMetricValues);
  const linePath = buildLinePath(payload.selected.miniSeries);
  const areaPath = buildAreaPath(payload.selected.miniSeries);
  const candleGeometry = useMemo(() => buildCandleGeometry(payload.selected.candles), [payload.selected.candles]);
  const sectorTotal = payload.sectorPerformance.reduce(
    (total, item) => total + Math.max(Math.abs(item.changePercent), 0.4),
    0,
  );
  const sectorSlices = payload.sectorPerformance.map((item, index) => ({
    ...item,
    color: ["#f08a38", "#d43c33", "#0f9d58", "#6f7ef7", "#f59e0b", "#64748b"][index % 6],
    weight: (Math.max(Math.abs(item.changePercent), 0.4) / sectorTotal) * 100,
  }));

  const { contextSafe } = useGSAP(
    () => {
      const panels = gsap.utils.toArray<HTMLElement>(".market-motion-panel");
      const watchCards = gsap.utils.toArray<HTMLElement>(".market-watch-card");
      const candles = gsap.utils.toArray<SVGGElement>(".market-candle");
      const taskChips = gsap.utils.toArray<HTMLElement>(".market-task-chip");
      const trendArea = gsap.utils.toArray<SVGPathElement>(".market-trend-area")[0];
      const trendLine = gsap.utils.toArray<SVGPathElement>(".market-trend-line")[0];
      const ambientOrb = gsap.utils.toArray<HTMLElement>(".market-ambient-orb")[0];

      if (prefersReducedMotion()) {
        gsap.set([...panels, ...watchCards, ...candles, ...taskChips, trendArea, trendLine, ambientOrb].filter(Boolean), {
          autoAlpha: 1,
          clearProps: "transform,opacity,visibility,strokeDasharray,strokeDashoffset",
        });
        return;
      }

      const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });

      timeline.fromTo(
        panels,
        { autoAlpha: 0, y: 18, scale: 0.985 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.52, stagger: 0.045, clearProps: "transform,opacity,visibility" },
        0,
      );

      timeline.fromTo(
        watchCards,
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.42, stagger: { amount: 0.22, from: "start" }, clearProps: "transform,opacity,visibility" },
        0.08,
      );

      timeline.fromTo(
        candles,
        { autoAlpha: 0, scaleY: 0.08, transformOrigin: "50% 100%" },
        {
          autoAlpha: 1,
          scaleY: 1,
          duration: 0.58,
          stagger: { amount: 0.32, from: "start" },
          ease: "back.out(1.25)",
          clearProps: "transform,opacity,visibility",
        },
        0.22,
      );

      if (trendArea) {
        timeline.fromTo(trendArea, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.68 }, 0.3);
      }

      if (trendLine) {
        const length = trendLine.getTotalLength();
        gsap.set(trendLine, { strokeDasharray: length, strokeDashoffset: length });
        timeline.to(trendLine, { strokeDashoffset: 0, duration: 0.95, ease: "power2.inOut" }, 0.36);
      }

      timeline.fromTo(
        taskChips,
        { autoAlpha: 0, y: 8 },
        { autoAlpha: 1, y: 0, duration: 0.38, stagger: 0.06, clearProps: "transform,opacity,visibility" },
        0.72,
      );

      if (ambientOrb) {
        gsap.to(ambientOrb, {
          autoAlpha: 0.9,
          scale: 1.1,
          duration: 3.2,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          overwrite: "auto",
        });
      }
    },
    { scope: marketBoardRef, dependencies: [payload.selected.symbol, payload.asOf], revertOnUpdate: true },
  );

  const handleMotionEnter = contextSafe((event: PointerEvent<HTMLElement>) => {
    if (prefersReducedMotion()) return;
    gsap.to(event.currentTarget, { y: -3, scale: 1.018, duration: 0.24, ease: "power2.out", overwrite: "auto" });
  });

  const handleMotionLeave = contextSafe((event: PointerEvent<HTMLElement>) => {
    if (prefersReducedMotion()) return;
    gsap.to(event.currentTarget, { y: 0, scale: 1, duration: 0.24, ease: "power2.out", overwrite: "auto" });
  });

  return (
    <div ref={marketBoardRef} className="space-y-6 pb-24">
      <section data-motion-reveal className="market-motion-panel panel rounded-[2rem] p-5 sm:p-6">
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
                className="min-h-10 w-full bg-transparent text-base font-semibold text-slate-950 outline-none placeholder:text-slate-400"
              />
            </label>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {filteredWatchlist.map((item) => {
              const active = item.symbol === selectedSymbol;
              return (
                <button
                  key={item.symbol}
                  type="button"
                  onPointerEnter={handleMotionEnter}
                  onPointerLeave={handleMotionLeave}
                  onClick={() => {
                    const cached = payloadCache[item.symbol];
                    if (cached) setPayload(cached);
                    startTransition(() => setSelectedSymbol(resolveMarketWatchlistSymbol(item.symbol)));
                  }}
                  data-motion-card
                  className={cn(
                    "market-watch-card min-w-0 rounded-[1.5rem] border px-4 py-4 text-left transition-colors duration-200 will-change-transform",
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
                        <p className="break-all text-base font-black leading-6 text-slate-950">{item.name}</p>
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

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.28fr)_minmax(380px,0.72fr)]">
        <div data-motion-card className="market-motion-panel panel rounded-[2rem] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-500">My Watchlist</p>
              <h3 className="mt-3 text-2xl font-black text-slate-950 md:text-3xl">我的自选观察</h3>
              <p className="mt-2 max-w-2xl text-base font-semibold leading-8 text-slate-600">
                先把“为什么值得看”写下来，再观察下一次行情是否验证你的判断。
              </p>
            </div>
            <div className="rounded-full bg-slate-50 px-4 py-2 text-sm font-black text-slate-500">
              已记录 {studentWatchlist?.historyCount ?? 0} 次
            </div>
          </div>

          <div className="mt-5 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              {studentWatchlist?.items.length ? (
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))]">
                  {studentWatchlist.items.map((item, index) => (
                    <article
                      key={item.symbol}
                      data-motion-card
                      data-motion-reveal
                      data-motion-delay={(index * 0.06).toFixed(2)}
                      className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_24px_60px_rgba(15,23,42,0.1)]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
                            style={{ background: `linear-gradient(135deg, ${item.accentColor}, rgba(15,23,42,0.32))` }}
                          >
                            {item.monogram}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-lg font-black text-slate-950">{item.name}</p>
                            <p className="mt-0.5 truncate text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                              {item.symbol} · {item.concept}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={watchlistPending}
                          onClick={() => void updateWatchlist("remove", item.symbol)}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition-colors hover:border-orange-300 hover:text-orange-600 disabled:opacity-50"
                          aria-label={`移除 ${item.name}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-slate-500">
                          {item.riskLabel}
                        </span>
                        <span className={cn("rounded-full px-3 py-1 text-xs font-black", getMarketMoveClasses(item.changePercent).badge)}>
                          {item.changePercent >= 0 ? "+" : ""}
                          {item.changePercent.toFixed(2)}%
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">{item.reason}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-5">
                  <p className="text-lg font-black text-slate-950">还没有自选标的</p>
                  <p className="mt-2 text-base font-semibold leading-8 text-slate-600">
                    从右侧当前选中股票开始，写一句观察理由；这会进入历史复盘，不影响模拟资产。
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {studentWatchlist?.suggested.slice(0, 3).map((item) => (
                      <button
                        key={item.symbol}
                        type="button"
                        onClick={() => {
                          const cached = payloadCache[item.symbol];
                          if (cached) setPayload(cached);
                          startTransition(() => setSelectedSymbol(resolveMarketWatchlistSymbol(item.symbol)));
                          setWatchReason(`${item.name}：${item.concept}值得观察，我想比较它的热度和风险是否同步。`);
                        }}
                        className="rounded-full border border-white bg-white px-4 py-2 text-sm font-black text-slate-600 shadow-sm transition-colors hover:border-orange-300 hover:text-orange-700"
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-[1.5rem] bg-slate-950 p-4 text-white">
              <div className="flex items-center gap-2">
                <BookmarkCheck className="h-4 w-4 text-orange-300" />
                <p className="text-base font-black">记录当前选中</p>
              </div>
              <p className="mt-3 text-sm font-semibold leading-7 text-white/62">
                当前：{payload.selected.name}（{payload.selected.symbol}）
              </p>
              <textarea
                value={watchReason}
                onChange={(event) => setWatchReason(event.target.value)}
                maxLength={120}
                placeholder="写一句观察理由，例如：AI 服务器需求强，但短期涨幅较快，需要比较板块是否共振。"
                className="mt-4 min-h-28 w-full resize-none rounded-[1.25rem] border border-white/10 bg-white/8 p-4 text-sm font-semibold leading-7 text-white outline-none placeholder:text-white/36 focus:border-orange-300/70"
              />
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={watchlistPending}
                  onClick={() => void updateWatchlist(selectedInStudentWatchlist ? "remove" : "add")}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-orange-400 px-4 text-sm font-black text-slate-950 shadow-[0_16px_34px_rgba(240,138,56,0.28)] transition-colors hover:bg-orange-300 disabled:opacity-55"
                >
                  {watchlistPending ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : selectedInStudentWatchlist ? (
                    <X className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {selectedInStudentWatchlist ? "移除自选" : "加入自选"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    dispatchAssistantOpen({
                      prompt: `请帮我把 ${payload.selected.name}（${payload.selected.symbol}）的观察理由改写成适合课堂复盘的一句话。`,
                      autoSend: true,
                    })
                  }
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/12 px-4 text-sm font-black text-white/78 transition-colors hover:bg-white/10"
                >
                  问 AI
                </button>
              </div>
              {watchlistMessage ? (
                <p className="mt-3 rounded-[1rem] bg-white/8 px-3 py-2 text-xs font-bold leading-6 text-white/70">
                  {watchlistMessage}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
          <div data-motion-card className="market-motion-panel panel rounded-[2rem] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-500">Market Heat</p>
                <h3 className="mt-3 text-2xl font-black text-slate-950">市场温度</h3>
              </div>
              <ThermometerSun className="h-8 w-8 text-orange-500" />
            </div>
            <div className="mt-5 rounded-[1.5rem] bg-slate-950 p-5 text-white">
              <div className="flex items-end justify-between gap-4">
                <p className="text-3xl font-black">{studentWatchlist?.temperature.label ?? "读取中"}</p>
                <p className="text-4xl font-black text-orange-300">{studentWatchlist?.temperature.score ?? "--"}</p>
              </div>
              <div className="mt-4 h-3 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-orange-300 to-rose-400"
                  style={{ width: `${studentWatchlist?.temperature.score ?? 0}%` }}
                />
              </div>
              <p className="mt-4 text-sm font-semibold leading-7 text-white/68">
                {studentWatchlist?.temperature.summary ?? "正在根据观察池涨跌分布生成课堂温度提示。"}
              </p>
            </div>
          </div>

          <div data-motion-card className="market-motion-panel panel rounded-[2rem] p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-500">Daily Brief</p>
            <h3 className="mt-3 text-2xl font-black text-slate-950">每日必看</h3>
            <div className="mt-5 rounded-[1.5rem] bg-orange-50 p-5">
              <p className="text-lg font-black text-slate-950">{studentWatchlist?.dailyBrief.title ?? "正在生成今日观察题"}</p>
              <p className="mt-3 text-base font-semibold leading-8 text-slate-600">
                {studentWatchlist?.dailyBrief.summary ?? "系统会从观察池里挑出一个最适合课堂讨论的样本。"}
              </p>
              <p className="mt-4 rounded-[1.25rem] bg-white px-4 py-3 text-sm font-black leading-7 text-orange-700">
                {studentWatchlist?.dailyBrief.question ?? "先选择一只股票加入自选，再写下你的观察理由。"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div data-motion-reveal className="market-motion-panel overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 text-white shadow-[0_28px_90px_rgba(15,23,42,0.14)]">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
            <div className="relative min-w-0 overflow-hidden p-5 sm:p-6 lg:p-7">
              <div className="grid-strokes pointer-events-none absolute inset-0 opacity-20" />
              <div
                className="market-ambient-orb pointer-events-none absolute -left-10 top-8 h-44 w-44 rounded-full blur-3xl"
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
                    onPointerEnter={handleMotionEnter}
                    onPointerLeave={handleMotionLeave}
                    onClick={() =>
                      dispatchAssistantOpen({
                        prompt: `请结合市场信息页，解读 ${payload.selected.name}（${payload.selected.symbol}）当前的价格位置、风险张力和下一步观察重点。`,
                        autoSend: true,
                      })
                    }
                    data-motion-button
                    className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/12 bg-white/10 px-4 text-base font-bold text-white transition-colors hover:bg-white/15 will-change-transform"
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
                      <p className="text-base font-black text-white">日 K 线与趋势速写</p>
                      <p className="mt-1 text-sm font-semibold text-white/50">实体看多空拉扯，影线看情绪波动；用于课堂复盘，不作为真实交易信号。</p>
                    </div>
                    <Activity className="h-5 w-5 text-orange-300" />
                  </div>
                  <svg aria-hidden="true" viewBox={`0 0 ${MINI_CHART_WIDTH} ${MINI_CHART_HEIGHT}`} className="mt-4 h-52 w-full">
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
                    <path className="market-trend-area" d={areaPath} fill="url(#market-board-fill)" />
                    {candleGeometry.map((item) => (
                      <g key={item.key} className="market-candle">
                        <line
                          x1={item.centerX}
                          x2={item.centerX}
                          y1={item.highY}
                          y2={item.lowY}
                          stroke={item.up ? "#f87171" : "#6ee7b7"}
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          opacity="0.9"
                        />
                        <rect
                          x={item.x}
                          y={item.bodyY}
                          width={item.width}
                          height={item.bodyHeight}
                          rx="3"
                          fill={item.up ? "#f87171" : "#6ee7b7"}
                          opacity="0.82"
                        />
                      </g>
                    ))}
                    <path className="market-trend-line" d={linePath} fill="none" stroke="#fff4e9" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="mt-4 grid gap-2 text-xs font-bold text-white/72 sm:grid-cols-3">
                    {["看实体：红涨绿跌", "看影线：识别波动", "写复盘：说出理由"].map((task) => (
                      <span key={task} data-motion-card className="market-task-chip rounded-full border border-white/10 bg-white/10 px-3 py-2 text-center">
                        {task}
                      </span>
                    ))}
                  </div>
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
                  更新时间：{formatDateLabel(new Date(payload.asOf))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside data-motion-card className="market-motion-panel panel rounded-[2rem] p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-500">Snapshot</p>
          <h3 className="mt-3 text-2xl font-black text-slate-950">关键字段</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {payload.selected.facts.map((fact) => (
              <div key={fact.label} className="rounded-[1.5rem] bg-slate-50 px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{fact.label}</p>
                <p className="mt-2 text-lg font-black text-slate-950">{fact.value}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(420px,0.65fr)]">
        <div data-motion-card className="market-motion-panel panel rounded-[2rem] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Radar className="h-5 w-5 text-orange-500" />
              <h3 className="text-2xl font-black text-slate-950">6维教学观察雷达</h3>
            </div>
            <p className="text-sm font-bold text-slate-400">文字说明移到右侧，避免图内拥挤。</p>
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start xl:grid-cols-[260px_minmax(0,1fr)]">
            <div data-motion-viz className="flex items-center justify-center rounded-[2rem] bg-slate-50 p-4">
              <svg aria-hidden="true" viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`} className="h-72 w-full max-w-[300px]">
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
                <path data-motion-viz-path d={radarPath} fill={`${payload.selected.accentColor}2b`} stroke={payload.selected.accentColor} strokeWidth="3" />
                <circle data-motion-viz-point cx={RADAR_CENTER} cy={RADAR_CENTER} r="4" fill={payload.selected.accentColor} />
              </svg>
            </div>
            <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-1">
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

        <div data-motion-card className="market-motion-panel panel rounded-[2rem] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-orange-500" />
            <h3 className="text-2xl font-black text-slate-950">观察池结构拆解</h3>
          </div>
          <div className="mt-6 flex flex-col items-center gap-7">
            <div className="relative flex h-52 w-52 shrink-0 items-center justify-center rounded-full">
              <div className="absolute inset-0 rounded-full shadow-inner" style={{ background: buildDonutGradient(sectorSlices) }} />
              <div className="relative flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white text-center shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
                <span className="text-xs font-bold text-slate-400">AI/科技</span>
                <span className="mt-1 text-2xl font-black text-slate-950">{payload.watchlist.length}</span>
                <span className="text-xs font-bold text-slate-400">观察标的</span>
              </div>
            </div>
            <ul className="w-full space-y-2.5">
              {sectorSlices.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-[1.5rem] bg-slate-50 px-4 py-3"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-black text-slate-950">{item.label}</p>
                    <p className="mt-0.5 truncate text-xs font-semibold text-slate-400">
                      领跑观察：{item.leadSymbol}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "shrink-0 text-sm font-black tabular-nums",
                      getMarketMoveClasses(item.changePercent).text,
                    )}
                  >
                    {item.changePercent >= 0 ? "+" : ""}
                    {item.changePercent.toFixed(2)}%
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2 2xl:grid-cols-4">
        <div data-testid="peer-heat-card" data-motion-card className="market-motion-panel panel rounded-[2rem] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <UsersRound className="h-5 w-5 text-orange-500" />
            <h3 className="text-2xl font-black text-slate-950">同学热度</h3>
          </div>
          <div className="mt-4 rounded-[1.5rem] bg-slate-950 p-4 text-white">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-300">
              {peerHeat.classroomName} · {peerHeat.totalStudents} 人
            </p>
            <p className="mt-3 text-xl font-black leading-7">{peerHeat.headline}</p>
            <p className="mt-3 text-sm font-semibold leading-6 text-white/64">{peerHeat.summary}</p>
          </div>
          <div className="mt-4 space-y-3">
            {peerHeat.items.length > 0 ? (
              peerHeat.items.slice(0, 4).map((item, index) => (
                <div key={`${item.source}-${item.symbol}`} className="rounded-[1.35rem] bg-slate-50 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-black text-slate-950">
                        #{index + 1} {item.name}
                      </p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                        {item.symbol} · {item.source === "holding" ? "模拟持有" : "自选观察"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-black text-orange-700">{item.count}人</p>
                      <p className="text-xs font-black text-slate-400">{item.ratio}%</p>
                    </div>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-400 via-amber-300 to-rose-300"
                      style={{ width: `${Math.max(8, item.ratio)}%` }}
                    />
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">
                    {item.concept} · {item.coachNote}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.35rem] bg-slate-50 px-4 py-5 text-sm font-semibold leading-6 text-slate-500">
                还没有足够的班级持有或自选观察记录。完成一笔模拟持有或加入自选后，这里会出现脱敏聚合热度。
              </div>
            )}
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-[1.25rem] bg-orange-50 px-4 py-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
            <p className="text-xs font-bold leading-5 text-slate-600">
              {peerHeat.privacyNote}
              {peerHeatError ? ` 刷新提示：${peerHeatError}` : ""}
            </p>
          </div>
        </div>

        <div data-motion-card className="market-motion-panel panel rounded-[2rem] p-5 sm:p-6">
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

        <div data-motion-card className="market-motion-panel panel rounded-[2rem] p-5 sm:p-6">
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

        <div data-motion-card className="market-motion-panel panel rounded-[2rem] p-5 sm:p-6">
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
          data-motion-reveal
          className="market-motion-panel overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 text-white shadow-[0_28px_90px_rgba(15,23,42,0.12)]"
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
            <div key={card.id} data-motion-card className="market-motion-panel panel rounded-[2rem] p-5">
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
