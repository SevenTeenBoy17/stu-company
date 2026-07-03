import { beforeEach, describe, expect, it } from "vitest";

import {
  buildStudentSeasonChallengePayload,
  claimSeasonChallengeReward,
} from "@/lib/season-challenges";
import { getSimulationStateForUser, resetStoreForTests } from "@/lib/store";
import type { ActionLog, ScenarioRun } from "@/lib/types";

function addAction(run: ScenarioRun, type: ActionLog["type"], label: string, meta: Record<string, unknown>) {
  run.actionLog.unshift({
    id: `season-test-${type}-${run.actionLog.length}`,
    round: run.currentRound,
    type,
    label,
    amount: 0,
    timestamp: new Date("2026-06-13T10:00:00.000Z").toISOString(),
    meta,
  });
}

function completedRun() {
  const state = getSimulationStateForUser("student-1");
  const run = structuredClone(state.run);
  addAction(run, "watchlist", "加入自选观察：英伟达", { kind: "watchlist_action", action: "add", symbol: "NVDA" });
  addAction(run, "opportunity", "机会观察：AI算力", { kind: "opportunity_note" });
  addAction(run, "fund_lab", "基金实验：均衡组合", { kind: "fund_lab_action" });
  addAction(run, "protection", "保护伞复盘：基础方案", { kind: "protection_review" });
  addAction(run, "wealth_review", "持有复盘：先看现金垫", { kind: "wealth_review" });
  return run;
}

describe("season challenges", () => {
  beforeEach(() => {
    resetStoreForTests();
  });

  it("builds a weekly challenge from real learning actions", () => {
    const payload = buildStudentSeasonChallengePayload(completedRun());

    expect(payload.totalObjectives).toBe(5);
    expect(payload.completedObjectives).toBe(5);
    expect(payload.progress).toBe(100);
    expect(payload.claimable).toBe(true);
    expect(payload.objectives.every((item) => item.done)).toBe(true);
  });

  it("blocks claiming before objectives are complete", () => {
    const state = getSimulationStateForUser("student-1");
    const payload = buildStudentSeasonChallengePayload(state.run);

    expect(payload.claimable).toBe(false);
    expect(() => claimSeasonChallengeReward(state.run, payload.id)).toThrow("赛季挑战还没有完成");
  });

  it("claims a decorative season reward without changing net worth or holdings", () => {
    const run = completedRun();
    const beforeSnapshot = run.snapshots.at(-1);
    const payload = buildStudentSeasonChallengePayload(run);
    const outcome = claimSeasonChallengeReward(run, payload.id, new Date("2026-06-13T11:00:00.000Z"));

    expect(outcome.claimed.reward).toContain("冷静观察者");
    expect(outcome.run.actionLog[0]).toMatchObject({
      type: "quest",
      amount: 0,
      meta: expect.objectContaining({ kind: "season_reward_claim", challengeId: payload.id }),
    });
    expect(outcome.run.snapshots.at(-1)).toEqual(beforeSnapshot);
    expect(outcome.run.holdings).toEqual(run.holdings);
    expect(outcome.payload.claimed).toBe(true);
    expect(outcome.payload.claimable).toBe(false);
  });

  it("prevents duplicate season reward claims", () => {
    const run = completedRun();
    const payload = buildStudentSeasonChallengePayload(run);
    const first = claimSeasonChallengeReward(run, payload.id);

    expect(() => claimSeasonChallengeReward(first.run, payload.id)).toThrow("已经领取");
  });
});
