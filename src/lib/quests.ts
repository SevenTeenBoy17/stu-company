import { buildWealthSummary, type WealthSummary } from "@/lib/allocation";
import { computeLearningStreak } from "@/lib/simulation";
import type { LearningProgressSummary, ScenarioRun } from "@/lib/types";
import { clamp, createId } from "@/lib/utils";

export type StudentQuestStatus = "done" | "active" | "watch" | "locked";
export type StudentQuestCategory = "finance" | "learning" | "discipline" | "risk" | "review";
export type StudentBenefitKind = "practice" | "competition" | "perk";
export type StudentBenefitStatus = "available" | "in_progress" | "locked" | "claimed";

export interface StudentQuestItem {
  id: string;
  title: string;
  category: StudentQuestCategory;
  status: StudentQuestStatus;
  progress: number;
  claimable: boolean;
  claimed: boolean;
  target: string;
  reward: string;
  coachNote: string;
}

export interface StudentAchievement {
  id: string;
  title: string;
  unlocked: boolean;
  detail: string;
  decorativeReward: string;
}

export interface StudentEarningsCalendarDay {
  round: number;
  netWorth: number;
  delta: number;
  tone: "up" | "down" | "flat";
  label: string;
}

export interface StudentBenefitItem {
  id: string;
  kind: StudentBenefitKind;
  title: string;
  label: string;
  summary: string;
  href: string;
  actionLabel: string;
  reward: string;
  progress: number;
  status: StudentBenefitStatus;
  guardrail: string;
}

export interface StudentQuestPayload {
  generatedAt: string;
  overview: {
    completed: number;
    total: number;
    active: number;
    streakCurrent: number;
    streakBest: number;
    stageLabel: string;
    learningCompleted: number;
    learningTotal: number;
  };
  quests: StudentQuestItem[];
  achievements: StudentAchievement[];
  benefits: {
    title: string;
    summary: string;
    guardrail: string;
    items: StudentBenefitItem[];
  };
  calendar: StudentEarningsCalendarDay[];
  coach: {
    title: string;
    summary: string;
    nextActions: string[];
  };
}

export interface QuestClaimResult {
  questId: string;
  title: string;
  reward: string;
  claimedAt: string;
  summary: string;
}

function questClaimEntries(run: ScenarioRun) {
  return run.actionLog.filter(
    (entry) => entry.type === "quest" && entry.meta?.kind === "quest_reward_claim",
  );
}

function isQuestClaimed(run: ScenarioRun, questId: string) {
  return questClaimEntries(run).some((entry) => entry.meta?.questId === questId);
}

function withClaimState(run: ScenarioRun, quest: Omit<StudentQuestItem, "claimable" | "claimed">): StudentQuestItem {
  const claimed = isQuestClaimed(run, quest.id);
  // 已领取即锁定为完成（评审会 P2·习得性无助）：cooldown/安全垫/分散度等实时指标驱动的任务，
  // 领取后若指标回落会静默回退成「进行中」——学生无法解释「为什么做过了还不算」。
  // 领取是终态：状态/进度永不回退，与图鉴「已点亮永久不变灰」承诺一致。
  if (claimed) {
    return { ...quest, status: "done", progress: 1, claimed: true, claimable: false };
  }
  return {
    ...quest,
    claimed,
    claimable: quest.status === "done" && !claimed,
  };
}

function statusFrom(progress: number, watch = false): StudentQuestStatus {
  if (progress >= 1) return "done";
  return watch ? "watch" : "active";
}

function countActions(run: ScenarioRun, type: ScenarioRun["actionLog"][number]["type"]) {
  return run.actionLog.filter((entry) => entry.type === type).length;
}

function latestActionRound(run: ScenarioRun, type: ScenarioRun["actionLog"][number]["type"]) {
  return Math.max(0, ...run.actionLog.filter((entry) => entry.type === type).map((entry) => entry.round));
}

