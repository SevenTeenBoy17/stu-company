import { buildWealthSummary, type WealthSummary } from "@/lib/allocation";
import { computeStreak } from "@/lib/simulation";
import type { LearningProgressSummary, ScenarioRun } from "@/lib/types";
import { clamp, createId } from "@/lib/utils";

export type StudentQuestStatus = "done" | "active" | "watch" | "locked";
export type StudentQuestCategory = "finance" | "learning" | "discipline" | "risk" | "review";

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
      "任务中心不会直接增加战力，它只把真实行为转成可见目标。这样既保留榜单公平，也让你知道自己下一步该练哪一种能力。",
    nextActions: nextActions.slice(0, 3),
  };
}

export function buildStudentQuestPayload(
  run: ScenarioRun,
  learning: LearningProgressSummary,
  now = new Date(),
): StudentQuestPayload {
  const wealth = buildWealthSummary(run);
  const streak = computeStreak(run);
  const tradeCount = countActions(run, "trade");
  const bankCount = countActions(run, "bank");
  const reviewActions = run.actionLog.filter((entry) => entry.type === "advance" || entry.type === "event").length;
  const lastTradeRound = latestActionRound(run, "trade");
  const cashBufferWeight =
    wealth.grossAssets > 0 ? ((run.cash + run.savings) / wealth.grossAssets) * 100 : 0;

  const quests: StudentQuestItem[] = [
    withClaimState(run, {
      id: "diversification-72",
      title: "分散度达到 72 分",
      category: "finance",
      status: statusFrom(wealth.diversificationScore / 72),
      progress: clamp(wealth.diversificationScore / 72, 0, 1),
      target: "学会不把鸡蛋放在同一个篮子里",
      reward: "装饰称号：均衡侦探",
      coachNote: `当前分散度 ${wealth.diversificationScore}，奖励只做展示，不影响战力。`,
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
      title: "完成 4 次回合复盘",
      category: "review",
      status: statusFrom(reviewActions / 4),
      progress: clamp(reviewActions / 4, 0, 1),
      target: "每推进回合都留下一条复盘线索",
      reward: "装饰徽章：复盘记录员",
      coachNote: "复盘会把一次输赢变成可迁移的经验。",
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
      id: "streak-maker",
      title: "连续成长记录",
      unlocked: streak.best >= 2,
      detail: `历史最佳净值连升 ${streak.best} 回合。`,
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
      summary: "奖励已加入你的成长轨迹。它只作为装饰和记录，不会直接改变战力或净值。",
    },
  };
}
