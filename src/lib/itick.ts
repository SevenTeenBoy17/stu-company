import { env } from "@/lib/env";
import { MARKET_REFRESH_INTERVAL_LABEL, MARKET_REFRESH_INTERVAL_MS } from "@/lib/market-refresh";
import { MARKET_WATCHLIST_SYMBOLS, getMarketMetadata } from "@/lib/market-watchlist";
import type {
  ExternalMarketSignal,
  MarketDataProvider,
  MarketKlineCandle,
  MarketQuoteSource,
  MarketWatchlistSymbol,
} from "@/lib/types";

type QuoteInput = {
  currentPrice?: number | null;
  changePercent?: number | null;
  source?: MarketQuoteSource;
};

export type ItickWatchlistSnapshot = {
  asOf: string;
  provider: MarketDataProvider;
  note: string;
  quotes: Partial<Record<MarketWatchlistSymbol, QuoteInput>>;
};

export type ItickMarketBoardSnapshot = ItickWatchlistSnapshot & {
  selectedKline?: number[];
  selectedCandles?: MarketKlineCandle[];
};

type ItickPayload = {
  code?: number | string;
  msg?: string;
  message?: string;
  data?: unknown;
};

type QuoteResponse = {
  live: boolean;
  quote?: QuoteInput;
  note?: string;
};

type KlineResponse = {
  live: boolean;
  series?: number[];
  candles?: MarketKlineCandle[];
  note?: string;
};

declare global {
  var __itickPulseCache__:
    | {
        expiresAt: number;
        value: {
          asOf: string;
          signals: ExternalMarketSignal[];
          note: string;
        };
      }
    | undefined;
  var __itickWatchlistCache__:
    | {
        expiresAt: number;
        value: ItickWatchlistSnapshot;
      }
    | undefined;
  var __itickBoardCache__:
    | Partial<
        Record<
          MarketWatchlistSymbol,
          {
            expiresAt: number;
            value: ItickMarketBoardSnapshot;
          }
        >
      >
    | undefined;
}

