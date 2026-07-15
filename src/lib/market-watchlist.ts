import type {
  MarketBoardContentCard,
  MarketBoardMetric,
  MarketBoardPayload,
  MarketBoardSector,
  MarketBoardStock,
  MarketCategoryId,
  MarketCategoryTab,
  MarketDataProvider,
  MarketKlineCandle,
  MarketQuoteSource,
  MarketWatchlistSymbol,
  TickerTapeItem,
} from "@/lib/types";
import {
  CATEGORY_LABELS,
  MARKET_CATEGORY_ORDER,
  NON_US_CATEGORY_INSTRUMENTS,
  US_ROUTING,
  industryImagePath,
  marketSymbolIconPath,
  type CatalogInstrument,
} from "@/lib/market-catalog";
import { MARKET_REFRESH_INTERVAL_LABEL } from "@/lib/market-refresh";
import { clamp } from "@/lib/utils";

type MarketMetadata = {
  symbol: MarketWatchlistSymbol;
  code: string;
  name: string;
  companyName: string;
  sector: string;
  sectorGroup:
    | "半导体与设备"
    | "云与企业软件"
    | "AI平台"
    | "电商与云消费"
    | "汽车与机器人"
    | "通信基础设施";
  tags: string[];
  monogram: string;
  accentColor: string;
  summary: string;
  teachingNote: string;
  observationAngle: string;
  aiRelevance: number;
  sectorHeat: number;
  fallbackPrice: number;
  fallbackChange: number;
  fallbackSeries: number[];
};

type QuoteInput = {
  currentPrice?: number | null;
  changePercent?: number | null;
  source?: MarketQuoteSource;
};

type StaticInfoInput = {
  nameCn?: string;
  nameEn?: string;
  currency?: string;
  exchange?: string;
  board?: string;
  lotSize?: string;
  totalShares?: string;
  circulatingShares?: string;
};

type BuilderInput = {
  // 选中标的 id（美股=固定 union 值，新分类=裸 ticker）。
  selectedSymbol?: string;
  asOf?: string;
  provider?: MarketDataProvider;
  note?: string;
  quotes?: Record<string, QuoteInput>;
  klineSeries?: number[];
  klineCandles?: MarketKlineCandle[];
  // 选中标的 K 线来源。用于 quote 缺失但 K 线真实可用时，从收盘价派生头部行情。
  klineSource?: MarketQuoteSource;
  staticInfo?: StaticInfoInput;
  // 每只 symbol 的真实收盘序列：让排行/预览评分吃真实走势而非合成兜底（实时 provider 才会传）。
  seriesBySymbol?: Record<string, number[]>;
};

export const MARKET_WATCHLIST_SYMBOLS: MarketWatchlistSymbol[] = [
  "MU",
  "MSFT",
  "NVDA",
  "AMZN",
  "META",
  "GOOG",
  "AVGO",
  "ORCL",
  "TSLA",
  "TSM",
];

