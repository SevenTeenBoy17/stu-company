import type { LearningModule, NavGroup } from "@/lib/types";

export const siteNavGroups: NavGroup[] = [
  {
    title: "市场情景",
    summary: "把复杂市场拆成高中生也能上手的动态任务，帮助学生从观察走向判断。",
    items: [
      {
        label: "春季试点场景",
        href: "/demo",
        description: "12 回合校园赛季，覆盖宏观波动、舆情冲击与资产配置。",
      },
      {
        label: "随机事件卡",
        href: "/learn",
        description: "政策、行业、情绪与黑天鹅事件分阶段出现，训练风险响应与复盘能力。",
      },
      {
        label: "登录后进入策略台",
        href: "/demo",
        description: "学生、教师、家长与管理员按账号权限进入对应工作台，公共站点不直接暴露内部入口。",
      },
    ],
  },
  {
    title: "投资课程",
    summary: "从 AP 经济学考点切入，做成可练、可评、可复盘的任务流。",
    items: [
      {
        label: "8 大核心模块",
        href: "/learn",
        description: "股市、银行、房产、创业、事件与榜单等模块化学习路径。",
      },
      {
        label: "学·用·评闭环",
        href: "/#method",
        description: "先学概念，再做情景决策，最后拿到 AI 行为报告。",
      },
      {
        label: "课堂挑战赛",
        href: "/demo",
        description: "教师登录后可把课堂作业变成班级挑战赛，提高参与度与完成率。",
      },
    ],
  },
  {
    title: "模拟空间",
    summary: "学生、教师、家长三端联动，让课堂和家庭都能看到成长轨迹。",
    items: [
      {
        label: "学生策略体验",
        href: "/demo",
        description: "统一交易面板、资产总览、AI 导师点评与回合推进，需登录后进入。",
      },
      {
        label: "教师组织工具",
        href: "/demo",
        description: "教师账号可发任务、管邀请码、看班级排行与行为偏差。",
      },
      {
        label: "家长成长报告",
        href: "/demo",
        description: "家长账号可查看理性决策、计划性与风险控制等维度变化。",
      },
    ],
  },
  {
    title: "家校共育",
    summary: "坚持去金钱化与未成年人友好，把投教做成成长工具而不是诱导工具。",
    items: [
      {
        label: "教育白名单",
        href: "/#safety",
        description: "不接真实交易、不做开户导流，强调教育属性与模拟边界。",
      },
      {
        label: "运营控制台",
        href: "/demo",
        description: "超级管理员登录后可统一查看账号、试用、订阅、订单与学校授权指标。",
      },
      {
        label: "项目路演摘要",
        href: "/#business",
        description: "市场机会、商业模式、试点路线与团队愿景总览。",
      },
    ],
  },
];

export const learningModules: LearningModule[] = [
  {
    key: "equities",
    title: "股市交易仿真",
    tagline: "从 K 线、涨跌幅到订单执行，完整感受市场心理波动。",
    description:
      "把牛熊转换、估值压力与舆情反转拆成易懂任务，帮助学生在无真实资金压力下训练判断。",
    level: "核心",
    highlights: ["市价 / 限价指令", "板块轮动提示", "行为偏差识别"],
  },
  {
    key: "portfolio",
    title: "多元投资组合",
    tagline: "把 ETF、债券、商品和外汇放进同一张资产配置视图。",
    description:
      "从单一押注切换为组合思维，理解分散配置、风险敞口与收益平衡。",
    level: "核心",
    highlights: ["ETF 组合", "债券缓冲", "外汇与商品对冲"],
  },
  {
    key: "banking",
    title: "银行与储蓄",
    tagline: "让现金流、存款利率和复利效应被真正看见。",
    description:
      "通过活期、定存、贷款与还款动作，理解流动性与资金管理的基本功。",
    level: "核心",
    highlights: ["复利计算", "贷款成本", "流动性管理"],
  },
  {
    key: "property",
    title: "房地产模拟",
    tagline: "把首付、按揭与租售比放进可比较的场景里。",
    description:
      "学生可以在不同利率与景气度环境下做买租判断，理解杠杆与长期现金流。",
    level: "进阶",
    highlights: ["首付压力测试", "租售比判断", "房产周期感知"],
  },
  {
    key: "venture",
    title: "创业与并购",
    tagline: "从投资者变成经营者，理解 ROE、现金流与扩张节奏。",
    description:
      "不只看价格涨跌，还要思考商业模式、并购窗口与团队执行效率。",
    level: "进阶",
    highlights: ["现金流经营", "股权结构", "并购窗口"],
  },
  {
    key: "events",
    title: "突发事件卡",
    tagline: "黑天鹅不是噱头，而是训练临场应变与复盘的关键材料。",
    description:
      "政策调整、舆情爆发、供需失衡会被随机推送，考验学生对不确定性的处理方式。",
    level: "运营",
    highlights: ["政策扰动", "舆情冲击", "危机复盘"],
  },
  {
    key: "competition",
    title: "社区与竞赛",
    tagline: "用班级榜、校际榜和周挑战，让课堂拥有游戏张力。",
    description:
      "把策略讨论、团队荣誉与阶段成绩结合起来，让学生更愿意持续参与。",
    level: "运营",
    highlights: ["班级榜", "校际榜", "每周挑战"],
  },
  {
    key: "guardian",
    title: "教师与家长端",
    tagline: "同一套数据同时服务课堂组织与家庭反馈。",
    description:
      "教师可发任务与看班级数据，家长能查看成长曲线和行为偏差，形成家校共育闭环。",
    level: "家校",
    highlights: ["教学脚本", "成长报告", "行为标签"],
  },
];

