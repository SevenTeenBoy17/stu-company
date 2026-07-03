import { describe, expect, it } from "vitest";

import { applySimulationAction, createInitialRun } from "@/lib/simulation";
import { buildWealthReviewPayload, createWealthReview } from "@/lib/wealth-review";

describe("wealth review", () => {
  it("builds a teaching review payload from the current holdings", () => {
    let run = createInitialRun("student-wealth-review", "classroom-1");
    run = applySimulationAction(run, {
      type: "trade",
      assetId: "asset-stock",
      side: "buy",
      quantity: 80,
      orderMode: "market",
    });

    const payload = buildWealthReviewPayload(run);

    expect(payload.focusOptions.length).toBeGreaterThan(0);
    expect(payload.actionOptions.length).toBeGreaterThan(0);
    expect(payload.planScore).toBeGreaterThan(30);
    expect(payload.coach.nextSteps).toHaveLength(3);
  });

  it("records a wealth review without mutating balances", () => {
    const run = createInitialRun("student-wealth-review", "classroom-1");
    const before = {
      cash: run.cash,
      savings: run.savings,
      debt: run.debt,
      netWorth: run.netWorth,
    };

    const outcome = createWealthReview(run, {
      focus: "safety-buffer",
      action: "raise-cash",
      confidence: 64,
      note: "我先补安全垫，因为下一回合如果出现回撤，现金不足会让我被迫卖出。",
    });

    expect(outcome.entry).toMatchObject({
      type: "wealth_review",
      amount: 0,
      meta: expect.objectContaining({
        kind: "wealth_review",
        focus: "safety-buffer",
        action: "raise-cash",
      }),
    });
    expect(outcome.run.cash).toBe(before.cash);
    expect(outcome.run.savings).toBe(before.savings);
    expect(outcome.run.debt).toBe(before.debt);
    expect(outcome.run.netWorth).toBe(before.netWorth);
    expect(outcome.payload.latestReview?.note).toContain("安全垫");
  });

  it("shows the newest wealth review first", () => {
    const first = createWealthReview(createInitialRun("student-wealth-review", "classroom-1"), {
      focus: "safety-buffer",
      action: "raise-cash",
      confidence: 64,
      note: "第一版计划：先补现金垫，避免下一回合被迫卖出。",
    });

    const second = createWealthReview(first.run, {
      focus: "growth-engine",
      action: "hold-and-watch",
      confidence: 72,
      note: "第二版计划：暂时持有观察，把成长资产和目标账户连接起来。",
    });

    expect(second.payload.latestReview?.note).toContain("第二版计划");
    expect(second.payload.history[0]?.note).toContain("第二版计划");
    expect(second.payload.history[1]?.note).toContain("第一版计划");
  });
});