const MARKET_METADATA: Record<MarketWatchlistSymbol, MarketMetadata> = {
  MU: {
    symbol: "MU",
    code: "MU.US",
    name: "美光科技",
    companyName: "Micron Technology",
    sector: "存储芯片",
    sectorGroup: "半导体与设备",
    tags: ["HBM", "存储周期", "AI服务器"],
    monogram: "MU",
    accentColor: "#1aa3a8",
    summary: "存储价格周期与 AI 服务器扩容，常常一起推动美光的弹性。",
    teachingNote: "适合观察“景气周期 + AI 需求外溢”如何影响半导体链条，不一定最稳，但很有节奏感。",
    observationAngle: "重点看库存周期和 AI 服务器的配套需求是否继续释放。",
    aiRelevance: 84,
    sectorHeat: 82,
    fallbackPrice: 439.145,
    fallbackChange: 2.95,
    fallbackSeries: [412, 416, 421, 428, 425, 431, 436, 439],
  },
  MSFT: {
    symbol: "MSFT",
    code: "MSFT.US",
    name: "微软",
    companyName: "Microsoft",
    sector: "云与企业软件",
    sectorGroup: "云与企业软件",
    tags: ["Azure", "Copilot", "企业软件"],
    monogram: "MS",
    accentColor: "#4f8ef7",
    summary: "微软常被当作 AI 商业化落地与企业预算韧性的组合样本。",
    teachingNote: "适合观察平台型公司如何把 AI 能力变成企业订阅收入，风险通常比高弹性芯片股更可控。",
    observationAngle: "重点看企业预算、云增长与 AI 工具商业化之间的联动。",
    aiRelevance: 92,
    sectorHeat: 88,
    fallbackPrice: 392.56,
    fallbackChange: 2.13,
    fallbackSeries: [372, 376, 379, 381, 386, 389, 391, 393],
  },
  NVDA: {
    symbol: "NVDA",
    code: "NVDA.US",
    name: "英伟达",
    companyName: "NVIDIA",
    sector: "AI 芯片平台",
    sectorGroup: "半导体与设备",
    tags: ["GPU", "算力", "平台生态"],
    monogram: "NV",
    accentColor: "#77d74c",
    summary: "英伟达是 AI 风险偏好最直观的风向标之一，但波动也更显著。",
    teachingNote: "适合观察高景气龙头的强趋势与高波动如何同时存在，训练仓位节奏感很有代表性。",
    observationAngle: "重点看高景气延续、估值容忍度和资金集中度之间的关系。",
    aiRelevance: 98,
    sectorHeat: 94,
    fallbackPrice: 878.2,
    fallbackChange: 1.86,
    fallbackSeries: [812, 826, 835, 844, 858, 866, 871, 878],
  },
  AMZN: {
    symbol: "AMZN",
    code: "AMZN.US",
    name: "亚马逊",
    companyName: "Amazon",
    sector: "电商与云",
    sectorGroup: "电商与云消费",
    tags: ["AWS", "电商消费", "云基础设施"],
    monogram: "AZ",
    accentColor: "#f08a38",
    summary: "亚马逊横跨消费与云业务，适合观察两种节奏如何在一家公司里叠加。",
    teachingNote: "适合训练“多引擎公司”的判断方式，不同业务线的冷暖会一起影响市场预期。",
    observationAngle: "重点看 AWS 资本开支与消费业务利润率能否形成同向支撑。",
    aiRelevance: 78,
    sectorHeat: 74,
    fallbackPrice: 246.33,
    fallbackChange: 2.68,
    fallbackSeries: [231, 233, 236, 239, 241, 243, 245, 246],
  },
  META: {
    symbol: "META",
    code: "META.US",
    name: "Meta",
    companyName: "Meta Platforms",
    sector: "广告与 AI 平台",
    sectorGroup: "AI平台",
    tags: ["广告平台", "Llama", "AI 应用"],
    monogram: "ME",
    accentColor: "#5c8dff",
    summary: "Meta 兼具广告现金流与 AI 平台想象力，是情绪和兑现度的双重样本。",
    teachingNote: "适合观察“现金流护城河 + 新叙事投入”如何一起影响市场对平台公司的定价。",
    observationAngle: "重点看广告基本盘是否继续给 AI 投入提供安全垫。",
    aiRelevance: 90,
    sectorHeat: 86,
    fallbackPrice: 653.7,
    fallbackChange: 3.02,
    fallbackSeries: [602, 611, 623, 631, 638, 644, 649, 654],
  },
  GOOG: {
    symbol: "GOOG",
    code: "GOOG.US",
    name: "谷歌",
    companyName: "Alphabet",
    sector: "搜索与 AI 平台",
    sectorGroup: "AI平台",
    tags: ["搜索", "云平台", "Gemini"],
    monogram: "GO",
    accentColor: "#58a6ff",
    summary: "谷歌代表的是成熟平台在 AI 转型中的节奏管理，而不是单纯追热点。",
    teachingNote: "适合观察“老业务护城河 + 新技术切换”之间的平衡，对理解大盘权重股很有帮助。",
    observationAngle: "重点看搜索护城河、云利润率和 AI 产品落地之间的配合度。",
    aiRelevance: 89,
    sectorHeat: 83,
    fallbackPrice: 325.64,
    fallbackChange: 2.01,
    fallbackSeries: [308, 311, 314, 316, 319, 322, 324, 326],
  },
  AVGO: {
    symbol: "AVGO",
    code: "AVGO.US",
    name: "博通",
    companyName: "Broadcom",
    sector: "通信芯片与基础设施",
    sectorGroup: "通信基础设施",
    tags: ["网络芯片", "VMware", "AI 互连"],
    monogram: "AV",
    accentColor: "#ff7b72",
    summary: "博通常被用来观察 AI 基础设施中“网络与互连”这条相对少被注意的主线。",
    teachingNote: "适合帮助学生理解，AI 产业链并不只有 GPU，还包括网络、连接和企业软件整合。",
    observationAngle: "重点看网络基础设施需求和并购整合后的利润质量。",
    aiRelevance: 76,
    sectorHeat: 79,
    fallbackPrice: 378.41,
    fallbackChange: -0.35,
    fallbackSeries: [391, 389, 386, 384, 382, 381, 380, 378],
  },
  ORCL: {
    symbol: "ORCL",
    code: "ORCL.US",
    name: "甲骨文",
    companyName: "Oracle",
    sector: "数据库与企业云",
    sectorGroup: "云与企业软件",
    tags: ["数据库", "企业云", "数据中心"],
    monogram: "OR",
    accentColor: "#f45b5b",
    summary: "甲骨文是传统企业软件向 AI 基础设施扩展的过渡型观察样本。",
    teachingNote: "适合观察老牌软件公司在新周期里的再定价过程，节奏通常比纯概念股更清晰。",
    observationAngle: "重点看数据中心订单与企业客户迁移是否支撑估值重估。",
    aiRelevance: 71,
    sectorHeat: 68,
    fallbackPrice: 164.535,
    fallbackChange: 5.73,
    fallbackSeries: [148, 151, 154, 156, 159, 161, 163, 165],
  },
  TSLA: {
    symbol: "TSLA",
    code: "TSLA.US",
    name: "特斯拉",
    companyName: "Tesla",
    sector: "汽车与机器人",
    sectorGroup: "汽车与机器人",
    tags: ["电动车", "机器人", "自动驾驶"],
    monogram: "TS",
    accentColor: "#e5546f",
    summary: "特斯拉更像高波动叙事资产，适合训练“题材强、波动大”时的节奏感。",
    teachingNote: "适合复盘情绪、叙事和业绩预期如何同时影响价格，不适合用来做保证式判断。",
    observationAngle: "重点看交付、利润率与机器人/自动驾驶叙事之间谁在主导定价。",
    aiRelevance: 74,
    sectorHeat: 81,
    fallbackPrice: 167.22,
    fallbackChange: -1.24,
    fallbackSeries: [191, 187, 184, 180, 176, 173, 170, 167],
  },
  TSM: {
    symbol: "TSM",
    code: "TSM.US",
    name: "台积电",
    companyName: "Taiwan Semiconductor",
    sector: "晶圆代工",
    sectorGroup: "半导体与设备",
    tags: ["先进制程", "代工", "AI 芯片"],
    monogram: "TSM",
    accentColor: "#50c1a2",
    summary: "台积电是 AI 产业链里最接近“真实产能约束”的核心样本之一。",
    teachingNote: "适合观察产业景气是不是正在兑现到真实产能和订单，而不只是留在概念叙事里。",
    observationAngle: "重点看先进制程稼动率和大客户订单是否持续稳健。",
    aiRelevance: 88,
    sectorHeat: 91,
    fallbackPrice: 375.99,
    fallbackChange: 1.74,
    fallbackSeries: [351, 356, 361, 365, 368, 371, 374, 376],
  },
};