// ── Learning quizzes (Option B) ─────────────────────────────────────────────
// DRAFT questions — educational, single clear answer, correct option deliberately
// placed at varied indices (never always-first). Easily edited/replaced: this is
// plain data. Graded server-side (src/lib/learning-quiz.ts); pass = 2 of 3.
export interface QuizQuestion {
  q: string;
  options: string[];
  /** index of the correct option in `options` */
  answer: number;
}

export const moduleQuizzes: Record<string, QuizQuestion[]> = {
  equities: [
    {
      q: "市价单(market order)和限价单(limit order)最主要的区别是？",
      options: [
        "限价单一定比市价单成交快",
        "市价单按当前最优价立即成交，限价单只在达到指定价时才成交",
        "市价单永远不会成交",
        "两者完全相同",
      ],
      answer: 1,
    },
    {
      q: "某股票一天内从 100 元涨到 110 元，涨幅是多少？",
      options: ["1%", "110%", "10%", "0.1%"],
      answer: 2,
    },
    {
      q: "看到一只股票连续大涨就立刻追进去，这最可能体现哪种行为偏差？",
      options: ["长期价值投资", "风险对冲", "理性分散", "追涨杀跌（羊群效应）"],
      answer: 3,
    },
  ],
  portfolio: [
    {
      q: "把资金分散到股票、债券、商品等不同资产，主要目的是？",
      options: [
        "降低单一资产波动带来的整体风险",
        "保证一定赚钱",
        "让收益必然翻倍",
        "纯粹为了省手续费",
      ],
      answer: 0,
    },
    {
      q: "在投资组合里，债券相对股票通常更接近什么作用？",
      options: ["提供最高的投机收益", "提供较稳的缓冲、降低波动", "必然亏损", "等同现金且零收益"],
      answer: 1,
    },
    {
      q: "“不要把鸡蛋放在同一个篮子里”讲的是哪种投资思想？",
      options: ["集中押注", "加杠杆借贷", "分散配置", "短线追涨"],
      answer: 2,
    },
  ],
  banking: [
    {
      q: "和单利相比，复利长期来看会让本息？",
      options: ["增长更慢", "完全一样", "最终归零", "增长更快（利滚利）"],
      answer: 3,
    },
    {
      q: "贷款的“成本”主要体现在哪里？",
      options: ["需要支付利息", "本金会自动变多", "完全免费", "只有还清后才产生"],
      answer: 0,
    },
    {
      q: "金融里说的“流动性”通常指？",
      options: ["贷款额度上限", "资产变现的难易和速度", "股票的数量", "账户的颜色"],
      answer: 1,
    },
  ],
  property: [
    {
      q: "买房按揭中的“首付”是指？",
      options: ["每月偿还的利息", "先自付的一部分房款，其余向银行贷款", "全款一次付清", "中介服务费"],
      answer: 1,
    },
    {
      q: "用较少自有资金、靠贷款撬动更大的资产，这通常被称为？",
      options: ["对冲", "套利", "杠杆", "分散"],
      answer: 2,
    },
    {
      q: "“租售比”常被用来判断什么？",
      options: ["贷款利率高低", "房子的朝向", "物业费多少", "租金相对房价是否合理、买还是租更划算"],
      answer: 3,
    },
  ],
  venture: [
    {
      q: "ROE（净资产收益率）衡量的是？",
      options: ["用股东的钱赚钱的效率", "公司员工人数", "办公室面积", "广告投放量"],
      answer: 0,
    },
    {
      q: "对一家企业而言，长期最关键的“血液”通常是？",
      options: ["会议数量", "现金流", "logo 设计", "办公楼层数"],
      answer: 1,
    },
    {
      q: "并购（M&A）指的是？",
      options: ["只发工资", "单纯打广告", "企业之间的合并与收购", "直接关闭公司"],
      answer: 2,
    },
  ],
  events: [
    {
      q: "“黑天鹅”事件通常指？",
      options: ["每天都会发生的小事", "一定是利好的事件", "可以精确预测的事件", "极少发生但影响巨大的意外事件"],
      answer: 3,
    },
    {
      q: "面对突发利空，较稳健的第一反应通常是？",
      options: [
        "先评估风险敞口、控制仓位，而不是情绪化操作",
        "立刻满仓加注",
        "完全无视行情",
        "借钱把全部身家抄底",
      ],
      answer: 0,
    },
    {
      q: "投资学习里“复盘”的意义是？",
      options: ["预测明天的涨跌", "回顾决策过程、总结改进", "炫耀收益", "删除交易记录"],
      answer: 1,
    },
  ],
  competition: [
    {
      q: "财商战力榜强调“比的是决策质量，不是谁更敢赌”，这鼓励学生？",
      options: ["尽量满仓豪赌", "注重风险调整后的理性决策", "只追求一夜暴富", "忽视投资纪律"],
      answer: 1,
    },
    {
      q: "班级榜、校际榜这类机制的主要作用是？",
      options: ["制造焦虑", "替代日常学习", "用良性竞争激励持续参与和策略讨论", "决定真实财富"],
      answer: 2,
    },
    {
      q: "在教育模拟里取得高分，主要应依靠？",
      options: ["运气", "作弊", "和同学攀比消费", "长期稳健的策略与纪律"],
      answer: 3,
    },
  ],
  guardian: [
    {
      q: "给家长看的“成长报告”核心是？",
      options: [
        "孩子在理性决策、计划性、风险控制等维度的变化",
        "孩子的真实银行存款",
        "股票内幕消息",
        "同学间的消费排行",
      ],
      answer: 0,
    },
    {
      q: "本产品坚持“去金钱化、未成年人友好”，意味着？",
      options: ["鼓励学生用真钱炒股", "把投教做成成长工具，不诱导真实交易或开户", "引导学生去开户", "比谁花钱更多"],
      answer: 1,
    },
    {
      q: "“家校共育”指的是？",
      options: ["家长替孩子考试", "学校只管分数", "教师与家长围绕同一套数据协同支持学生成长", "家庭与学校互不沟通"],
      answer: 2,
    },
  ],
};

