import { describe, expect, it } from "vitest";

import { buildFundLabPayload, createFundLabAction } from "@/lib/fund-lab";
import { createInitialRun } from "@/lib/simulation";

describe("fund lab", () => {
  it("builds a diversified teaching portfolio payload", () => {
    const run = createInitialRun("student-1", "classroom-1");
    const payload = buildFundLabPayload(run, "balanced", 6000);

    expect(payload.funds).toHaveLength(4);
    expect(payload.selectedPlan.allocations.reduce((total, item) => total + item.weight, 0)).toBe(100);
    expect(payload.selectedPlan.diversificationScore).toBeGreaterThan(40);
  });

  it("previews different plan metrics from the same simulation run", () => {
    const run = createInitialRun("student-1", "classroom-1");
    const defensive = buildFundLabPayload(run, "defensive", 5000);
    const growth = buildFundLabPayload(run, "growth", 12000);

    expect(growth.selectedPlan.amount).toBe(12000);
    expect(growth.selectedPlan.riskScore).toBeGreaterThan(defensive.selectedPlan.riskScore);
    expect(growth.selectedPlan.maxDrawdown).toBeGreaterThan(defensive.selectedPlan.maxDrawdown);
    expect(growth.selectedPlan.expectedReturn).toBeGreaterThan(defensive.selectedPlan.expectedReturn);
  });

  it("records a fund lab experiment without changing cash or net worth", () => {
    const run = createInitialRun("student-1", "classroom-1");
    const cashBefore = run.cash;
    const netWorthBefore = run.netWorth;
    const outcome = createFundLabAction(run, {
      plan: "defensive",
      amount: 5000,
      note: "我想测试防守底仓能否减少组合波动。",
    });

    expect(outcome.run.actionLog[0]).toMatchObject({
      type: "fund_lab",
      amount: 0,
      meta: expect.objectContaining({ kind: "fund_lab_action", plan: "defensive", amount: 5000 }),
    });
    expect(outcome.run.cash).toBe(cashBefore);
    expect(outcome.run.netWorth).toBe(netWorthBefore);
  });

  it("cleans unreadable legacy notes and dedupes identical history entries", () => {
    const run = createInitialRun("student-1", "classroom-1");
    const outcome = createFundLabAction(run, {
      plan: "balanced",
      amount: 6000,
      note: "记录一个清晰的均衡组合理由。",
    });
    const firstAction = outcome.run.actionLog[0]!;
    const runWithLegacyNoise = {
      ...outcome.run,
      actionLog: [
        firstAction,
        firstAction,
        {
          ...firstAction,
          id: "legacy-noise",
          meta: {
            ...firstAction.meta,
            note: "??????",
          },
        },
      ],
    };

    const payload = buildFundLabPayload(runWithLegacyNoise, "balanced", 6000);

    expect(payload.history).toHaveLength(2);
    expect(payload.history.some((entry) => entry.note.includes("无法识别"))).toBe(true);
  });
});
