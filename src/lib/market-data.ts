import type {
  EventCard,
  MarketAsset,
  MarketBoardPayload,
  MarketDataProvider,
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
  {
    id: "asset-gold",
    symbol: "AUG",
    name: "避险黄金",
    category: "commodity",
    description: "在恐慌、衰退和地缘冲击中常被当作防守资产，但平静行情里也可能回落。",
    basePrice: 98,
    risk: "中",
  },
  {
    id: "asset-index",
    symbol: "MIX",
    name: "全市场指数基金",
    category: "etf",
    description: "把多类股票打包成一篮子，用较低波动训练长期分散配置。",
    basePrice: 92,
    risk: "中",
  },
];

const baseEventCards: EventCard[] = [
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
    title: "东西变贵了：物价在涨",
    category: "macro",
    signal: "利空",
    description:
      "菜价和油价都涨了，大家生活成本变高，企业赚的钱也被成本吃掉一部分。",
    coachingCue: "通胀来了债券价格会跌，想想商品类资产能不能对冲。",
  },
  {
    id: "event-rate-cut",
    title: "央行宣布下调利率",
    category: "macro",
    signal: "利好",
    description:
      "利率降低意味着借钱更便宜，企业更愿意投资扩张，股票价格可能会涨。",
    coachingCue: "降息利好股票和债券，但汇率可能走弱，注意平衡。",
  },
  {
    id: "event-global-recession-warning",
    title: "全球经济衰退预警",
    category: "macro",
    signal: "利空",
    description:
      "很多国家的工厂订单在减少，全球经济可能要变差一段时间。",
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
    title: "政府要求企业更守规矩",
    category: "policy",
    signal: "利空",
    description:
      "政府出了新规定，企业要花更多钱去合规，短期内赚的钱会变少，大家变得谨慎。",
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
      "政府让买房变难了，想买房的人变少，但省下来的钱可能去买股票和基金。",
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
    title: "投资人开始喜欢便宜稳定的东西",
    category: "sentiment",
    signal: "中性",
    description:
      "之前涨太多的东西开始跌了，大家转向去买便宜又稳定的资产，市场风格在变。",
    coachingCue: "风格轮动时不要追着跑，分散持有更能抗住切换。",
  },
  {
    id: "event-info-cocoon",
    title: "只看想看的消息，判断容易出错",
    category: "sentiment",
    signal: "利空",
    description:
      "很多人只关注支持自己想法的消息，忽略了危险信号，结果仓位偏到了一个方向。",
    coachingCue: "主动找反面观点，打破信息茧房才能做出更冷静的判断。",
  },
  {
    id: "event-market-divergence",
    title: "大盘与个股严重分化",
    category: "sentiment",
    signal: "中性",
    description:
      "大盘指数看着还行，但大多数公司其实在跌，只有少数大公司在涨。",
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

  // black swan (2) — extreme low-probability events for R9-12
  {
    id: "event-liquidity-crisis",
    title: "突发流动性危机",
    category: "black_swan",
    signal: "利空",
    description:
      "一家大型金融机构突然出问题，银行之间不敢互相借钱了，所有资产都在跌。这就像考试前一天全班突然集体感冒 — 不管你准备得多好，都会受影响。",
    coachingCue: "危机时现金和债券是救命稻草，先活下来再说。",
    choices: [
      { id: "lc-protect", label: "抛售保命", detail: "把风险资产换成现金，先稳住阵脚", teachingPoint: "危机里保住流动性，宁可错过也别被迫贱卖", outcome: "protect" },
      { id: "lc-gamble", label: "借机抄底", detail: "趁恐慌大举买入便宜资产", teachingPoint: "别人恐惧我贪婪，但也可能抄在半山腰", outcome: "gamble" },
      { id: "lc-hold", label: "按兵不动", detail: "什么都不做，扛过这一轮", teachingPoint: "不行动也是一种选择，前提是你扛得住波动", outcome: "hold" },
    ],
  },
  {
    id: "event-surprise-policy-pivot",
    title: "意外政策大转向",
    category: "black_swan",
    signal: "利好",
    description:
      "政府突然宣布了一个谁都没预料到的大利好政策，市场一下子兴奋起来，几乎所有资产都在涨。这就像老师突然说今天的考试取消了 — 大家瞬间开心。",
    coachingCue: "意外利好时别急着全押，先想想利好能持续多久。",
  },

  // E4 expansion — tier 1 (basics: total return, money illusion)
  {
    id: "event-dividend-payout",
    title: "分红到账：公司把利润分给你",
    category: "macro",
    signal: "利好",
    description:
      "你持有的公司赚钱后，把一部分利润以现金分给股东，这叫分红。涨跌之外，分红也是你的真实回报。",
    coachingCue: "看一笔投资别只盯价格，分红+价格才是「总回报」。",
  },
  {
    id: "event-stock-split",
    title: "股票拆分：切成更多份，但蛋糕没变大",
    category: "sentiment",
    signal: "中性",
    description:
      "一股拆成两股，价格减半、数量翻倍，你的总市值其实没变。就像把一块披萨切成更多片，披萨还是那一块。",
    coachingCue: "拆股不会让你更有钱，别被「变便宜了」的错觉骗到。",
  },

  // E4 expansion — tier 2 (rates, leverage, FX, fraud literacy)
  {
    id: "event-rate-hike",
    title: "央行宣布加息",
    category: "macro",
    signal: "利空",
    description:
      "利率上调后借钱更贵，企业扩张变谨慎；而且利率涨了，之前发行的低息债券就变得不值钱。",
    coachingCue: "加息时债券价格会跌，杠杆成本也变高，先看看自己借了多少。",
  },
  {
    id: "event-leverage-temptation",
    title: "杠杆诱惑：借钱炒，赢加倍输也加倍",
    category: "macro",
    signal: "中性",
    description:
      "有人提醒你可以借钱放大仓位。杠杆能放大盈利，但同样会放大亏损，行情一反向就可能爆掉。",
    coachingCue: "杠杆是双刃剑，先想清楚最坏情况你扛不扛得住，再决定用不用。",
    choices: [
      { id: "lev-borrow", label: "借钱加仓", detail: "用杠杆把仓位放大一倍", teachingPoint: "杠杆赢了翻倍、输了也翻倍，先想清最坏情况", outcome: "gamble" },
      { id: "lev-skip", label: "不碰杠杆", detail: "维持现有仓位，稳为先", teachingPoint: "稳健者宁可少赚，也不让一次失误清盘", outcome: "hold" },
    ],
  },
  {
    id: "event-currency-devaluation",
    title: "本币贬值：钱在国外变「不值钱」了",
    category: "macro",
    signal: "利空",
    description:
      "本国货币相对外币贬值，进口的东西变贵，持有外币资产的人反而占了便宜。价值取决于你用什么来衡量。",
    coachingCue: "汇率也是一种风险，别忘了你的钱是用什么货币计价的。",
  },
  {
    id: "event-ponzi-scheme",
    title: "「保证高收益」的项目找上门",
    category: "sentiment",
    signal: "利空",
    description:
      "一个号称「稳赚不赔、保证 20% 收益」的项目在流传。它其实是用新人的钱付老人的利息，迟早会崩。",
    coachingCue: "承诺「高收益+零风险」的，基本都是骗局，转身就走。",
  },

  // E4 expansion — tier 3 (advanced: squeeze, runs, default, crash & recovery)
  {
    id: "event-short-squeeze",
    title: "逼空行情：散户把做空的人逼到墙角",
    category: "sentiment",
    signal: "利好",
    description:
      "一只被大量做空的股票突然暴涨，做空的人被迫高价买回，价格被进一步推高，随后往往又急速回落。",
    coachingCue: "逼空又猛又险，追进去很可能是最后接棒的人。",
    choices: [
      { id: "ss-chase", label: "追进去", detail: "跟着人群冲进暴涨的股票", teachingPoint: "逼空又猛又险，追高常常是接最后一棒", outcome: "gamble" },
      { id: "ss-watch", label: "只看不追", detail: "保持观望，不参与狂热", teachingPoint: "看不懂的钱不赚，是一种纪律", outcome: "hold" },
    ],
  },
  {
    id: "event-bank-run",
    title: "银行挤兑：大家同时去取钱",
    category: "black_swan",
    signal: "利空",
    description:
      "银行并没把所有存款放在金库里。一旦大家恐慌性同时取钱，再健康的银行也可能因为没有足够现金而出问题。",
    coachingCue: "这考验的是「流动性」，不是「赚不赚钱」，危机时现金最金贵。",
  },
  {
    id: "event-regulation-hammer",
    title: "监管重锤：一纸新规改变行业价值",
    category: "policy",
    signal: "利空",
    description:
      "政府对某个行业突然出台严厉新规，相关公司的价值可能一夜之间被重估。规则并不是一成不变的。",
    coachingCue: "政策风险很难预测，别把全部筹码压在单一行业上。",
  },
  {
    id: "event-corporate-default",
    title: "公司违约：借的钱还不上了",
    category: "competition",
    signal: "利空",
    description:
      "一家公司无法按期偿还债务，它发行的债券大幅缩水。收益率越高的债券，往往意味着违约风险也越高。",
    coachingCue: "高收益的另一面是高风险，借钱给谁要先看它还不还得起。",
  },
  {
    id: "event-bankruptcy-zero",
    title: "破产清零：股票可能真的归零",
    category: "competition",
    signal: "利空",
    description:
      "一家持续亏损的公司宣告破产，股票价值清零。清算时债权人优先受偿，股东往往什么都拿不到。",
    coachingCue: "「跌无可跌」是错觉，归零之前都还能再跌。",
  },
  {
    id: "event-geopolitical-shock",
    title: "地缘冲击：世界变乱，资金找避风港",
    category: "black_swan",
    signal: "利空",
    description:
      "突发的地缘冲突让市场充满不确定性，风险资产普遍下跌，资金涌向黄金和政府债券等避险品种。",
    coachingCue: "恐慌时黄金、债券常常和股票反向走，这就是对冲的价值。",
  },
  {
    id: "event-capital-gains-tax",
    title: "资本利得税：你的盈利要交一部分",
    category: "policy",
    signal: "利空",
    description:
      "对已实现的投资收益开始征税，你最终拿到手的没有账面那么多。算回报要算「税后」，不是「税前」。",
    coachingCue: "别只看赚了多少，扣完税和成本之后才是你真正赚到的。",
  },
  {
    id: "event-v-recovery",
    title: "V 型反弹：暴跌之后的快速回升",
    category: "macro",
    signal: "利好",
    description:
      "经历一轮急跌后，市场情绪修复，价格快速反弹。在底部恐慌割肉的人，往往刚好卖在了最低点。",
    coachingCue: "崩盘常常孕育机会，在低点慌乱卖出只会把亏损变成现实。",
  },
];

