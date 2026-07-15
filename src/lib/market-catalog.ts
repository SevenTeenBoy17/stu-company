// 市场雷达「多市场」目录 —— 在原有 10 只美股观察池之外，新增 A股 / 港股 / 基金(ETF) 三个分类，
// 每个分类一批真实标的（沧海日线已逐一验真）。每个标的归到一个「行业示意图」(industryKey)，
// 图片为 AI 生成的扁平插画，存于 public/market/industries/{industryKey}.webp。
//
// 设计要点：
//  - 美股分类沿用 market-watchlist.ts 里现有的 MARKET_METADATA（不在此重复），仅在这里补「路由字段」
//    (US_ROUTING：exchange/ticker/currency/industryKey)，保证现有美股盘行为字节级不变、单测继续绿。
//  - A股 / 港股 / 基金 三类在此完整定义（含教学文案 + 兜底价/兜底走势，真实日线在线时覆盖兜底）。
//  - id 用裸 ticker（跨分类无碰撞）；API 以 category + symbol 双参数定位，彻底消歧。

import type { MarketCategoryId } from "@/lib/types";

export type { MarketCategoryId };
export type InstrumentKind = "stock" | "etf";

export type IndustryKey =
  | "semiconductor"
  | "cloud-software"
  | "ai-platform"
  | "ev-robotics"
  | "baijiu"
  | "finance"
  | "healthcare-medicine"
  | "utility-dividend"
  | "ecommerce"
  | "telecom"
  | "consumer-electronics"
  | "broad-index"
  | "overseas-tech-index";

