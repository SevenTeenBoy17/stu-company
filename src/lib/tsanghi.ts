import { env } from "@/lib/env";
import { MARKET_REFRESH_INTERVAL_LABEL, MARKET_REFRESH_INTERVAL_MS } from "@/lib/market-refresh";
import { MARKET_WATCHLIST_SYMBOLS, getMarketMetadata } from "@/lib/market-watchlist";
import type {
  ExternalMarketSignal,
  MarketDataProvider,
  MarketKlineCandle,
  MarketWatchlistSymbol,
} from "@/lib/types";

// 沧海数据 (Tsanghi) 行情 provider —— 真实「日线 EOD」数据源。
// 实测：免费 token 实时(realtime)返回 3003 权限不足，但日线(daily)可用且能取到当日收盘。
// 故本 provider 以日线为真实数据源：最新收盘=现价，(最新-次新)/次新=日涨跌幅，近 24 根=K 线。
// 设计与 itick.ts / alltick.ts 同构；无 token / code≠200 / 超时 → 优雅回退教学观察池。
// 详见 docs/market-data/tsanghi-api-integration.md。

type QuoteInput = {
  currentPrice?: number | null;
  changePercent?: number | null;
  source?: "tsanghi" | "fallback";
};

export type TsanghiStaticInfo = {
  nameCn?: string;
  nameEn?: string;
  currency?: string;
  exchange?: string;
  board?: string;
  lotSize?: string;
  totalShares?: string;
  circulatingShares?: string;
};

export type TsanghiWatchlistSnapshot = {
  asOf: string;
  provider: MarketDataProvider;
  note: string;
  quotes: Partial<Record<MarketWatchlistSymbol, QuoteInput>>;
  // 每只观察池 symbol 的真实近 24 根日 K：让排行/预览评分也吃真实走势，而非合成兜底序列。
  candlesBySymbol?: Partial<Record<MarketWatchlistSymbol, MarketKlineCandle[]>>;
};

export type TsanghiMarketBoardSnapshot = TsanghiWatchlistSnapshot & {
  selectedKline?: number[];
  selectedCandles?: MarketKlineCandle[];
  staticInfo?: TsanghiStaticInfo;
};

type TsanghiBar = {
  ticker?: string;
  date?: string;
  open?: number | string;
  high?: number | string;
  low?: number | string;
  close?: number | string;
  volume?: number | string;
};

type TsanghiPayload = {
  code?: number | string;
  msg?: string;
  data?: unknown;
};

// 观察池 symbol → 沧海交易所代码 + ticker（实测 US 大盘科技多在 XNAS，ORCL/TSM 在 XNYS）。
const TSANGHI_INSTRUMENT: Record<
  MarketWatchlistSymbol,
  { exchange: string; exchangeName: string; ticker: string; currency: string }
> = {
  MU: { exchange: "XNAS", exchangeName: "NASDAQ", ticker: "MU", currency: "USD" },
  MSFT: { exchange: "XNAS", exchangeName: "NASDAQ", ticker: "MSFT", currency: "USD" },
  NVDA: { exchange: "XNAS", exchangeName: "NASDAQ", ticker: "NVDA", currency: "USD" },
  AMZN: { exchange: "XNAS", exchangeName: "NASDAQ", ticker: "AMZN", currency: "USD" },
  META: { exchange: "XNAS", exchangeName: "NASDAQ", ticker: "META", currency: "USD" },
  GOOG: { exchange: "XNAS", exchangeName: "NASDAQ", ticker: "GOOG", currency: "USD" },
  AVGO: { exchange: "XNAS", exchangeName: "NASDAQ", ticker: "AVGO", currency: "USD" },
  ORCL: { exchange: "XNYS", exchangeName: "NYSE", ticker: "ORCL", currency: "USD" },
  TSLA: { exchange: "XNAS", exchangeName: "NASDAQ", ticker: "TSLA", currency: "USD" },
  TSM: { exchange: "XNYS", exchangeName: "NYSE", ticker: "TSM", currency: "USD" },
};

declare global {
  var __tsanghiPulseCache__:
    | {
        expiresAt: number;
        value: { asOf: string; signals: ExternalMarketSignal[]; note: string };
      }
    | undefined;
  var __tsanghiWatchlistCache__:
    | { expiresAt: number; value: TsanghiWatchlistSnapshot }
    | undefined;
  var __tsanghiBoardCache__:
    | Partial<
        Record<MarketWatchlistSymbol, { expiresAt: number; value: TsanghiMarketBoardSnapshot }>
      >
    | undefined;
}

