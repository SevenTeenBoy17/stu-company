import { env } from "@/lib/env";
import { MARKET_REFRESH_INTERVAL_LABEL, MARKET_REFRESH_INTERVAL_MS } from "@/lib/market-refresh";
import { MARKET_WATCHLIST_SYMBOLS, getMarketMetadata } from "@/lib/market-watchlist";
import type { ExternalMarketSignal, MarketWatchlistSymbol } from "@/lib/types";

type QuoteInput = {
  currentPrice?: number | null;
  changePercent?: number | null;
  source?: "alltick" | "fallback";
};

type KlinePoint = {
  timestamp?: string;
  open_price?: string | number;
  close_price?: string | number;
  high_price?: string | number;
  low_price?: string | number;
};

type TickPoint = {
  code?: string;
  symbol?: string;
  price?: string | number;
  last_price?: string | number;
  prev_close?: string | number;
  close_price?: string | number;
  change_percent?: string | number;
  change_ratio?: string | number;
  change_rate?: string | number;
  tick_time?: string;
};

export type AlltickStaticInfo = {
  nameCn?: string;
  nameEn?: string;
  currency?: string;
  exchange?: string;
  board?: string;
  lotSize?: string;
  totalShares?: string;
  circulatingShares?: string;
};

export type AlltickWatchlistSnapshot = {
  asOf: string;
  provider: "alltick" | "hybrid" | "fallback";
  note: string;
  quotes: Partial<Record<MarketWatchlistSymbol, QuoteInput>>;
};

export type AlltickMarketBoardSnapshot = AlltickWatchlistSnapshot & {
  selectedKline?: number[];
  staticInfo?: AlltickStaticInfo;
};

type AlltickPayload = {
  ret?: number;
  msg?: string;
  trace?: string;
  data?: Record<string, unknown>;
};

type KlineResponse = {
  live: boolean;
  note?: string;
  series?: number[];
};

type StaticInfoResponse = {
  live: boolean;
  note?: string;
  info?: AlltickStaticInfo;
};

declare global {
  var __alltickPulseCache__:
    | {
        expiresAt: number;
        value: {
          asOf: string;
          signals: ExternalMarketSignal[];
          note: string;
        };
      }
    | undefined;
  var __alltickWatchlistCache__:
    | {
        expiresAt: number;
        value: AlltickWatchlistSnapshot;
      }
    | undefined;
  var __alltickBoardCache__:
    | Partial<
        Record<
          MarketWatchlistSymbol,
          {
            expiresAt: number;
            value: AlltickMarketBoardSnapshot;
          }
        >
      >
    | undefined;
}

