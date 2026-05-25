import { beforeEach, describe, expect, it } from "vitest";

import { buildHistoryReviewAiContext, buildHistoryReviewPayload } from "@/lib/history-review";
import { getSimulationStateForUser, resetStoreForTests } from "@/lib/store";

describe("history review", () => {
  beforeEach(() => {
    resetStoreForTests();
  });

  it("builds a stable review payload from the seeded student run", () => {
    const state = getSimulationStateForUser("student-1");
    const payload = buildHistoryReviewPayload(state);

    expect(payload.timeline).toHaveLength(state.run.snapshots.length);
    expect(payload.actionGroups[0]?.round).toBe(state.run.currentRound);
    expect(payload.metrics.roundsCompleted).toBe(state.run.snapshots.length);
    expect(payload.metrics.buyCount).toBeGreaterThan(0);
    expect(payload.highlights).toHaveLength(4);
    expect(payload.aiReview.summary).toContain("回合");
  });

  it("builds an AI context block that references trend and action history", () => {
    const state = getSimulationStateForUser("student-1");
    const payload = buildHistoryReviewPayload(state);
    const context = buildHistoryReviewAiContext(state, payload);

    expect(context).toContain("净值轨迹");
    expect(context).toContain("关键节点");
    expect(context).toContain("最近动作");
  });
});