function enrichEventCard(event: EventCard): EventCard {
  const categoryDefaults: Record<
    EventCard["category"],
    Pick<EventCard, "teachingConcept" | "impactAssets" | "impactRange" | "stage">
  > = {
    macro: {
      teachingConcept: "宏观周期会改变不同资产的风险偏好。",
      impactAssets: ["stock", "etf", "bond", "commodity", "fx"],
      impactRange: "medium",
      stage: "early",
    },
    policy: {
      teachingConcept: "政策会改变资金流向，但落地需要时间验证。",
      impactAssets: ["stock", "etf", "bond"],
      impactRange: "medium",
      stage: "middle",
    },
    sentiment: {
      teachingConcept: "情绪会放大短期波动，复盘时要区分价格和价值。",
      impactAssets: ["stock", "etf"],
      impactRange: "medium",
      stage: "middle",
    },
    competition: {
      teachingConcept: "行业竞争会让同一板块里的公司出现分化。",
      impactAssets: ["stock", "etf"],
      impactRange: "medium",
      stage: "middle",
    },
    black_swan: {
      teachingConcept: "小概率高冲击事件要求组合保留安全垫。",
      impactAssets: ["stock", "etf", "bond", "commodity", "fx"],
      impactRange: "high",
      stage: "late",
    },
    behavior: {
      teachingConcept: "个人行为偏差会影响决策质量。",
      impactAssets: ["stock", "etf"],
      impactRange: "low",
      stage: "middle",
    },
  };

  const idOverrides: Record<
    string,
    Partial<Pick<EventCard, "teachingConcept" | "impactAssets" | "impactRange" | "stage">>
  > = {
    "event-consumer-recovery": {
      teachingConcept: "消费信心改善通常会推高成长资产预期。",
      impactAssets: ["stock", "etf"],
      impactRange: "low",
      stage: "early",
    },
    "event-inflation-pressure": {
      teachingConcept: "通胀会挤压利润，也会改变债券和商品表现。",
      impactAssets: ["bond", "commodity", "stock"],
      impactRange: "medium",
      stage: "middle",
    },
    "event-liquidity-crisis": {
      teachingConcept: "流动性危机里，现金和防守资产的价值会变得更明显。",
      impactAssets: ["stock", "etf", "bond", "fx"],
      impactRange: "high",
      stage: "late",
    },
    "event-surprise-policy-pivot": {
      teachingConcept: "突发利好也需要验证持续性，不能把好运误当能力。",
      impactAssets: ["stock", "etf", "bond", "commodity"],
      impactRange: "high",
      stage: "late",
    },
    // E4 — tier 1 (early)
    "event-dividend-payout": {
      teachingConcept: "分红是「总回报」的一部分，回报不只看价格涨跌。",
      impactAssets: ["stock", "etf"],
      impactRange: "low",
      stage: "early",
    },
    "event-stock-split": {
      teachingConcept: "拆股只是数字变化，公司价值和你的财富并没有改变。",
      impactAssets: ["stock"],
      impactRange: "low",
      stage: "early",
    },
    // E4 — tier 2 (middle)
    "event-rate-hike": {
      teachingConcept: "利率上升会压低债券价格，并抬高借钱（杠杆）的成本。",
      impactAssets: ["bond", "stock", "etf"],
      impactRange: "medium",
      stage: "middle",
    },
    "event-leverage-temptation": {
      teachingConcept: "杠杆同时放大盈亏，是一把需要敬畏的双刃剑。",
      impactAssets: ["stock", "etf"],
      impactRange: "low",
      stage: "middle",
    },
    "event-currency-devaluation": {
      teachingConcept: "汇率波动会改变以本币计价的资产价值，这是一种 FX 风险。",
      impactAssets: ["fx", "commodity"],
      impactRange: "medium",
      stage: "middle",
    },
    "event-ponzi-scheme": {
      teachingConcept: "识别「高收益+零风险」骗局，是最具现实保护价值的一课。",
      impactAssets: ["stock", "etf"],
      impactRange: "medium",
      stage: "middle",
    },
    // E4 — tier 3 (late)
    "event-short-squeeze": {
      teachingConcept: "做空、羊群与反身性如何制造剧烈而危险的波动。",
      impactAssets: ["stock", "etf"],
      impactRange: "high",
      stage: "late",
    },
    "event-bank-run": {
      teachingConcept: "流动性不等于偿付能力，信心崩塌会自我实现。",
      impactAssets: ["stock", "etf", "bond", "fx"],
      impactRange: "high",
      stage: "late",
    },
    "event-regulation-hammer": {
      teachingConcept: "政策风险会在一夜之间重估某个行业的资产价值。",
      impactAssets: ["stock", "etf"],
      impactRange: "high",
      stage: "late",
    },
    "event-corporate-default": {
      teachingConcept: "信用违约风险，以及「收益越高、风险通常越高」。",
      impactAssets: ["stock", "etf", "bond"],
      impactRange: "high",
      stage: "late",
    },
    "event-bankruptcy-zero": {
      teachingConcept: "股票可能真的归零，清算时债权优先于股权。",
      impactAssets: ["stock", "etf"],
      impactRange: "high",
      stage: "late",
    },
    "event-geopolitical-shock": {
      teachingConcept: "不确定性溢价，以及避险资产在危机中的对冲作用。",
      impactAssets: ["stock", "etf", "fx"],
      impactRange: "high",
      stage: "late",
    },
    "event-capital-gains-tax": {
      teachingConcept: "税后回报与税前回报的差别，盈利不会全归你。",
      impactAssets: ["stock", "etf"],
      impactRange: "low",
      stage: "late",
    },
    "event-v-recovery": {
      teachingConcept: "暴跌之后常有修复，别在底部恐慌中把亏损变成现实。",
      impactAssets: ["stock", "etf", "commodity"],
      impactRange: "high",
      stage: "late",
    },
  };

  return {
    ...categoryDefaults[event.category],
    ...event,
    ...idOverrides[event.id],
  };
}

