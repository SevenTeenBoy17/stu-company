import type { ActionLog, ScenarioRun } from "@/lib/types";
import { clamp, createId } from "@/lib/utils";

export interface StudentSeasonObjective {
  id: string;
  label: string;
  detail: string;
  progress: number;
  target: number;
  href: string;
  done: boolean;
}

export interface StudentSeasonChallengePayload {
  id: string;
  title: string;
  summary: string;
  progress: number;
  reward: string;
  claimable: boolean;
  claimed: boolean;
  completedObjectives: number;
  totalObjectives: number;
  objectives: StudentSeasonObjective[];
  generatedAt: string;
}

export interface SeasonClaimResult {
  challengeId: string;
  title: string;
  reward: string;
  claimedAt: string;
  summary: string;
}

const ACTIVE_CHALLENGE = {
  id: "steady-config-week",
  title: "本周赛季：稳健配置挑战",
  summary: "目标不是冲最高收益，而是在行情波动中完成观察、分散、保护和复盘四类动作。",
  reward: "装饰徽章：冷静观察者",
};

function countActions(run: ScenarioRun, type: ActionLog["type"]) {
  return run.actionLog.filter((entry) => entry.type === type).length;
}

function seasonClaimEntries(run: ScenarioRun) {
  return run.actionLog.filter(
    (entry) => entry.type === "quest" && entry.meta?.kind === "season_reward_claim",
  );
}

function isSeasonClaimed(run: ScenarioRun, challengeId: string) {
  return seasonClaimEntries(run).some((entry) => entry.meta?.challengeId === challengeId);
}

function objective(input: Omit<StudentSeasonObjective, "done" | "progress"> & { progress: number }) {
  return {
    ...input,
    progress: clamp(input.progress / Math.max(input.target, 1), 0, 1),
    done: input.progress >= input.target,
  } satisfies StudentSeasonObjective;
}

export function buildStudentSeasonChallengePayload(
  run: ScenarioRun,
  now = new Date(),
): StudentSeasonChallengePayload {
  const watchlistCount = countActions(run, "watchlist");
  const opportunityCount = countActions(run, "opportunity");
  const fundCount = countActions(run, "fund_lab") + countActions(run, "auto_invest");
  const safetyCount =
    countActions(run, "goal_account") + countActions(run, "protection") + Math.floor(countActions(run, "bank") / 2);
  const reviewCount = countActions(run, "wealth_review");

  const objectives = [
    objective({
      id: "market-observe",
      label: "市场观察",
      detail: "加入 1 个自选观察，并写下为什么值得看。",
      progress: watchlistCount,
      target: 1,
      href: "/student/market",
    }),
    objective({
      id: "opportunity-note",
      label: "机会证据",
      detail: "完成 1 张机会观察单，包含证据、风险和下一步验证。",
      progress: opportunityCount,
      target: 1,
      href: "/student/opportunity",
    }),
    objective({
      id: "portfolio-lab",
      label: "组合实验",
      detail: "做 1 次基金/ETF 实验或定投计划，比较分散后的波动。",
      progress: fundCount,
      target: 1,
      href: "/student/fund-lab",
    }),
    objective({
      id: "safety-base",
      label: "安全底座",
      detail: "完成目标账户、保护伞或现金管理动作，先留出选择权。",
      progress: safetyCount,
      target: 1,
      href: "/student/protection",
    }),
    objective({
      id: "holding-review",
      label: "持有复盘",
      detail: "提交 1 次持有计划复盘，把等待也变成有理由的动作。",
      progress: reviewCount,
      target: 1,
      href: "/student/wealth",
    }),
  ];

  const completedObjectives = objectives.filter((item) => item.done).length;
  const claimed = isSeasonClaimed(run, ACTIVE_CHALLENGE.id);

  return {
    ...ACTIVE_CHALLENGE,
    progress: Math.round((completedObjectives / objectives.length) * 100),
    claimable: completedObjectives === objectives.length && !claimed,
    claimed,
    completedObjectives,
    totalObjectives: objectives.length,
    objectives,
    generatedAt: now.toISOString(),
  };
}

export function claimSeasonChallengeReward(
  run: ScenarioRun,
  challengeId: string,
  now = new Date(),
): { run: ScenarioRun; payload: StudentSeasonChallengePayload; claimed: SeasonClaimResult } {
  const payload = buildStudentSeasonChallengePayload(run, now);
  if (challengeId !== payload.id) {
    throw new Error("赛季挑战不存在，请刷新后重试。");
  }
  if (!payload.claimable) {
    throw new Error(payload.claimed ? "这个赛季奖励已经领取过了。" : "赛季挑战还没有完成。");
  }

  const claimedAt = now.toISOString();
  const entry: ActionLog = {
    id: createId("season"),
    round: run.currentRound,
    type: "quest",
    label: `领取赛季奖励：${payload.reward}`,
    amount: 0,
    timestamp: claimedAt,
    meta: {
      kind: "season_reward_claim",
      challengeId: payload.id,
      title: payload.title,
      reward: payload.reward,
      completedObjectives: payload.completedObjectives,
    },
  };

  const nextRun: ScenarioRun = {
    ...run,
    actionLog: [entry, ...run.actionLog],
  };

  return {
    run: nextRun,
    payload: buildStudentSeasonChallengePayload(nextRun, now),
    claimed: {
      challengeId: payload.id,
      title: payload.title,
      reward: payload.reward,
      claimedAt,
      summary: "赛季奖励已加入成长轨迹。它只做装饰和学习记录，不改变净值、战力或班级排名。",
    },
  };
}
