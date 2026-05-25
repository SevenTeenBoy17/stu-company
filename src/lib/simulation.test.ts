import { describe, expect, it } from "vitest";

import { advanceSimulationRun, applySimulationAction, createInitialRun, evaluateRun } from "@/lib/simulation";

describe("simulation", () => {
  it("updates holdings and cash after a buy action", () => {
    const run = createInitialRun("student-test", "class-test");
    const updated = applySimulationAction(run, {
      type: "trade",
      assetId: "asset-etf",
      side: "buy",
      quantity: 50,
      orderMode: "market",
    });

    expect(updated.cash).toBeLessThan(run.cash);
    expect(updated.holdings.find((holding) => holding.assetId === "asset-etf")?.quantity).toBe(50);
  });

  it("advances the round and records a new snapshot", () => {
    const run = createInitialRun("student-test", "class-test");
    const progressed = advanceSimulationRun(run);

    expect(progressed.currentRound).toBe(2);
    expect(progressed.snapshots.at(-1)?.round).toBe(2);
  });

  it("evaluates risk and net worth deterministically", () => {
    let run = createInitialRun("student-test", "class-test");
    run = applySimulationAction(run, {
      type: "bank",
      action: "loan",
      amount: 10_000,
    });

    const evaluated = evaluateRun(run);
    expect(evaluated.netWorth).toBeGreaterThan(80_000);
    expect(evaluated.riskScore).toBeGreaterThanOrEqual(24);
  });
});