function getBaseUrl() {
  const base = env.ALLTICK_STOCK_BASE_URL ?? "https://quote.alltick.co/quote-stock-b-api";
  return base.replace(/\/$/, "");
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeChangePercent(input?: Partial<TickPoint>) {
  if (!input) return null;

  const raw =
    normalizeNumber(input.change_percent) ??
    normalizeNumber(input.change_ratio) ??
    normalizeNumber(input.change_rate);

  if (raw !== null) {
    return Math.abs(raw) <= 1 ? raw * 100 : raw;
  }

  const currentPrice =
    normalizeNumber(input.price) ??
    normalizeNumber(input.last_price) ??
    normalizeNumber(input.close_price);
  const prevClose = normalizeNumber(input.prev_close);

  if (currentPrice !== null && prevClose && prevClose !== 0) {
    return ((currentPrice - prevClose) / prevClose) * 100;
  }

  return null;
}

function extractTickList(payload: AlltickPayload) {
  const data = payload.data ?? {};
  const tickList = (data.tick_list ?? data.list ?? []) as TickPoint[];
  return Array.isArray(tickList) ? tickList : [];
}

function extractKlineList(payload: AlltickPayload) {
  const data = payload.data ?? {};
  const list = (data.kline_list ?? []) as KlinePoint[];
  return Array.isArray(list) ? list : [];
}

function extractStaticInfo(payload: AlltickPayload) {
  const data = payload.data ?? {};
  const list = (data.static_info_list ?? []) as Array<Record<string, unknown>>;
  if (!Array.isArray(list) || list.length === 0) return null;

  const first = list[0];
  return {
    nameCn: typeof first.name_cn === "string" ? first.name_cn : undefined,
    nameEn: typeof first.name_en === "string" ? first.name_en : undefined,
    currency: typeof first.currency === "string" ? first.currency : undefined,
    exchange: typeof first.exchange === "string" ? first.exchange : undefined,
    board: typeof first.board === "string" ? first.board : undefined,
    lotSize: typeof first.lot_size === "string" ? first.lot_size : undefined,
    totalShares: typeof first.total_shares === "string" ? first.total_shares : undefined,
    circulatingShares:
      typeof first.circulating_shares === "string" ? first.circulating_shares : undefined,
  } satisfies AlltickStaticInfo;
}

async function fetchWithTimeout(url: string, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      headers: {
        accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

function buildQueryUrl(pathname: string, query: object) {
  const url = new URL(`${getBaseUrl()}/${pathname}`);
  url.searchParams.set("token", env.ALLTICK_API_KEY ?? "");
  url.searchParams.set("query", JSON.stringify(query));
  return url.toString();
}

function cacheWatchlistSnapshot(value: AlltickWatchlistSnapshot) {
  globalThis.__alltickWatchlistCache__ = {
    expiresAt: Date.now() + MARKET_REFRESH_INTERVAL_MS,
    value,
  };

  return value;
}

function cacheBoardSnapshot(symbol: MarketWatchlistSymbol, value: AlltickMarketBoardSnapshot) {
  globalThis.__alltickBoardCache__ = {
    ...(globalThis.__alltickBoardCache__ ?? {}),
    [symbol]: {
      expiresAt: Date.now() + MARKET_REFRESH_INTERVAL_MS,
      value,
    },
  };

  return value;
}

function cachePulseResult(value: { asOf: string; signals: ExternalMarketSignal[]; note: string }) {
  globalThis.__alltickPulseCache__ = {
    expiresAt: Date.now() + MARKET_REFRESH_INTERVAL_MS,
    value,
  };

  return value;
}

function fallbackWatchlist(note: string): AlltickWatchlistSnapshot {
  return {
    asOf: new Date().toISOString(),
    provider: "fallback",
    note,
    quotes: {},
  };
}

async function requestAlltick(pathname: string, query: object) {
  if (!env.ALLTICK_API_KEY) {
    return {
      ok: false as const,
      message: `未配置 AllTick token，当前使用教学观察池并按每 ${MARKET_REFRESH_INTERVAL_LABEL} 自动刷新。`,
    };
  }

  try {
    const response = await fetchWithTimeout(buildQueryUrl(pathname, query));
    const payload = (await response.json()) as AlltickPayload;

    if (!response.ok) {
      return {
        ok: false as const,
        message: payload.msg ?? `HTTP ${response.status}`,
      };
    }

    if (payload.ret && payload.ret !== 200) {
      return {
        ok: false as const,
        message: payload.msg ?? `ret=${payload.ret}`,
        payload,
      };
    }

    return {
      ok: true as const,
      payload,
    };
  } catch {
    return {
      ok: false as const,
      message: `AllTick 请求超时或网络波动，已回退到教学观察池，并会在每 ${MARKET_REFRESH_INTERVAL_LABEL} 自动重试。`,
    };
  }
}

async function fetchSelectedKline(symbol: MarketWatchlistSymbol): Promise<KlineResponse> {
  const metadata = getMarketMetadata(symbol);
  const result = await requestAlltick("kline", {
    trace: `brown-zone-kline-${symbol}-${Date.now()}`,
    data: {
      code: metadata.code,
      kline_type: 8,
      kline_timestamp_end: 0,
      query_kline_num: 24,
      adjust_type: 0,
    },
  });

  if (!result.ok) {
    return {
      live: false,
      note: result.message,
    };
  }

  const series = extractKlineList(result.payload)
    .map((item) => normalizeNumber(item.close_price))
    .filter((value): value is number => typeof value === "number");

  if (series.length < 4) {
    return {
      live: false,
      note: "AllTick 当前没有返回足够的 K 线数据，已使用教学曲线补齐展示。",
    };
  }

  return {
    live: true,
    series,
  };
}

async function fetchSelectedStaticInfo(symbol: MarketWatchlistSymbol): Promise<StaticInfoResponse> {
  const metadata = getMarketMetadata(symbol);
  const result = await requestAlltick("static_info", {
    trace: `brown-zone-static-${symbol}-${Date.now()}`,
    data: {
      symbol_list: [{ code: metadata.code }],
    },
  });

  if (!result.ok) {
    return {
      live: false,
      note: result.message,
    };
  }

  const info = extractStaticInfo(result.payload);
  if (!info) {
    return {
      live: false,
      note: "AllTick 当前没有返回基础信息，已使用本地教学资料补足字段。",
    };
  }

  return {
    live: true,
    info,
  };
}

export async function fetchWatchlistSnapshot(): Promise<AlltickWatchlistSnapshot> {
  const cached = globalThis.__alltickWatchlistCache__;
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  if (!env.ALLTICK_API_KEY) {
    return cacheWatchlistSnapshot(
      fallbackWatchlist(`未配置 AllTick token，首页轮播条与市场页当前使用教学观察池，并按每 ${MARKET_REFRESH_INTERVAL_LABEL} 自动刷新。`),
    );
  }

  const request = await requestAlltick("trade-tick", {
    trace: `brown-zone-watchlist-${Date.now()}`,
    data: {
      symbol_list: MARKET_WATCHLIST_SYMBOLS.map((symbol) => ({
        code: getMarketMetadata(symbol).code,
      })),
    },
  });

  if (!request.ok) {
    return cacheWatchlistSnapshot(
      fallbackWatchlist(
        `AllTick 当前返回「${request.message}」，已自动回退到教学观察池，并会在每 ${MARKET_REFRESH_INTERVAL_LABEL} 自动重试。`,
      ),
    );
  }

  const tickList = extractTickList(request.payload);
  const quotes: Partial<Record<MarketWatchlistSymbol, QuoteInput>> = {};

  for (const symbol of MARKET_WATCHLIST_SYMBOLS) {
    const code = getMarketMetadata(symbol).code;
    const tick = tickList.find((candidate) => candidate.code === code || candidate.symbol === code);
    if (!tick) {
      continue;
    }

    const currentPrice =
      normalizeNumber(tick.price) ??
      normalizeNumber(tick.last_price) ??
      normalizeNumber(tick.close_price);
    const changePercent = normalizeChangePercent(tick);

    if (currentPrice === null && changePercent === null) {
      continue;
    }

    quotes[symbol] = {
      currentPrice,
      changePercent,
      source: "alltick",
    };
  }

  const liveCount = Object.values(quotes).filter((item) => typeof item?.currentPrice === "number").length;
  const provider =
    liveCount === 0
      ? "fallback"
      : liveCount === MARKET_WATCHLIST_SYMBOLS.length
        ? "alltick"
        : "hybrid";

  const note =
    provider === "alltick"
      ? `AllTick 实时报价已接入，观察池按每 ${MARKET_REFRESH_INTERVAL_LABEL} 自动刷新一次。`
      : provider === "hybrid"
        ? `AllTick 已返回部分实时字段，缺失部分会自动用教学观察池补齐，并按每 ${MARKET_REFRESH_INTERVAL_LABEL} 重试。`
        : `AllTick 本次没有返回可用报价，已切换到教学观察池，并会在每 ${MARKET_REFRESH_INTERVAL_LABEL} 自动重试。`;

  return cacheWatchlistSnapshot({
    asOf: new Date().toISOString(),
    provider,
    note,
    quotes,
  });
}

export async function fetchMarketBoardSnapshot(
  symbol: MarketWatchlistSymbol,
): Promise<AlltickMarketBoardSnapshot> {
  const cached = globalThis.__alltickBoardCache__?.[symbol];
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const watchlist = await fetchWatchlistSnapshot();
  const [kline, staticInfo] = await Promise.all([
    fetchSelectedKline(symbol),
    fetchSelectedStaticInfo(symbol),
  ]);

  const provider =
    watchlist.provider === "alltick" && kline.live && staticInfo.live
      ? "alltick"
      : watchlist.provider === "fallback" && !kline.live && !staticInfo.live
        ? "fallback"
        : "hybrid";

  const notes = [
    watchlist.note,
    !kline.live && kline.note ? kline.note : null,
    !staticInfo.live && staticInfo.note ? staticInfo.note : null,
  ].filter((item, index, list): item is string => Boolean(item) && list.indexOf(item) === index);

  return cacheBoardSnapshot(symbol, {
    asOf: new Date().toISOString(),
    provider,
    note: notes.join(" "),
    quotes: watchlist.quotes,
    selectedKline: kline.series,
    staticInfo: staticInfo.info,
  });
}

export async function fetchAlltickMarketPulse() {
  const cached = globalThis.__alltickPulseCache__;
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const snapshot = await fetchWatchlistSnapshot();
  if (snapshot.provider === "fallback") {
    return cachePulseResult({
      asOf: snapshot.asOf,
      signals: [],
      note: snapshot.note,
    });
  }

  const selectedSymbols: MarketWatchlistSymbol[] = ["NVDA", "MSFT", "TSM"];
  const signals = selectedSymbols
    .map((symbol) => {
      const metadata = getMarketMetadata(symbol);
      const quote = snapshot.quotes[symbol];
      if (!quote || typeof quote.currentPrice !== "number") return null;

      return {
        key: symbol.toLowerCase(),
        label: metadata.name,
        code: metadata.code,
        region: "US",
        currentPrice: quote.currentPrice,
        changePercent: quote.changePercent ?? 0,
        source: "alltick" as const,
        summary: metadata.observationAngle,
      } satisfies ExternalMarketSignal;
    })
    .filter(Boolean) as ExternalMarketSignal[];

  return cachePulseResult({
    asOf: snapshot.asOf,
    signals,
    note: snapshot.note,
  });
}