function buildCalendar(run: ScenarioRun): StudentEarningsCalendarDay[] {
  return [...run.snapshots]
    .sort((left, right) => left.round - right.round)
    .map((snapshot, index, snapshots) => {
      const previous = snapshots[index - 1];
      const delta = previous ? snapshot.netWorth - previous.netWorth : 0;
      return {
        round: snapshot.round,
        netWorth: snapshot.netWorth,
        delta,
        tone: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
        label: delta > 0 ? "净值上行" : delta < 0 ? "回撤复盘" : "起步记录",
      };
    });
}

function buildCoach(summary: WealthSummary, run: ScenarioRun, learning: LearningProgressSummary) {
  const tradeCount = countActions(run, "trade");
  const bankCount = countActions(run, "bank");
  const opportunityCount = countActions(run, "opportunity");
  const fundLabCount = countActions(run, "fund_lab");
  const protectionCount = countActions(run, "protection");
  const learningRate = learning.total > 0 ? learning.completed / learning.total : 0;
  const nextActions: string[] = [];

  if (summary.diversificationScore < 72) {
    nextActions.push("先做一次持仓体检：把单一资产占比、现金缓冲和债务压力写成一句复盘。");
  }
  if (bankCount < 2) {
    nextActions.push("补一个现金管理动作：转入储蓄或减少债务，让下一回合有更稳定的选择权。");
  }
  if (learningRate < 0.35) {
    nextActions.push("完成 1 节课程模块，再回到沙盘执行；这比盲目多交易更能提升判断质量。");
  }
  if (opportunityCount === 0) {
    nextActions.push("去机会训练场写 1 张观察单：先说明证据和风险，再决定是否进入模拟配置。");
  }
  if (fundLabCount === 0) {
    nextActions.push("完成 1 次基金/ETF 实验，比较分散配置和单一资产的波动差异。");
  }
  if (protectionCount === 0 && summary.riskScore >= 55) {
    nextActions.push("做一次保护伞压力测试，看看现金垫、保险和债务会怎样影响坏情况。");
  }
  if (tradeCount > Math.max(6, run.currentRound + 2)) {
    nextActions.push("本回合先暂停追单，选择 1 笔交易写下理由，训练“先解释再行动”。");
  }
  if (nextActions.length === 0) {
    nextActions.push("保持现在的节奏：下一步只做小幅再平衡，不为了追求刺激而重仓单一方向。");
  }

  return {
    title:
      summary.diversificationScore >= 78
        ? "你已经进入均衡挑战段"
        : summary.riskScore >= 68
          ? "先把风险温度降下来"
          : "把好习惯变成连续任务",
    summary:
      "任务中心不会直接增加学习点，它只把真实行为转成可见目标。这样既保留学习榜公平，也让你知道自己下一步该练哪一种能力。",
    nextActions: nextActions.slice(0, 3),
  };
}

function benefitStatus(progress: number, locked = false): StudentBenefitStatus {
  if (locked) return "locked";
  if (progress >= 1) return "claimed";
  if (progress > 0) return "in_progress";
  return "available";
}

