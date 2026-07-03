import type { ScenarioRun } from "@/lib/types";
import {
  buildStudentSeasonChallengePayload,
  type StudentSeasonChallengePayload,
} from "@/lib/season-challenges";
import {
  computeMarketTemperature,
  type MarketTemperaturePayload,
} from "@/lib/market-sentiment";

export type StudentDomainKey = "home" | "market" | "opportunity" | "wealth";

export interface StudentDomainEntry {
  key: StudentDomainKey;
  label: string;
  href: string;
  summary: string;
  metricLabel: string;
  metricValue: string;
}

export interface StudentServiceEntry {
  id: string;
  title: string;
  href: string;
  group: "strategy" | "assets" | "life" | "learning";
  summary: string;
  learn: string;
  status: "ready" | "new" | "premium";
}

export type StudentServiceGroupKey = StudentServiceEntry["group"];

export interface StudentServiceGroupSummary {
  key: StudentServiceGroupKey;
  label: string;
  href: string;
  summary: string;
  concept: string;
  primaryActionLabel: string;
  completionLabel: string;
  completedCount: number;
  totalCount: number;
  serviceIds: string[];
}

export interface StudentHomeHubPayload {
  domains: StudentDomainEntry[];
  services: StudentServiceEntry[];
  serviceMap: StudentServiceGroupSummary[];
  marketTemperature: MarketTemperaturePayload;
  today: Array<{
    id: string;
    title: string;
    summary: string;
    href: string;
    tag: string;
    concept: string;
    actionLabel: string;
    progressLabel: string;
    done: boolean;
  }>;
  season: StudentSeasonChallengePayload;
}

export const studentServiceGroups: Record<StudentServiceGroupKey, string> = {
  strategy: "策略行动",
  assets: "资产成长",
  life: "生活理财",
  learning: "学习留存",
};

export const studentServices: StudentServiceEntry[] = [
  {
    id: "market",
    title: "市场雷达",
    href: "/student/market",
    group: "strategy",
    summary: "看指数、板块热度和观察池，先理解市场再做模拟决策。",
    learn: "学会把行情变化拆成事件、资金、情绪和风险。",
    status: "ready",
  },
  {
    id: "opportunity",
    title: "机会训练场",
    href: "/student/opportunity",
    group: "strategy",
    summary: "像写侦探线索一样记录机会，不急着买，先练观察理由。",
    learn: "训练主题识别、证据链和风险提示。",
    status: "new",
  },
  {
    id: "wealth",
    title: "我的财富",
    href: "/student/wealth",
    group: "assets",
    summary: "把现金、储蓄、持仓、房产、创业和负债放到一张地图里。",
    learn: "学会资产配置、分散和安全垫。",
    status: "ready",
  },
  {
    id: "fund-lab",
    title: "基金/ETF 实验室",
    href: "/student/fund-lab",
    group: "assets",
    summary: "比较指数、债券、黄金和主题组合，理解长期配置。",
    learn: "学会平均成本、回撤和组合波动。",
    status: "new",
  },
  {
    id: "auto-invest",
    title: "定投机器人",
    href: "/student/auto-invest",
    group: "assets",
    summary: "设置每回合自动计划，观察纪律如何影响平均成本。",
    learn: "学会定投、现金安全垫和节奏控制。",
    status: "ready",
  },
  {
    id: "life",
    title: "生活账本",
    href: "/student/life",
    group: "life",
    summary: "把预算、应急金和保险放进同一个月度挑战。",
    learn: "学会收入分配、消费取舍和风险保护。",
    status: "ready",
  },
  {
    id: "goal-accounts",
    title: "目标账户",
    href: "/student/goal-accounts",
    group: "life",
    summary: "把电脑、研学、备用金和创业启动金拆成每回合小目标。",
    learn: "学会延迟满足、目标储蓄和机会成本。",
    status: "new",
  },
  {
    id: "protection",
    title: "风险保护伞",
    href: "/student/protection",
    group: "life",
    summary: "用应急金、保险、债务和分散度做突发事件压力测试。",
    learn: "学会先防守，再追求更高收益。",
    status: "new",
  },
  {
    id: "credit",
    title: "信用实验室",
    href: "/student/credit",
    group: "life",
    summary: "先算清利息，再决定要不要借钱。",
    learn: "学会利息、杠杆、还款能力和现金流压力。",
    status: "ready",
  },
  {
    id: "risk",
    title: "风险测评",
    href: "/student/risk-profile",
    group: "learning",
    summary: "用 6 个情境看清自己的投资人格和风险边界。",
    learn: "学会风险承受力不是胆量，而是约束条件。",
    status: "ready",
  },
  {
    id: "quests",
    title: "任务中心",
    href: "/student/quests",
    group: "learning",
    summary: "把理财好习惯变成可以完成、可以复盘的任务。",
    learn: "学会用小任务巩固概念，而不是追短期刺激。",
    status: "ready",
  },
  {
    id: "history",
    title: "历史复盘",
    href: "/student/history",
    group: "learning",
    summary: "把每回合操作、净值变化和 AI 反馈串成复盘故事。",
    learn: "学会从错误和回撤里提炼下一步动作。",
    status: "ready",
  },
];