function getBaseUrl() {
  const base = env.TSANGHI_REST_BASE_URL ?? "https://www.tsanghi.com/api/fin";
  return base.replace(/\/$/, "");
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeTime(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    // "yyyy-mm-dd" 或 "yyyy-mm-dd hh:mm:ss" → ISO；解析失败则原样返回。
    const iso = value.includes(" ") ? value.replace(" ", "T") : `${value}T00:00:00`;
    const parsed = Date.parse(iso.endsWith("Z") ? iso : `${iso}Z`);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : value;
  }
  return new Date().toISOString();
}

function buildUrl(pathname: string, params: Record<string, string | number>) {
  const url = new URL(`${getBaseUrl()}/${pathname.replace(/^\//, "")}`);
  url.searchParams.set("token", env.TSANGHI_API_TOKEN ?? "");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function fetchWithTimeout(url: string, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

async function requestTsanghi(
  pathname: string,
  params: Record<string, string | number>,
): Promise<{ ok: true; payload: TsanghiPayload } | { ok: false; message: string }> {
  if (!env.TSANGHI_API_TOKEN) {
    return {
      ok: false,
      message: `未配置沧海数据 token，当前使用教学观察池并按每 ${MARKET_REFRESH_INTERVAL_LABEL} 自动刷新。`,
    };
  }

  try {
    const response = await fetchWithTimeout(buildUrl(pathname, params));
    const payload = (await response.json()) as TsanghiPayload;
    const code = normalizeNumber(payload.code);

    if (!response.ok) {
      return { ok: false, message: payload.msg ?? `HTTP ${response.status}` };
    }
    if (code !== 200) {
      // code 必须显式为 200 才算成功：3003=权限不足、3002=参数异常、缺失/异常 code 一律按失败处理。
      return { ok: false, message: payload.msg ?? `code=${payload.code ?? "missing"}` };
    }
    return { ok: true, payload };
  } catch {
    return {
      ok: false,
      message: `沧海数据请求超时或网络波动，已回退到教学观察池，并会在每 ${MARKET_REFRESH_INTERVAL_LABEL} 自动重试。`,
    };
  }
}

// 提取并**强制按 date 升序排序**（沧海 daily 默认 order=0 返回乱序，绝不能直接用）。
function extractSortedBars(payload: TsanghiPayload): TsanghiBar[] {
  const data = payload.data;
  if (!Array.isArray(data)) return [];
  const bars = data.filter(
    (item): item is TsanghiBar => Boolean(item) && typeof item === "object" && !Array.isArray(item),
  );
  return bars
    .filter((bar) => typeof bar.date === "string" && normalizeNumber(bar.close) !== null)
    // 确定性字典序（"yyyy-mm-dd" 即时间序）；不用 localeCompare（受运行时 locale 影响）。
    .sort((a, b) => (String(a.date) < String(b.date) ? -1 : String(a.date) > String(b.date) ? 1 : 0));
}

async function fetchSymbolBars(
  symbol: MarketWatchlistSymbol,
  limit: number,
): Promise<{ ok: true; bars: TsanghiBar[] } | { ok: false; message: string }> {
  const instrument = TSANGHI_INSTRUMENT[symbol];
  const result = await requestTsanghi(`stock/${instrument.exchange}/daily`, {
    ticker: instrument.ticker,
    order: 2, // 降序请求（再在客户端排序，双保险）
    limit: Math.max(1, Math.floor(limit)),
  });
  if (!result.ok) return result;
  const bars = extractSortedBars(result.payload);
  if (bars.length === 0) {
    // code=200 但 data 为空（标的不存在 / feed 暂缺）→ 显式判失败，保证 hybrid 计数与 note 准确。
    return { ok: false as const, message: `沧海数据暂无 ${instrument.ticker} 的日线数据。` };
  }
  return { ok: true, bars };
}

function barsToQuote(bars: TsanghiBar[]): QuoteInput | null {
  if (bars.length === 0) return null;
  const latest = normalizeNumber(bars[bars.length - 1]?.close);
  if (latest === null) return null;

  const prev = bars.length >= 2 ? normalizeNumber(bars[bars.length - 2]?.close) : null;
  const changePercent =
    prev !== null && prev !== 0 ? ((latest - prev) / prev) * 100 : null;

  return { currentPrice: latest, changePercent, source: "tsanghi" };
}

function barsToCandles(bars: TsanghiBar[]): MarketKlineCandle[] {
  return bars
    .map((bar) => {
      const open = normalizeNumber(bar.open);
      const high = normalizeNumber(bar.high);
      const low = normalizeNumber(bar.low);
      const close = normalizeNumber(bar.close);
      const volume = normalizeNumber(bar.volume);
      if (open === null || high === null || low === null || close === null) return null;
      return {
        time: normalizeTime(bar.date),
        open,
        high,
        low,
        close,
        volume: volume ?? undefined,
      } satisfies MarketKlineCandle;
    })
    .filter(Boolean) as MarketKlineCandle[];
}

function fallbackWatchlist(note: string): TsanghiWatchlistSnapshot {
  return { asOf: new Date().toISOString(), provider: "fallback", note, quotes: {} };
}

function cacheWatchlistSnapshot(value: TsanghiWatchlistSnapshot) {
  globalThis.__tsanghiWatchlistCache__ = {
    expiresAt: Date.now() + MARKET_REFRESH_INTERVAL_MS,
    value,
  };
  return value;
}

function cacheBoardSnapshot(symbol: MarketWatchlistSymbol, value: TsanghiMarketBoardSnapshot) {
  globalThis.__tsanghiBoardCache__ = {
    ...(globalThis.__tsanghiBoardCache__ ?? {}),
    [symbol]: { expiresAt: Date.now() + MARKET_REFRESH_INTERVAL_MS, value },
  };
  return value;
}

function cachePulseResult(value: { asOf: string; signals: ExternalMarketSignal[]; note: string }) {
  globalThis.__tsanghiPulseCache__ = {
    expiresAt: Date.now() + MARKET_REFRESH_INTERVAL_MS,
    value,
  };
  return value;
}

// 小并发限制：分批拉取，规避网络/免费套餐对一次性 10 路连接的丢弃（实测 10 并发会整批失败）。
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...(await Promise.all(items.slice(i, i + limit).map(fn))));
  }
  return out;
}

