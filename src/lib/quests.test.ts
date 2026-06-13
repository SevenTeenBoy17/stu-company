import { describe, expect, it } from "vitest";

import { buildStudentQuestPayload, claimQuestReward } from "@/lib/quests";
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

function runWithSnapshots(values: number[]): ScenarioRun {
  const run = createInitialRun("student-1", "classroom-1");
  run.snapshots = values.map((netWorth, index) => ({
    round: index + 1,
    netWorth,
    cash: Math.max(0, run.cash - index * 1000),
    savings: run.savings,
    debt: run.debt,
    riskScore: 50 + index,
    disciplineScore: 70,
    reflection: `第 ${index + 1} 回合复盘`,
  }));
  run.currentRound = values.length;
  run.netWorth = values[values.length - 1] ?? run.netWorth;
  return run;
}

describe("buildStudentQuestPayload", () => {
  it("derives quests from real sandbox and learning behavior without power rewards", () => {
    const run = runWithSnapshots([100000]);
    run.actionLog.unshift({
      id: "bank-1",
      round: 1,
      type: "bank",
      label: "转入储蓄",
      amount: -5000,
      timestamp: new Date("2026-06-01T00:00:00.000Z").toISOString(),
    });
    run.actionLog.unshift({
      id: "bank-2",
      round: 2,
      type: "bank",
      label: "提取储蓄",
      amount: 2000,
      timestamp: new Date("2026-06-02T00:00:00.000Z").toISOString(),
    });

    const payload = buildStudentQuestPayload(run, learning({ completed: 2, completedKeys: ["stock", "etf"] }));

    expect(payload.quests.find((quest) => quest.id === "cash-management")?.status).toBe("done");
    expect(payload.quests.find((quest) => quest.id === "learn-two-modules")?.status).toBe("done");
    expect(payload.quests.every((quest) => !/战力|power/i.test(quest.reward))).toBe(true);
    expect(payload.achievements.find((item) => item.id === "learning-spark")?.unlocked).toBe(true);
  });

  it("builds an earnings calendar with round deltas and tones", () => {
    const payload = buildStudentQuestPayload(runWithSnapshots([100000, 103000, 101000]), learning());

    expect(payload.calendar).toEqual([
      expect.objectContaining({ round: 1, delta: 0, tone: "flat" }),
      expect.objectContaining({ round: 2, delta: 3000, tone: "up" }),
      expect.objectContaining({ round: 3, delta: -2000, tone: "down" }),
    ]);
    expect(payload.overview.streakBest).toBe(1);
  });

  it("locks the cooldown quest before the first trade", () => {
    const payload = buildStudentQuestPayload(runWithSnapshots([100000, 101000]), learning());

    const cooldown = payload.quests.find((quest) => quest.id === "cooldown-after-trade");
    expect(cooldown).toMatchObject({ status: "locked", progress: 0 });
  });

  it("claims a completed decorative quest reward without changing net worth", () => {
    const run = runWithSnapshots([100000]);
    run.actionLog.unshift({
      id: "bank-1",
      round: 1,
      type: "bank",
      label: "转入储蓄",
      amount: -5000,
      timestamp: new Date("2026-06-01T00:00:00.000Z").toISOString(),
    });
    run.actionLog.unshift({
      id: "bank-2",
      round: 1,
      type: "bank",
      label: "偿还债务",
      amount: -1000,
      timestamp: new Date("2026-06-01T00:00:01.000Z").toISOString(),
    });

    const outcome = claimQuestReward(run, learning(), "cash-management", new Date("2026-06-02T00:00:00.000Z"));

    expect(outcome.claimed.reward).toContain("现金流队长");
    expect(outcome.run.netWorth).toBe(run.netWorth);
    expect(outcome.run.actionLog[0]).toMatchObject({
      type: "quest",
      amount: 0,
      meta: expect.objectContaining({ kind: "quest_reward_claim", questId: "cash-management" }),
    });
    expect(outcome.payload.quests.find((quest) => quest.id === "cash-management")).toMatchObject({
      status: "done",
      claimed: true,
      claimable: false,
    });
  });

  it("prevents claiming the same quest twice", () => {
    const run = runWithSnapshots([100000]);
    run.actionLog.unshift({
      id: "bank-1",
      round: 1,
      type: "bank",
      label: "转入储蓄",
      amount: -5000,
      timestamp: new Date("2026-06-01T00:00:00.000Z").toISOString(),
    });
    run.actionLog.unshift({
      id: "bank-2",
      round: 1,
      type: "bank",
      label: "偿还债务",
      amount: -1000,
      timestamp: new Date("2026-06-01T00:00:01.000Z").toISOString(),
    });

    const first = claimQuestReward(run, learning(), "cash-management");
    expect(() => claimQuestReward(first.run, learning(), "cash-management")).toThrow("已经领取");
  });
});
