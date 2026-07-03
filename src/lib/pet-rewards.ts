import { buildWealthSummary } from "@/lib/allocation";
import { computeLearningStreak } from "@/lib/simulation";
import type { ActionLog, LearningProgressSummary, ScenarioRun } from "@/lib/types";
import { clamp } from "@/lib/utils";

export type StudentPetMood = "curious" | "focused" | "celebrating" | "steady" | "alert";
export type StudentPetStage = "seedling" | "scout" | "strategist";
export type StudentPetRewardType = "badge" | "hat" | "aura" | "skin" | "trophy";
// 成就难度层级（非盲盒稀有度）——防射幸：不使用 common/rare/epic 抽卡词汇。
export type StudentPetRewardTier = "basic" | "advanced" | "honor";

export interface StudentPetVisual {
  shape: "coin" | "cap" | "shield" | "spark" | "leaf" | "crown" | "map";
  accent: string;
  glow: string;
}

export interface StudentPetReward {
  id: string;
  title: string;
  description: string;
  type: StudentPetRewardType;
  tier: StudentPetRewardTier;
  unlocked: boolean;
  source: string;
  unlockHint: string;
  visual: StudentPetVisual;
}

export interface StudentPetPayload {
  generatedAt: string;
  pet: {
    id: string;
    name: string;
    species: string;
    stage: StudentPetStage;
    stageLabel: string;
    level: number;
    xp: number;
    xpToNext: number;
    xpProgress: number;
    mood: StudentPetMood;
    moodLabel: string;
    headline: string;
    coachNote: string;
    energy: number;
    trust: number;
    focus: number;
    discipline: number;
    equippedRewardIds: string[];
  };
  rewards: StudentPetReward[];
  summary: {
    unlocked: number;
    total: number;
    nextRewardTitle: string;
    safetyNote: string;
  };
  nextActions: Array<{
    id: string;
    title: string;
    detail: string;
    href: string;
  }>;
  timeline: Array<{
    id: string;
    label: string;
    detail: string;
    round: number;
    unlocked: boolean;
  }>;
}

const defaultLearning: LearningProgressSummary = {
  completed: 0,
  total: 8,
  completedKeys: [],
};

function countActions(run: ScenarioRun, type: ActionLog["type"]) {
  return run.actionLog.filter((entry) => entry.type === type).length;
}

function questClaimEntries(run: ScenarioRun) {
  return run.actionLog.filter(
    (entry) => entry.type === "quest" && entry.meta?.kind === "quest_reward_claim",
  );
}

function seasonClaimEntries(run: ScenarioRun) {
  return run.actionLog.filter(
    (entry) => entry.type === "quest" && entry.meta?.kind === "season_reward_claim",
  );
}

function latestSnapshot(run: ScenarioRun) {
  return run.snapshots.at(-1);
}

function currentNetWorth(run: ScenarioRun) {
  return latestSnapshot(run)?.netWorth ?? run.netWorth ?? run.cash + run.savings - run.debt;
}

function reward(input: StudentPetReward): StudentPetReward {
  return input;
}

