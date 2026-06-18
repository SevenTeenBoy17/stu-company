import type { LearningModule, NavGroup } from "@/lib/types";

export type LearningModuleQuiz = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};

type LearningModuleDefinition = LearningModule & {
  quiz: LearningModuleQuiz[];
};

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

const learningModuleDefinitions: LearningModuleDefinition[] = [
  {
    key: "equities",
    title: "股市交易仿真",
    tagline: "从 K 线、涨跌幅到订单执行，完整感受市场心理波动。",
    description:
      "把牛熊转换、估值压力与舆情反转拆成易懂任务，帮助学生在无真实资金压力下训练判断。",
    level: "核心",
    highlights: ["市价 / 限价指令", "板块轮动提示", "行为偏差识别"],
    href: "https://www.bilibili.com/video/BV1AnSvB8EZY/",
    hrefLabel: "B站 · 从零开始学炒股",
    quiz: [
      {
        question: "在模拟股票交易里，限价单最适合用来训练哪一种能力？",
        options: ["先设定可接受价格再等待成交", "看到上涨就立刻全仓追入", "忽略波动只看同学排名", "把所有现金都换成单只股票"],
        answerIndex: 0,
        explanation: "限价单让学生先写下交易边界，练的是计划性，而不是追涨冲动。",
      },
      {
        question: "如果某只股票连续大涨，下一步最合理的课堂观察动作是什么？",
        options: ["只看涨幅就判断一定会继续涨", "同时检查消息、估值压力和仓位占比", "马上借钱加仓", "不记录原因直接退出课程"],
        answerIndex: 1,
        explanation: "涨幅只是现象，复盘原因、风险和仓位才是可迁移的投资能力。",
      },
    ],
  },
  {
    key: "portfolio",
    title: "多元投资组合",
    tagline: "把 ETF、债券、商品和外汇放进同一张资产配置视图。",
    description:
      "从单一押注切换为组合思维，理解分散配置、风险敞口与收益平衡。",
    level: "核心",
    highlights: ["ETF 组合", "债券缓冲", "外汇与商品对冲"],
    href: "https://www.bilibili.com/video/BV1364y1S7wK/",
    hrefLabel: "B站 · 理财与资产配置",
    quiz: [
      {
        question: "多元投资组合最想解决的核心问题是什么？",
        options: ["让每个资产每天都上涨", "把风险分散到不同来源", "保证本金永远不会亏损", "让交易次数越多越好"],
        answerIndex: 1,
        explanation: "分散配置不能消灭风险，但能避免单一资产决定整个结果。",
      },
      {
        question: "债券在组合里常被当作什么角色来理解？",
        options: ["只负责制造高波动", "在部分情境下缓冲股票波动", "一定比股票收益更高", "和现金完全一样"],
        answerIndex: 1,
        explanation: "债券通常更像稳定器，但仍会受利率、信用和期限影响。",
      },
    ],
  },
  {
    key: "banking",
    title: "银行与储蓄",
    tagline: "让现金流、存款利率和复利效应被真正看见。",
    description:
      "通过活期、定存、贷款与还款动作，理解流动性与资金管理的基本功。",
    level: "核心",
    highlights: ["复利计算", "贷款成本", "流动性管理"],
    href: "https://www.bilibili.com/video/BV1ZY97YQEN8/",
    hrefLabel: "B站 · 个人理财公开课",
    quiz: [
      {
        question: "应急现金垫的主要作用是什么？",
        options: ["让账户看起来更无聊", "在突发支出时减少被迫卖出资产", "提高每次交易的杠杆", "替代所有长期投资"],
        answerIndex: 1,
        explanation: "流动性不是躺平，而是给决策争取时间和选择空间。",
      },
      {
        question: "贷款成本最应该关注哪一类信息？",
        options: ["利息、期限和还款压力", "同学有没有贷款", "按钮颜色是否好看", "排行榜是否马上上升"],
        answerIndex: 0,
        explanation: "贷款会改变现金流，必须把利息和还款节奏一起看。",
      },
    ],
  },
  {
    key: "property",
    title: "房地产模拟",
    tagline: "把首付、按揭与租售比放进可比较的场景里。",
    description:
      "学生可以在不同利率与景气度环境下做买租判断，理解杠杆与长期现金流。",
    level: "进阶",
    highlights: ["首付压力测试", "租售比判断", "房产周期感知"],
    href: "https://www.bilibili.com/video/BV1Nt411v7CD/",
    hrefLabel: "B站 · 房地产投资分析",
    quiz: [
      {
        question: "买房决策里，首付之外还应该一起观察什么？",
        options: ["月供、现金流和机会成本", "只看房价会不会涨", "只看装修图片", "只看同学是否购买"],
        answerIndex: 0,
        explanation: "房产是长期现金流决策，不只是一次购买动作。",
      },
      {
        question: "租售比在课堂模拟中可以帮助学生比较什么？",
        options: ["租金收入和房产价格之间的关系", "股票 K 线的颜色", "创业团队人数", "AI 导师的语气"],
        answerIndex: 0,
        explanation: "租售比能帮助学生把房价和现金流联系起来，而不是只看总价。",
      },
    ],
  },
  {
    key: "venture",
    title: "创业与并购",
    tagline: "从投资者变成经营者，理解 ROE、现金流与扩张节奏。",
    description:
      "不只看价格涨跌，还要思考商业模式、并购窗口与团队执行效率。",
    level: "进阶",
    highlights: ["现金流经营", "股权结构", "并购窗口"],
    href: "https://www.bilibili.com/video/BV1KK4y1s7mY/",
    hrefLabel: "B站 · 斯坦福《如何创业》",
    quiz: [
      {
        question: "创业项目看起来很火时，学生最应该先检查什么？",
        options: ["现金流、成本和能否持续经营", "名字是否足够酷", "是否能立刻超过全班", "有没有一次性投完所有资金"],
        answerIndex: 0,
        explanation: "热度不等于质量，经营现金流能帮助判断项目是否可持续。",
      },
      {
        question: "并购窗口在沙盘里主要训练哪种思维？",
        options: ["比较价格、协同和风险后再行动", "看到便宜就全部买下", "完全不看负债", "只听传闻做决定"],
        answerIndex: 0,
        explanation: "并购不是捡便宜，而是比较协同价值和整合风险。",
      },
    ],
  },
  {
    key: "events",
    title: "突发事件卡",
    tagline: "黑天鹅不是噱头，而是训练临场应变与复盘的关键材料。",
    description:
      "政策调整、舆情爆发、供需失衡会被随机推送，考验学生对不确定性的处理方式。",
    level: "运营",
    highlights: ["政策扰动", "舆情冲击", "危机复盘"],
    href: "https://www.bilibili.com/video/BV14L4y157Ft/",
    hrefLabel: "B站 · 金融史黑天鹅事件",
    quiz: [
      {
        question: "黑天鹅事件在课堂里最适合作为什么材料？",
        options: ["训练应对不确定性和复盘", "证明市场永远无法学习", "让学生停止记录", "保证某个资产一定上涨"],
        answerIndex: 0,
        explanation: "突发事件的价值在于训练预案、情绪管理和事后复盘。",
      },
      {
        question: "面对突发政策变化，最稳妥的第一步是什么？",
        options: ["识别影响哪些资产和现金流", "立刻全仓反向操作", "忽略事件继续点完成", "只看排行榜名次"],
        answerIndex: 0,
        explanation: "先判断影响范围，再决定动作，能降低情绪化操作。",
      },
    ],
  },
  {
    key: "competition",
    title: "社区与竞赛",
    tagline: "用班级榜、校际榜和周挑战，让课堂拥有游戏张力。",
    description:
      "把策略讨论、团队荣誉与阶段成绩结合起来，让学生更愿意持续参与。",
    level: "运营",
    highlights: ["班级榜", "校际榜", "每周挑战"],
    href: "https://www.bilibili.com/video/BV1As4y1U7e5/",
    hrefLabel: "B站 · 模拟投资实训竞赛",
    quiz: [
      {
        question: "班级榜单最健康的使用方式是什么？",
        options: ["把榜单当作复盘线索，而不是唯一目标", "只追求短期冲分", "不记录任何策略", "输了就删除账户"],
        answerIndex: 0,
        explanation: "榜单能提供反馈，但学习价值来自解释差异和修正策略。",
      },
      {
        question: "每周挑战赛应该鼓励学生提交什么？",
        options: ["策略理由和风险复盘", "只提交最终净值", "只截图最高排名", "完全不解释操作"],
        answerIndex: 0,
        explanation: "有理由、有证据、有复盘的挑战才有教学价值。",
      },
    ],
  },
  {
    key: "guardian",
    title: "教师与家长端",
    tagline: "同一套数据同时服务课堂组织与家庭反馈。",
    description:
      "教师可发任务与看班级数据，家长能查看成长曲线和行为偏差，形成家校共育闭环。",
    level: "家校",
    highlights: ["教学脚本", "成长报告", "行为标签"],
    href: "https://www.bilibili.com/video/BV1rR4y1i7nC/",
    hrefLabel: "B站 · 少儿财商启蒙课",
    quiz: [
      {
        question: "教师和家长端最应该共同关注哪类变化？",
        options: ["学生决策习惯和风险意识是否进步", "学生是否每天排名第一", "学生是否每次都买股票", "学生是否跳过所有复盘"],
        answerIndex: 0,
        explanation: "家校共育关注的是长期行为变化，而不是单次胜负。",
      },
      {
        question: "行为标签的教育用途是什么？",
        options: ["帮助学生看见自己的决策模式", "给学生贴永久标签", "替代所有教师判断", "直接给真实投资建议"],
        answerIndex: 0,
        explanation: "标签应作为对话入口，帮助学生理解并修正习惯。",
      },
    ],
  },
];

export const learningModules: LearningModule[] = learningModuleDefinitions.map((module) => ({
  key: module.key,
  title: module.title,
  tagline: module.tagline,
  description: module.description,
  level: module.level,
  highlights: module.highlights,
  href: module.href,
  hrefLabel: module.hrefLabel,
}));

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