export function isMarketWatchlistSymbol(value: string): value is MarketWatchlistSymbol {
  return MARKET_WATCHLIST_SYMBOLS.includes(value as MarketWatchlistSymbol);
}

export function resolveMarketWatchlistSymbol(value?: string | null): MarketWatchlistSymbol {
  if (!value) return "NVDA";
  const normalized = value.trim().toUpperCase();
  return isMarketWatchlistSymbol(normalized) ? normalized : "NVDA";
}

export function getMarketMetadata(symbol: MarketWatchlistSymbol) {
  return MARKET_METADATA[symbol];
}

// 把现有美股元数据 + 路由字段拼成统一的 CatalogInstrument —— 美股盘数据与排序保持字节级不变。
function metadataToInstrument(symbol: MarketWatchlistSymbol): CatalogInstrument {
  const m = MARKET_METADATA[symbol];
  const r = US_ROUTING[symbol];
  return {
    id: symbol,
    category: "us",
    kind: "stock",
    exchange: r.exchange,
    ticker: r.ticker,
    exchangeName: r.exchangeName,
    currency: r.currency,
    code: m.code,
    name: m.name,
    companyName: m.companyName,
    sector: m.sector,
    sectorGroup: m.sectorGroup,
    industryKey: r.industryKey,
    tags: m.tags,
    monogram: m.monogram,
    accentColor: m.accentColor,
    summary: m.summary,
    teachingNote: m.teachingNote,
    observationAngle: m.observationAngle,
    aiRelevance: m.aiRelevance,
    sectorHeat: m.sectorHeat,
    fallbackPrice: m.fallbackPrice,
    fallbackChange: m.fallbackChange,
    fallbackSeries: m.fallbackSeries,
  };
}