function buildRewards(run: ScenarioRun, learning: LearningProgressSummary): StudentPetReward[] {
  const questClaims = questClaimEntries(run);
  const seasonClaims = seasonClaimEntries(run);
  const bankCount = countActions(run, "bank");
  const tradeCount = countActions(run, "trade");
  const opportunityCount = countActions(run, "opportunity") + countActions(run, "watchlist");
  const fundCount = countActions(run, "fund_lab") + countActions(run, "auto_invest");
  const lifeCount = countActions(run, "goal_account") + countActions(run, "protection");
  const reviewCount = countActions(run, "wealth_review");
  const wealth = buildWealthSummary(run);

  return [
    reward({
      id: "starter-companion",
      title: "布朗伙伴证",
      description: "第一次进入沙盘时点亮，代表你已经拥有自己的学习伙伴。",
      type: "badge",
      tier: "basic",
      unlocked: true,
      source: "初始伙伴",
      unlockHint: "进入学生策略台即可点亮。",
      visual: { shape: "coin", accent: "#f08a38", glow: "rgba(240,138,56,0.32)" },
    }),
    reward({
      id: "first-order-cap",
      title: "首单小帽",
      description: "完成第一笔模拟交易后解锁，用来提醒你每笔交易都要能解释。",
      type: "hat",
      tier: "basic",
      unlocked: tradeCount > 0,
      source: "完成 1 笔模拟交易",
      unlockHint: "在策略台完成一笔买入或卖出。",
      visual: { shape: "cap", accent: "#ffb15f", glow: "rgba(255,177,95,0.28)" },
    }),
    reward({
      id: "cash-guardian-shield",
      title: "现金流护盾",
      description: "完成现金流管理后解锁，提醒你先保留选择权，再追求成长。",
      type: "badge",
      tier: "advanced",
      unlocked: bankCount >= 2 || questClaims.some((entry) => entry.meta?.questId === "cash-management"),
      source: "现金流任务",
      unlockHint: "完成 2 次储蓄、提款、贷款或还款动作。",
      visual: { shape: "shield", accent: "#78d8ad", glow: "rgba(120,216,173,0.28)" },
    }),
    reward({
      id: "market-scout-map",
      title: "市场侦察地图",
      description: "记录观察池或机会单后解锁，让冲动交易先变成可复盘证据。",
      type: "aura",
      tier: "advanced",
      unlocked: opportunityCount > 0,
      source: "市场观察",
      unlockHint: "在市场信息或机会训练中写下 1 条观察。",
      visual: { shape: "map", accent: "#7aa7ff", glow: "rgba(122,167,255,0.28)" },
    }),
    reward({
      id: "portfolio-leaf",
      title: "组合研究叶",
      description: "完成基金/ETF 或定投训练后解锁，强化分散配置意识。",
      type: "skin",
      tier: "advanced",
      unlocked: fundCount > 0 || wealth.diversificationScore >= 72,
      source: "组合实验",
      unlockHint: "完成 1 次基金/ETF 实验，或让分散度达到 72。",
      visual: { shape: "leaf", accent: "#8bd6c0", glow: "rgba(139,214,192,0.3)" },
    }),
    reward({
      id: "life-planner-spark",
      title: "生活规划星",
      description: "目标账户和保护伞训练会让宠物更稳，不只盯着短期涨跌。",
      type: "aura",
      tier: "advanced",
      unlocked: lifeCount >= 2,
      source: "生活理财",
      unlockHint: "完成目标账户与风险保护相关训练。",
      visual: { shape: "spark", accent: "#f7c45f", glow: "rgba(247,196,95,0.3)" },
    }),
    reward({
      id: "review-crown",
      title: "复盘小冠",
      description: "坚持回合复盘后解锁，代表你开始把输赢转化为经验。",
      type: "trophy",
      tier: "honor",
      unlocked: reviewCount >= 4 || seasonClaims.length > 0,
      source: "历史复盘 / 赛季挑战",
      unlockHint: "推进并复盘多个回合，或领取一次赛季奖励。",
      visual: { shape: "crown", accent: "#ff8aa8", glow: "rgba(255,138,168,0.28)" },
    }),
    reward({
      id: "knowledge-fire",
      title: "知识火种",
      description: "完成投教模块后点亮，让宠物的提示更偏向概念理解。",
      type: "aura",
      tier: "honor",
      unlocked: learning.completed >= 2,
      source: "投教课程",
      unlockHint: "完成至少 2 个课程模块。",
      visual: { shape: "spark", accent: "#ff6b4a", glow: "rgba(255,107,74,0.3)" },
    }),
  ];
}

function petStage(level: number): { stage: StudentPetStage; stageLabel: string } {
  if (level >= 7) return { stage: "strategist", stageLabel: "策略伙伴" };
  if (level >= 4) return { stage: "scout", stageLabel: "市场侦察员" };
  return { stage: "seedling", stageLabel: "幼年守护兽" };
}

