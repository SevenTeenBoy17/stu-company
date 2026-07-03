import { describe, expect, it } from "vitest";

import { buildStudentPetPayload } from "@/lib/pet-rewards";
import { createInitialRun } from "@/lib/simulation";
import type { LearningProgressSummary, ScenarioRun } from "@/lib/types";

function learning(overrides: Partial<LearningProgressSummary> = {}): LearningProgressSummary {
  return {
    completed: 0,
    total: 8,
    completedKeys: [],
    ...overrides,
  };
}

function baseRun(): ScenarioRun {
  const run = createInitialRun("student-1", "classroom-1");
  run.snapshots = [
    {
      round: 1,
      netWorth: 100000,
      cash: run.cash,
      savings: 0,
      debt: 0,
      riskScore: 52,
      disciplineScore: 74,
      reflection: "第一回合复盘",
    },
  ];
  run.currentRound = 1;
  run.netWorth = 100000;
  return run;
}

describe("buildStudentPetPayload", () => {
  it("creates a personal pet with safe decorative rewards from a new run", () => {
    const payload = buildStudentPetPayload(baseRun(), learning());

    expect(payload.pet.name).toBe("布朗小栗");
    expect(payload.pet.species).toBe("财商守护兽");
    expect(payload.pet.level).toBeGreaterThanOrEqual(1);
    expect(payload.summary.unlocked).toBe(1);
    expect(payload.rewards.find((item) => item.id === "starter-companion")).toMatchObject({
      unlocked: true,
      type: "badge",
    });
    expect(payload.summary.safetyNote).toContain("不改变净值");
  });

  it("unlocks rewards from real sandbox actions and learning progress", () => {
    const run = baseRun();
    run.actionLog.unshift(
      {
        id: "trade-1",
        round: 1,
        type: "trade",
        label: "买入模拟资产",
        amount: -1000,
        timestamp: "2026-06-01T00:00:00.000Z",
      },
      {
        id: "bank-1",
        round: 1,
        type: "bank",
        label: "转入储蓄",
        amount: -5000,
        timestamp: "2026-06-01T00:01:00.000Z",
      },
      {
        id: "bank-2",
        round: 1,
        type: "bank",
        label: "偿还债务",
        amount: -2000,
        timestamp: "2026-06-01T00:02:00.000Z",
      },
      {
        id: "watch-1",
        round: 1,
        type: "watchlist",
        label: "观察 AI 科技主题",
        amount: 0,
        timestamp: "2026-06-01T00:03:00.000Z",
      },
      {
        id: "fund-1",
        round: 1,
        type: "fund_lab",
        label: "完成 ETF 实验",
        amount: 0,
        timestamp: "2026-06-01T00:04:00.000Z",
      },
    );

    const payload = buildStudentPetPayload(run, learning({ completed: 2, completedKeys: ["equities", "portfolio"] }));

    expect(payload.rewards.find((item) => item.id === "first-order-cap")?.unlocked).toBe(true);
    expect(payload.rewards.find((item) => item.id === "cash-guardian-shield")?.unlocked).toBe(true);
    expect(payload.rewards.find((item) => item.id === "market-scout-map")?.unlocked).toBe(true);
    expect(payload.rewards.find((item) => item.id === "portfolio-leaf")?.unlocked).toBe(true);
    expect(payload.rewards.find((item) => item.id === "knowledge-fire")?.unlocked).toBe(true);
    expect(payload.pet.xp).toBeGreaterThan(buildStudentPetPayload(baseRun(), learning()).pet.xp);
  });

  it("switches to a celebrating mood after a quest reward claim", () => {
    const run = baseRun();
    run.actionLog.unshift({
      id: "quest-1",
      round: 1,
      type: "quest",
      label: "领取任务奖励：现金流护盾",
      amount: 0,
      timestamp: "2026-06-01T00:05:00.000Z",
      meta: {
        kind: "quest_reward_claim",
        questId: "cash-management",
        reward: "装饰徽章：现金流护盾",
      },
    });

    const payload = buildStudentPetPayload(run, learning());

    expect(payload.pet.mood).toBe("celebrating");
    expect(payload.pet.headline).toContain("庆祝");
    expect(payload.timeline.find((item) => item.id === "reward-claim")?.unlocked).toBe(true);
  });

  it("does not create pay-to-win rewards or real-money promises", () => {
    const payload = buildStudentPetPayload(baseRun(), learning({ completed: 3 }));
    const blob = JSON.stringify(payload);

    expect(blob).not.toMatch(/保证收益|真实收益|战力加成|充值变强/);
    expect(payload.rewards.every((item) => item.description.length > 0 && item.unlockHint.length > 0)).toBe(true);
  });
});