// 一个标的展示/教学所需的全部静态元数据（现价/走势是运行时由 provider 注入的真实日线）。
export type CatalogInstrument = {
  id: string;
  category: MarketCategoryId;
  kind: InstrumentKind;
  exchange: string; // 沧海交易所代码：XNAS/XNYS/XSHG/XSHE/XHKG
  ticker: string; // 沧海 ticker：NVDA / 600519 / 0700 / 510300 / SPY
  exchangeName: string; // 展示用：NASDAQ / 上交所 / 港交所 …
  currency: string; // USD / CNY / HKD
  code: string; // 展示代码：NVDA.US / 600519.SH / 0700.HK …
  name: string;
  companyName: string;
  sector: string;
  sectorGroup: string;
  industryKey: IndustryKey;
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

export const CATEGORY_LABELS: Record<MarketCategoryId, { label: string; en: string; blurb: string }> = {
  us: { label: "美股", en: "US", blurb: "全球科技与 AI 主线，最直观的风险偏好风向标。" },
  cn: { label: "A股", en: "A-Shares", blurb: "沪深核心资产：白酒、新能源、金融与红利。" },
  hk: { label: "港股", en: "HK", blurb: "中国互联网平台与消费电子的离岸定价场。" },
  fund: { label: "基金", en: "Funds", blurb: "宽基与海外指数 ETF：一篮子分散，先学结构。" },
};

export const MARKET_CATEGORY_ORDER: MarketCategoryId[] = ["us", "cn", "hk", "fund"];

// 美股 10 只 → 行业示意图 + 路由字段（交易所/ticker/币种与现有 tsanghi.ts 中 TSANGHI_INSTRUMENT 一致）。
export const US_ROUTING: Record<
  string,
  { exchange: string; exchangeName: string; ticker: string; currency: string; industryKey: IndustryKey }
> = {
  MU: { exchange: "XNAS", exchangeName: "NASDAQ", ticker: "MU", currency: "USD", industryKey: "semiconductor" },
  MSFT: { exchange: "XNAS", exchangeName: "NASDAQ", ticker: "MSFT", currency: "USD", industryKey: "cloud-software" },
  NVDA: { exchange: "XNAS", exchangeName: "NASDAQ", ticker: "NVDA", currency: "USD", industryKey: "semiconductor" },
  AMZN: { exchange: "XNAS", exchangeName: "NASDAQ", ticker: "AMZN", currency: "USD", industryKey: "ecommerce" },
  META: { exchange: "XNAS", exchangeName: "NASDAQ", ticker: "META", currency: "USD", industryKey: "ai-platform" },
  GOOG: { exchange: "XNAS", exchangeName: "NASDAQ", ticker: "GOOG", currency: "USD", industryKey: "ai-platform" },
  AVGO: { exchange: "XNAS", exchangeName: "NASDAQ", ticker: "AVGO", currency: "USD", industryKey: "semiconductor" },
  ORCL: { exchange: "XNYS", exchangeName: "NYSE", ticker: "ORCL", currency: "USD", industryKey: "cloud-software" },
  TSLA: { exchange: "XNAS", exchangeName: "NASDAQ", ticker: "TSLA", currency: "USD", industryKey: "ev-robotics" },
  TSM: { exchange: "XNYS", exchangeName: "NYSE", ticker: "TSM", currency: "USD", industryKey: "semiconductor" },
};

function series(base: number, change: number, drift = 0.04): number[] {
  // 8 点兜底曲线，末点=现价 base。方向随涨跌符号：change<0 递减（起高落到现价）、change>=0 递增，
  // 使兜底 K 线方向、区间文案、收涨根数与顶栏涨跌一致（itest6 R3 P2：不违反红涨绿跌教学）。
  const dir = change < 0 ? 1 : -1; // change<0: 起点在现价之上→整体下行；否则起点在下→上行
  const out: number[] = [];
  for (let i = 7; i >= 0; i--) {
    out.push(Number((base * (1 + (dir * i * drift) / 7)).toFixed(base >= 100 ? 2 : 3)));
  }
  return out;
}

export const CN_INSTRUMENTS: CatalogInstrument[] = [
  {
    id: "600519", category: "cn", kind: "stock", exchange: "XSHG", ticker: "600519", exchangeName: "上交所",
    currency: "CNY", code: "600519.SH", name: "贵州茅台", companyName: "Kweichow Moutai",
    sector: "白酒", sectorGroup: "白酒消费", industryKey: "baijiu",
    tags: ["高端白酒", "品牌壁垒", "消费龙头"], monogram: "茅", accentColor: "#c0392b",
    summary: "贵州茅台是 A 股「核心资产」的代名词，常用来观察高端消费的定价权与情绪溢价。",
    teachingNote: "适合理解「强品牌护城河 + 高估值」如何共存，用来练习等待证据、比较估值，而不是把短期涨幅当行动理由。",
    observationAngle: "重点看高端消费需求、批价走势与估值容忍度之间的配合。",
    aiRelevance: 24, sectorHeat: 72, fallbackPrice: 1212.1, fallbackChange: 0.42, fallbackSeries: series(1212.1, 0.42),
  },
  {
    id: "300750", category: "cn", kind: "stock", exchange: "XSHE", ticker: "300750", exchangeName: "深交所",
    currency: "CNY", code: "300750.SZ", name: "宁德时代", companyName: "CATL",
    sector: "动力电池", sectorGroup: "新能源与制造", industryKey: "ev-robotics",
    tags: ["动力电池", "储能", "新能源链"], monogram: "宁", accentColor: "#1aa3a8",
    summary: "宁德时代是新能源产业链「卖铲人」，把电池景气与全球电动化绑在一起。",
    teachingNote: "适合观察周期成长股如何随渗透率、产能与价格战一起波动，弹性大、需看仓位。",
    observationAngle: "重点看动力电池出货、储能放量与价格竞争对利润率的拉扯。",
    aiRelevance: 38, sectorHeat: 80, fallbackPrice: 401.9, fallbackChange: 1.12, fallbackSeries: series(401.9, 1.12, 0.06),
  },
  {
    id: "601318", category: "cn", kind: "stock", exchange: "XSHG", ticker: "601318", exchangeName: "上交所",
    currency: "CNY", code: "601318.SH", name: "中国平安", companyName: "Ping An Insurance",
    sector: "保险", sectorGroup: "银行与保险", industryKey: "finance",
    tags: ["保险", "金融综合", "高股息"], monogram: "平", accentColor: "#e08a2f",
    summary: "中国平安横跨保险、银行与科技，是观察大金融与利率环境的综合样本。",
    teachingNote: "适合理解「低估值 + 顺周期金融」的节奏，更看分红与基本面修复而非短线弹性。",
    observationAngle: "重点看新业务价值、利率走势与资产质量是否同步改善。",
    aiRelevance: 28, sectorHeat: 58, fallbackPrice: 49.3, fallbackChange: -0.36, fallbackSeries: series(49.3, -0.36, 0.03),
  },
  {
    id: "600036", category: "cn", kind: "stock", exchange: "XSHG", ticker: "600036", exchangeName: "上交所",
    currency: "CNY", code: "600036.SH", name: "招商银行", companyName: "China Merchants Bank",
    sector: "银行", sectorGroup: "银行与保险", industryKey: "finance",
    tags: ["零售银行", "高股息", "稳健"], monogram: "招", accentColor: "#c0504d",
    summary: "招商银行是 A 股银行里的「零售标杆」，常被当作稳健红利与经济温度的双重读数。",
    teachingNote: "适合观察高股息蓝筹在防御与进攻之间如何切换，波动小、适合做组合压舱石。",
    observationAngle: "重点看净息差、零售资产质量与分红水平的稳定性。",
    aiRelevance: 22, sectorHeat: 54, fallbackPrice: 36.23, fallbackChange: 0.28, fallbackSeries: series(36.23, 0.28, 0.025),
  },
  {
    id: "000858", category: "cn", kind: "stock", exchange: "XSHE", ticker: "000858", exchangeName: "深交所",
    currency: "CNY", code: "000858.SZ", name: "五粮液", companyName: "Wuliangye",
    sector: "白酒", sectorGroup: "白酒消费", industryKey: "baijiu",
    tags: ["浓香白酒", "品牌消费", "顺周期"], monogram: "五", accentColor: "#9b59b6",
    summary: "五粮液与茅台一起构成高端白酒「双龙头」，更偏向观察消费复苏的弹性那一端。",
    teachingNote: "适合与茅台对照，理解同一赛道里「龙一稳、龙二弹」的相对强弱。",
    observationAngle: "重点看批价、动销与消费场景修复是否传导到报表。",
    aiRelevance: 22, sectorHeat: 66, fallbackPrice: 75, fallbackChange: 0.55, fallbackSeries: series(75, 0.55, 0.04),
  },
  {
    id: "002594", category: "cn", kind: "stock", exchange: "XSHE", ticker: "002594", exchangeName: "深交所",
    currency: "CNY", code: "002594.SZ", name: "比亚迪", companyName: "BYD",
    sector: "新能源车", sectorGroup: "新能源与制造", industryKey: "ev-robotics",
    tags: ["新能源车", "整车", "出海"], monogram: "迪", accentColor: "#2e86c1",
    summary: "比亚迪是「整车 + 电池」垂直一体化样本，把销量、出海与价格战集中在一只股票上。",
    teachingNote: "适合观察制造业龙头如何用规模、成本与交付节奏形成优势；课堂复盘重点放在证据链，而不是单一叙事。",
    observationAngle: "重点看月度销量、海外扩张与单车利润的平衡。",
    aiRelevance: 34, sectorHeat: 78, fallbackPrice: 82.2, fallbackChange: -0.74, fallbackSeries: series(82.2, -0.74, 0.05),
  },
  {
    id: "600900", category: "cn", kind: "stock", exchange: "XSHG", ticker: "600900", exchangeName: "上交所",
    currency: "CNY", code: "600900.SH", name: "长江电力", companyName: "China Yangtze Power",
    sector: "水电公用", sectorGroup: "公用事业与红利", industryKey: "utility-dividend",
    tags: ["水电", "高股息", "防御"], monogram: "电", accentColor: "#2980b9",
    summary: "长江电力是「现金奶牛」式公用事业，常被当作低波动、稳分红的红利资产代表。",
    teachingNote: "适合理解防御性资产为什么在震荡市受青睐——稳定现金流比弹性更重要。",
    observationAngle: "重点看来水情况、分红比例与利率下行带来的估值支撑。",
    aiRelevance: 16, sectorHeat: 50, fallbackPrice: 26.22, fallbackChange: 0.19, fallbackSeries: series(26.22, 0.19, 0.02),
  },
  {
    id: "600276", category: "cn", kind: "stock", exchange: "XSHG", ticker: "600276", exchangeName: "上交所",
    currency: "CNY", code: "600276.SH", name: "恒瑞医药", companyName: "Hengrui Medicine",
    sector: "创新药", sectorGroup: "医药创新", industryKey: "healthcare-medicine",
    tags: ["创新药", "研发投入", "出海授权"], monogram: "药", accentColor: "#df5f5f",
    summary: "恒瑞医药适合用来观察创新药研发、集采压力和出海授权之间的平衡。",
    teachingNote: "医药股不是只看新闻热度，更要看研发管线、审批节奏和现金流承受力。",
    observationAngle: "重点看新药获批、海外授权收入和研发费用率是否形成正向循环。",
    aiRelevance: 30, sectorHeat: 68, fallbackPrice: 52.8, fallbackChange: 0.74, fallbackSeries: series(52.8, 0.74, 0.04),
  },
];

export const HK_INSTRUMENTS: CatalogInstrument[] = [
  {
    id: "0700", category: "hk", kind: "stock", exchange: "XHKG", ticker: "0700", exchangeName: "港交所",
    currency: "HKD", code: "0700.HK", name: "腾讯控股", companyName: "Tencent",
    sector: "互联网平台", sectorGroup: "互联网与AI平台", industryKey: "ai-platform",
    tags: ["社交", "游戏", "AI大模型"], monogram: "腾", accentColor: "#1aa3a8",
    summary: "腾讯是港股科技的定海神针，社交、游戏与广告现金流叠加 AI 与回购，是平台股的标杆。",
    teachingNote: "适合观察「现金流护城河 + 回购」如何托底估值，比纯题材股更看基本面。",
    observationAngle: "重点看游戏与广告基本盘、视频号商业化与 AI 投入的回报。",
    aiRelevance: 84, sectorHeat: 86, fallbackPrice: 421.4, fallbackChange: 1.04, fallbackSeries: series(421.4, 1.04, 0.04),
  },
  {
    id: "9988", category: "hk", kind: "stock", exchange: "XHKG", ticker: "9988", exchangeName: "港交所",
    currency: "HKD", code: "9988.HK", name: "阿里巴巴", companyName: "Alibaba",
    sector: "电商与云", sectorGroup: "电商与本地生活", industryKey: "ecommerce",
    tags: ["电商", "阿里云", "AI算力"], monogram: "阿", accentColor: "#e8743b",
    summary: "阿里巴巴把电商基本盘与阿里云、AI 算力绑在一起，是「困境反转 + AI 重估」的双重样本。",
    teachingNote: "适合观察老平台如何靠云与 AI 讲新故事，预期与兑现的落差值得复盘。",
    observationAngle: "重点看核心电商份额、云增速与 AI 资本开支的回报节奏。",
    aiRelevance: 80, sectorHeat: 82, fallbackPrice: 95, fallbackChange: 1.86, fallbackSeries: series(95, 1.86, 0.05),
  },
  {
    id: "3690", category: "hk", kind: "stock", exchange: "XHKG", ticker: "3690", exchangeName: "港交所",
    currency: "HKD", code: "3690.HK", name: "美团", companyName: "Meituan",
    sector: "本地生活", sectorGroup: "电商与本地生活", industryKey: "ecommerce",
    tags: ["外卖", "本地生活", "即时零售"], monogram: "美", accentColor: "#f1c40f",
    summary: "美团代表「本地生活 + 即时零售」赛道，是观察消费频次与竞争格局的高弹性样本。",
    teachingNote: "适合理解平台型公司在补贴战与盈利之间的取舍，竞争一变脸波动就放大。",
    observationAngle: "重点看外卖单量、即时零售扩张与新业务亏损收窄。",
    aiRelevance: 40, sectorHeat: 74, fallbackPrice: 66.1, fallbackChange: -1.1, fallbackSeries: series(66.1, -1.1, 0.05),
  },
  {
    id: "1810", category: "hk", kind: "stock", exchange: "XHKG", ticker: "1810", exchangeName: "港交所",
    currency: "HKD", code: "1810.HK", name: "小米集团", companyName: "Xiaomi",
    sector: "消费电子", sectorGroup: "消费电子与智造", industryKey: "consumer-electronics",
    tags: ["手机", "IoT", "造车"], monogram: "米", accentColor: "#e67e22",
    summary: "小米把手机、IoT 生态与造车叠在一起，是观察消费电子复苏 + 新业务想象力的混合样本。",
    teachingNote: "适合理解「硬件基本盘 + 第二曲线」如何共同影响定价，新故事会放大波动。",
    observationAngle: "重点看手机份额、IoT 生态变现与汽车交付爬坡。",
    aiRelevance: 48, sectorHeat: 76, fallbackPrice: 22.3, fallbackChange: 2.05, fallbackSeries: series(22.3, 2.05, 0.06),
  },
  {
    id: "0941", category: "hk", kind: "stock", exchange: "XHKG", ticker: "0941", exchangeName: "港交所",
    currency: "HKD", code: "0941.HK", name: "中国移动", companyName: "China Mobile",
    sector: "通信运营", sectorGroup: "通信基础设施", industryKey: "telecom",
    tags: ["运营商", "高股息", "算力网络"], monogram: "移", accentColor: "#2471a3",
    summary: "中国移动是通信「压舱石」，高股息 + 算力网络叙事让它兼具防御与一点成长想象。",
    teachingNote: "适合观察高股息央企如何在低波动里提供稳定回报，更看分红而非短线。",
    observationAngle: "重点看 ARPU 稳定性、分红水平与算力/云业务增量。",
    aiRelevance: 30, sectorHeat: 52, fallbackPrice: 77.65, fallbackChange: 0.32, fallbackSeries: series(77.65, 0.32, 0.02),
  },
  {
    id: "0388", category: "hk", kind: "stock", exchange: "XHKG", ticker: "0388", exchangeName: "港交所",
    currency: "HKD", code: "0388.HK", name: "香港交易所", companyName: "HKEX",
    sector: "交易所", sectorGroup: "金融与交易所", industryKey: "finance",
    tags: ["交易所", "成交活跃度", "金融基建"], monogram: "港", accentColor: "#16a085",
    summary: "港交所是市场情绪的「卖水人」，成交越活跃它越受益，是观察市场冷热的元指标。",
    teachingNote: "适合理解「平台型金融基建」如何随成交量与上市活跃度起伏，是市场温度计。",
    observationAngle: "重点看日均成交额、IPO 节奏与互联互通资金流向。",
    aiRelevance: 26, sectorHeat: 60, fallbackPrice: 366.6, fallbackChange: 0.88, fallbackSeries: series(366.6, 0.88, 0.04),
  },
  {
    id: "2269", category: "hk", kind: "stock", exchange: "XHKG", ticker: "2269", exchangeName: "港交所",
    currency: "HKD", code: "2269.HK", name: "药明生物", companyName: "WuXi Biologics",
    sector: "生物药外包", sectorGroup: "医药创新", industryKey: "healthcare-medicine",
    tags: ["CXO", "生物药", "全球订单"], monogram: "药", accentColor: "#d85b78",
    summary: "药明生物代表医药外包赛道，适合观察全球订单、产能利用率和行业信心修复。",
    teachingNote: "适合学习“产业链卖水人”与政策、海外需求之间的关系，波动通常比稳健药企更大。",
    observationAngle: "重点看新增项目、产能利用率和海外客户预算是否改善。",
    aiRelevance: 36, sectorHeat: 64, fallbackPrice: 18.42, fallbackChange: -0.62, fallbackSeries: series(18.42, -0.62, 0.05),
  },
];

export const FUND_INSTRUMENTS: CatalogInstrument[] = [
  {
    id: "510300", category: "fund", kind: "etf", exchange: "XSHG", ticker: "510300", exchangeName: "上交所",
    currency: "CNY", code: "510300.SH", name: "沪深300ETF", companyName: "CSI 300 ETF",
    sector: "宽基指数", sectorGroup: "宽基指数基金", industryKey: "broad-index",
    tags: ["沪深300", "大盘蓝筹", "宽基"], monogram: "300", accentColor: "#c0392b",
    summary: "沪深300ETF 一篮子打包 A 股最具代表性的 300 家大盘公司，是「买大盘」的最朴素方式。",
    teachingNote: "适合作为定投与分散的起点：先用宽基理解整体市场，再谈个股选择。",
    observationAngle: "重点看大盘整体估值分位与北向资金的中长期态度。",
    aiRelevance: 30, sectorHeat: 62, fallbackPrice: 5.048, fallbackChange: 0.36, fallbackSeries: series(5.048, 0.36, 0.02),
  },
  {
    id: "510500", category: "fund", kind: "etf", exchange: "XSHG", ticker: "510500", exchangeName: "上交所",
    currency: "CNY", code: "510500.SH", name: "中证500ETF", companyName: "CSI 500 ETF",
    sector: "中盘宽基", sectorGroup: "宽基指数基金", industryKey: "broad-index",
    tags: ["中证500", "中盘成长", "宽基"], monogram: "500", accentColor: "#d35400",
    summary: "中证500ETF 覆盖中盘成长股，比沪深300更偏弹性，是观察「中盘风格」的宽基工具。",
    teachingNote: "适合与沪深300对照，理解大盘价值与中盘成长在不同行情里的轮动。",
    observationAngle: "重点看中盘成长相对大盘蓝筹的强弱切换。",
    aiRelevance: 32, sectorHeat: 60, fallbackPrice: 9.085, fallbackChange: 0.62, fallbackSeries: series(9.085, 0.62, 0.03),
  },
  {
    id: "588000", category: "fund", kind: "etf", exchange: "XSHG", ticker: "588000", exchangeName: "上交所",
    currency: "CNY", code: "588000.SH", name: "科创50ETF", companyName: "STAR 50 ETF",
    sector: "硬科技指数", sectorGroup: "宽基指数基金", industryKey: "broad-index",
    tags: ["科创板", "硬科技", "高弹性"], monogram: "科", accentColor: "#8e44ad",
    summary: "科创50ETF 集中半导体、生物医药等硬科技龙头，是 A 股弹性最大的宽基之一。",
    teachingNote: "适合理解高成长宽基的高波动属性——同样是「一篮子」，风险却很不一样。",
    observationAngle: "重点看科技景气周期与风险偏好对硬科技估值的放大效应。",
    aiRelevance: 56, sectorHeat: 70, fallbackPrice: 2.178, fallbackChange: 1.28, fallbackSeries: series(2.178, 1.28, 0.05),
  },
  {
    id: "159915", category: "fund", kind: "etf", exchange: "XSHE", ticker: "159915", exchangeName: "深交所",
    currency: "CNY", code: "159915.SZ", name: "创业板ETF", companyName: "ChiNext ETF",
    sector: "成长指数", sectorGroup: "宽基指数基金", industryKey: "broad-index",
    tags: ["创业板", "成长", "新能源权重"], monogram: "创", accentColor: "#16a085",
    summary: "创业板ETF 以新能源、医药与高成长公司为主，是 A 股「成长风格」的代表宽基。",
    teachingNote: "适合观察成长指数的高 beta 特征：涨得多、回撤也大，定投更要看节奏。",
    observationAngle: "重点看成长板块景气与流动性环境对估值的双向影响。",
    aiRelevance: 44, sectorHeat: 64, fallbackPrice: 4.395, fallbackChange: 0.91, fallbackSeries: series(4.395, 0.91, 0.04),
  },
  {
    id: "513100", category: "fund", kind: "etf", exchange: "XSHG", ticker: "513100", exchangeName: "上交所",
    currency: "CNY", code: "513100.SH", name: "纳指ETF", companyName: "NASDAQ-100 ETF (QDII)",
    sector: "海外科技", sectorGroup: "海外科技指数", industryKey: "overseas-tech-index",
    tags: ["纳斯达克", "海外科技", "QDII"], monogram: "纳", accentColor: "#2c3e90",
    summary: "纳指ETF 用人民币就能跟踪纳斯达克100，是 A 股投资者配置海外科技的便捷工具。",
    teachingNote: "适合理解跨市场分散与汇率/溢价风险——QDII 常有折溢价，别只看涨跌。",
    observationAngle: "重点看美股科技龙头走势、人民币汇率与场内溢价。",
    aiRelevance: 72, sectorHeat: 78, fallbackPrice: 2.208, fallbackChange: 0.45, fallbackSeries: series(2.208, 0.45, 0.03),
  },
  {
    id: "SPY", category: "fund", kind: "etf", exchange: "XNYS", ticker: "SPY", exchangeName: "NYSE Arca",
    currency: "USD", code: "SPY.US", name: "标普500ETF", companyName: "SPDR S&P 500 ETF",
    sector: "海外宽基", sectorGroup: "海外科技指数", industryKey: "overseas-tech-index",
    tags: ["标普500", "美股宽基", "全球配置"], monogram: "SPY", accentColor: "#34495e",
    summary: "SPY 跟踪标普500，是全球最具代表性的宽基 ETF 之一，适合在课堂里观察美国大盘结构与分散配置思路。",
    teachingNote: "适合作为全球资产配置的锚：先理解宽基长期回报，再谈主动选择。",
    observationAngle: "重点看美国宏观、企业盈利与利率路径对大盘的整体影响。",
    aiRelevance: 60, sectorHeat: 72, fallbackPrice: 733.24, fallbackChange: 0.31, fallbackSeries: series(733.24, 0.31, 0.02),
  },
  {
    id: "QQQ", category: "fund", kind: "etf", exchange: "XNAS", ticker: "QQQ", exchangeName: "NASDAQ",
    currency: "USD", code: "QQQ.US", name: "纳指100ETF", companyName: "Invesco QQQ Trust",
    sector: "海外科技", sectorGroup: "海外科技指数", industryKey: "overseas-tech-index",
    tags: ["纳斯达克100", "美股科技", "高成长"], monogram: "QQQ", accentColor: "#2c3e90",
    summary: "QQQ 跟踪纳斯达克100，集中美股科技与成长龙头，是观察「美股科技 beta」的标准工具。",
    teachingNote: "适合与 SPY 对照，理解科技集中度更高的宽基为何弹性更大、回撤也更深。",
    observationAngle: "重点看大型科技股景气、估值与利率敏感度。",
    aiRelevance: 76, sectorHeat: 80, fallbackPrice: 710.62, fallbackChange: 0.52, fallbackSeries: series(710.62, 0.52, 0.03),
  },
  {
    id: "512170", category: "fund", kind: "etf", exchange: "XSHG", ticker: "512170", exchangeName: "上交所",
    currency: "CNY", code: "512170.SH", name: "医疗ETF", companyName: "Healthcare ETF",
    sector: "医疗服务", sectorGroup: "医药主题基金", industryKey: "healthcare-medicine",
    tags: ["医药", "医疗服务", "主题基金"], monogram: "医", accentColor: "#d85b78",
    summary: "医疗ETF 用一篮子方式观察医药与医疗服务板块，适合对比主题基金和个股波动。",
    teachingNote: "主题基金比宽基更集中，适合训练“看懂赛道，但不过度押注”的配置意识。",
    observationAngle: "重点看医保政策、创新药进展和医疗服务需求是否共同改善。",
    aiRelevance: 34, sectorHeat: 66, fallbackPrice: 0.612, fallbackChange: 0.48, fallbackSeries: series(0.612, 0.48, 0.045),
  },
];

// 非美股分类的标的表（美股从 MARKET_METADATA + US_ROUTING 在 market-watchlist.ts 里组装）。
export const NON_US_CATEGORY_INSTRUMENTS: Record<Exclude<MarketCategoryId, "us">, CatalogInstrument[]> = {
  cn: CN_INSTRUMENTS,
  hk: HK_INSTRUMENTS,
  fund: FUND_INSTRUMENTS,
};

export function industryImagePath(key: IndustryKey): string {
  return `/market/industries/${key}.webp`;
}

export function marketBadgePath(key: IndustryKey): string {
  const iconKey: Record<IndustryKey, string> = {
    semiconductor: "semiconductor",
    "cloud-software": "cloud-software",
    "ai-platform": "ai-platform",
    "ev-robotics": "ev-robotics",
    baijiu: "consumer-retail",
    finance: "finance",
    "healthcare-medicine": "healthcare-medicine",
    "utility-dividend": "utility-dividend",
    ecommerce: "ecommerce",
    telecom: "telecom",
    "consumer-electronics": "consumer-electronics",
    "broad-index": "broad-index",
    "overseas-tech-index": "overseas-tech-index",
  };

  return `/brand/market-radar-icons/${iconKey[key]}.webp`;
}

export function marketSymbolIconPath(symbol: string): string {
  return `/brand/market-symbol-icons/${encodeURIComponent(symbol)}.webp`;
}