const US_INSTRUMENTS: CatalogInstrument[] = MARKET_WATCHLIST_SYMBOLS.map(metadataToInstrument);

export const MARKET_CATALOG: Record<MarketCategoryId, CatalogInstrument[]> = {
  us: US_INSTRUMENTS,
  cn: NON_US_CATEGORY_INSTRUMENTS.cn,
  hk: NON_US_CATEGORY_INSTRUMENTS.hk,
  fund: NON_US_CATEGORY_INSTRUMENTS.fund,
};

export function getCategoryInstruments(category: MarketCategoryId): CatalogInstrument[] {
  return MARKET_CATALOG[category] ?? MARKET_CATALOG.us;
}

export function resolveMarketCategory(value?: string | null): MarketCategoryId {
  const v = (value ?? "").trim().toLowerCase();
  return (MARKET_CATEGORY_ORDER as string[]).includes(v) ? (v as MarketCategoryId) : "us";
}

// 在某分类内把外部传入的 symbol 收敛到合法 id（大小写不敏感），非法时回退该类首个标的。
export function resolveCategoryInstrumentId(category: MarketCategoryId, value?: string | null): string {
  const list = getCategoryInstruments(category);
  const want = (value ?? "").trim();
  const hit = list.find((i) => i.id === want || i.id.toUpperCase() === want.toUpperCase());
  return hit?.id ?? list[0].id;
}

export function getCatalogInstrument(category: MarketCategoryId, id: string): CatalogInstrument | undefined {
  return getCategoryInstruments(category).find((i) => i.id === id);
}

function categoryTabs(): MarketCategoryTab[] {
  return MARKET_CATEGORY_ORDER.map((id) => ({
    id,
    ...CATEGORY_LABELS[id],
    defaultSymbol: getCategoryInstruments(id)[0].id,
  }));
}

function resolveQuote(instrument: CatalogInstrument, quotes?: BuilderInput["quotes"]) {
  const quote = quotes?.[instrument.id];

  return {
    currentPrice: quote?.currentPrice ?? instrument.fallbackPrice,
    changePercent: quote?.changePercent ?? instrument.fallbackChange,
    source:
      quote?.source && typeof quote.currentPrice === "number" ? quote.source : ("fallback" as const),
  };
}

function quoteFromLiveKline(
  source: MarketQuoteSource | undefined,
  series: number[] | undefined,
  candles?: MarketKlineCandle[],
) {
  if (source !== "tsanghi") return null;

  const candleCloses = (candles ?? [])
    .map((candle) => candle.close)
    .filter((value) => Number.isFinite(value));
  const closes = candleCloses.length >= 2 ? candleCloses : (series ?? []).filter((value) => Number.isFinite(value));
  if (closes.length < 2) return null;

  const latest = closes.at(-1)!;
  const previous = closes.at(-2)!;
  if (!Number.isFinite(latest) || !Number.isFinite(previous) || previous <= 0) return null;

  return {
    currentPrice: Number(latest.toFixed(3)),
    changePercent: Number((((latest - previous) / previous) * 100).toFixed(2)),
    source,
  };
}

