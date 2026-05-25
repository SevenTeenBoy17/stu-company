import type {
  EventCard,
  MarketAsset,
  MarketBoardPayload,
  MarketRound,
  MarketWatchlistSymbol,
  TickerTapeItem,
} from "@/lib/types";
import { fetchMarketBoardSnapshot, fetchWatchlistSnapshot } from "@/lib/alltick";
import { buildMarketBoardPayload, buildTickerTapeItems } from "@/lib/market-watchlist";

export const marketAssets: MarketAsset[] = [
  {
    id: "asset-stock",
    symbol: "BZA",
    name: "智造先锋股票",
    category: "stock",
    description: "受消费信心与科技订单影响较大，波动强，适合训练情绪管理。",
    basePrice: 112,
    risk: "高",
  },
  {
    id: "asset-etf",
    symbol: "EDGE",
    name: "成长力量 ETF",
    category: "etf",
    description: "覆盖多行业龙头，涨跌相对平衡，适合学习分散投资。",
    basePrice: 85,
    risk: "中",
  },
  {
    id: "asset-bond",
    symbol: "SAFE",
    name: "政策稳健债券",
    category: "bond",
    description: "收益平稳、回撤较低，用来构建组合稳定器。",
    basePrice: 102,
    risk: "低",
  },
  {
    id: "asset-commodity",
    symbol: "CORE",
    name: "能源商品篮子",
    category: "commodity",
    description: "受能源与运输链变化影响，适合理解供需与周期。",
    basePrice: 75,
    risk: "中",
  },
  {
    id: "asset-fx",
    symbol: "FXH",
    name: "离岸汇率对冲",
    category: "fx",
    description: "帮助学生感知汇率波动与避险需求之间的关系。",
    basePrice: 64,
    risk: "中",
  },
];

export const eventCards: EventCard[] = [
  {
    id: "event-demand-rebound",
    title: "消费与科技订单共同回暖",
    category: "macro",
    signal: "利好",
    description: "企业补库存与居民消费恢复同步出现，成长资产的风险偏好上升。",
    coachingCue: "适合比较主动加仓与分批布局的区别，不要只看涨幅。",
  },
  {
    id: "event-merger-wave",
    title: "高景气赛道出现并购行情",
    category: "sentiment",
    signal: "利好",
    description: "优质创业项目被高溢价收购，经营者视角的重要性被放大。",
    coachingCue: "这是观察创业投入窗口的好时机，但仍要留意现金流缓冲。",
  },
  {
    id: "event-policy-cooling",
    title: "监管口径转向审慎",
    category: "policy",
    signal: "利空",
    description: "风险资产估值承压，防御性资产与现金流管理的重要性上升。",
    coachingCue: "先看你能不能稳住回撤，再考虑下一步扩张。",
  },
  {
    id: "event-energy-shock",
    title: "能源运输成本快速抬升",
    category: "macro",
    signal: "中性",
    description: "商品与汇率波动放大，市场开始重新定价供需失衡。",
    coachingCue: "适合训练对冲思维，不一定每次都要正面下注。",
  },
  {
    id: "event-liquidity-tightening",
    title: "流动性边际收紧",
    category: "macro",
    signal: "利空",
    description: "融资环境不再宽松，现金与储蓄的安全垫价值上升。",
    coachingCue: "先确保组合有呼吸感，再去追逐高弹性资产。",
  },
  {
    id: "event-confidence-reset",
    title: "情绪修复但分化加大",
    category: "sentiment",
    signal: "中性",
    description: "市场不再恐慌，但只有基本面更扎实的资产得到持续定价。",
    coachingCue: "要学会区分“板块热”与“个股真强”。",
  },
];

