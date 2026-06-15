import { beforeEach, describe, expect, it } from "vitest";

import { buildHistoryReviewAiContext, buildHistoryReviewPayload } from "@/lib/history-review";
import { getEventCard } from "@/lib/simulation";
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

  it("turns diversified finance learning actions into review signals", () => {
    const state = getSimulationStateForUser("student-1");

    state.run.actionLog.push(
      {
        id: "history-opportunity-1",
        round: state.run.currentRound,
        type: "opportunity",
        label: "机会观察：AI芯片需求是否能支撑估值",
        amount: 0,
        timestamp: new Date("2026-06-13T08:00:00.000Z").toISOString(),
        meta: { kind: "opportunity_note" },
      },
      {
        id: "history-fund-lab-1",
        round: state.run.currentRound,
        type: "fund_lab",
        label: "基金实验：比较成长ETF与均衡ETF",
        amount: 0,
        timestamp: new Date("2026-06-13T08:05:00.000Z").toISOString(),
        meta: { kind: "fund_lab_action" },
      },
      {
        id: "history-wealth-review-1",
        round: state.run.currentRound,
        type: "wealth_review",
        label: "持有复盘：先验证现金缓冲再加仓",
        amount: 0,
        timestamp: new Date("2026-06-13T08:10:00.000Z").toISOString(),
        meta: { kind: "wealth_review" },
      },
      {
        id: "history-quest-1",
        round: state.run.currentRound,
        type: "quest",
        label: "领取任务奖励：机会侦察徽章",
        amount: 0,
        timestamp: new Date("2026-06-13T08:15:00.000Z").toISOString(),
        meta: { kind: "quest_reward_claim", questId: "opportunity-first-note" },
      },
    );

    const payload = buildHistoryReviewPayload(state);
    const latestGroup = payload.actionGroups.find((group) => group.round === state.run.currentRound);
    const context = buildHistoryReviewAiContext(state, payload);

    expect(payload.metrics.learningActions).toBeGreaterThanOrEqual(4);
    expect(payload.metrics.reviewActions).toBeGreaterThanOrEqual(2);
    expect(payload.learningSignals.map((signal) => signal.id)).toEqual(
      expect.arrayContaining(["opportunity", "fund_lab", "wealth_review", "quest"]),
    );
    expect(latestGroup?.items.find((item) => item.type === "quest")?.impact).toContain("任务奖励");
    expect(context).toContain("学习信号");
    expect(context).toContain("机会观察");
  });

  it("resolves each round's event from the run's seeded eventTimeline, not the static market script", () => {
    const state = getSimulationStateForUser("student-1");
    // Force a distinctive timeline so a regression (reading the static round.eventId)
    // would surface as a mismatch. These are real event ids used across the suite.
    state.run.eventTimeline = (state.run.eventTimeline ?? []).map((_, index) =>
      index % 2 === 0 ? "event-liquidity-crisis" : "event-leverage-temptation",
    );

    const payload = buildHistoryReviewPayload(state);

    expect(payload.timeline.length).toBeGreaterThan(0);
    for (const entry of payload.timeline) {
      const expectedEventId = state.run.eventTimeline[entry.round - 1];
      expect(entry.eventTitle).toBe(getEventCard(expectedEventId).title);
    }
  });
});