function buildSyntheticCandles(series: number[]): MarketKlineCandle[] {
  const values = series.length >= 4 ? series : [100, 101, 100.4, 102];
  const now = Date.now();

  return values.map((close, index) => {
    const previous = index === 0 ? close * 0.992 : values[index - 1];
    const open = previous ?? close;
    const spread = Math.max(Math.abs(close - open), close * 0.006);
    const high = Math.max(open, close) + spread * 0.42;
    const low = Math.max(0.01, Math.min(open, close) - spread * 0.36);

    return {
      time: new Date(now - (values.length - 1 - index) * 24 * 60 * 60 * 1000).toISOString(),
      open: Number(open.toFixed(3)),
      high: Number(high.toFixed(3)),
      low: Number(low.toFixed(3)),
      close: Number(close.toFixed(3)),
    };
  });
}

function normalizeCandles(
  candles: MarketKlineCandle[] | undefined,
  series: number[],
): MarketKlineCandle[] {
  const valid = (candles ?? []).filter(
    (item) =>
      Number.isFinite(item.open) &&
      Number.isFinite(item.high) &&
      Number.isFinite(item.low) &&
      Number.isFinite(item.close),
  );

  return valid.length >= 4 ? valid.slice(-24) : buildSyntheticCandles(series).slice(-24);
}

function formatShares(raw?: string) {
  if (!raw) return "教学观察";
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return raw;

  if (parsed >= 1_000_000_000_000) {
    return `${(parsed / 1_000_000_000_000).toFixed(2)} 万亿`;
  }

  if (parsed >= 1_000_000_000) {
    return `${(parsed / 1_000_000_000).toFixed(2)} 亿`;
  }

  if (parsed >= 1_000_000) {
    return `${(parsed / 1_000_000).toFixed(2)} 百万`;
  }

  return raw;
}

function buildMomentumScore(series: number[], changePercent: number) {
  const slope = series.length > 1 ? (series.at(-1)! - series[0]) / Math.max(series[0], 1) : 0;
  return clamp(Math.round(56 + slope * 180 + changePercent * 4), 32, 96);
}

function buildVolatilityScore(series: number[]) {
  if (series.length < 2) return 50;
  const changes = series.slice(1).map((value, index) => (value - series[index]) / Math.max(series[index], 1));
  const average = changes.reduce((sum, value) => sum + value, 0) / changes.length;
  const variance =
    changes.reduce((sum, value) => sum + (value - average) ** 2, 0) / Math.max(changes.length, 1);
  const volatility = Math.sqrt(variance);
  return clamp(Math.round(38 + volatility * 1200), 24, 93);
}

function buildTrendIntegrity(series: number[]) {
  if (series.length < 2) return 50;
  const upMoves = series.slice(1).filter((value, index) => value >= series[index]).length;
  return clamp(Math.round(34 + (upMoves / (series.length - 1)) * 58), 28, 94);
}

function buildTeachingMetrics(
  metadata: CatalogInstrument,
  currentPrice: number,
  changePercent: number,
  series: number[],
): MarketBoardMetric[] {
  const priceMomentum = buildMomentumScore(series, changePercent);
  const volatilityRisk = buildVolatilityScore(series);
  const trendIntegrity = buildTrendIntegrity(series);
  const industryHeat = clamp(Math.round(metadata.sectorHeat + changePercent * 1.6), 35, 95);
  const aiRelevance = clamp(metadata.aiRelevance, 38, 98);
  const watchPriority = clamp(
    Math.round((priceMomentum * 0.26 + industryHeat * 0.2 + aiRelevance * 0.24 + trendIntegrity * 0.3) / 1),
    35,
    97,
  );

  return [
    {
      id: "price-momentum",
      label: "价格动量",
      score: priceMomentum,
      note: `现价 ${currentPrice.toFixed(2)}，日内涨跌 ${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%。`,
    },
    {
      id: "volatility-risk",
      label: "波动风险",
      score: volatilityRisk,
      note: "分数越高代表波动张力越大，复盘时更要重视仓位节奏。",
    },
    {
      id: "industry-heat",
      label: "行业热度",
      score: industryHeat,
      note: `${metadata.sectorGroup} 当前在观察池里热度靠前，适合做板块联动观察。`,
    },
    {
      id: "ai-relevance",
      label: "AI相关度",
      score: aiRelevance,
      note: "用于强调这家公司与 AI 主线的关联强弱，不代表短期涨跌承诺。",
    },
    {
      id: "trend-integrity",
      label: "趋势完整度",
      score: trendIntegrity,
      note: "用于观察走势是否连贯，而不是只看单日涨跌。",
    },
    {
      id: "watch-priority",
      label: "观察优先级",
      score: watchPriority,
      note: `当前建议优先从“${metadata.observationAngle}”这个角度来跟踪。`,
    },
  ];
}