function buildBenefits(
  run: ScenarioRun,
  learning: LearningProgressSummary,
  wealth: WealthSummary,
): StudentQuestPayload["benefits"] {
  const tradeCount = countActions(run, "trade");
  const opportunityCount = countActions(run, "opportunity");
  const fundLabCount = countActions(run, "fund_lab");
  const reviewCount = countActions(run, "wealth_review") + countActions(run, "advance");
  const learningProgress = learning.total > 0 ? learning.completed / Math.min(3, learning.total) : 0;
  const diversified = wealth.diversificationScore >= 72;

  const items: StudentBenefitItem[] = [
    {
      id: "guess-direction",
      kind: "practice",
      title: "猜涨跌微练习",
      label: "波动观察",
      summary: "先写下你对下一回合冷热方向的判断，再用结果复盘“预测为什么会失误”。",
      href: "/student/market",
      actionLabel: "去市场雷达练习",
      reward: "装饰贴纸：波动侦探",
      progress: clamp(opportunityCount / 1, 0, 1),
      status: benefitStatus(opportunityCount / 1),
      guardrail: "猜测只用于训练概率感，不改变净值、学习点和学习榜。",
    },
    {
      id: "season-mini-league",
      kind: "competition",
      title: "班级赛季小赛",
      label: "模拟大赛",
      summary: "用分散度、复盘和学习任务参与班级挑战，比的是决策质量，不是谁胆子更大。",
      href: "/student/rank",
      actionLabel: "查看班级榜",
      reward: "称号：稳健挑战者",
      progress: clamp((reviewCount + fundLabCount) / 3, 0, 1),
      status: benefitStatus((reviewCount + fundLabCount) / 3),
      guardrail: "赛事奖励只做展示，不额外发放学习点。",
    },
    {
      id: "trial-cash-lab",
      kind: "perk",
      title: "模拟资金首单训练",
      label: "练习资金",
      summary: "完成第一笔模拟交易后，系统会引导你复盘“为什么买、亏了怎么办、什么时候退出”。",
      href: "/student",
      actionLabel: tradeCount > 0 ? "回到策略台复盘" : "去策略台完成首单",
      reward: "头像角标：第一笔模拟单",
      progress: clamp(tradeCount / 1, 0, 1),
      status: benefitStatus(tradeCount / 1),
      guardrail: "练习资金只用于课堂模拟，不是真实资金，也不进入真实交易。",
    },
    {
      id: "learn-to-earn",
      kind: "perk",
      title: "学投资课程领皮肤",
      label: "学习皮肤",
      summary: "完成课程与小测后解锁界面皮肤，让“先学再做”变成可见的成长仪式。",
      href: "/learn",
      actionLabel: "去投教课程",
      reward: "主页卡片光效：知识火种",
      progress: clamp(learningProgress, 0, 1),
      status: benefitStatus(learningProgress),
      guardrail: "学习奖励是装饰权益，不承诺收益，不替代真实投资建议。",
    },
    {
      id: "risk-shield",
      kind: "practice",
      title: "大盘晴雨保护伞",
      label: "大盘晴雨",
      summary: "当市场过热或过冷时，先检查现金垫和分散度，再决定下一步是否行动。",
      href: "/student/protection",
      actionLabel: "做保护伞压力测试",
      reward: "装饰徽章：风险守门员",
      progress: diversified ? 1 : clamp(wealth.diversificationScore / 72, 0, 1),
      status: benefitStatus(wealth.diversificationScore / 72),
      guardrail: "保护伞训练强调风险管理，不提供真实买卖指令。",
    },
  ];

  return {
    title: "活动权益中心",
    summary: "把参考图里的波动观察、模拟资金练习、学习皮肤和大盘晴雨，改造成未成年人友好的课堂练习货架。",
    guardrail: "所有活动权益都只用于学习、装饰和复盘，不直接改变净值、学习点或真实收益。",
    items,
  };
}