export function buildStudentHomeHubPayload(run: ScenarioRun): StudentHomeHubPayload {
  const latest = run.snapshots.at(-1);
  const previous = run.snapshots.at(-2);
  const netWorth = latest?.netWorth ?? run.cash + run.savings - run.debt;
  const delta = previous ? netWorth - previous.netWorth : 0;
  const opportunityNotes = run.actionLog.filter((entry) => entry.type === "opportunity").length;
  const watchlistActions = run.actionLog.filter((entry) => entry.type === "watchlist").length;
  const fundActions = run.actionLog.filter((entry) => entry.type === "fund_lab").length;
  const goalActions = run.actionLog.filter((entry) => entry.type === "goal_account").length;
  const protectionActions = run.actionLog.filter((entry) => entry.type === "protection").length;
  const wealthReviews = run.actionLog.filter((entry) => entry.type === "wealth_review").length;
  const autoInvestActions = run.actionLog.filter((entry) => entry.type === "auto_invest").length;
  const bankActions = run.actionLog.filter((entry) => entry.type === "bank").length;
  const questActions = run.actionLog.filter((entry) => entry.type === "quest").length;
  const marketTemperature = computeMarketTemperature(run);
  const serviceIdsByGroup = {
    strategy: studentServices.filter((service) => service.group === "strategy").map((service) => service.id),
    assets: studentServices.filter((service) => service.group === "assets").map((service) => service.id),
    life: studentServices.filter((service) => service.group === "life").map((service) => service.id),
    learning: studentServices.filter((service) => service.group === "learning").map((service) => service.id),
  } satisfies Record<StudentServiceGroupKey, string[]>;
  const serviceMap: StudentServiceGroupSummary[] = [
    {
      key: "strategy",
      label: studentServiceGroups.strategy,
      href: "/student/market",
      summary: "先读行情和主题，再写证据链，把冲动买卖变成可复盘的观察训练。",
      concept: "市场观察 / 机会证据链",
      primaryActionLabel: watchlistActions + opportunityNotes > 0 ? "继续更新观察" : "开始观察市场",
      completionLabel: `${watchlistActions} 次观察 · ${opportunityNotes} 张机会单`,
      completedCount: Number(watchlistActions > 0) + Number(opportunityNotes > 0),
      totalCount: 2,
      serviceIds: serviceIdsByGroup.strategy,
    },
    {
      key: "assets",
      label: studentServiceGroups.assets,
      href: "/student/wealth",
      summary: "把现金、储蓄、基金实验和持有复盘放在一起，理解长期配置的节奏。",
      concept: "资产配置 / 分散投资",
      primaryActionLabel: fundActions + wealthReviews > 0 ? "检查财富地图" : "做一次组合实验",
      completionLabel: `${fundActions} 次基金实验 · ${wealthReviews} 次持有复盘`,
      completedCount: Number(fundActions > 0) + Number(autoInvestActions > 0) + Number(wealthReviews > 0),
      totalCount: 3,
      serviceIds: serviceIdsByGroup.assets,
    },
    {
      key: "life",
      label: studentServiceGroups.life,
      href: "/student/goal-accounts",
      summary: "把生活目标、应急金、保护伞和信用压力接入投资决策，先稳住现金流。",
      concept: "目标储蓄 / 风险缓冲",
      primaryActionLabel: goalActions + protectionActions > 0 ? "补强安全底座" : "设置生活目标",
      completionLabel: `${goalActions} 个目标动作 · ${protectionActions} 次保护测试`,
      completedCount: Number(goalActions > 0) + Number(protectionActions > 0) + Number(bankActions > 0),
      totalCount: 3,
      serviceIds: serviceIdsByGroup.life,
    },
    {
      key: "learning",
      label: studentServiceGroups.learning,
      href: "/student/quests",
      summary: "用任务、历史复盘和风险测评记录学习过程，让每次选择都能变成下一步证据。",
      concept: "复盘习惯 / 行为偏差",
      primaryActionLabel: questActions + wealthReviews > 0 ? "领取学习反馈" : "打开任务中心",
      completionLabel: `${questActions} 次任务记录 · ${run.currentRound} 个回合样本`,
      completedCount: Number(questActions > 0) + Number(wealthReviews > 0) + Number(run.snapshots.length > 1),
      totalCount: 3,
      serviceIds: serviceIdsByGroup.learning,
    },
  ];

  return {
    domains: [
      {
        key: "home",
        label: "首页",
        href: "/student",
        summary: "今日任务、财富快照、服务台与 AI 教练。",
        metricLabel: "本轮净值",
        metricValue: `¥${netWorth.toLocaleString("zh-CN")}`,
      },
      {
        key: "market",
        label: "行情",
        href: "/student/market",
        summary: "观察市场温度、AI/科技观察池和板块热度。",
        metricLabel: "自选观察",
        metricValue: `${watchlistActions} 次`,
      },
      {
        key: "opportunity",
        label: "机会",
        href: "/student/opportunity",
        summary: "用观察单训练证据链，不直接给真实买卖结论。",
        metricLabel: "观察单",
        metricValue: `${opportunityNotes} 张`,
      },
      {
        key: "wealth",
        label: "持有",
        href: "/student/wealth",
        summary: "查看资产结构、现金垫和长期配置。",
        metricLabel: "持有复盘",
        metricValue: `${fundActions + goalActions + protectionActions + wealthReviews} 次`,
      },
    ],
    services: studentServices,
    serviceMap,
    marketTemperature,
    today: [
      {
        id: "read-market",
        title: "先看一眼市场温度",
        summary: `${marketTemperature.label}：${watchlistActions === 0 ? "先把一个涨跌背后的原因写进自选观察。" : "回看自选理由，判断证据是否比上一回合更清楚。"}`,
        href: "/student/market",
        tag: "行情",
        concept: "市场情绪",
        actionLabel: watchlistActions === 0 ? "去写观察理由" : "复查观察池",
        progressLabel: watchlistActions === 0 ? "未开始" : `已记录 ${watchlistActions} 次`,
        done: watchlistActions > 0,
      },
      {
        id: "opportunity-note",
        title: "开一张机会观察单",
        summary:
          opportunityNotes === 0
            ? "选择一个主题，写下证据、风险和下一步验证动作。"
            : "把已经写过的机会观察单带回历史复盘，看看证据链是否更清楚。",
        href: "/student/opportunity",
        tag: "机会",
        concept: "证据链",
        actionLabel: opportunityNotes === 0 ? "写观察单" : "继续训练",
        progressLabel: opportunityNotes === 0 ? "未完成" : `已写 ${opportunityNotes} 张`,
        done: opportunityNotes > 0,
      },
      {
        id: "fund-lab",
        title: fundActions === 0 ? "做一次基金/ETF 实验" : "复查组合分散度",
        summary:
          fundActions === 0
            ? "用指数、债券、黄金和主题基金做一次虚拟组合比较。"
            : delta >= 0
              ? "净值上行时也要看集中度，避免把好运误当成能力。"
              : "回撤出现时先看组合分散度、现金垫和仓位节奏。",
        href: fundActions === 0 ? "/student/fund-lab" : "/student/wealth",
        tag: "资产",
        concept: "分散投资",
        actionLabel: fundActions === 0 ? "进入实验室" : "看财富地图",
        progressLabel: fundActions === 0 ? "未完成" : `已做 ${fundActions} 次`,
        done: fundActions > 0,
      },
      {
        id: "safety-base",
        title: "补一块安全底座",
        summary: goalActions === 0 ? "先给紧急备用金或电脑基金转入一小笔。" : "做一次保护伞压力测试，看看坏情况能不能扛住。",
        href: goalActions === 0 ? "/student/goal-accounts" : "/student/protection",
        tag: "生活",
        concept: "安全垫",
        actionLabel: goalActions === 0 ? "设置目标账户" : "测试保护伞",
        progressLabel:
          goalActions + protectionActions === 0
            ? "未开始"
            : `目标 ${goalActions} 次 · 保护 ${protectionActions} 次`,
        done: goalActions > 0 && protectionActions > 0,
      },
    ],
    season: buildStudentSeasonChallengePayload(run),
  };
}