function buildFacts(metadata: CatalogInstrument, staticInfo?: StaticInfoInput) {
  return [
    {
      label: "行业板块",
      value: staticInfo?.board || metadata.sector,
    },
    {
      label: "交易所",
      value: staticInfo?.exchange || metadata.exchangeName,
    },
    {
      label: "交易货币",
      value: staticInfo?.currency || metadata.currency,
    },
    {
      label: "每手股数",
      value: staticInfo?.lotSize || "1",
    },
    {
      label: "总股本",
      value: formatShares(staticInfo?.totalShares),
    },
    {
      label: "流通股本",
      value: formatShares(staticInfo?.circulatingShares),
    },
  ];
}

function buildOverallScore(metrics: MarketBoardMetric[]) {
  const average = metrics.reduce((sum, item) => sum + item.score, 0) / metrics.length;
  return Number((average / 10).toFixed(2));
}

function buildObservationNotes(
  selected: MarketBoardStock,
  marketSummary: MarketBoardPayload["marketSummary"],
  sectorPerformance: MarketBoardSector[],
  provider: MarketBoardPayload["provider"],
) {
  const leader = marketSummary[0];
  const weakest = [...marketSummary].sort((left, right) => left.changePercent - right.changePercent)[0];
  const hottestSector = sectorPerformance[0];

  const notes = [
    `${selected.name} 当前更适合从“${selected.teachingNote}”这个框架来理解，而不是只盯着单日涨跌。`,
    hottestSector
      ? `${hottestSector.label} 暂时是观察池里最热的板块之一，可用来判断是否存在板块扩散。`
      : "当前观察池没有明显单边主线，更适合比较各板块的节奏差异。",
    leader
      ? `${leader.name} 目前综合评分领先，说明它在动量、主题与观察优先级上同时占优。`
      : "当前没有明显领跑标的，优先看结构而不是追逐单点表现。",
    weakest
      ? `${weakest.name} 短线相对承压，更适合作为“高波动资产如何管理仓位”的反向样本。`
      : "当前回落样本不多，需警惕情绪一致时的回撤风险。",
    provider === "fallback"
      ? "当前行情字段已回退到教学观察池，适合用来看结构、节奏和复盘逻辑。"
      : provider === "tsanghi"
      ? "当前价格是沧海真实「日线收盘价」（每天收盘后才更新一次、盘中不变），适合练结构与趋势判断，别当实时行情追涨杀跌。"
      : "当前行情已接入外部实时字段，可把价格变化与教学评分一起交叉阅读。",
  ];

  return notes.slice(0, 4);
}

function buildContentCards(selected: MarketBoardStock): MarketBoardContentCard[] {
  return [
    {
      id: `${selected.symbol}-feature`,
      variant: "feature",
      title: `${selected.name} 为什么适合做课堂观察样本`,
      summary: `${selected.name} 属于 ${selected.sectorGroup}，既能看到价格波动，也能训练学生把行业位置、主题强弱和仓位节奏放在同一张图里理解。`,
      sourceLabel: "课堂观察精选",
      accentColor: selected.accentColor,
    },
    {
      id: `${selected.symbol}-brief-1`,
      variant: "brief",
      title: "先看主线，再看节奏",
      summary: `如果 ${selected.name} 所在主线持续变热，优先关注它的趋势完整度，而不是追逐最高点。`,
      sourceLabel: "复盘提示",
      accentColor: "#f08a38",
    },
    {
      id: `${selected.symbol}-brief-2`,
      variant: "brief",
      title: "波动并不等于错误",
      summary: "高波动资产更适合训练仓位管理和观察框架，不适合用来追求保证式判断。",
      sourceLabel: "风险提醒",
      accentColor: "#6f7ef7",
    },
    {
      id: `${selected.symbol}-brief-3`,
      variant: "brief",
      title: "用行业联动做二次验证",
      summary: `把 ${selected.name} 与同组板块一起看，能更快判断它是个股强势还是板块共振。`,
      sourceLabel: "教学建议",
      accentColor: "#7dd3a6",
    },
  ];
}