export const eventCards: EventCard[] = baseEventCards.map(enrichEventCard);

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
  provider: MarketDataProvider;
  note: string;
  items: TickerTapeItem[];
};

export async function getTickerTapePayload(): Promise<TickerTapePayload> {
  const { fetchTsanghiWatchlistSnapshot } = await import("@/lib/tsanghi");
  const tsanghiSnapshot = await fetchTsanghiWatchlistSnapshot();
  if (tsanghiSnapshot.provider !== "fallback") {
    return {
      asOf: tsanghiSnapshot.asOf,
      provider: tsanghiSnapshot.provider,
      note: tsanghiSnapshot.note,
      items: buildTickerTapeItems({ quotes: tsanghiSnapshot.quotes }),
    };
  }

  const { fetchItickWatchlistSnapshot } = await import("@/lib/itick");
  const itickSnapshot = await fetchItickWatchlistSnapshot();
  if (itickSnapshot.provider !== "fallback") {
    return {
      asOf: itickSnapshot.asOf,
      provider: itickSnapshot.provider,
      note: itickSnapshot.note,
      items: buildTickerTapeItems({ quotes: itickSnapshot.quotes }),
    };
  }

  const { fetchWatchlistSnapshot } = await import("@/lib/alltick");
  const snapshot = await fetchWatchlistSnapshot();
  const liveAlltick = snapshot.provider !== "fallback";

  return {
    asOf: liveAlltick ? snapshot.asOf : itickSnapshot.asOf,
    provider: liveAlltick ? snapshot.provider : itickSnapshot.provider,
    note: liveAlltick ? snapshot.note : itickSnapshot.note,
    items: buildTickerTapeItems({ quotes: liveAlltick ? snapshot.quotes : itickSnapshot.quotes }),
  };
}

