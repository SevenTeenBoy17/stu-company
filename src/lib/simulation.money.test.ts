import { describe, expect, it } from "vitest";

import {
  advanceSimulationRun,
  applyEventChoice,
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

  // itest10 #9: the stake is measured on NET WORTH but was applied to cash and
  // floored at 0. Parking all cash in savings made a gamble loss vanish while the
  // win still paid — a risk-free money printer that inflated net worth + the
  // leaderboard. A loss must now be realized against savings/debt.
  it("realizes a gamble loss from savings when cash is 0 (no risk-free money printer)", () => {
    let sawLoss = false;
    let sawWin = false;
    for (let seed = 1; seed <= 40; seed += 1) {
      const run = createInitialRun("student-gamble", "class-gamble", "test", seed);
      // Park every yuan in savings, then force the liquidity-crisis gamble card.
      run.cash = 0;
      run.savings = 120_000;
      run.debt = 0;
      run.eventTimeline = run.eventTimeline ? [...run.eventTimeline] : [];
      run.eventTimeline[run.currentRound - 1] = "event-liquidity-crisis";

      const before = evaluateRun(run).netWorth;
      const after = applyEventChoice(run, "lc-gamble");
      const netWorth = evaluateRun(after).netWorth;

      if (netWorth < before) {
        // Old bug: with cash=0 this branch NEVER happened (loss floored to 0).
        sawLoss = true;
        expect(after.savings).toBeLessThan(120_000);
      }
      if (netWorth > before) {
        sawWin = true;
        expect(after.cash).toBeGreaterThan(0);
      }
    }
    // A real gamble swings both ways; crucially, losses are now felt.
    expect(sawLoss).toBe(true);
    expect(sawWin).toBe(true);
  });
});