function petMood(run: ScenarioRun, learning: LearningProgressSummary): {
  mood: StudentPetMood;
  moodLabel: string;
  headline: string;
  coachNote: string;
} {
  const latest = latestSnapshot(run);
  const risk = latest?.riskScore ?? 50;
  const discipline = latest?.disciplineScore ?? 70;
  const recentAction = run.actionLog.at(-1);
  const recentClaim = recentAction?.type === "quest";
  const cashBuffer = (run.cash + run.savings) / Math.max(currentNetWorth(run), 1);

  if (recentClaim) {
    return {
      mood: "celebrating",
      moodLabel: "刚刚被奖励点亮",
      headline: "你的伙伴正在庆祝一次好习惯",
      coachNote: "奖励不会改变模拟成绩，但会把好行为标记出来。下一步，把这次好行为复用到新的回合里。",
    };
  }

  if (risk >= 72 || cashBuffer < 0.08) {
    return {
      mood: "alert",
      moodLabel: "风险警觉",
      headline: "布朗小栗正在提醒你先看安全垫",
      coachNote: "当风险温度偏高时，先检查现金、债务和集中度，再决定是否继续行动。",
    };
  }

  if (discipline >= 82 && learning.completed >= 2) {
    return {
      mood: "focused",
      moodLabel: "专注学习",
      headline: "它进入了稳定训练状态",
      coachNote: "你已经开始把课程概念带回沙盘。现在适合做小幅调整，而不是追求一次性满仓。",
    };
  }

  if (discipline >= 72) {
    return {
      mood: "steady",
      moodLabel: "稳定陪伴",
      headline: "它更喜欢你现在的节奏",
      coachNote: "节奏稳定时，最有价值的动作往往是复盘、记录和验证假设。",
    };
  }

  return {
    mood: "curious",
    moodLabel: "好奇观察",
    headline: "它正在等你给下一步一个理由",
    coachNote: "先写下为什么行动，再行动。这个顺序会让模拟投资更像训练，而不是拼运气。",
  };
}

function buildNextActions(run: ScenarioRun, learning: LearningProgressSummary): StudentPetPayload["nextActions"] {
  const actions: StudentPetPayload["nextActions"] = [];
  const tradeCount = countActions(run, "trade");
  const bankCount = countActions(run, "bank");
  const opportunityCount = countActions(run, "opportunity") + countActions(run, "watchlist");
  const reviewCount = countActions(run, "wealth_review") + countActions(run, "advance");

  if (tradeCount === 0) {
    actions.push({
      id: "first-trade",
      title: "完成一笔小额模拟交易",
      detail: "先用少量仓位练习下单、记录理由和观察价格变化。",
      href: "/student",
    });
  }
  if (bankCount < 2) {
    actions.push({
      id: "cash-buffer",
      title: "补一块现金安全垫",
      detail: "用储蓄、还款或提款动作理解现金流和选择权。",
      href: "/student",
    });
  }
  if (opportunityCount === 0) {
    actions.push({
      id: "market-note",
      title: "写一条市场观察",
      detail: "把热门资产拆成证据、风险和下一步验证动作。",
      href: "/student/market",
    });
  }
  if (learning.completed < 2) {
    actions.push({
      id: "learn-two",
      title: "点亮 2 个投教模块",
      detail: "每次只学一个概念，再回到沙盘里使用它。",
      href: "/learn",
    });
  }
  if (reviewCount < 3) {
    actions.push({
      id: "review-loop",
      title: "建立复盘节奏",
      detail: "推进回合后看净值、风险和纪律分，不只看涨跌。",
      href: "/student/history",
    });
  }

  return actions.slice(0, 3);
}