function getRestBaseUrl() {
  const base = env.ITICK_REST_BASE_URL ?? "https://api0.itick.org";
  return base.replace(/\/$/, "");
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeTime(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    const maybeNumber = Number(value);
    if (Number.isFinite(maybeNumber)) {
      return normalizeTime(maybeNumber);
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value < 10_000_000_000 ? value * 1000 : value;
    return new Date(millis).toISOString();
  }

  return new Date().toISOString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function dataCandidates(payload: ItickPayload): Record<string, unknown>[] {
  const data = payload.data;
  if (Array.isArray(data)) {
    return data.map(asRecord).filter(Boolean) as Record<string, unknown>[];
  }

  const record = asRecord(data);
  if (!record) return [];

  for (const key of ["list", "items", "quotes", "tick_list", "kline_list"]) {
    const list = record[key];
    if (Array.isArray(list)) {
      return list.map(asRecord).filter(Boolean) as Record<string, unknown>[];
    }
  }

  return [record];
}

function getMessage(payload: ItickPayload, fallback: string) {
  return payload.msg ?? payload.message ?? fallback;
}

async function fetchWithTimeout(url: string, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      headers: {
        accept: "application/json",
        token: env.ITICK_API_TOKEN ?? "",
      },
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

function buildRestUrl(pathname: string, params: Record<string, string | number>) {
  const url = new URL(`${getRestBaseUrl()}/${pathname.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function toItickStockCode(symbol: MarketWatchlistSymbol) {
  return getMarketMetadata(symbol).code.replace(/\.US$/i, "");
}

async function requestItick(pathname: string, params: Record<string, string | number>) {
  if (!env.ITICK_API_TOKEN) {
    return {
      ok: false as const,
      message: `未配置 iTick token，当前使用教学观察池并按每 ${MARKET_REFRESH_INTERVAL_LABEL} 自动刷新。`,
    };
  }

  try {
    const response = await fetchWithTimeout(buildRestUrl(pathname, params));
    const payload = (await response.json()) as ItickPayload;
    const code = normalizeNumber(payload.code);

    if (!response.ok) {
      return {
        ok: false as const,
        message: getMessage(payload, `HTTP ${response.status}`),
      };
    }

    if (code !== null && code !== 0 && code !== 200) {
      return {
        ok: false as const,
        message: getMessage(payload, `code=${payload.code}`),
      };
    }

    return {
      ok: true as const,
      payload,
    };
  } catch {
    return {
      ok: false as const,
      message: `iTick 请求超时或网络波动，已回退到教学观察池，并会在每 ${MARKET_REFRESH_INTERVAL_LABEL} 自动重试。`,
    };
  }
}

function fallbackWatchlist(note: string): ItickWatchlistSnapshot {
  return {
    asOf: new Date().toISOString(),
    provider: "fallback",
    note,
    quotes: {},
  };
}

function cacheWatchlistSnapshot(value: ItickWatchlistSnapshot) {
  globalThis.__itickWatchlistCache__ = {
    expiresAt: Date.now() + MARKET_REFRESH_INTERVAL_MS,
    value,
  };

  return value;
}

function cacheBoardSnapshot(symbol: MarketWatchlistSymbol, value: ItickMarketBoardSnapshot) {
  globalThis.__itickBoardCache__ = {
    ...(globalThis.__itickBoardCache__ ?? {}),
    [symbol]: {
      expiresAt: Date.now() + MARKET_REFRESH_INTERVAL_MS,
      value,
    },
  };

  return value;
}

function cachePulseResult(value: { asOf: string; signals: ExternalMarketSignal[]; note: string }) {
  globalThis.__itickPulseCache__ = {
    expiresAt: Date.now() + MARKET_REFRESH_INTERVAL_MS,
    value,
  };

  return value;
}

function normalizeChangePercent(input: Record<string, unknown>) {
  const raw =
    normalizeNumber(input.chp) ??
    normalizeNumber(input.change_percent) ??
    normalizeNumber(input.changePercent) ??
    normalizeNumber(input.change_ratio) ??
    normalizeNumber(input.change_rate) ??
    normalizeNumber(input.percent);

  if (raw !== null) {
    return Math.abs(raw) <= 1 ? raw * 100 : raw;
  }

  const currentPrice =
    normalizeNumber(input.ld) ??
    normalizeNumber(input.latest_price) ??
    normalizeNumber(input.price) ??
    normalizeNumber(input.close) ??
    normalizeNumber(input.c);
  const prevClose =
    normalizeNumber(input.p) ??
    normalizeNumber(input.prev_close_price) ??
    normalizeNumber(input.prev_close) ??
    normalizeNumber(input.pre_close);

  if (currentPrice !== null && prevClose && prevClose !== 0) {
    return ((currentPrice - prevClose) / prevClose) * 100;
  }

  return null;
}

function extractQuote(payload: ItickPayload): QuoteInput | null {
  const candidate = dataCandidates(payload)[0];
  if (!candidate) return null;

  const currentPrice =
    normalizeNumber(candidate.ld) ??
    normalizeNumber(candidate.latest_price) ??
    normalizeNumber(candidate.price) ??
    normalizeNumber(candidate.close) ??
    normalizeNumber(candidate.c);
  const changePercent = normalizeChangePercent(candidate);

  if (currentPrice === null && changePercent === null) {
    return null;
  }

  return {
    currentPrice,
    changePercent,
    source: "itick",
  };
}

async function fetchSelectedQuote(symbol: MarketWatchlistSymbol): Promise<QuoteResponse> {
  const result = await requestItick("stock/quote", {
    region: "US",
    code: toItickStockCode(symbol),
  });

  if (!result.ok) {
    return {
      live: false,
      note: result.message,
    };
  }

  const quote = extractQuote(result.payload);
  if (!quote) {
    return {
      live: false,
      note: "iTick 当前没有返回可用报价，已使用教学观察池补齐展示。",
    };
  }

  return {
    live: true,
    quote,
  };
}

function extractCandles(payload: ItickPayload): MarketKlineCandle[] {
  return dataCandidates(payload)
    .map((item) => {
      const open = normalizeNumber(item.o ?? item.open ?? item.open_price);
      const high = normalizeNumber(item.h ?? item.high ?? item.high_price);
      const low = normalizeNumber(item.l ?? item.low ?? item.low_price);
      const close = normalizeNumber(item.c ?? item.close ?? item.close_price);
      const volume = normalizeNumber(item.v ?? item.volume);

      if (open === null || high === null || low === null || close === null) {
        return null;
      }

      return {
        time: normalizeTime(item.t ?? item.timestamp ?? item.time ?? item.latest_time),
        open,
        high,
        low,
        close,
        volume: volume ?? undefined,
      } satisfies MarketKlineCandle;
    })
    .filter(Boolean) as MarketKlineCandle[];
}

async function fetchSelectedKline(symbol: MarketWatchlistSymbol): Promise<KlineResponse> {
  const result = await requestItick("stock/kline", {
    region: "US",
    code: toItickStockCode(symbol),
    kType: 8,
    limit: 24,
  });

  if (!result.ok) {
    return {
      live: false,
      note: result.message,
    };
  }

  const candles = extractCandles(result.payload).slice(-24);
  if (candles.length < 4) {
    return {
      live: false,
      note: "iTick 当前没有返回足够的日 K 线数据，已使用教学曲线补齐展示。",
    };
  }

  return {
    live: true,
    series: candles.map((item) => item.close),
    candles,
  };
}

export async function fetchItickWatchlistSnapshot(): Promise<ItickWatchlistSnapshot> {
  const cached = globalThis.__itickWatchlistCache__;
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  if (!env.ITICK_API_TOKEN) {
    return cacheWatchlistSnapshot(
      fallbackWatchlist(`未配置 iTick token，首页轮播条与市场页当前使用教学观察池，并按每 ${MARKET_REFRESH_INTERVAL_LABEL} 自动刷新。`),
    );
  }

  const results = await Promise.all(
    MARKET_WATCHLIST_SYMBOLS.map(async (symbol) => [symbol, await fetchSelectedQuote(symbol)] as const),
  );
  const quotes: Partial<Record<MarketWatchlistSymbol, QuoteInput>> = {};
  const notes = new Set<string>();

  for (const [symbol, result] of results) {
    if (result.live && result.quote) {
      quotes[symbol] = result.quote;
    } else if (result.note) {
      notes.add(result.note);
    }
  }

  const liveCount = Object.values(quotes).filter((item) => typeof item?.currentPrice === "number").length;
  const provider: MarketDataProvider =
    liveCount === 0 ? "fallback" : liveCount === MARKET_WATCHLIST_SYMBOLS.length ? "itick" : "hybrid";
  const note =
    provider === "itick"
      ? `iTick 实时报价已接入，观察池按每 ${MARKET_REFRESH_INTERVAL_LABEL} 自动刷新一次。`
      : provider === "hybrid"
        ? `iTick 已返回部分实时字段，缺失部分会自动用教学观察池补齐，并按每 ${MARKET_REFRESH_INTERVAL_LABEL} 重试。`
        : `iTick 本次没有返回可用报价，已切换到教学观察池，并会在每 ${MARKET_REFRESH_INTERVAL_LABEL} 自动重试。`;

  return cacheWatchlistSnapshot({
    asOf: new Date().toISOString(),
    provider,
    note: [note, ...Array.from(notes).slice(0, 1)].join(" "),
    quotes,
  });
}

export async function fetchItickMarketBoardSnapshot(
  symbol: MarketWatchlistSymbol,
): Promise<ItickMarketBoardSnapshot> {
  const cached = globalThis.__itickBoardCache__?.[symbol];
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const watchlist = await fetchItickWatchlistSnapshot();
  const kline = await fetchSelectedKline(symbol);

  const provider: MarketDataProvider =
    watchlist.provider === "itick" && kline.live
      ? "itick"
      : watchlist.provider === "fallback" && !kline.live
        ? "fallback"
        : "hybrid";

  const notes = [
    watchlist.note,
    !kline.live && kline.note ? kline.note : null,
  ].filter((item, index, list): item is string => Boolean(item) && list.indexOf(item) === index);

  return cacheBoardSnapshot(symbol, {
    asOf: new Date().toISOString(),
    provider,
    note: notes.join(" "),
    quotes: watchlist.quotes,
    selectedKline: kline.series,
    selectedCandles: kline.candles,
  });
}

export async function fetchItickMarketPulse() {
  const cached = globalThis.__itickPulseCache__;
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const snapshot = await fetchItickWatchlistSnapshot();
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
        source: "itick" as const,
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
