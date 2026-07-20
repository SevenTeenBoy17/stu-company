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

import Image from "next/image";

import { Disclosure } from "@/components/shared/disclosure";
import { dispatchAssistantOpen } from "@/lib/assistant-config";
import { MARKET_REFRESH_INTERVAL_MS } from "@/lib/market-refresh";
import type { PeerHeatPayload } from "@/lib/peer-heat";
import type { StudentWatchlistPayload } from "@/lib/student-watchlist";
import type {
  MarketBoardMetric,
  MarketBoardPayload,
  MarketBoardSector,
  MarketBoardStock,
  MarketCategoryId,
  MarketKlineCandle,
} from "@/lib/types";
import { cn, getMarketMoveClasses } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

const MINI_CHART_WIDTH = 720;
const MINI_CHART_HEIGHT = 220;
const RADAR_SIZE = 260;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = 92;

type MarketWatchItem = MarketBoardPayload["watchlist"][number];

type MarketThemeFilter = {
  id: string;
  label: string;
  count: number;
  leadSymbol: string;
  accentColor: string;
  iconUrl?: string;
  description: string;
};

const MARKET_THEME_DESCRIPTIONS: Record<string, string> = {
  全部: "查看当前市场分类下的全部观察标的。",
  科技: "AI、芯片、软件与平台型公司的主线观察。",
  云软件: "企业软件、云服务与数据基础设施。",
  AI平台: "广告、搜索、社交与 AI 应用平台。",
  消费: "消费、零售与日常需求相关样本。",
  新能源: "新能源车、电池与制造链条。",
  金融: "银行、保险与交易所等金融基础设施。",
  红利: "现金流、分红与防御型资产。",
  医药: "创新药、医疗服务与研发周期。",
  宽基: "覆盖范围更广的一篮子指数工具。",
  海外科技: "海外科技与全球资产配置样本。",
  汽车机器人: "电动车、自动驾驶与机器人叙事。",
  基础设施: "通信、网络与算力基础设施。",
  智能硬件: "手机、IoT 与消费电子创新。",
};

function marketThemeLabel(category: MarketCategoryId, item: MarketWatchItem) {
  const sectorGroup = item.sectorGroup ?? "";
  const sector = item.sector ?? "";
  const tags = item.tags?.join(" ") ?? "";
  const text = `${sectorGroup} ${sector} ${tags}`;

  if (text.includes("医药") || text.includes("医疗") || text.includes("创新药")) return "医药";
  if (category === "fund") {
    if (text.includes("海外")) return "海外科技";
    if (text.includes("科技") || text.includes("科创") || text.includes("创业")) return "科技";
    return "宽基";
  }
  if (text.includes("半导体") || text.includes("芯片") || text.includes("硬科技")) return "科技";
  if (text.includes("云") || text.includes("软件") || text.includes("数据库")) return "云软件";
  if (text.includes("AI平台") || text.includes("搜索") || text.includes("社交")) return "AI平台";
  if (text.includes("新能源") || text.includes("电池")) return "新能源";
  if (text.includes("汽车") || text.includes("机器人")) return "汽车机器人";
  if (text.includes("消费电子") || text.includes("智造")) return "智能硬件";
  if (text.includes("电商") || text.includes("白酒") || text.includes("消费")) return "消费";
  if (text.includes("通信") || text.includes("基础设施")) return "基础设施";
  if (text.includes("银行") || text.includes("保险") || text.includes("金融") || text.includes("交易所")) return "金融";
  if (text.includes("红利") || text.includes("公用")) return "红利";
  return sectorGroup || sector || "全部";
}

function buildThemeFilters(category: MarketCategoryId, items: MarketWatchItem[]): MarketThemeFilter[] {
  const buckets = new Map<string, MarketThemeFilter>();

  for (const item of items) {
    const label = marketThemeLabel(category, item);
    const existing = buckets.get(label);
    if (existing) {
      existing.count += 1;
      continue;
    }

    buckets.set(label, {
      id: label,
      label,
      count: 1,
      leadSymbol: item.symbol,
      accentColor: item.accentColor,
      iconUrl: item.imageUrl,
      description: MARKET_THEME_DESCRIPTIONS[label] ?? `${item.sectorGroup ?? item.sector ?? "板块"}方向的观察样本。`,
    });
  }

  return [
    {
      id: "all",
      label: "全部",
      count: items.length,
      leadSymbol: items[0]?.symbol ?? "--",
      accentColor: "#f08a38",
      iconUrl: items[0]?.imageUrl,
      description: MARKET_THEME_DESCRIPTIONS["全部"],
    },
    ...Array.from(buckets.values()).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "zh-CN")),
  ];
}

function formatPrice(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: value >= 100 ? 2 : 3,
    maximumFractionDigits: value >= 100 ? 2 : 3,
  });
}

function formatSignedPercent(value: number) {
  if (value > 0) return `上涨 ${value.toFixed(2)}%`;
  if (value < 0) return `下跌 ${Math.abs(value).toFixed(2)}%`;
  return "持平 0.00%";
}

export function buildMarketKlineSummary(
  stock: Pick<MarketBoardStock, "name" | "symbol" | "currentPrice" | "changePercent" | "miniSeries" | "candles">,
) {
  const firstPoint = stock.miniSeries[0] ?? stock.currentPrice;
  const lastPoint = stock.miniSeries.at(-1) ?? stock.currentPrice;
  const rangeChange = firstPoint === 0 ? 0 : ((lastPoint - firstPoint) / firstPoint) * 100;
  const recentCandles = stock.candles.slice(-6);
  const risingCandles = recentCandles.filter((item) => item.close >= item.open).length;
  const trendLabel = rangeChange > 0.6 ? "整体上行" : rangeChange < -0.6 ? "整体回落" : "窄幅整理";

  return `${stock.name}（${stock.symbol}）当前价格 ${formatPrice(stock.currentPrice)}，日内${formatSignedPercent(stock.changePercent)}。近 ${stock.miniSeries.length} 个趋势点呈现${trendLabel}，区间约${formatSignedPercent(rangeChange)}；最近 ${recentCandles.length} 根K线中 ${risingCandles} 根收涨。该图用于课堂复盘，不代表真实交易信号。`;
}