let tsanghiWatchlistInflight: Promise<TsanghiWatchlistSnapshot> | null = null;

export async function fetchTsanghiWatchlistSnapshot(): Promise<TsanghiWatchlistSnapshot> {
  const cached = globalThis.__tsanghiWatchlistCache__;
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  // 并发去重：同一进程内多个 SSR 调用（轮播 + 市场板）共享同一次拉取，避免重复打配额。
  if (tsanghiWatchlistInflight) return tsanghiWatchlistInflight;
  tsanghiWatchlistInflight = computeTsanghiWatchlistSnapshot().finally(() => {
    tsanghiWatchlistInflight = null;
  });
  return tsanghiWatchlistInflight;
}

async function computeTsanghiWatchlistSnapshot(): Promise<TsanghiWatchlistSnapshot> {
  if (!env.TSANGHI_API_TOKEN) {
    return cacheWatchlistSnapshot(
      fallbackWatchlist(
        `未配置沧海数据 token，首页轮播条与市场页当前使用教学观察池，并按每 ${MARKET_REFRESH_INTERVAL_LABEL} 自动刷新。`,
      ),
    );
  }

  // limit=2 取报价(最新两根)，同时把这 2 根真实走势(昨收→现价)喂给排行/预览评分、与现价同源；
  // 分批(每批 5)并发，规避网络/免费套餐对一次性 10 路连接的丢弃。
  const results = await mapWithConcurrency(
    MARKET_WATCHLIST_SYMBOLS,
    5,
    async (symbol) => [symbol, await fetchSymbolBars(symbol, 2)] as const,
  );

  const quotes: Partial<Record<MarketWatchlistSymbol, QuoteInput>> = {};
  const candlesBySymbol: Partial<Record<MarketWatchlistSymbol, MarketKlineCandle[]>> = {};
  const notes = new Set<string>();
  for (const [symbol, result] of results) {
    if (!result.ok) {
      notes.add(result.message);
      continue;
    }
    const quote = barsToQuote(result.bars);
    if (quote) quotes[symbol] = quote;
    const candles = barsToCandles(result.bars).slice(-24);
    if (candles.length > 0) candlesBySymbol[symbol] = candles;
  }

  const liveCount = Object.values(quotes).filter((q) => typeof q?.currentPrice === "number").length;
  const provider: MarketDataProvider =
    liveCount === 0 ? "fallback" : liveCount === MARKET_WATCHLIST_SYMBOLS.length ? "tsanghi" : "hybrid";

  const note =
    provider === "tsanghi"
      ? `沧海数据真实日线收盘已接入，观察池按每 ${MARKET_REFRESH_INTERVAL_LABEL} 自动刷新一次（每天收盘后才更新一次，不是盘中实时价）。`
      : provider === "hybrid"
        ? `沧海数据已返回部分真实日线，缺失部分会自动用教学观察池补齐，并按每 ${MARKET_REFRESH_INTERVAL_LABEL} 重试。`
        : `沧海数据本次没有返回可用日线，已切换到教学观察池，并会在每 ${MARKET_REFRESH_INTERVAL_LABEL} 自动重试。`;

  return cacheWatchlistSnapshot({
    asOf: new Date().toISOString(),
    provider,
    note: [note, ...Array.from(notes).slice(0, 1)].join(" "),
    quotes,
    candlesBySymbol,
  });
}