function buildTimeline(run: ScenarioRun): StudentPetPayload["timeline"] {
  return [
    {
      id: "start",
      label: "伙伴诞生",
      detail: "进入学生策略台，布朗小栗开始记录你的每次选择。",
      round: 1,
      unlocked: true,
    },
    {
      id: "first-trade",
      label: "第一次模拟下单",
      detail: "从看行情变成可复盘行动。",
      round: run.actionLog.find((entry) => entry.type === "trade")?.round ?? run.currentRound,
      unlocked: countActions(run, "trade") > 0,
    },
    {
      id: "cash-manager",
      label: "现金流训练",
      detail: "你开始理解安全垫不是躺平，而是保留选择权。",
      round: run.actionLog.find((entry) => entry.type === "bank")?.round ?? run.currentRound,
      unlocked: countActions(run, "bank") >= 2,
    },
    {
      id: "reward-claim",
      label: "领取装饰奖励",
      detail: "任务奖励进入图鉴，只做展示和成长记录。",
      round: questClaimEntries(run)[0]?.round ?? run.currentRound,
      unlocked: questClaimEntries(run).length > 0,
    },
    {
      id: "season-memory",
      label: "赛季纪念",
      detail: "完成一组跨模块动作后，伙伴获得赛季纪念标记。",
      round: seasonClaimEntries(run)[0]?.round ?? run.currentRound,
      unlocked: seasonClaimEntries(run).length > 0,
    },
  ];
}

export function buildStudentPetPayload(
  run: ScenarioRun,
  learning: LearningProgressSummary = defaultLearning,
  now = new Date(),
): StudentPetPayload {
  const latest = latestSnapshot(run);
  const wealth = buildWealthSummary(run);
  const streak = computeLearningStreak(run);
  const questClaims = questClaimEntries(run);
  const seasonClaims = seasonClaimEntries(run);
  const actionXp = Math.min(260, run.actionLog.length * 7);
  const roundXp = run.currentRound * 18;
  const snapshotXp = run.snapshots.length * 20;
  const learningXp = learning.completed * 34;
  const rewardXp = questClaims.length * 48 + seasonClaims.length * 90;
  const diversificationXp = Math.round(clamp(wealth.diversificationScore, 0, 100) * 1.2);
  const streakXp = streak.best * 22;
  const xp = Math.max(0, roundXp + snapshotXp + actionXp + learningXp + rewardXp + diversificationXp + streakXp);
  const level = Math.max(1, Math.min(12, Math.floor(xp / 140) + 1));
  const currentLevelBase = (level - 1) * 140;
  const xpToNext = level >= 12 ? 0 : level * 140 - xp;
  const xpProgress = level >= 12 ? 1 : clamp((xp - currentLevelBase) / 140, 0, 1);
  const stage = petStage(level);
  const mood = petMood(run, learning);
  const netWorth = currentNetWorth(run);
  const cashBuffer = (run.cash + run.savings) / Math.max(netWorth, 1);
  const rewards = buildRewards(run, learning);
  const unlockedRewards = rewards.filter((item) => item.unlocked);
  const nextReward = rewards.find((item) => !item.unlocked) ?? rewards.at(-1);

  return {
    generatedAt: now.toISOString(),
    pet: {
      id: `pet-${run.userId}`,
      name: "布朗小栗",
      species: "财商守护兽",
      ...stage,
      level,
      xp,
      xpToNext,
      xpProgress,
      ...mood,
      energy: Math.round(clamp(52 + cashBuffer * 80 + streak.current * 4, 20, 100)),
      trust: Math.round(clamp(45 + run.snapshots.length * 4 + questClaims.length * 12 + learning.completed * 5, 25, 100)),
      focus: Math.round(clamp((latest?.disciplineScore ?? 70) + learning.completed * 2, 30, 100)),
      discipline: latest?.disciplineScore ?? 70,
      equippedRewardIds: unlockedRewards.slice(-3).map((item) => item.id),
    },
    rewards,
    summary: {
      unlocked: unlockedRewards.length,
      total: rewards.length,
      nextRewardTitle: nextReward?.unlocked ? "奖励已全部点亮" : nextReward?.title ?? "继续探索",
      safetyNote: "萌宠和奖励只用于学习反馈、界面装饰和复盘提示，不改变净值、排名或现实世界的投资结果。",
    },
    nextActions: buildNextActions(run, learning),
    timeline: buildTimeline(run),
  };
}
