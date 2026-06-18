import { describe, expect, it } from "vitest";

import {
  advanceSimulationRun,
  applySimulationAction,
  createInitialRun,
  evaluateRun,
  getRoundQuotesForRun,
} from "@/lib/simulation";

// TEST-STRATEGY §4 R4: every money value is Math.round-ed at each step, so 12
// rounds of compounding must NOT accumulate floating-point drift (a ".0000001"
// tail would diverge leaderboard power and break tabular-nums display).

describe("money rounding invariants (R4 — no float drift over 12 rounds)", () => {
  it("keeps every snapshot net worth + risk score integral across a full run", () => {
    let run = createInitialRun("student-test", "class-test", "测试", 1);
    // Seed non-zero balances so the savings*1.012.. / debt*1.018 compounding runs.
    run.cash = 40_000;
    run.savings = 50_000;
    run.debt = 30_000;

    for (let i = 0; i < 12; i++) {
      run = advanceSimulationRun(run);
      expect(Number.isInteger(run.savings)).toBe(true);
      expect(Number.isInteger(run.debt)).toBe(true);
    }

    expect(run.snapshots.length).toBeGreaterThan(1);
    for (const snap of run.snapshots) {
      expect(Number.isInteger(snap.netWorth)).toBe(true);
      expect(Number.isInteger(snap.riskScore)).toBe(true);
    }
  });

  it("compounds debt at exactly round(×1.018) and keeps savings integral", () => {
    let run = createInitialRun("student-test", "class-test", "测试", 1);
    run.savings = 50_000;
    run.debt = 30_000;

    run = advanceSimulationRun(run);

    // Debt compounding is deterministic: Math.round(30000 * 1.018) = 30540.
    expect(run.debt).toBe(Math.round(30_000 * 1.018));
    expect(run.debt).toBe(30_540);
    // Savings compounding varies by round liquidityBoost, but must stay integral.
    expect(Number.isInteger(run.savings)).toBe(true);
    expect(run.savings).toBeGreaterThan(0);
  });

  it("conserves net worth when buying the gold and index assets at their current quotes", () => {
    for (const assetId of ["asset-gold", "asset-index"]) {
      const run = createInitialRun(`student-${assetId}`, "class-test", "test", 20260618);
      const quote = getRoundQuotesForRun(run, run.currentRound).find((asset) => asset.id === assetId);
      expect(quote).toBeDefined();

      const before = evaluateRun(run).netWorth;
      const quantity = 3;
      const bought = applySimulationAction(run, {
        type: "trade",
        assetId,
        side: "buy",
        quantity,
        orderMode: "market",
      });

      expect(bought.cash).toBe(run.cash - quote!.currentPrice * quantity);
      expect(evaluateRun(bought).netWorth).toBe(before);
    }
  });
});