export async function fetchTsanghiMarketBoardSnapshot(
  symbol: MarketWatchlistSymbol,
): Promise<TsanghiMarketBoardSnapshot> {
  const cached = globalThis.__tsanghiBoardCache__?.[symbol];
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  // watchlist(各只 2 根真实序列) 与选中只的 30 根 K 线并发拉取：选中只用富走势画图+评分，
  // 其余只用 watchlist 的 2 点真实序列喂预览评分。
  const [watchlist, selectedResult] = await Promise.all([
    fetchTsanghiWatchlistSnapshot(),
    fetchSymbolBars(symbol, 30),
  ]);
  const selectedCandles = selectedResult.ok ? barsToCandles(selectedResult.bars).slice(-24) : [];
  const candles =
    selectedCandles.length >= 4 ? selectedCandles : (watchlist.candlesBySymbol?.[symbol] ?? []);
  const klineLive = candles.length >= 4;
  const instrument = TSANGHI_INSTRUMENT[symbol];

  const provider: MarketDataProvider =
    watchlist.provider === "tsanghi" && klineLive
      ? "tsanghi"
      : watchlist.provider === "fallback" && !klineLive
        ? "fallback"
        : "hybrid";

  const notes = [
    watchlist.note,
    !klineLive ? `沧海数据当前没有返回足够的日 K 线，已使用教学曲线补齐展示。` : null,
  ].filter((item, index, list): item is string => Boolean(item) && list.indexOf(item) === index);

  // 数据新鲜度按「最新交易日」而非拉取时刻展示，避免把昨日收盘误标成此刻现价。
  const asOf = klineLive ? (candles.at(-1)?.time ?? new Date().toISOString()) : new Date().toISOString();
  return cacheBoardSnapshot(symbol, {
    asOf,
    provider,
    note: notes.join(" "),
    quotes: watchlist.quotes,
    // 选中只并入 30 根富走势喂其预览评分；其余只沿用 watchlist 的 2 点真实序列。
    candlesBySymbol:
      selectedCandles.length >= 4
        ? { ...(watchlist.candlesBySymbol ?? {}), [symbol]: selectedCandles }
        : watchlist.candlesBySymbol,
    selectedKline: klineLive ? candles.map((c) => c.close) : undefined,
    selectedCandles: klineLive ? candles : undefined,
    staticInfo: { exchange: instrument.exchangeName, currency: instrument.currency },
  });
}

export async function fetchTsanghiMarketPulse() {
  const cached = globalThis.__tsanghiPulseCache__;
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const snapshot = await fetchTsanghiWatchlistSnapshot();
  if (snapshot.provider === "fallback") {
    return cachePulseResult({ asOf: snapshot.asOf, signals: [], note: snapshot.note });
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
        source: "tsanghi" as const,
        summary: metadata.observationAngle,
      } satisfies ExternalMarketSignal;
    })
    .filter(Boolean) as ExternalMarketSignal[];

  return cachePulseResult({ asOf: snapshot.asOf, signals, note: snapshot.note });
}