export async function getMarketBoardPayload(
  symbol: MarketWatchlistSymbol = "MU",
): Promise<MarketBoardPayload> {
  const { fetchTsanghiMarketBoardSnapshot } = await import("@/lib/tsanghi");
  const tsanghiSnapshot = await fetchTsanghiMarketBoardSnapshot(symbol);
  if (tsanghiSnapshot.provider !== "fallback") {
    return buildMarketBoardPayload({
      selectedSymbol: symbol,
      asOf: tsanghiSnapshot.asOf,
      provider: tsanghiSnapshot.provider,
      note: tsanghiSnapshot.note,
      quotes: tsanghiSnapshot.quotes,
      klineSeries: tsanghiSnapshot.selectedKline,
      klineCandles: tsanghiSnapshot.selectedCandles,
      staticInfo: tsanghiSnapshot.staticInfo,
    });
  }

  const { fetchItickMarketBoardSnapshot } = await import("@/lib/itick");
  const itickSnapshot = await fetchItickMarketBoardSnapshot(symbol);
  if (itickSnapshot.provider !== "fallback") {
    return buildMarketBoardPayload({
      selectedSymbol: symbol,
      asOf: itickSnapshot.asOf,
      provider: itickSnapshot.provider,
      note: itickSnapshot.note,
      quotes: itickSnapshot.quotes,
      klineSeries: itickSnapshot.selectedKline,
      klineCandles: itickSnapshot.selectedCandles,
    });
  }

  const { fetchMarketBoardSnapshot } = await import("@/lib/alltick");
  const snapshot = await fetchMarketBoardSnapshot(symbol);
  const liveAlltick = snapshot.provider !== "fallback";

  return buildMarketBoardPayload({
    selectedSymbol: symbol,
    asOf: liveAlltick ? snapshot.asOf : itickSnapshot.asOf,
    provider: liveAlltick ? snapshot.provider : itickSnapshot.provider,
    note: liveAlltick ? snapshot.note : itickSnapshot.note,
    quotes: liveAlltick ? snapshot.quotes : itickSnapshot.quotes,
    klineSeries: liveAlltick ? snapshot.selectedKline : itickSnapshot.selectedKline,
    klineCandles: itickSnapshot.selectedCandles,
    staticInfo: snapshot.staticInfo,
  });
}