export function buildStudentQuestPayload(
  run: ScenarioRun,
  learning: LearningProgressSummary,
  now = new Date(),
): StudentQuestPayload {
  const wealth = buildWealthSummary(run);
  // 学习型连续（替代净值连升运气钩子）：streakCurrent/Best 现表示连续学习回合数。
  const streak = computeLearningStreak(run);
  const tradeCount = countActions(run, "trade");
  const bankCount = countActions(run, "bank");
  const opportunityCount = countActions(run, "opportunity");
  const fundLabCount = countActions(run, "fund_lab");
  const goalAccountCount = countActions(run, "goal_account");
  const protectionCount = countActions(run, "protection");
  const wealthReviewCount = countActions(run, "wealth_review");
  const lastTradeRound = latestActionRound(run, "trade");
  const cashBufferWeight =
    wealth.grossAssets > 0 ? ((run.cash + run.savings) / wealth.grossAssets) * 100 : 0;

  // systems-thinking 触发器（评审会 P1·集卡死结）：12 张卡此前只有 10 个任务触发器，
  // market-composer / black-swan-navigator 两张卡与图鉴末两格永不可达。以下两个判据
  // 只依赖学生自主动作（无市场行情/事件卡运气），单个 12 回合沙盘内必然可完成。
  const toolkitActionTypes = ["bank", "opportunity", "fund_lab", "goal_account", "protection", "wealth_review"] as const;
  const distinctToolCount = new Set(
    run.actionLog
      .map((entry) => entry.type)
      .filter((type): type is (typeof toolkitActionTypes)[number] =>
        (toolkitActionTypes as readonly string[]).includes(type),
      ),
  ).size;
  // 黑天鹅演练：同一回合内既做了保护伞压力测试、又提交了持有计划复盘（防御×复盘配对）。
  const blackSwanDrillProgress = (() => {
    const roundMasks = new Map<number, number>();
    for (const entry of run.actionLog) {
      if (entry.type !== "protection" && entry.type !== "wealth_review") continue;
      const mask = roundMasks.get(entry.round) ?? 0;
      roundMasks.set(entry.round, mask | (entry.type === "protection" ? 1 : 2));
    }
    let best = 0;
    for (const mask of roundMasks.values()) best = Math.max(best, mask === 3 ? 2 : 1);
    return best / 2;
  })();

  const quests: StudentQuestItem[] = [
    withClaimState(run, {
      id: "diversification-72",
      title: "分散度达到 72 分",
      category: "finance",
      status: statusFrom(wealth.diversificationScore / 72),
      progress: clamp(wealth.diversificationScore / 72, 0, 1),
      target: "学会不把鸡蛋放在同一个篮子里",
      reward: "装饰称号：均衡侦探",
      coachNote: `当前分散度 ${wealth.diversificationScore}，奖励只做展示，不影响学习点。`,
    }),
    withClaimState(run, {
      id: "cash-buffer-20",
      title: "安全垫保持 20%",
      category: "risk",
      status: statusFrom(cashBufferWeight / 20, cashBufferWeight < 12),
      progress: clamp(cashBufferWeight / 20, 0, 1),
      target: "现金 + 储蓄占总资产 20%",
      reward: "装饰徽章：安全垫守门员",
      coachNote: "安全垫越稳定，突发事件里越不容易被迫卖出。",
    }),
    withClaimState(run, {
      id: "learn-two-modules",
      title: "完成 2 个投教模块",
      category: "learning",
      status: statusFrom(learning.completed / 2),
      progress: clamp(learning.completed / 2, 0, 1),
      target: "课程学习转化为策略语言",
      reward: "装饰边框：知识火种",
      coachNote: `已完成 ${learning.completed}/${learning.total} 个模块，先学再做可以降低冲动交易。`,
    }),
    withClaimState(run, {
      id: "cash-management",
      title: "做 2 次现金流管理",
      category: "discipline",
      status: statusFrom(bankCount / 2),
      progress: clamp(bankCount / 2, 0, 1),
      target: "储蓄、还债或现金规划动作",
      reward: "装饰称号：现金流队长",
      coachNote: "真正的理财不是只买资产，也包括为未来选择权留空间。",
    }),
    withClaimState(run, {
      id: "review-rhythm",
      // 假成就修复（评审会 P1）：原先 advance/event 也计入「复盘」，纯点击推进回合即可刷满；
      // 现只统计学生主动提交的持有计划复盘（与 computeLearningStreak 排除 advance 的口径一致），
      // 阈值 4→3（12 回合内主动复盘 3 次=节奏养成；wealth-review-plan 是第 1 次的入门任务）。
      title: "养成 3 次复盘节奏",
      category: "review",
      status: statusFrom(wealthReviewCount / 3),
      progress: clamp(wealthReviewCount / 3, 0, 1),
      target: "主动提交 3 次持有计划复盘（推进回合不算）",
      reward: "装饰徽章：复盘记录员",
      coachNote: "复盘会把一次输赢变成可迁移的经验；只有你主动写下的复盘才算数。",
    }),
    withClaimState(run, {
      id: "opportunity-first-note",
      title: "写下 1 张机会观察单",
      category: "learning",
      status: statusFrom(opportunityCount),
      progress: clamp(opportunityCount, 0, 1),
      target: "把热点主题拆成证据、风险和下一步验证动作",
      reward: "装饰徽章：机会侦察员",
      coachNote: "机会训练先练观察，不把热点直接变成真实买卖建议。",
    }),
    withClaimState(run, {
      id: "fund-lab-first-plan",
      title: "完成 1 次基金/ETF 实验",
      category: "finance",
      status: statusFrom(fundLabCount),
      progress: clamp(fundLabCount, 0, 1),
      target: "比较至少一种组合方案的收益、回撤和分散度",
      reward: "装饰称号：组合研究员",
      coachNote: "基金实验训练长期配置，不承诺收益，也不替代真实投顾。",
    }),
    withClaimState(run, {
      id: "goal-protection-pair",
      title: "连接目标账户与保护伞",
      category: "risk",
      status: statusFrom(Math.min(goalAccountCount, protectionCount)),
      progress: clamp((goalAccountCount + protectionCount) / 2, 0, 1),
      target: "至少做 1 次目标账户动作和 1 次保护伞压力测试",
      reward: "装饰边框：生活规划师",
      coachNote: "现实理财不是只看收益，还要看目标能否在坏情况里坚持下去。",
    }),
    withClaimState(run, {
      id: "wealth-review-plan",
      title: "提交 1 次持有计划复盘",
      category: "review",
      status: statusFrom(wealthReviewCount),
      progress: clamp(wealthReviewCount, 0, 1),
      target: "把当前持有理由、风险关注点和下一步动作写清楚",
      reward: "装饰贴纸：冷静持有人",
      coachNote: "持有计划不会改变净值，但会让每次等待都有可复查的理由。",
    }),
    withClaimState(run, {
      id: "cooldown-after-trade",
      title: "交易后留出冷静回合",
      category: "discipline",
      status: lastTradeRound === 0 ? "locked" : statusFrom(run.currentRound - lastTradeRound),
      progress: lastTradeRound === 0 ? 0 : clamp(run.currentRound - lastTradeRound, 0, 1),
      target: "至少 1 回合不追单",
      reward: "装饰称号：耐心玩家",
      coachNote: tradeCount > 0 ? "不是每回合都要下单，等待也是策略。" : "先完成第一笔交易后再解锁这个任务。",
    }),
    withClaimState(run, {
      id: "toolkit-composer",
      title: "解锁 4 种理财工具",
      category: "finance",
      status: statusFrom(distinctToolCount / 4),
      progress: clamp(distinctToolCount / 4, 0, 1),
      target: "在储蓄、机会观察、基金实验、目标账户、保护伞、持有复盘中用过至少 4 种",
      reward: "装饰称号：市场作曲家",
      coachNote: `已解锁 ${distinctToolCount}/4 种工具。系统思维不是精通单一工具，而是让多种工具彼此配合。`,
    }),
    withClaimState(run, {
      id: "black-swan-drill",
      title: "完成 1 次黑天鹅演练",
      category: "risk",
      status: statusFrom(blackSwanDrillProgress),
      progress: clamp(blackSwanDrillProgress, 0, 1),
      target: "同一回合内：先做 1 次保护伞压力测试，再提交 1 次持有计划复盘",
      reward: "装饰称号：黑天鹅导航员",
      coachNote: "极端行情来临前的演练：防御动作和冷静复盘要在同一回合内完成才算数。",
    }),
  ];

  const achievements: StudentAchievement[] = [
    {
      id: "first-map",
      title: "财富地图已点亮",
      unlocked: run.snapshots.length >= 1,
      detail: "你已经拥有自己的净值记录。",
      decorativeReward: "头像角标：起航",
    },
    {
      id: "diversify-detective",
      title: "分散投资侦探",
      unlocked: wealth.diversificationScore >= 72,
      detail: "组合不再只依赖单一方向。",
      decorativeReward: "称号：均衡侦探",
    },
    {
      id: "learning-spark",
      title: "知识火种",
      unlocked: learning.completed >= 2,
      detail: "你开始把课程语言带回沙盘。",
      decorativeReward: "主页卡片光效",
    },
    {
      id: "opportunity-scout",
      title: "机会侦察员",
      unlocked: opportunityCount >= 1,
      detail: "你已经把一个市场主题写成可复盘的观察单。",
      decorativeReward: "机会卡片角标",
    },
    {
      id: "portfolio-researcher",
      title: "组合研究员",
      unlocked: fundLabCount >= 1,
      detail: "你开始用组合视角理解基金、ETF 和分散配置。",
      decorativeReward: "基金实验室光效",
    },
    {
      id: "life-planner",
      title: "生活规划师",
      unlocked: goalAccountCount >= 1 && protectionCount >= 1,
      detail: "你已经把目标储蓄和风险保护放进同一张生活地图。",
      decorativeReward: "生活理财徽章组",
    },
    {
      id: "streak-maker",
      title: "连续成长记录",
      unlocked: streak.best >= 2,
      detail: `历史最佳连续学习 ${streak.best} 回合。`,
      decorativeReward: "收益日历贴纸",
    },
  ];

  const completed = quests.filter((quest) => quest.status === "done").length;

  return {
    generatedAt: now.toISOString(),
    overview: {
      completed,
      total: quests.length,
      active: quests.filter((quest) => quest.status === "active" || quest.status === "watch").length,
      streakCurrent: streak.current,
      streakBest: streak.best,
      stageLabel: wealth.stageLabel,
      learningCompleted: learning.completed,
      learningTotal: learning.total,
    },
    quests,
    achievements,
    benefits: buildBenefits(run, learning, wealth),
    calendar: buildCalendar(run),
    coach: buildCoach(wealth, run, learning),
  };
}