export function buildMarketRadarSummary(stockName: string, metrics: MarketBoardMetric[]) {
  if (metrics.length === 0) return `${stockName} 暂无可比较的教学观察维度。`;

  const sorted = [...metrics].sort((a, b) => b.score - a.score);
  const strongest = sorted[0];
  const weakest = sorted.at(-1) ?? strongest;

  return `${stockName} 的 6 维观察里，最强项是${strongest.label}（${strongest.score}），需要重点复核的是${weakest.label}（${weakest.score}）。阅读雷达图时先比较强弱项，再结合右侧说明写出证据。`;
}

export function buildMarketSectorSummary(sectors: MarketBoardSector[]) {
  if (sectors.length === 0) return "观察池暂时没有可汇总的板块结构。";

  const sorted = [...sectors].sort((a, b) => b.changePercent - a.changePercent);
  const strongest = sorted[0];
  const weakest = sorted.at(-1) ?? strongest;

  return `观察池覆盖 ${sectors.length} 个板块；当前最强的是${strongest.label}，${formatSignedPercent(strongest.changePercent)}，代表标的是 ${strongest.leadSymbol}；最弱的是${weakest.label}，${formatSignedPercent(weakest.changePercent)}，适合作为风险对照。`;
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

/**
 * UI v2 信息收敛：长文案默认折成一行（line-clamp-1），点击展开全文。
 * 原生 button + aria-expanded，键盘可达；文字样式由调用方传入以适配深浅底。
 */
function ExpandableText({
  text,
  className,
  textClassName,
}: {
  text: string;
  className?: string;
  textClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => setOpen((value) => !value)}
      className={cn("block w-full text-left", className)}
    >
      <span className={cn("block", textClassName, !open && "line-clamp-1")}>{text}</span>
    </button>
  );
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
  const themeControlRef = useRef<HTMLButtonElement>(null);
  const [payload, setPayload] = useState(initialPayload);
  const [payloadCache, setPayloadCache] = useState<Record<string, MarketBoardPayload>>({
    [`${initialPayload.category}:${initialPayload.selected.symbol}`]: initialPayload,
  });
  const [category, setCategory] = useState<MarketCategoryId>(initialPayload.category);
  const [selectedSymbol, setSelectedSymbol] = useState<string>(initialPayload.selected.symbol);
  const [search, setSearch] = useState("");
  const [activeTheme, setActiveTheme] = useState("all");
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentWatchlist, setStudentWatchlist] = useState<StudentWatchlistPayload | null>(initialWatchlistPayload);
  const [peerHeat, setPeerHeat] = useState<PeerHeatPayload>(initialPeerHeatPayload);
  const [peerHeatError, setPeerHeatError] = useState<string | null>(null);
  const [watchReason, setWatchReason] = useState("");
  const [watchlistPending, setWatchlistPending] = useState(false);
  const [watchlistMessage, setWatchlistMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [moreNotesOpen, setMoreNotesOpen] = useState(false);
  const deferredSearch = useDeferredValue(search);

  // 自选观察 / 同伴热度是美股沙盘专属能力（与 12 轮经济沙盘的美股观察池绑定）。
  const isUsCategory = category === "us";
  // 切分类/标的后、新数据到达前，当前 payload 仍是旧分类的数据 → 用于过渡态降透明 + aria-busy。
  const boardLoading = isPending || payload.category !== category;

  // itest7 P3：请求时序令牌。快速切换分类/标的时多个 board 请求并发，若较早发出的慢响应晚于
  // 较新的返回，会覆盖已到达的新数据 → payload.category 卡在旧值、boardLoading 恒 true（骨架卡住）。
  // 只有「最新」一次请求才允许写入可见 payload / error；缓存按响应自身 key 写入可无条件保留。
  const loadBoardSeq = useRef(0);
  const loadBoard = useCallback(async (cat: MarketCategoryId, symbol: string) => {
    const seq = ++loadBoardSeq.current;
    try {
      const response = await fetch(
        `/api/market/board?category=${cat}&symbol=${encodeURIComponent(symbol)}`,
        { cache: "no-store" },
      );
      const nextPayload = (await response.json()) as MarketBoardPayload & { error?: string };

      if (!response.ok || nextPayload.error) {
        throw new Error("市场信息刷新失败，请稍后重试。");
      }

      // 缓存写入用响应自身的 (category:symbol) key，不会串味，可保留。
      setPayloadCache((current) => ({
        ...current,
        [`${nextPayload.category}:${nextPayload.selected.symbol}`]: nextPayload,
      }));
      if (seq !== loadBoardSeq.current) return; // 已有更新请求发出，丢弃这次陈旧响应
      setPayload(nextPayload);
      setError(null);
    } catch (nextError) {
      if (seq !== loadBoardSeq.current) return;
      setError(nextError instanceof Error ? nextError.message : "市场信息刷新失败。");
    }
  }, []);

  const loadStudentWatchlist = useCallback(async (symbol: string) => {
    try {
      const response = await fetch(`/api/student/watchlist?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" });
      const nextPayload = (await response.json()) as { payload?: StudentWatchlistPayload; error?: string; message?: string };
      if (!response.ok || !nextPayload.payload) {
        throw new Error(nextPayload.message ?? "自选观察刷新失败，请稍后重试。");
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
        throw new Error(nextPayload.message ?? "同学热度刷新失败，请稍后重试。");
      }
      setPeerHeat(nextPayload.payload);
      setPeerHeatError(null);
    } catch (nextError) {
      setPeerHeatError(nextError instanceof Error ? nextError.message : "同学热度刷新失败。");
    }
  }, []);

  async function updateWatchlist(action: "add" | "remove", symbol: string = selectedSymbol) {
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
        throw new Error(nextPayload.message ?? "自选观察更新失败，请稍后重试。");
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

  // 切到某个分类标的：先用本地缓存秒切（若有），再由 effect 拉取真实日线。
  const selectSymbol = useCallback(
    (symbol: string) => {
      const cached = payloadCache[`${category}:${symbol}`];
      if (cached) setPayload(cached);
      startTransition(() => setSelectedSymbol(symbol));
    },
    [category, payloadCache, startTransition],
  );

  // 切分类：用 Tab 自带 defaultSymbol，一次取数无需先探测。
  const selectCategory = useCallback(
    (tab: { id: MarketCategoryId; defaultSymbol: string }) => {
      if (tab.id === category && selectedSymbol === tab.defaultSymbol) return;
      setSearch("");
      setActiveTheme("all");
      setThemeMenuOpen(false);
      // 切分类时清掉上一分类残留的自选/同伴热度报错，避免在非美股分类误显。
      setWatchlistMessage(null);
      setPeerHeatError(null);
      const cached = payloadCache[`${tab.id}:${tab.defaultSymbol}`];
      if (cached) setPayload(cached);
      setCategory(tab.id);
      startTransition(() => setSelectedSymbol(tab.defaultSymbol));
    },
    [category, selectedSymbol, payloadCache, startTransition],
  );

  useEffect(() => {
    void loadBoard(category, selectedSymbol);
  }, [category, selectedSymbol, loadBoard]);

  useEffect(() => {
    if (isUsCategory) void loadStudentWatchlist(selectedSymbol);
  }, [isUsCategory, loadStudentWatchlist, selectedSymbol]);

  useEffect(() => {
    void loadPeerHeat();
  }, [loadPeerHeat]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadBoard(category, selectedSymbol);
      void loadPeerHeat();
    }, MARKET_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadBoard, loadPeerHeat, category, selectedSymbol]);

  const themeFilters = useMemo(() => buildThemeFilters(payload.category, payload.watchlist), [payload.category, payload.watchlist]);
  const activeThemeFilter = useMemo(
    () => themeFilters.find((filter) => filter.id === activeTheme) ?? themeFilters[0],
    [activeTheme, themeFilters],
  );

  useEffect(() => {
    if (!themeFilters.some((filter) => filter.id === activeTheme)) setActiveTheme("all");
  }, [activeTheme, themeFilters]);

  const filteredWatchlist = useMemo(() => {
    const keyword = deferredSearch.trim().toLowerCase();
    const byTheme = activeTheme === "all"
      ? payload.watchlist
      : payload.watchlist.filter((item) => marketThemeLabel(payload.category, item) === activeTheme);
    if (!keyword) return byTheme;
    return byTheme.filter((item) =>
      `${item.symbol} ${item.name} ${item.companyName} ${item.sector ?? ""} ${item.sectorGroup ?? ""} ${(item.tags ?? []).join(" ")}`.toLowerCase().includes(keyword),
    );
  }, [activeTheme, deferredSearch, payload.category, payload.watchlist]);

  const selectedMetricValues = useMemo(
    () => payload.selected.metrics.map((item) => item.score),
    [payload.selected.metrics],
  );
  const selectedInStudentWatchlist = studentWatchlist?.items.some((item) => item.symbol === selectedSymbol) ?? false;
  const radarPath = useMemo(() => buildRadarShape(selectedMetricValues), [selectedMetricValues]);
  const linePath = useMemo(() => buildLinePath(payload.selected.miniSeries), [payload.selected.miniSeries]);
  const areaPath = useMemo(() => buildAreaPath(payload.selected.miniSeries), [payload.selected.miniSeries]);
  const candleGeometry = useMemo(() => buildCandleGeometry(payload.selected.candles), [payload.selected.candles]);
  const klineSummary = useMemo(() => buildMarketKlineSummary(payload.selected), [payload.selected]);
  const radarSummary = useMemo(
    () => buildMarketRadarSummary(payload.selected.name, payload.selected.metrics),
    [payload.selected.metrics, payload.selected.name],
  );
  const sectorTotal = useMemo(
    () => payload.sectorPerformance.reduce((total, item) => total + Math.max(Math.abs(item.changePercent), 0.4), 0),
    [payload.sectorPerformance],
  );
  const sectorSummary = useMemo(() => buildMarketSectorSummary(payload.sectorPerformance), [payload.sectorPerformance]);
  const sectorSlices = useMemo(
    () =>
      payload.sectorPerformance.map((item, index) => ({
        ...item,
        color: ["#f08a38", "#d43c33", "#0f9d58", "#6f7ef7", "#f59e0b", "#64748b"][index % 6],
        weight: (Math.max(Math.abs(item.changePercent), 0.4) / sectorTotal) * 100,
      })),
    [payload.sectorPerformance, sectorTotal],
  );

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
        <div className="mb-5">
          <div role="group" aria-label="选择市场分类" className="flex flex-wrap items-center gap-2">
            <span className="bz-eyebrow mr-1 self-center">Markets</span>
            {payload.categories.map((tab) => {
              const activeTab = tab.id === category;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onPointerEnter={handleMotionEnter}
                  onPointerLeave={handleMotionLeave}
                  onClick={() => selectCategory(tab)}
                  aria-pressed={activeTab}
                  data-testid="market-category-tab"
                  data-market-category={tab.id}
                  data-motion-button
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-body-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500",
                    activeTab
                      ? "border-orange-400 bg-orange-100 text-orange-900 shadow-[0_12px_30px_rgba(240,138,56,0.22)]"
                      : "border-slate-200 bg-white text-fg-muted hover:border-orange-300 hover:text-orange-700",
                  )}
                >
                  {tab.label}
                  <span className={cn("text-caption font-semibold", activeTab ? "text-orange-800" : "text-fg-muted")}>
                    {tab.en}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-body-sm text-fg-muted">
            {payload.categories.find((tab) => tab.id === category)?.blurb}
            {isUsCategory ? "" : " · 真实日线收盘数据；自选记录与同伴热度仅美股开放。"}
          </p>
        </div>
        <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <div>
            <p className="bz-eyebrow">Market Radar</p>
            <h2 className="mt-3 text-h1 text-fg-strong">市场信息</h2>
            <p className="mt-3 text-body-lg text-fg-default">
              这里是只读观察台，先看主线，再看结构，最后再去问 AI。
            </p>
            <label className="mt-5 flex min-h-12 items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4">
              <Search className="h-4 w-4 text-fg-muted" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="搜索股票或代码"
                placeholder="搜索股票或代码"
                className="min-h-10 w-full bg-transparent text-body text-fg-default outline-none placeholder:text-fg-muted"
              />
            </label>
          </div>

          <div className="min-w-0 space-y-4">
            <div
              className="relative"
              data-testid="market-theme-filters"
              data-active-category={payload.category}
              onKeyDown={(event) => {
                // itest5 R3 P3：Esc 关闭板块下拉并把焦点还给触发按钮（与定投下拉同口径）。
                if (event.key === "Escape" && themeMenuOpen) {
                  setThemeMenuOpen(false);
                  themeControlRef.current?.focus();
                }
              }}
              onBlur={(event) => {
                // 焦点移出整个下拉区域即关闭（点/Tab 到别处）。
                if (themeMenuOpen && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setThemeMenuOpen(false);
                }
              }}
            >
              <button
                ref={themeControlRef}
                type="button"
                onPointerEnter={handleMotionEnter}
                onPointerLeave={handleMotionLeave}
                onClick={() => setThemeMenuOpen((open) => !open)}
                aria-expanded={themeMenuOpen}
                aria-controls="market-theme-menu"
                data-testid="market-theme-control"
                data-motion-button
                className="flex min-h-16 w-full items-center justify-between gap-4 rounded-[1.5rem] border border-slate-200 bg-white px-4 py-3 text-left shadow-[0_18px_54px_rgba(15,23,42,0.06)] transition-colors hover:border-orange-300 hover:bg-orange-50/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[1rem] border border-white bg-slate-950 shadow-[0_12px_28px_rgba(15,23,42,0.16)]">
                    {activeThemeFilter?.iconUrl ? (
                      <Image
                        src={activeThemeFilter.iconUrl}
                        alt={`${activeThemeFilter.label}板块图案`}
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-h3 text-fg-strong">全部</span>
                    <span className="mt-1 block text-body-sm font-semibold leading-5 text-fg-muted">
                      当前：{activeThemeFilter?.label ?? "全部"} · {activeThemeFilter?.count ?? payload.watchlist.length} 个样本
                    </span>
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-slate-950 px-4 py-2 text-caption font-bold text-white">
                  {themeMenuOpen ? "收起" : "展开板块"}
                </span>
              </button>

              {themeMenuOpen ? (
                <div
                  id="market-theme-menu"
                  role="menu"
                  aria-label="市场板块分类"
                  className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-30 grid gap-3 rounded-[1.75rem] border border-slate-200 bg-white/95 p-3 shadow-[0_30px_90px_rgba(15,23,42,0.18)] backdrop-blur-xl [grid-template-columns:repeat(auto-fit,minmax(8.75rem,1fr))]"
                  data-testid="market-theme-menu"
                >
                  {themeFilters.map((filter) => {
                    const active = filter.id === activeTheme;
                    return (
                      <button
                        key={filter.id}
                        type="button"
                        role="menuitemradio"
                        onPointerEnter={handleMotionEnter}
                        onPointerLeave={handleMotionLeave}
                        onClick={() => {
                          setActiveTheme(filter.id);
                          setThemeMenuOpen(false);
                          const nextItems = filter.id === "all"
                            ? payload.watchlist
                            : payload.watchlist.filter((item) => marketThemeLabel(payload.category, item) === filter.id);
                          const firstItem = nextItems[0];
                          if (firstItem && firstItem.symbol !== selectedSymbol) selectSymbol(firstItem.symbol);
                        }}
                        aria-checked={active}
                        data-testid="market-theme-button"
                        data-theme-label={filter.label}
                        title={filter.description}
                        data-motion-button
                        className={cn(
                          "group min-w-0 rounded-[1.35rem] border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500",
                          active
                            ? "border-orange-400 bg-slate-950 text-white shadow-[0_18px_42px_rgba(15,23,42,0.16)]"
                            : "border-slate-200 bg-white text-fg-default hover:border-orange-300 hover:bg-orange-50/60",
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[1rem] border border-white/50 bg-slate-900 shadow-[0_12px_28px_rgba(15,23,42,0.16)]">
                            {filter.iconUrl ? (
                              <Image
                                src={filter.iconUrl}
                                alt={`${filter.label}板块图案`}
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <p className={cn("truncate text-body font-bold", active ? "text-white" : "text-fg-strong")}>
                              {filter.label}
                            </p>
                            <p className={cn("mt-0.5 text-caption font-semibold", active ? "text-white/65" : "text-fg-muted")}>
                              {filter.count} 个样本 · {filter.leadSymbol}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {filteredWatchlist.length > 0 ? (
              <div
                aria-busy={boardLoading}
                className={cn(
                  "grid min-w-0 gap-3 md:grid-cols-2 2xl:grid-cols-3 transition-opacity",
                  boardLoading && "opacity-60",
                )}
                data-testid="market-watch-card-grid"
              >
                {filteredWatchlist.map((item) => {
                  const active = item.symbol === selectedSymbol;
                  return (
                    <button
                      key={item.symbol}
                      type="button"
                      aria-pressed={active}
                      onPointerEnter={handleMotionEnter}
                      onPointerLeave={handleMotionLeave}
                      onClick={() => selectSymbol(item.symbol)}
                      data-motion-card
                      data-testid="market-watch-card"
                      className={cn(
                        "market-watch-card min-w-0 rounded-[1.55rem] border px-4 py-3.5 text-left transition-colors duration-200",
                        active
                          ? "border-orange-400 bg-orange-50 shadow-[0_18px_44px_rgba(240,138,56,0.16)]"
                          : "border-slate-200 bg-white hover:border-orange-300 hover:bg-slate-50",
                      )}
                    >
                      <div className="grid min-w-0 grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3">
                        <div
                          className="relative h-13 w-13 shrink-0 overflow-hidden rounded-[1.15rem] border border-white bg-slate-950 shadow-[0_12px_28px_rgba(15,23,42,0.18)]"
                          style={{
                            boxShadow: active
                              ? `0 18px 34px ${item.accentColor}30`
                              : "0 12px 28px rgba(15,23,42,0.18)",
                          }}
                        >
                          {item.imageUrl ? (
                            <Image
                              src={item.imageUrl}
                              alt={`${item.name}相关图案`}
                              fill
                              sizes="52px"
                              className="object-cover"
                            />
                          ) : (
                            <span
                              className="flex h-full w-full items-center justify-center text-caption font-bold text-white"
                              style={{ background: `linear-gradient(135deg, ${item.accentColor} 0%, rgba(255,255,255,0.16) 115%)` }}
                            >
                              {item.monogram}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-body-lg font-bold leading-6 text-fg-strong" data-market-card-name>
                            {item.name}
                          </p>
                          <p className="mt-1 truncate text-caption font-semibold uppercase tracking-[0.08em] text-fg-muted">
                            {item.symbol} · {item.sectorGroup ?? item.sector ?? "观察池"}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-body font-bold tabular-nums text-fg-strong">{formatPrice(item.currentPrice)}</p>
                          <p className={cn("mt-1 text-caption font-bold tabular-nums", getMarketMoveClasses(item.changePercent).text)}>
                            {item.changePercent >= 0 ? "+" : ""}
                            {item.changePercent.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-body text-fg-muted">
                没有匹配“{search || activeTheme}”的股票/基金，换个关键词、代码或板块试试。
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.28fr)_minmax(380px,0.72fr)]">
        <div data-motion-card className="market-motion-panel panel rounded-[2rem] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="bz-eyebrow">My Watchlist</p>
              <h3 className="mt-3 text-h2 text-fg-strong">我的自选观察</h3>
              <p className="mt-2 max-w-2xl text-body text-fg-muted">
                先把“为什么值得看”写下来，再观察下一次行情是否验证你的判断。
              </p>
            </div>
            <div className="rounded-full bg-slate-50 px-4 py-2 text-body-sm font-semibold tabular-nums text-fg-muted">
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
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-caption font-bold text-white"
                            style={{ background: `linear-gradient(135deg, ${item.accentColor}, rgba(15,23,42,0.32))` }}
                          >
                            {item.monogram}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-h3 text-fg-strong">{item.name}</p>
                            <p className="mt-0.5 truncate text-caption uppercase tracking-[0.14em] text-fg-muted">
                              {item.symbol} · {item.concept}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={watchlistPending}
                          onClick={() => void updateWatchlist("remove", item.symbol)}
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-fg-muted transition-colors hover:border-orange-300 hover:text-orange-600 disabled:opacity-50"
                          aria-label={`移除 ${item.name}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-50 px-3 py-1 text-caption font-semibold text-fg-muted">
                          {item.riskLabel}
                        </span>
                        <span className={cn("rounded-full px-3 py-1 text-caption font-semibold tabular-nums", getMarketMoveClasses(item.changePercent).badge)}>
                          {item.changePercent >= 0 ? "+" : ""}
                          {item.changePercent.toFixed(2)}%
                        </span>
                      </div>
                      <ExpandableText text={item.reason} className="mt-3" textClassName="text-body-sm text-fg-muted" />
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-5">
                  <p className="text-h3 text-fg-strong">还没有自选标的</p>
                  <p className="mt-2 text-body text-fg-muted">
                    从右侧当前选中股票开始，写一句观察理由。
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {studentWatchlist?.suggested.slice(0, 3).map((item) => (
                      <button
                        key={item.symbol}
                        type="button"
                        onClick={() => {
                          selectSymbol(item.symbol);
                          setWatchReason(`${item.name}：${item.concept}值得观察，我想比较它的热度和风险是否同步。`);
                        }}
                        className="rounded-full border border-white bg-white px-4 py-2 text-body-sm font-semibold text-fg-muted shadow-sm transition-colors hover:border-orange-300 hover:text-orange-700"
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
                <BookmarkCheck className="h-4 w-4 text-brand-warm" />
                <p className="text-h3 text-white">记录当前选中</p>
              </div>
              <p className="mt-3 text-body-sm leading-7 text-white/70">
                当前：{payload.selected.name}（{payload.selected.symbol}）
                {isUsCategory ? "" : " · 自选记录仅美股开放，切到「美股」即可保存观察理由。"}
              </p>
              <textarea
                value={watchReason}
                onChange={(event) => setWatchReason(event.target.value)}
                maxLength={120}
                aria-label="观察理由"
                placeholder="写一句观察理由，例如：AI 服务器需求强，但短期涨幅较快，需要比较板块是否共振。"
                className="mt-4 min-h-28 w-full resize-none rounded-[1.25rem] border border-white/10 bg-white/8 p-4 text-body-sm leading-7 text-white outline-none placeholder:text-white/70 focus:border-orange-300/70"
              />
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={watchlistPending || !isUsCategory}
                  aria-label={isUsCategory ? undefined : "自选观察仅在美股分类开放"}
                  onClick={() => {
                    if (!isUsCategory) return;
                    void updateWatchlist(selectedInStudentWatchlist ? "remove" : "add");
                  }}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-brand px-4 text-body-sm font-semibold text-fg-default shadow-[0_16px_34px_rgba(240,138,56,0.28)] transition-colors hover:bg-brand-hover disabled:opacity-55"
                >
                  {watchlistPending ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : selectedInStudentWatchlist ? (
                    <X className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {!isUsCategory ? "仅美股支持" : selectedInStudentWatchlist ? "移除自选" : "加入自选"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    dispatchAssistantOpen({
                      prompt: `请帮我把 ${payload.selected.name}（${payload.selected.symbol}）的观察理由改写成适合课堂复盘的一句话。`,
                      autoSend: true,
                    })
                  }
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-4 text-body-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  问 AI
                </button>
              </div>
              {watchlistMessage ? (
                <p className="mt-3 rounded-[1rem] bg-white/8 px-3 py-2 text-caption leading-6 text-white/70">
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
                <p className="bz-eyebrow">Market Heat</p>
                <h3 className="mt-3 text-h2 text-fg-strong">市场温度</h3>
              </div>
              <ThermometerSun className="h-8 w-8 text-brand" />
            </div>
            <div className="mt-5 rounded-[1.5rem] bg-slate-950 p-5 text-white">
              <div className="flex items-end justify-between gap-4">
                <p className="text-h2 text-white">{studentWatchlist?.temperature.label ?? "读取中"}</p>
                <span className="bz-hero-stat">
                  <span className="bz-eyebrow bz-brand-text-on-light">今日温度</span>
                  <span className="text-hero-num tabular-nums bz-brand-text-on-light">
                    {studentWatchlist?.temperature.score ?? "--"}
                  </span>
                </span>
              </div>
              <div className="mt-4 h-3 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-orange-300 to-rose-400"
                  style={{ width: `${studentWatchlist?.temperature.score ?? 0}%` }}
                />
              </div>
              <p className="mt-4 text-body-sm leading-7 text-white/70">
                {studentWatchlist?.temperature.summary ?? "正在根据观察池涨跌分布生成课堂温度提示。"}
              </p>
            </div>
          </div>

          <div data-motion-card className="market-motion-panel panel rounded-[2rem] p-5 sm:p-6">
            <p className="bz-eyebrow">Daily Brief</p>
            <h3 className="mt-3 text-h2 text-fg-strong">每日必看</h3>
            <div className="mt-5 rounded-[1.5rem] bg-orange-50 p-5">
              <p className="text-h3 text-fg-strong">{studentWatchlist?.dailyBrief.title ?? "正在生成今日观察题"}</p>
              <p className="mt-3 text-body text-fg-muted">
                {studentWatchlist?.dailyBrief.summary ?? "系统会从观察池里挑出一个最适合课堂讨论的样本。"}
              </p>
              <p className="mt-4 rounded-[1.25rem] bg-white px-4 py-3 text-body-sm font-semibold leading-7 text-orange-700">
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
                {payload.selected.imageUrl ? (
                  <div className="relative mb-5 h-32 w-full overflow-hidden rounded-[1.5rem] border border-white/10 sm:h-40">
                    <Image
                      src={payload.selected.imageUrl}
                      alt={`${payload.selected.sectorGroup}行业示意图`}
                      fill
                      sizes="(max-width: 640px) calc(100vw - 2.5rem), (max-width: 1280px) calc(100vw - 3.5rem), 680px"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/15 to-transparent" />
                    {payload.selected.symbolImageUrl ? (
                      <div
                        className="absolute left-4 top-4 h-16 w-16 overflow-hidden rounded-[1.25rem] border border-white/25 bg-slate-950 shadow-[0_18px_42px_rgba(15,23,42,0.35)]"
                        data-testid="market-selected-symbol-icon"
                      >
                        <Image
                          src={payload.selected.symbolImageUrl}
                          alt={`${payload.selected.name}标的徽章`}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      </div>
                    ) : null}
                    <span className="absolute bottom-3 left-4 rounded-full border border-white/15 bg-slate-950/55 px-3 py-1 text-caption font-semibold text-white/85 backdrop-blur">
                      {payload.selected.sectorGroup} · 标的识别
                    </span>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="bz-eyebrow-inverse">AI / Tech Watchlist</p>
                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      <h2 className="text-display-lg leading-tight text-white">{payload.selected.name}</h2>
                      <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1 text-caption font-semibold text-white/80">
                        {payload.selected.symbol}
                      </span>
                    </div>
                    <p className="mt-3 max-w-2xl text-body-lg leading-8 text-white/80">{payload.selected.summary}</p>
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
                    className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/12 bg-white/10 px-4 text-body font-semibold text-white transition-colors hover:bg-white/15"
                  >
                    <Bot className="h-4 w-4" />
                    让 AI 解读
                  </button>
                </div>

                <div className="mt-7 flex flex-wrap items-end gap-4">
                  <p className="text-display-lg font-bold tracking-tight tabular-nums text-white sm:text-display-xl">
                    {formatPrice(payload.selected.currentPrice)}
                  </p>
                  <p className={cn("rounded-full px-3 py-1.5 text-body font-semibold tabular-nums", getMarketMoveClasses(payload.selected.changePercent).darkBadge)}>
                    {payload.selected.changePercent >= 0 ? "+" : ""}
                    {payload.selected.changePercent.toFixed(2)}%
                  </p>
                  <p className="text-body-sm text-white/70">{payload.selected.companyName}</p>
                  {/* itest5 R3 P2：此前只有 tsanghi 真日线才显示新鲜度徽章，fallback 兜底价
                      （硬编码/合成走势）反而无任何标识，学生分不清真假。改为始终显示来源徽章，
                      兜底数据明确标「教学示意 · 非真实行情」。 */}
                  <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-caption font-semibold text-white/75">
                    {payload.selected.source === "tsanghi" ? "日线收盘 · 非实时" : "教学示意 · 非真实行情"}
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {payload.selected.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-caption font-semibold text-white/80">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-7 rounded-[2rem] border border-white/10 bg-white/[0.05] p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-h3 text-white">日 K 线与趋势速写</p>
                      {payload.category !== "us" ? (
                        <p className="mt-1 text-body-sm text-white/70">沿用 A 股红涨绿跌配色，与美股相反。</p>
                      ) : null}
                    </div>
                    <Activity className="h-5 w-5 text-brand-warm" />
                  </div>
                  <svg
                    role="img"
                    aria-label={`${payload.selected.name}（${payload.selected.symbol}）日 K 线速写：当前价格 ${formatPrice(payload.selected.currentPrice)}，日内变化 ${payload.selected.changePercent >= 0 ? "+" : ""}${payload.selected.changePercent.toFixed(2)}%。`}
                    viewBox={`0 0 ${MINI_CHART_WIDTH} ${MINI_CHART_HEIGHT}`}
                    className="mt-4 h-52 w-full"
                  >
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
                  <Disclosure
                    summary="图表解读"
                    className="mt-3 rounded-[1.25rem] border border-white/10 bg-white/[0.08] px-4 py-1"
                    summaryClassName="text-white/85 hover:text-white"
                    panelClassName="text-white/75"
                  >
                    <p data-testid="market-kline-summary" className="text-body-sm leading-6">
                      {klineSummary}
                    </p>
                  </Disclosure>
                  <div className="mt-4 flex flex-wrap gap-2 text-caption font-semibold text-white/80">
                    {["看实体：红涨绿跌", "看影线：识别波动", "写复盘：说出理由"].map((task) => (
                      <span
                        key={task}
                        data-motion-card
                        className="market-task-chip inline-flex min-h-9 min-w-32 flex-1 items-center justify-center whitespace-nowrap rounded-full border border-white/10 bg-white/10 px-3 py-2 text-center"
                      >
                        {task}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid content-start gap-4 bg-white p-5 text-fg-strong sm:p-6 lg:p-7">
              <div className="rounded-[1.5rem] bg-slate-50 p-5">
                <p className="text-body-sm font-semibold text-fg-muted">教学综合评分</p>
                <div className="mt-4 flex items-end justify-between gap-4">
                  <p className="text-display-lg font-bold tracking-tight tabular-nums text-fg-strong">{payload.selected.score.toFixed(2)}</p>
                  <div className="rounded-full bg-orange-50 px-3 py-1.5 text-body-sm font-semibold text-orange-700">
                    {payload.selected.sectorGroup}
                  </div>
                </div>
                <p className="mt-4 text-body text-fg-muted">{payload.selected.teachingNote}</p>
              </div>

              <div className="rounded-[1.5rem] bg-orange-50 p-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand" />
                  <p className="text-h3 text-fg-strong">数据新鲜度</p>
                </div>
                <p className="mt-4 text-body text-fg-muted">{payload.note}</p>
                <div className="mt-4 rounded-full bg-white px-3 py-2 text-caption font-semibold text-fg-muted">
                  {payload.selected.source === "tsanghi"
                    ? `数据日期：${new Date(payload.asOf).getUTCMonth() + 1}月${new Date(payload.asOf).getUTCDate()}日（收盘）`
                    : "教学示意数据 · 非真实行情，仅用于课堂演示"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside data-motion-card className="market-motion-panel panel rounded-[2rem] p-5 sm:p-6">
          <p className="bz-eyebrow">Snapshot</p>
          <h3 className="mt-3 text-h2 text-fg-strong">关键字段</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {payload.selected.facts.map((fact) => (
              <div key={fact.label} className="rounded-[1.5rem] bg-slate-50 px-4 py-4">
                <p className="text-caption uppercase tracking-[0.18em] text-fg-muted">{fact.label}</p>
                <p className="mt-2 text-h3 tabular-nums text-fg-strong">{fact.value}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(420px,0.65fr)]">
        <div data-motion-card className="market-motion-panel panel rounded-[2rem] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Radar className="h-5 w-5 text-brand" />
              <h3 className="text-h2 text-fg-strong">6维教学观察雷达</h3>
            </div>
            <p className="text-body-sm text-fg-muted">文字说明移到右侧，避免图内拥挤。</p>
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start xl:grid-cols-[260px_minmax(0,1fr)]">
            <div data-motion-viz className="flex flex-col items-center justify-center rounded-[2rem] bg-slate-50 p-4">
              <svg
                role="img"
                aria-label={`${payload.selected.name} 6 维教学观察雷达：${payload.selected.metrics
                  .map((metric) => `${metric.label} ${metric.score}`)
                  .join("，")}。`}
                viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
                className="h-72 w-full max-w-[300px]"
              >
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
              {/* UI v2：图注只保「最强/最弱」一句，方法提示不再铺开（builder 原文未动，测试锚定不变） */}
              <p data-testid="market-radar-summary" className="mt-3 text-center text-body-sm leading-6 text-fg-muted">
                {`${radarSummary.split("。")[0]}。`}
              </p>
            </div>
            <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-1">
              {payload.selected.metrics.map((metric) => (
                <div key={metric.id} className="rounded-[1.5rem] bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-body font-semibold text-fg-strong">{metric.label}</p>
                    <p className="text-h3 tabular-nums text-orange-700">{metric.score}</p>
                  </div>
                  <ExpandableText text={metric.note} className="mt-2" textClassName="text-body-sm text-fg-muted" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div data-motion-card className="market-motion-panel panel rounded-[2rem] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-brand" />
            <h3 className="text-h2 text-fg-strong">观察池结构拆解</h3>
          </div>
          <div className="mt-6 flex flex-col items-center gap-7">
            <div className="relative flex h-52 w-52 shrink-0 items-center justify-center rounded-full">
              <div className="absolute inset-0 rounded-full shadow-inner" style={{ background: buildDonutGradient(sectorSlices) }} />
              <div className="relative flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white text-center shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
                <span className="text-caption font-semibold text-fg-muted">AI/科技</span>
                <span className="mt-1 text-h2 tabular-nums text-fg-strong">{payload.watchlist.length}</span>
                <span className="text-caption font-semibold text-fg-muted">观察标的</span>
              </div>
            </div>
            {/* UI v2：可见 sectorSummary 与甜甜圈/列表重复，视觉层删除；保留 sr-only 作为图形的读屏替代 */}
            <p data-testid="market-sector-summary" className="sr-only">
              {sectorSummary}
            </p>
            <ul className="w-full space-y-2.5">
              {sectorSlices.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-[1.5rem] bg-slate-50 px-4 py-3"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-semibold text-fg-strong">{item.label}</p>
                    <p className="mt-0.5 truncate text-caption font-normal text-fg-muted">
                      领跑观察：{item.leadSymbol}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "shrink-0 text-body-sm font-semibold tabular-nums",
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
            <UsersRound className="h-5 w-5 text-brand" />
            <h3 className="text-h2 text-fg-strong">同学热度</h3>
          </div>
          <div className="mt-4 rounded-[1.5rem] bg-slate-950 p-4 text-white">
            <p className="bz-eyebrow-inverse tabular-nums">
              {peerHeat.classroomName} · {peerHeat.totalStudents} 人
            </p>
            <p className="mt-3 text-h3 leading-7 text-white">{peerHeat.headline}</p>
            <ExpandableText text={peerHeat.summary} className="mt-2" textClassName="text-body-sm leading-6 text-white/70" />
          </div>
          <div className="mt-4 space-y-3">
            {peerHeat.items.length > 0 ? (
              peerHeat.items.slice(0, 4).map((item, index) => (
                <div key={`${item.source}-${item.symbol}`} className="rounded-[1.35rem] bg-slate-50 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-body font-semibold text-fg-strong">
                        #{index + 1} {item.name}
                      </p>
                      <p className="mt-1 text-caption uppercase tracking-[0.16em] text-fg-muted">
                        {item.symbol} · {item.source === "holding" ? "模拟持有" : "自选观察"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-h3 tabular-nums text-orange-700">{item.count}人</p>
                      <p className="text-caption font-semibold tabular-nums text-fg-muted">{item.ratio}%</p>
                    </div>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-400 via-amber-300 to-rose-300"
                      style={{ width: `${Math.max(8, item.ratio)}%` }}
                    />
                  </div>
                  <ExpandableText
                    text={`${item.concept} · ${item.coachNote}`}
                    className="mt-2"
                    textClassName="text-caption font-normal leading-5 text-fg-muted"
                  />
                </div>
              ))
            ) : (
              <div className="rounded-[1.35rem] bg-slate-50 px-4 py-5 text-body-sm leading-6 text-fg-muted">
                还没有足够的班级持有或自选观察记录。完成一笔模拟持有或加入自选后，这里会出现脱敏聚合热度。
              </div>
            )}
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-[1.25rem] bg-orange-50 px-4 py-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <p className="text-caption font-normal leading-5 text-fg-muted">
              {peerHeat.privacyNote}
              {peerHeatError ? ` 刷新提示：${peerHeatError}` : ""}
            </p>
          </div>
        </div>

        <div data-motion-card className="market-motion-panel panel rounded-[2rem] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-brand" />
            <h3 className="text-h2 text-fg-strong">观察池排行</h3>
          </div>
          <div className="mt-5 space-y-3">
            {payload.marketSummary.map((item, index) => (
              <div key={item.symbol} className="rounded-[1.5rem] bg-slate-50 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-body font-semibold text-fg-strong">#{index + 1} {item.name}</p>
                    <p className="mt-1 text-caption uppercase tracking-[0.18em] text-fg-muted">{item.symbol}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-body font-semibold tabular-nums text-fg-strong">{item.score.toFixed(2)}</p>
                    <p className={cn("mt-1 text-caption font-semibold tabular-nums", getMarketMoveClasses(item.changePercent).text)}>
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
            <Layers3 className="h-5 w-5 text-brand" />
            <h3 className="text-h2 text-fg-strong">板块热度条</h3>
          </div>
          <div className="mt-5 space-y-5">
            {payload.sectorPerformance.map((item) => {
              const width = `${Math.min(Math.max(Math.abs(item.changePercent) * 18, 12), 100)}%`;
              return (
                <div key={item.id}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-body font-semibold text-fg-strong">{item.label}</p>
                    <p className={cn("text-body-sm font-semibold tabular-nums", getMarketMoveClasses(item.changePercent).text)}>
                      {item.changePercent >= 0 ? "+" : ""}
                      {item.changePercent.toFixed(2)}%
                    </p>
                  </div>
                  <div className="mt-2 h-3 rounded-full bg-slate-100">
                    <div className={cn("h-full rounded-full", getMarketMoveClasses(item.changePercent).bar)} style={{ width }} />
                  </div>
                  <p className="mt-2 text-caption font-normal text-fg-muted">领跑观察：{item.leadSymbol}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div data-motion-card className="market-motion-panel panel rounded-[2rem] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Waves className="h-5 w-5 text-brand" />
            <h3 className="text-h2 text-fg-strong">课堂提示</h3>
          </div>
          <div className="mt-5 space-y-3">
            {payload.observationNotes.slice(0, 1).map((note, index) => (
              <div key={`note-${index}`} className="rounded-[1.5rem] bg-orange-50 px-4 py-4 text-body text-fg-default">
                {note}
              </div>
            ))}
            {payload.observationNotes.length > 1 ? (
              <>
                {moreNotesOpen
                  ? payload.observationNotes.slice(1).map((note, index) => (
                      <div key={`note-more-${index}`} className="rounded-[1.5rem] bg-orange-50 px-4 py-4 text-body text-fg-default">
                        {note}
                      </div>
                    ))
                  : null}
                <button
                  type="button"
                  aria-expanded={moreNotesOpen}
                  onClick={() => setMoreNotesOpen((value) => !value)}
                  className="w-full rounded-full border border-slate-200 px-4 py-2 text-body-sm font-semibold text-fg-muted transition-colors hover:border-orange-300 hover:text-orange-700"
                >
                  {moreNotesOpen ? "收起提示" : `更多提示（${payload.observationNotes.length - 1}）`}
                </button>
              </>
            ) : null}
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
              <p className="bz-eyebrow-inverse">{payload.contentCards[0].sourceLabel}</p>
              <h3 className="mt-4 max-w-2xl text-h1 text-white">{payload.contentCards[0].title}</h3>
              <p className="mt-4 max-w-2xl text-body-lg leading-8 text-white/80">{payload.contentCards[0].summary}</p>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4">
          {payload.contentCards.slice(1).map((card) => (
            <div key={card.id} data-motion-card className="market-motion-panel panel rounded-[2rem] p-5">
              <div className="flex items-center gap-2">
                <Newspaper className="h-4 w-4" style={{ color: card.accentColor }} />
                <p className="text-caption font-semibold uppercase tracking-[0.22em]" style={{ color: card.accentColor }}>
                  {card.sourceLabel}
                </p>
              </div>
              <h3 className="mt-3 text-h2 text-fg-strong">{card.title}</h3>
              <ExpandableText text={card.summary} className="mt-3" textClassName="text-body text-fg-muted" />
            </div>
          ))}
        </div>
      </section>

      {isPending || error ? (
        <div className={cn("rounded-[1.5rem] px-4 py-3 text-body-sm font-semibold", error ? "bg-orange-50 text-orange-700" : "bg-slate-50 text-fg-muted")}>
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