export const marketRounds: MarketRound[] = [
  {
    round: 1,
    theme: "开局试盘",
    headline: "课堂资金刚进入市场，情绪谨慎但机会开始浮现",
    summary: "这是建立组合骨架的阶段，先保留现金弹性，再决定主攻方向。",
    assetMultipliers: { stock: 1, etf: 1, bond: 1, commodity: 1, fx: 1 },
    liquidityBoost: 0.4,
    eventId: "event-demand-rebound",
  },
  {
    round: 2,
    theme: "订单回暖",
    headline: "科技与消费链条同步改善，成长资产开始领跑",
    summary: "市场愿意给成长更高权重，但高弹性品种的节奏也会更快。",
    assetMultipliers: { stock: 1.06, etf: 1.04, bond: 0.99, commodity: 1.01, fx: 0.98 },
    liquidityBoost: 0.5,
    eventId: "event-demand-rebound",
  },
  {
    round: 3,
    theme: "并购窗口",
    headline: "高景气赛道出现并购行情",
    summary: "创业与高成长叙事受到追捧，但需要平衡仓位和现金流。",
    assetMultipliers: { stock: 1.13, etf: 1.07, bond: 0.98, commodity: 1.02, fx: 0.97 },
    liquidityBoost: 0.45,
    eventId: "event-merger-wave",
  },
  {
    round: 4,
    theme: "政策转向",
    headline: "监管口径趋于审慎，市场开始重估风险",
    summary: "这个阶段更适合比较主动收缩和被动承压的差别。",
    assetMultipliers: { stock: 0.97, etf: 1.01, bond: 1.03, commodity: 1.01, fx: 1.02 },
    liquidityBoost: 0.7,
    eventId: "event-policy-cooling",
  },
  {
    round: 5,
    theme: "供需扰动",
    headline: "能源与汇率波动放大，外部冲击开始传导",
    summary: "市场进入分化阶段，适合观察对冲思维而不是单边下注。",
    assetMultipliers: { stock: 0.99, etf: 1.02, bond: 1.01, commodity: 1.08, fx: 1.05 },
    liquidityBoost: 0.55,
    eventId: "event-energy-shock",
  },
  {
    round: 6,
    theme: "现金为王",
    headline: "流动性边际收紧，安全垫价值被市场重新强调",
    summary: "这时更适合修复组合呼吸感，再决定是否重返高弹性资产。",
    assetMultipliers: { stock: 0.95, etf: 0.99, bond: 1.05, commodity: 1.03, fx: 1.04 },
    liquidityBoost: 0.9,
    eventId: "event-liquidity-tightening",
  },
  {
    round: 7,
    theme: "修复确认",
    headline: "情绪修复启动，但只有更稳的资产先得到认可",
    summary: "市场开始从恐慌转向筛选，仓位结构比冲动更重要。",
    assetMultipliers: { stock: 1.01, etf: 1.03, bond: 1.04, commodity: 1.02, fx: 1.01 },
    liquidityBoost: 0.7,
    eventId: "event-confidence-reset",
  },
  {
    round: 8,
    theme: "趋势扩散",
    headline: "主线资产重新吸引资金，板块扩散开始出现",
    summary: "这时适合比较“提前埋伏”和“追确认”的差别。",
    assetMultipliers: { stock: 1.08, etf: 1.06, bond: 1.01, commodity: 1.02, fx: 0.99 },
    liquidityBoost: 0.5,
    eventId: "event-demand-rebound",
  },
  {
    round: 9,
    theme: "估值压力",
    headline: "高位资产开始面临估值消化，波动重新加大",
    summary: "不是所有上涨都适合追，先看仓位是否已经过重。",
    assetMultipliers: { stock: 1.02, etf: 1.04, bond: 1.02, commodity: 1.01, fx: 1 },
    liquidityBoost: 0.65,
    eventId: "event-policy-cooling",
  },
  {
    round: 10,
    theme: "结构轮动",
    headline: "资金从高波动资产流向更稳的收益结构",
    summary: "这个阶段适合观察你是不是能把收益留在账户里。",
    assetMultipliers: { stock: 0.99, etf: 1.03, bond: 1.06, commodity: 1.01, fx: 1.02 },
    liquidityBoost: 0.85,
    eventId: "event-liquidity-tightening",
  },
  {
    round: 11,
    theme: "再平衡窗口",
    headline: "市场给出一次重新摆放仓位的窗口",
    summary: "适合比较主动再平衡和被动持有最终带来的差别。",
    assetMultipliers: { stock: 1.05, etf: 1.05, bond: 1.03, commodity: 1.02, fx: 0.99 },
    liquidityBoost: 0.6,
    eventId: "event-confidence-reset",
  },
  {
    round: 12,
    theme: "学期收官",
    headline: "最后一轮更看重净值留存与风险管理，而不是冲动加码",
    summary: "学期收官时最值得比较的是：谁把收益真正留了下来。",
    assetMultipliers: { stock: 1.04, etf: 1.06, bond: 1.04, commodity: 1.03, fx: 1 },
    liquidityBoost: 0.72,
    eventId: "event-merger-wave",
  },
];

export type TickerTapePayload = {
  asOf: string;
  provider: "alltick" | "hybrid" | "fallback";
  note: string;
  items: TickerTapeItem[];
};

export async function getTickerTapePayload(): Promise<TickerTapePayload> {
  const snapshot = await fetchWatchlistSnapshot();

  return {
    asOf: snapshot.asOf,
    provider: snapshot.provider,
    note: snapshot.note,
    items: buildTickerTapeItems({ quotes: snapshot.quotes }),
  };
}

export async function getMarketBoardPayload(
  symbol: MarketWatchlistSymbol = "MU",
): Promise<MarketBoardPayload> {
  const snapshot = await fetchMarketBoardSnapshot(symbol);

  return buildMarketBoardPayload({
    selectedSymbol: symbol,
    asOf: snapshot.asOf,
    provider: snapshot.provider,
    note: snapshot.note,
    quotes: snapshot.quotes,
    klineSeries: snapshot.selectedKline,
    staticInfo: snapshot.staticInfo,
  });
}
