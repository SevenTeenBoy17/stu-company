import { describe, expect, it } from "vitest";

import {
  buildAutoInvestPayload,
  cancelAutoInvestPlan,
  createAutoInvestPlan,
  executeAutoInvestForRound,
  getActiveAutoInvestPlan,
} from "@/lib/auto-invest";
import { advanceSimulationRun, createInitialRun } from "@/lib/simulation";

describe("buildAutoInvestPayload", () => {
  it("builds an executable recurring investment schedule without overdrawing cash", () => {
    const run = createInitialRun("student-1", "class-1", "test", 20260613);
    const payload = buildAutoInvestPayload(run, {
      assetId: "asset-etf",
      amountPerRound: 3000,
      durationRounds: 4,
      strategy: "steady",
    });

    expect(payload.selected.assetId).toBe("asset-etf");
    expect(payload.schedule).toHaveLength(4);
    expect(payload.summary.executedRounds).toBeGreaterThan(0);
    expect(payload.summary.totalInvested).toBeGreaterThan(0);
    expect(payload.summary.cashAfterPlan).toBeGreaterThanOrEqual(0);
    expect(payload.schedule.every((row) => row.cashAfter >= 0)).toBe(true);
    expect(payload.comparison.lumpSumInvested).toBeGreaterThan(0);
  });

  it("skips rounds safely when the budget cannot buy one unit", () => {
    const run = createInitialRun("student-1", "class-1", "test", 20260613);
    run.cash = 600;
    const payload = buildAutoInvestPayload(run, {
      assetId: "asset-stock",
      amountPerRound: 500,
      durationRounds: 3,
      strategy: "buyDip",
    });

    expect(payload.summary.cashAfterPlan).toBeGreaterThanOrEqual(0);
    expect(payload.schedule.some((row) => row.status === "skipped")).toBe(true);
    expect(payload.summary.skippedRounds).toBeGreaterThan(0);
  });

  it("falls back to a valid asset and clamps invalid duration", () => {
    const run = createInitialRun("student-1", "class-1", "test", 20260613);
    const payload = buildAutoInvestPayload(run, {
      assetId: "missing",
      amountPerRound: 999999,
      durationRounds: 99,
      strategy: "momentum",
    });

    expect(payload.options.map((item) => item.assetId)).toContain(payload.selected.assetId);
    expect(payload.selected.durationRounds).toBeLessThanOrEqual(run.totalRounds);
    expect(payload.selected.amountPerRound).toBeLessThanOrEqual(run.cash);
  });

  it("creates a persistent plan and executes it on the next round", () => {
    let run = createInitialRun("student-1", "class-1", "test", 20260613);
    run = createAutoInvestPlan(run, {
      assetId: "asset-etf",
      amountPerRound: 3000,
      durationRounds: 3,
      strategy: "steady",
    });

    const plan = getActiveAutoInvestPlan(run);
    expect(plan?.startRound).toBe(2);
    expect(run.actionLog[0]?.type).toBe("auto_invest");

    const cashBefore = run.cash;
    run = executeAutoInvestForRound(advanceSimulationRun(run));

    expect(run.currentRound).toBe(2);
    expect(run.cash).toBeLessThan(cashBefore);
    expect(run.holdings.some((holding) => holding.assetId === "asset-etf")).toBe(true);
    expect(run.actionLog.some((entry) => entry.type === "auto_invest" && entry.round === 2)).toBe(true);
    expect(getActiveAutoInvestPlan(run)?.executedRounds).toContain(2);
  });

  it("cancels an active plan and prevents future execution", () => {
    let run = createInitialRun("student-1", "class-1", "test", 20260613);
    run = createAutoInvestPlan(run, {
      assetId: "asset-etf",
      amountPerRound: 3000,
      durationRounds: 3,
      strategy: "steady",
    });
    run = cancelAutoInvestPlan(run);

    expect(getActiveAutoInvestPlan(run)).toBeNull();
    const cashBefore = run.cash;
    run = executeAutoInvestForRound(advanceSimulationRun(run));
    expect(run.cash).toBe(cashBefore);
  });

  it("preview schedule aligns with the actual plan window (starts next round, not current)", () => {
    const run = createInitialRun("student-1", "class-1", "test", 20260613);
    const payload = buildAutoInvestPayload(run, {
      assetId: "asset-etf",
      amountPerRound: 3000,
      durationRounds: 3,
      strategy: "steady",
    });
    const planned = createAutoInvestPlan(run, {
      assetId: "asset-etf",
      amountPerRound: 3000,
      durationRounds: 3,
      strategy: "steady",
    });
    const plan = getActiveAutoInvestPlan(planned);

    expect(plan).not.toBeNull();
    // Preview window must equal the real execution window, else the headline
    // DCA-vs-lumpsum numbers are computed over rounds the robot never trades.
    expect(payload.schedule[0]?.round).toBe(run.currentRound + 1);
    expect(payload.schedule[0]?.round).toBe(plan?.startRound);
    expect(payload.schedule.at(-1)?.round).toBe(plan?.endRound);
  });
});