export function claimQuestReward(
  run: ScenarioRun,
  learning: LearningProgressSummary,
  questId: string,
  now = new Date(),
): { run: ScenarioRun; payload: StudentQuestPayload; claimed: QuestClaimResult } {
  const payload = buildStudentQuestPayload(run, learning, now);
  const quest = payload.quests.find((item) => item.id === questId);
  if (!quest) {
    throw new Error("任务不存在，请刷新后重试。");
  }
  if (quest.status !== "done") {
    throw new Error("这个任务还没有完成，先按提示完成真实行为再来领取。");
  }
  if (quest.claimed) {
    throw new Error("这个装饰奖励已经领取过了。");
  }

  const nextRun = structuredClone(run);
  const claimedAt = now.toISOString();
  nextRun.actionLog.unshift({
    id: createId("log"),
    round: nextRun.currentRound,
    type: "quest",
    label: `领取任务奖励：${quest.reward}`,
    amount: 0,
    timestamp: claimedAt,
    meta: {
      kind: "quest_reward_claim",
      questId: quest.id,
      title: quest.title,
      reward: quest.reward,
    },
  });

  const nextPayload = buildStudentQuestPayload(nextRun, learning, now);
  return {
    run: nextRun,
    payload: nextPayload,
    claimed: {
      questId: quest.id,
      title: quest.title,
      reward: quest.reward,
      claimedAt,
      summary: "奖励已加入你的成长轨迹。它只作为装饰和记录，不会直接改变学习点或净值。",
    },
  };
}
