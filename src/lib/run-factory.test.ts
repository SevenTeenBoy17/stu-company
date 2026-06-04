import { describe, expect, it } from "vitest";

import { STARTING_CASH } from "@/lib/simulation";

import { makeScenarioRun } from "../../tests/factories/run";

// Consumer + characterization test for the run factory. Locks the canonical
// starting invariants (120000 cash / round 1 / 12 rounds) that every downstream
// sim and leaderboard calculation depends on.

describe("makeScenarioRun factory", () => {
  it("produces a fresh run with the canonical starting invariants", () => {
    const run = makeScenarioRun();
    expect(run.cash).toBe(STARTING_CASH);
    expect(run.cash).toBe(120_000);
    expect(run.currentRound).toBe(1);
    expect(run.totalRounds).toBe(12);
    expect(run.holdings).toEqual([]);
    expect(run.actionLog).toEqual([]);
  });

  it("is deterministic for its fixed seed (identical event timeline every call)", () => {
    expect(makeScenarioRun().eventTimeline).toEqual(makeScenarioRun().eventTimeline);
    expect(makeScenarioRun().seed).toBe(makeScenarioRun().seed);
  });

  it("applies shallow overrides", () => {
    const run = makeScenarioRun({ cash: 999, currentRound: 5 });
    expect(run.cash).toBe(999);
    expect(run.currentRound).toBe(5);
    // untouched fields keep factory defaults
    expect(run.totalRounds).toBe(12);
  });
});
