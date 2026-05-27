import type {
  EventCard,
  MarketAsset,
  MarketBoardPayload,
  MarketRound,
  MarketWatchlistSymbol,
  TickerTapeItem,
} from "@/lib/types";
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
  // macro (6)
  {
    id: "event-consumer-recovery",
    title: "居民消费信心回升",
    category: "macro",
    signal: "利好",
    description:
      "商场客流和线上零售额连续两个月增长，说明大家更愿意花钱了，企业收入预期提高。",
    coachingCue: "消费回暖时成长类资产先涨，但别把全部仓位押上去。",
  },
  {
    id: "event-inflation-pressure",
    title: "物价上涨压力显现",
    category: "macro",
    signal: "利空",
    description:
      "食品和能源价格走高推动整体物价上升，生活成本增加会挤压企业利润。",
    coachingCue: "通胀来了债券价格会跌，想想商品类资产能不能对冲。",
  },
  {
    id: "event-rate-cut",
    title: "央行宣布下调利率",
    category: "macro",
    signal: "利好",
    description:
      "利率降低意味着借钱更便宜，企业投资意愿上升，股市估值空间打开。",
    coachingCue: "降息利好股票和债券，但汇率可能走弱，注意平衡。",
  },
  {
    id: "event-global-recession-warning",
    title: "全球经济衰退预警",
    category: "macro",
    signal: "利空",
    description:
      "多国制造业数据走弱，国际贸易订单下降，市场担心经济进入下行周期。",
    coachingCue: "衰退预警时防御先行，先看债券和现金能不能稳住。",
  },
  {
    id: "event-economic-recovery",
    title: "经济复苏数据超预期",
    category: "macro",
    signal: "利好",
    description:
      "工厂开工率和就业数据同时好转，市场信心恢复，资金愿意流向风险资产。",
    coachingCue: "复苏初期分散买入比集中押注安全，留余力应对反复。",
  },
  {
    id: "event-supply-chain-disruption",
    title: "供应链中断引发涨价",
    category: "macro",
    signal: "中性",
    description:
      "港口拥堵和芯片短缺推高原材料成本，有些行业受损，但能源类资产受益。",
    coachingCue: "供应链冲击让赢家和输家分化，看看谁能转嫁成本。",
  },

  // policy (6)
  {
    id: "event-regulatory-tightening",
    title: "监管口径趋于收紧",
    category: "policy",
    signal: "利空",
    description:
      "监管部门要求行业合规整改，企业短期利润空间受压，市场情绪变得谨慎。",
    coachingCue: "监管收紧时先守住回撤，等政策落地后再考虑布局。",
  },
  {
    id: "event-industrial-support",
    title: "制造业扶持政策出台",
    category: "policy",
    signal: "利好",
    description:
      "政府对高端制造和国产替代给予税收优惠和补贴，相关企业订单有望增加。",
    coachingCue: "产业政策落地需要时间，分批建仓比一次性冲进去稳。",
  },
  {
    id: "event-property-controls",
    title: "房地产调控加码",
    category: "policy",
    signal: "中性",
    description:
      "限购和贷款门槛提高压制了地产热度，但多余的资金可能转向股票和基金。",
    coachingCue: "地产降温时留意资金搬家方向，股市可能接到溢出。",
  },
  {
    id: "event-green-energy-subsidies",
    title: "绿色能源补贴加力",
    category: "policy",
    signal: "利好",
    description:
      "光伏和电动车补贴延长三年，清洁能源企业成本优势扩大，行业增速加快。",
    coachingCue: "补贴利好新能源赛道，但也要想政策到期后还能不能持续。",
  },
  {
    id: "event-data-security-rules",
    title: "数据安全新规落地",
    category: "policy",
    signal: "利空",
    description:
      "企业需要增加合规投入保护用户数据，短期研发成本上升，影响利润预期。",
    coachingCue: "新规是短痛，合规能力强的公司反而会脱颖而出。",
  },
  {
    id: "event-education-reform",
    title: "教育改革政策推进",
    category: "policy",
    signal: "中性",
    description:
      "素质教育投入增加，传统补习行业受限，但科技教育和硬件需求出现增长。",
    coachingCue: "政策调整时有人受损有人受益，关键看资金流向哪里。",
  },

  // sentiment (6)
  {
    id: "event-merger-wave",
    title: "并购潮推高市场热度",
    category: "sentiment",
    signal: "利好",
    description:
      "龙头公司高溢价收购创业项目，投资者预期更多收购出现，市场情绪高涨。",
    coachingCue: "并购潮让创业标的升值，但高价买入要小心被套。",
  },
  {
    id: "event-panic-selling",
    title: "恐慌性抛售蔓延",
    category: "sentiment",
    signal: "利空",
    description:
      "一条负面消息引发连锁卖出，价格短期内超跌，但基本面并未根本恶化。",
    coachingCue: "恐慌时别跟风抛售，先看基本面有没有真的变差。",
  },
  {
    id: "event-fomo-spread",
    title: "追涨情绪快速扩散",
    category: "sentiment",
    signal: "中性",
    description:
      "社交媒体上涨声一片，新手资金跟风涌入，短期推高了价格但也积累了泡沫。",
    coachingCue: "所有人都在喊买的时候，正是检查自己仓位是否过重的时候。",
  },
  {
    id: "event-value-rotation",
    title: "资金从成长转向价值",
    category: "sentiment",
    signal: "中性",
    description:
      "高估值品种开始回落，便宜又稳定的资产重新获得资金关注，风格发生切换。",
    coachingCue: "风格轮动时不要追着跑，分散持有更能抗住切换。",
  },
  {
    id: "event-info-cocoon",
    title: "信息茧房效应加剧",
    category: "sentiment",
    signal: "利空",
    description:
      "投资者只看自己想看的消息，忽略了风险警告，导致仓位过于集中在单一方向。",
    coachingCue: "主动找反面观点，打破信息茧房才能做出更冷静的判断。",
  },
  {
    id: "event-market-divergence",
    title: "大盘与个股严重分化",
    category: "sentiment",
    signal: "中性",
    description:
      "指数看起来稳定，但多数个股下跌，只有少数龙头在涨，赚钱效应变差。",
    coachingCue: "指数骗人时看持仓的实际表现，别被大盘数字迷惑。",
  },

  // competition (6)
  {
    id: "event-tech-earnings-beat",
    title: "科技龙头业绩超预期",
    category: "competition",
    signal: "利好",
    description:
      "头部科技公司公布的利润远超市场预期，带动整个科技板块估值上升。",
    coachingCue: "龙头业绩好会带动板块，但跟风小票风险更大。",
  },
  {
    id: "event-industry-substitution",
    title: "传统行业遭遇替代冲击",
    category: "competition",
    signal: "利空",
    description:
      "新技术让旧产品快速过时，没有转型的传统企业订单大幅下滑。",
    coachingCue: "被替代的行业很难翻身，及时止损比死抗更聪明。",
  },
  {
    id: "event-new-energy-overcapacity",
    title: "新能源产能过剩显现",
    category: "competition",
    signal: "利空",
    description:
      "太多工厂同时扩产导致供大于求，产品价格战打响，行业利润集体缩水。",
    coachingCue: "产能过剩时龙头有成本优势，但整体板块要谨慎。",
  },
  {
    id: "event-consumer-upgrade",
    title: "消费升级趋势加速",
    category: "competition",
    signal: "利好",
    description:
      "年轻人更愿意为品质和品牌付费，中高端消费品企业利润率持续改善。",
    coachingCue: "消费升级利好品牌力强的公司，便宜货逻辑在弱化。",
  },
  {
    id: "event-ai-disruption",
    title: "AI 应用加速落地",
    category: "competition",
    signal: "中性",
    description:
      "人工智能开始替代部分工作岗位，提高了效率但也引发就业担忧和行业洗牌。",
    coachingCue: "AI 是双刃剑，受益方和受损方要分开看待。",
  },
  {
    id: "event-startup-ecosystem-boom",
    title: "创业生态空前活跃",
    category: "competition",
    signal: "利好",
    description:
      "风险投资大量涌入初创企业，新商业模式层出不穷，创新活力带动市场预期。",
    coachingCue: "创业热潮中找到有真实收入的项目，比追概念靠谱。",
  },
];