export const showcaseStats = [
  { label: "目标赛道", value: "青少年财商教育", detail: "2032 年全球规模预计 938 亿美元" },
  { label: "产品闭环", value: "学 · 用 · 评", detail: "知识颗粒化任务 + 高保真模拟 + AI 反馈" },
  { label: "试点路径", value: "5-10 所重点高中", detail: "先校内验证，再联赛扩张与 SaaS 化" },
];

export const comparisonRows = [
  {
    label: "市场真实度",
    traditional: "静态案例与纸面模拟，变化有限",
    brownZone: "宏观、行业、公司与舆情联动，回合环境不断刷新",
  },
  {
    label: "反馈机制",
    traditional: "考试分数为主，缺乏行为诊断",
    brownZone: "AI 实时点评 + 多维成长报告，能看到习惯变化",
  },
  {
    label: "安全与合规",
    traditional: "容易停留在概念层面，缺少去金钱化设计",
    brownZone: "严格教育白名单，不接真实交易与开户导流",
  },
  {
    label: "家校协同",
    traditional: "课堂结束后难以持续跟踪",
    brownZone: "教师任务、家长报告、班级榜单共享同一条成长线",
  },
];

export const roadmapPhases = [
  {
    title: "Phase 01 · 校园试点",
    detail: "由 5-10 所重点高中验证核心玩法、任务脚本和留存曲线。",
  },
  {
    title: "Phase 02 · 区域扩张",
    detail: "举办 Mr.Brown 杯挑战赛，让课堂任务与赛事传播互相放大。",
  },
  {
    title: "Phase 03 · SaaS 规模化",
    detail: "形成校园版订阅、个人增值订阅与赛事服务的组合收入。",
  },
];

export const teamProfiles = [
  {
    name: "白杨景美",
    role: "CEO / Product Lead",
    summary: "统筹产品架构、商业逻辑与市场试点，定义整体产品方向。",
  },
  {
    name: "罗布森",
    role: "CTO / Algorithm",
    summary: "负责高保真股市仿真、事件逻辑与 AI 导师接入策略。",
  },
  {
    name: "刘煜柯",
    role: "CFO / Curriculum",
    summary: "负责经济学内容转译、预算控制与财务模型设计。",
  },
  {
    name: "张珍清",
    role: "COO / Operations",
    summary: "负责校园运营、联赛活动、执行节奏与用户增长试点。",
  },
];