function toTickerItem(
  instrument: CatalogInstrument,
  quote: ReturnType<typeof resolveQuote>,
): TickerTapeItem {
  return {
    symbol: instrument.id,
    code: instrument.code,
    name: instrument.name,
    companyName: instrument.companyName,
    currentPrice: quote.currentPrice,
    changePercent: quote.changePercent,
    source: quote.source,
    accentColor: instrument.accentColor,
    monogram: instrument.monogram,
    sector: instrument.sector,
    sectorGroup: instrument.sectorGroup,
    tags: instrument.tags,
    imageUrl: marketSymbolIconPath(instrument.id),
  } satisfies TickerTapeItem;
}

// 首页轮播条 / 脉冲只用美股观察池（保持现有公开站行为）。
export function buildTickerTapeItems(input?: Pick<BuilderInput, "quotes">): TickerTapeItem[] {
  return US_INSTRUMENTS.map((instrument) => toTickerItem(instrument, resolveQuote(instrument, input?.quotes)));
}

function humanizeMarketBoardNote(
  note: string | undefined,
  provider: MarketDataProvider,
) {
  const fallbackMessage = `iTick 行情当前异常时会自动回退到教学观察池，并按每 ${MARKET_REFRESH_INTERVAL_LABEL} 自动重试。`;
  if (!note) {
    return provider === "tsanghi"
      ? `沧海数据真实日线收盘已接入，观察池按每 ${MARKET_REFRESH_INTERVAL_LABEL} 自动刷新（每天收盘后才更新一次，不是盘中实时价）。`
      : provider === "itick"
      ? `iTick 实时行情与日 K 线已接入，观察池按每 ${MARKET_REFRESH_INTERVAL_LABEL} 自动刷新。`
      : provider === "alltick"
        ? `AllTick 实时字段已接入，观察池按每 ${MARKET_REFRESH_INTERVAL_LABEL} 自动刷新。`
      : fallbackMessage;
  }

  const normalized = note.toLowerCase();
  if (
    normalized.includes("token invalid") ||
    normalized.includes("unauthorized") ||
    normalized.includes("http 4") ||
    normalized.includes("http 5") ||
    normalized.includes("ret=")
  ) {
    return `外部行情当前鉴权或权限返回异常，已自动切换到教学观察池，并按每 ${MARKET_REFRESH_INTERVAL_LABEL} 自动重试。`;
  }

  if (
    normalized.includes("timeout") ||
    normalized.includes("network") ||
    normalized.includes("超时") ||
    normalized.includes("网络")
  ) {
    return `外部行情当前请求波动，已回退到教学观察池，并会在每 ${MARKET_REFRESH_INTERVAL_LABEL} 自动重试。`;
  }

  if (provider === "hybrid") {
    return `外部行情当前仅返回了部分字段，缺失部分已由教学观察池补齐，并按每 ${MARKET_REFRESH_INTERVAL_LABEL} 自动刷新。`;
  }

  if (provider === "tsanghi") {
    return `沧海数据真实日线收盘已接入，观察池按每 ${MARKET_REFRESH_INTERVAL_LABEL} 自动刷新（每天收盘后才更新一次，不是盘中实时价）。`;
  }

  if (provider === "itick") {
    return `iTick 实时行情与日 K 线已接入，观察池按每 ${MARKET_REFRESH_INTERVAL_LABEL} 自动刷新。`;
  }

  if (provider === "alltick") {
    return `AllTick 实时字段已接入，观察池按每 ${MARKET_REFRESH_INTERVAL_LABEL} 自动刷新。`;
  }

  return fallbackMessage;
}

