import { evaluateRun } from "@/lib/simulation";
import type { ScenarioRun } from "@/lib/types";
import { clamp, createId } from "@/lib/utils";
import { DomainError } from "@/lib/domain-error";

export type GoalAccountId = "emergency" | "laptop" | "study-trip" | "startup";

export interface GoalAccountTemplate {
  id: GoalAccountId;
  title: string;
  target: number;
  horizonRounds: number;
  category: "safety" | "learning" | "experience" | "venture";
  concept: string;
  whyItMatters: string;
}

export interface GoalAccountView extends GoalAccountTemplate {
  saved: number;
  progress: number;
  remaining: number;
  suggestedRoundContribution: number;
  status: "ahead" | "on_track" | "needs_attention";
}

export interface GoalAccountPayload {
  generatedAt: string;
  overview: {
    earmarkedTotal: number;
    availableCash: number;
    savings: number;
    goalScore: number;
    stageLabel: string;
    learningPrompt: string;
  };
  goals: GoalAccountView[];
  selectedGoalId: GoalAccountId;
  history: Array<{
    id: string;
    goalId: GoalAccountId;
    title: string;
    amount: number;
    note: string;
    round: number;
    createdAt: string;
  }>;
  coach: {
    title: string;
    summary: string;
    nextSteps: string[];
  };
}

export interface GoalAccountActionInput {
  goalId: GoalAccountId;
  amount: number;
  note?: string;
  now?: Date;
}

export const goalAccountTemplates: GoalAccountTemplate[] = [
  {
    id: "emergency",
    title: "紧急备用金",
    target: 12_000,
    horizonRounds: 4,
    category: "safety",
    concept: "应急金",
    whyItMatters: "先能扛住突发支出，再谈更高波动的投资训练。",
  },
  {
    id: "laptop",
    title: "大学电脑基金",
    target: 8_800,
    horizonRounds: 5,
    category: "learning",
    concept: "目标储蓄",
    whyItMatters: "把未来学习工具拆成每回合的小额行动，降低一次性压力。",
  },
  {
    id: "study-trip",
    title: "研学旅行账户",
    target: 6_000,
    horizonRounds: 3,
    category: "experience",
    concept: "机会成本",
    whyItMatters: "体验型消费可以存在，但需要和储蓄、投资试错一起排序。",
  },
  {
    id: "startup",
    title: "创业启动金",
    target: 18_000,
    horizonRounds: 6,
    category: "venture",
    concept: "风险预算",
    whyItMatters: "创业不是把钱一次押上，而是先留出可承受失败的试验金。",
  },
];

function goalEntries(run: ScenarioRun) {
  return run.actionLog.filter((entry) => entry.type === "goal_account" || entry.meta?.kind === "goal_account_action");
}

function findGoal(goalId: GoalAccountId) {
  return goalAccountTemplates.find((goal) => goal.id === goalId) ?? goalAccountTemplates[0];
}

function savedForGoal(run: ScenarioRun, goalId: GoalAccountId) {
  return goalEntries(run).reduce((sum, entry) => {
    return entry.meta?.goalId === goalId ? sum + Math.max(0, entry.amount) : sum;
  }, 0);
}

function toHistoryItem(entry: ScenarioRun["actionLog"][number]): GoalAccountPayload["history"][number] | null {
  const goalId = entry.meta?.goalId as GoalAccountId | undefined;
  const goal = goalId ? goalAccountTemplates.find((item) => item.id === goalId) : undefined;
  if (!goalId || !goal) return null;
  return {
    id: entry.id,
    goalId,
    title: goal.title,
    amount: Math.max(0, entry.amount),
    note: typeof entry.meta?.note === "string" ? entry.meta.note : "为目标账户做了一次分配。",
    round: entry.round,
    createdAt: entry.timestamp,
  };
}

function buildCoach(goals: GoalAccountView[], availableCash: number): GoalAccountPayload["coach"] {
  const emergency = goals.find((goal) => goal.id === "emergency") ?? goals[0];
  const weakest = goals.slice().sort((a, b) => a.progress - b.progress)[0];
  const nextSteps: string[] = [];

  if (emergency.progress < 70) {
    nextSteps.push("先把紧急备用金补到 70% 以上，再考虑更刺激的主题机会。");
  } else {
    nextSteps.push("安全垫已经初步建立，可以把下一次小额预算分给学习工具或研学目标。");
  }

  if (availableCash < 2_000) {
    nextSteps.push("现金偏紧时不要硬凑目标，先回到生活账本检查本回合必要支出。");
  } else {
    nextSteps.push(`本回合可以尝试给“${weakest.title}”转入一小笔，观察进度条变化。`);
  }

  nextSteps.push("每次只记录一个目标和一句理由，避免把目标账户变成新的认知负担。");

  return {
    title: "Mr.Brown 的目标账户建议",
    summary: "目标账户把“我想买什么”变成“每回合怎么安排现金流”。它不会神奇增加财富，但能减少冲动和拖延。",
    nextSteps,
  };
}

