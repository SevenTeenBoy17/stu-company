import { describe, expect, it } from "vitest";

import { applyLifeCashflowChallenge, buildLifeCashflowPayload } from "@/lib/life-cashflow";
import { applySimulationAction, createInitialRun } from "@/lib/simulation";

describe("life cashflow", () => {
  it("builds a teen-friendly cashflow plan from a live simulation run", () => {
    const run = createInitialRun("student-life-1", "classroom-1");
    const payload = buildLifeCashflowPayload(run, "balanced", "basic", new Date("2026-06-01T00:00:00.000Z"));

    expect(payload.overview.monthlyIncome).toBeGreaterThan(0);
    expect(payload.budgetRows).toHaveLength(4);
    expect(payload.weeklyPlan).toHaveLength(4);
    expect(payload.stressEvents).toHaveLength(3);
    expect(payload.coach.summary).toContain("真实理财");
  });

  it("reduces out-of-pocket pressure when insurance covers an event", () => {
    const run = createInitialRun("student-life-2", "classroom-1");
    const noInsurance = buildLifeCashflowPayload(run, "balanced", "none");
    const plusInsurance = buildLifeCashflowPayload(run, "balanced", "plus");

    const noHealth = noInsurance.stressEvents.find((event) => event.category === "health");
    const plusHealth = plusInsurance.stressEvents.find((event) => event.category === "health");

    expect(plusHealth?.outOfPocket).toBeLessThan(noHealth?.outOfPocket ?? 0);
    expect(plusHealth?.coveredAmount).toBeGreaterThan(0);
  });

  it("flags emergency-fund repair when cash has been moved into risky use", () => {
    let run = createInitialRun("student-life-3", "classroom-1");
    run = applySimulationAction(run, {
      type: "trade",
      assetId: "asset-stock",
      side: "buy",
      quantity: 500,
      orderMode: "market",
    });
    run.cash = 400;
    run.savings = 0;

    const payload = buildLifeCashflowPayload(run, "growth", "none");

    expect(payload.overview.emergencyGap).toBeGreaterThan(0);
    expect(payload.overview.stageLabel).toBe("应急金修复");
    expect(payload.coach.nextSteps.join("")).toContain("应急金");
  });

  it("applies a monthly budget challenge to the live run and records history", () => {
    const run = createInitialRun("student-life-4", "classroom-1");
    const outcome = applyLifeCashflowChallenge(run, {
      planId: "shield",
      insuranceId: "basic",
      now: new Date("2026-06-01T00:00:00.000Z"),
    });

    expect(outcome.run).not.toBe(run);
    expect(outcome.result.savingTransferred).toBeGreaterThan(0);
    expect(outcome.run.savings).toBeGreaterThan(run.savings);
    expect(outcome.run.actionLog[0]).toMatchObject({
      type: "bank",
      label: expect.stringContaining("生活账本执行"),
      meta: expect.objectContaining({ kind: "life_cashflow_challenge", planId: "shield" }),
    });
    expect(outcome.run.snapshots.at(-1)?.round).toBe(outcome.run.currentRound);
    expect(outcome.payload.overview.emergencyFund).toBe(outcome.result.emergencyFundAfter);
  });

  it("a fresh sandbox run is not trivially over-funded (#5 scale fix)", () => {
    const run = createInitialRun("student-life-5", "classroom-1");
    const payload = buildLifeCashflowPayload(run, "balanced", "basic", new Date("2026-06-01T00:00:00.000Z"));
    // The six-figure investment portfolio must not make personal budgeting trivially
    // safe: runway should be realistic and at least one stress event should bite.
    expect(payload.overview.runwayMonths).toBeLessThan(12);
    expect(payload.stressEvents.some((event) => event.status !== "safe")).toBe(true);
  });
});