export const marketRounds: MarketRound[] = [
  // R1-R4: Simple / Low Volatility (spread <= +/-8%)
  {
    round: 1,
    theme: "开局试盘",
    headline: "课堂资金刚进入市场，消费信心温和回暖",
    summary: "这是建立组合骨架的阶段，先保留现金弹性，再决定主攻方向。",
    assetMultipliers: { stock: 1.03, etf: 1.02, bond: 1.01, commodity: 1.0, fx: 0.99 },
    liquidityBoost: 0.4,
    eventId: "event-consumer-recovery",
  },
  {
    round: 2,
    theme: "政策暖风",
    headline: "制造业扶持措施落地，市场预期改善",
    summary: "政策利好让工业资产小幅上涨，适合尝试第一笔分散配置。",
    assetMultipliers: { stock: 1.05, etf: 1.04, bond: 0.99, commodity: 1.03, fx: 0.98 },
    liquidityBoost: 0.5,
    eventId: "event-industrial-support",
  },
  {
    round: 3,
    theme: "科技领跑",
    headline: "科技龙头业绩亮眼，成长板块初露锋芒",
    summary: "龙头带动板块上行，但小票未必跟涨，体会“选品”的价值。",
    assetMultipliers: { stock: 1.07, etf: 1.05, bond: 0.97, commodity: 1.01, fx: 0.98 },
    liquidityBoost: 0.45,
    eventId: "event-tech-earnings-beat",
  },
  {
    round: 4,
    theme: "地产降温",
    headline: "房地产调控加码，资金开始寻找新去处",
    summary: "地产受限但股市获得溢出资金，体会政策对资金流向的引导。",
    assetMultipliers: { stock: 1.04, etf: 1.03, bond: 1.02, commodity: 0.98, fx: 1.01 },
    liquidityBoost: 0.6,
    eventId: "event-property-controls",
  },

  // R5-R8: Medium Complexity (spread <= +/-15%)
  {
    round: 5,
    theme: "通胀来袭",
    headline: "物价上涨压力传导，债券首次明显承压",
    summary: "通胀环境下债券和股票同时波动，商品类资产成为对冲工具。",
    assetMultipliers: { stock: 0.93, etf: 0.96, bond: 0.92, commodity: 1.12, fx: 1.06 },
    liquidityBoost: 0.55,
    eventId: "event-inflation-pressure",
  },
  {
    round: 6,
    theme: "降息转机",
    headline: "央行宣布降息，市场情绪迅速回暖",
    summary: "降息让股债双涨但汇率走弱，体会利率对多类资产的联动影响。",
    assetMultipliers: { stock: 1.10, etf: 1.08, bond: 1.06, commodity: 1.02, fx: 0.93 },
    liquidityBoost: 0.7,
    eventId: "event-rate-cut",
  },
  {
    round: 7,
    theme: "追涨陷阱",
    headline: "社交媒体带动 FOMO 情绪，价格脱离基本面",
    summary: "跟风资金推高泡沫，这时检查仓位比追涨更重要。",
    assetMultipliers: { stock: 1.14, etf: 1.09, bond: 0.94, commodity: 1.03, fx: 0.97 },
    liquidityBoost: 0.45,
    eventId: "event-fomo-spread",
  },
  {
    round: 8,
    theme: "监管收紧",
    headline: "数据安全新规落地，科技板块利润预期下调",
    summary: "合规成本上升压制高估值品种，现金持有者开始感受到机会。",
    assetMultipliers: { stock: 0.88, etf: 0.93, bond: 1.08, commodity: 0.97, fx: 1.05 },
    liquidityBoost: 0.85,
    eventId: "event-data-security-rules",
  },

  // R9-R12: High Complexity (spread <= +/-22%)
  {
    round: 9,
    theme: "衰退预警",
    headline: "全球经济数据走弱，恐慌抛售一触即发",
    summary: "衰退信号让风险资产暴跌，防御配置和止损纪律接受终极考验。",
    assetMultipliers: { stock: 0.80, etf: 0.85, bond: 1.15, commodity: 0.88, fx: 1.10 },
    liquidityBoost: 0.95,
    eventId: "event-global-recession-warning",
  },
  {
    round: 10,
    theme: "恐慌与机会",
    headline: "恐慌性抛售后，超跌资产开始吸引价值猎手",
    summary: "别人恐惧时你要冷静分析，基本面没变的资产可能被错杀了。",
    assetMultipliers: { stock: 1.12, etf: 1.08, bond: 0.95, commodity: 1.06, fx: 0.94 },
    liquidityBoost: 0.7,
    eventId: "event-panic-selling",
  },
  {
    round: 11,
    theme: "复苏博弈",
    headline: "经济复苏数据超预期，但产能过剩阴影未散",
    summary: "复苏和过剩同时存在，考验能否在矛盾信号中找到平衡。",
    assetMultipliers: { stock: 1.15, etf: 1.10, bond: 0.90, commodity: 1.08, fx: 0.93 },
    liquidityBoost: 0.55,
    eventId: "event-economic-recovery",
  },
  {
    round: 12,
    theme: "学期收官",
    headline: "AI 重塑格局，收官之战看谁把收益留了下来",
    summary: "最后一轮考验的不是冲刺能力，而是全程风险管理的总账。",
    assetMultipliers: { stock: 1.18, etf: 1.06, bond: 1.02, commodity: 0.92, fx: 0.95 },
    liquidityBoost: 0.65,
    eventId: "event-ai-disruption",
  },
];

export type TickerTapePayload = {
  asOf: string;
  provider: "alltick" | "hybrid" | "fallback";
  note: string;
  items: TickerTapeItem[];
};

export async function getTickerTapePayload(): Promise<TickerTapePayload> {
  const { fetchWatchlistSnapshot } = await import("@/lib/alltick");
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
  const { fetchMarketBoardSnapshot } = await import("@/lib/alltick");
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