// 分类驱动的统一看板构建器：任意分类(美股/A股/港股/基金)同一套结构。
export function buildCategoryBoardPayload(
  category: MarketCategoryId,
  input?: BuilderInput,
): MarketBoardPayload {
  const instruments = getCategoryInstruments(category);
  const byId = new Map(instruments.map((instrument) => [instrument.id, instrument] as const));
  const selectedId =
    input?.selectedSymbol && byId.has(input.selectedSymbol) ? input.selectedSymbol : instruments[0].id;
  const selectedInstrument = byId.get(selectedId)!;

  const watchlist = instruments.map((instrument) =>
    toTickerItem(instrument, resolveQuote(instrument, input?.quotes)),
  );

  const baseSelectedQuote = resolveQuote(selectedInstrument, input?.quotes);
  const liveSelectedSeries =
    input?.klineSeries && input.klineSeries.length >= 4 ? input.klineSeries : undefined;
  const selectedSeries =
    input?.klineSeries && input.klineSeries.length >= 4
      ? input.klineSeries
      : selectedInstrument.fallbackSeries;
  const selectedCandles = normalizeCandles(input?.klineCandles, selectedSeries);
  const klineQuote = quoteFromLiveKline(input?.klineSource, liveSelectedSeries, input?.klineCandles);
  const selectedQuote = baseSelectedQuote.source === "fallback" && klineQuote ? klineQuote : baseSelectedQuote;
  const metrics = buildTeachingMetrics(
    selectedInstrument,
    selectedQuote.currentPrice,
    selectedQuote.changePercent,
    selectedSeries,
  );
  const selected: MarketBoardStock = {
    symbol: selectedInstrument.id,
    code: selectedInstrument.code,
    name: input?.staticInfo?.nameCn || selectedInstrument.name,
    companyName: input?.staticInfo?.nameEn || selectedInstrument.companyName,
    currentPrice: selectedQuote.currentPrice,
    changePercent: selectedQuote.changePercent,
    source: selectedQuote.source,
    score: buildOverallScore(metrics),
    summary: selectedInstrument.summary,
    teachingNote: selectedInstrument.teachingNote,
    sector: selectedInstrument.sector,
    sectorGroup: selectedInstrument.sectorGroup,
    tags: selectedInstrument.tags,
    monogram: selectedInstrument.monogram,
    accentColor: selectedInstrument.accentColor,
    miniSeries: selectedSeries,
    candles: selectedCandles,
    metrics,
    facts: buildFacts(selectedInstrument, input?.staticInfo),
    imageUrl: industryImagePath(selectedInstrument.industryKey),
    symbolImageUrl: marketSymbolIconPath(selectedInstrument.id),
    currency: selectedInstrument.currency,
  };

  const marketSummary = watchlist
    .map((item) => {
      const instrument = byId.get(item.symbol)!;
      const previewMetrics = buildTeachingMetrics(
        instrument,
        item.currentPrice,
        item.changePercent,
        // 有真实走势就用真实的（与现价同源），否则回退教学曲线。
        input?.seriesBySymbol?.[item.symbol] ?? instrument.fallbackSeries,
      );

      return {
        symbol: item.symbol,
        name: item.name,
        currentPrice: item.currentPrice,
        changePercent: item.changePercent,
        score: buildOverallScore(previewMetrics),
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 8);

  const sectorPerformance = Array.from(
    new Map(instruments.map((instrument) => [instrument.sectorGroup, instrument] as const)).values(),
  )
    .map((instrument) => {
      const members = watchlist.filter(
        (item) => byId.get(item.symbol)?.sectorGroup === instrument.sectorGroup,
      );
      const average =
        members.reduce((sum, item) => sum + item.changePercent, 0) / Math.max(members.length, 1);
      const leadSymbol =
        members.slice().sort((left, right) => right.changePercent - left.changePercent)[0]?.symbol ??
        instrument.id;

      return {
        id: instrument.sectorGroup,
        label: instrument.sectorGroup,
        changePercent: Number(average.toFixed(2)),
        leadSymbol,
      } satisfies MarketBoardSector;
    })
    .sort((left, right) => right.changePercent - left.changePercent);

  const sanitizedNote = humanizeMarketBoardNote(input?.note, input?.provider ?? "fallback");

  return {
    asOf: input?.asOf ?? new Date().toISOString(),
    provider: input?.provider ?? "fallback",
    note: sanitizedNote,
    category,
    categories: categoryTabs(),
    watchlist,
    selected,
    marketSummary,
    sectorPerformance,
    observationNotes: buildObservationNotes(selected, marketSummary, sectorPerformance, input?.provider ?? "fallback"),
    contentCards: buildContentCards(selected),
  };
}

// 美股盘 back-compat 包装：行为与原 buildMarketBoardPayload 完全一致（含默认选中 MU）。
export function buildMarketBoardPayload(input?: BuilderInput): MarketBoardPayload {
  return buildCategoryBoardPayload("us", input);
}
