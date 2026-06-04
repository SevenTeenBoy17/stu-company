import { describe, expect, it } from "vitest";

import { advanceSimulationRun, createInitialRun } from "@/lib/simulation";

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
});