export function buildGoalAccountsPayload(
  run: ScenarioRun,
  selectedGoalId: GoalAccountId = "emergency",
  now = new Date(),
): GoalAccountPayload {
  const history = goalEntries(run)
    .map(toHistoryItem)
    .filter((item): item is GoalAccountPayload["history"][number] => Boolean(item));
  const earmarkedTotal = history.reduce((sum, item) => sum + item.amount, 0);

  const goals = goalAccountTemplates.map((goal) => {
    const saved = savedForGoal(run, goal.id);
    const remaining = Math.max(0, goal.target - saved);
    const roundsLeft = Math.max(1, goal.horizonRounds - Math.min(run.currentRound - 1, goal.horizonRounds - 1));
    const progress = Math.round(clamp((saved / goal.target) * 100, 0, 100));
    const suggestedRoundContribution = Math.min(1_800, Math.max(200, Math.ceil(remaining / roundsLeft / 100) * 100));
    const pace = progress / Math.max(1, Math.min(100, (run.currentRound / goal.horizonRounds) * 100));

    return {
      ...goal,
      saved,
      progress,
      remaining,
      suggestedRoundContribution,
      status:
        progress >= 100 || pace >= 1.08
          ? ("ahead" as const)
          : pace >= 0.72
            ? ("on_track" as const)
            : ("needs_attention" as const),
    };
  });

  const emergency = goals.find((goal) => goal.id === "emergency") ?? goals[0];
  const completed = goals.filter((goal) => goal.progress >= 100).length;
  const goalScore = Math.round(
    clamp(emergency.progress * 0.42 + goals.reduce((sum, goal) => sum + goal.progress, 0) / goals.length * 0.38 + completed * 8, 15, 98),
  );

  return {
    generatedAt: now.toISOString(),
    overview: {
      earmarkedTotal,
      availableCash: run.cash,
      savings: run.savings,
      goalScore,
      stageLabel: goalScore >= 82 ? "目标节奏稳" : goalScore >= 62 ? "正在建立目标感" : "先补安全垫",
      learningPrompt: "本页训练的是“先定义目标，再决定投资和消费”，不是为了让钱越花越紧。",
    },
    goals,
    selectedGoalId,
    history,
    coach: buildCoach(goals, run.cash),
  };
}

export function createGoalAccountAction(
  run: ScenarioRun,
  input: GoalAccountActionInput,
): { run: ScenarioRun; payload: GoalAccountPayload; entry: GoalAccountPayload["history"][number] } {
  const now = input.now ?? new Date();
  const goal = findGoal(input.goalId);
  const amount = Math.round(input.amount);
  if (amount <= 0) throw new DomainError("目标金额必须大于 0。");
  if (amount > run.cash) throw new DomainError("可用现金不足，先回到生活账本检查本回合现金流。");

  const nextRun = structuredClone(run);
  nextRun.cash -= amount;
  nextRun.savings += amount;

  const evaluated = evaluateRun(nextRun, nextRun.currentRound);
  nextRun.netWorth = evaluated.netWorth;
  nextRun.lastInsight = evaluated.reflection;
  const existing = nextRun.snapshots.find((item) => item.round === nextRun.currentRound);
  const snapshot = {
    round: nextRun.currentRound,
    netWorth: evaluated.netWorth,
    cash: nextRun.cash,
    savings: nextRun.savings,
    debt: nextRun.debt,
    riskScore: evaluated.riskScore,
    disciplineScore: evaluated.disciplineScore,
    reflection: evaluated.reflection,
  };
  if (existing) Object.assign(existing, snapshot);
  else nextRun.snapshots.push(snapshot);

  const savedAfter = savedForGoal(run, goal.id) + amount;
  nextRun.actionLog.unshift({
    id: createId("log"),
    round: nextRun.currentRound,
    type: "goal_account",
    label: `目标账户转入：${goal.title}`,
    amount,
    timestamp: now.toISOString(),
    meta: {
      kind: "goal_account_action",
      goalId: goal.id,
      note: input.note?.trim() || "把一笔现金转入目标账户，训练延迟满足。",
      target: goal.target,
      progressAfter: Math.round(clamp((savedAfter / goal.target) * 100, 0, 100)),
    },
  });

  const payload = buildGoalAccountsPayload(nextRun, goal.id, now);
  const entry = toHistoryItem(nextRun.actionLog[0]);
  if (!entry) throw new Error("目标账户记录生成失败。");
  return { run: nextRun, payload, entry };
}
