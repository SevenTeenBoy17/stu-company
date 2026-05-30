import { describe, expect, it } from "vitest";

import {
  advanceSimulationRun,
  applyEventChoice,
  applySimulationAction,
  createInitialRun,
  evaluateRun,
  getRoundQuotes,
  getRoundQuotesForRun,
} from "@/lib/simulation";

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

  it("allows exiting an existing venture without a manual amount", () => {
    let run = createInitialRun("student-test", "class-test");
    run = applySimulationAction(run, {
      type: "venture",
      action: "invest",
      amount: 8_000,
    });

    const exited = applySimulationAction(run, {
      type: "venture",
      action: "exit",
    });

    expect(exited.ventureStake).toBe(0);
    expect(exited.cash).toBeGreaterThan(run.cash);
    expect(exited.actionLog[0]?.label).toContain("退出创业项目");
  });
});

describe("seeded random events", () => {
  it("assigns a reproducible 12-round event timeline from a seed", () => {
    const a = createInitialRun("student-test", "class-test", "试点", 2024);
    const b = createInitialRun("student-test", "class-test", "试点", 2024);
    expect(a.eventTimeline).toHaveLength(12);
    expect(a.eventTimeline).toEqual(b.eventTimeline);
  });

  it("varies the event timeline across different seeds", () => {
    const a = createInitialRun("student-test", "class-test", "试点", 1);
    const b = createInitialRun("student-test", "class-test", "试点", 2);
    expect(a.eventTimeline).not.toEqual(b.eventTimeline);
  });

  it("lets a bearish event pull an impacted asset below its event-free baseline", () => {
    const run = createInitialRun("student-test", "class-test", "试点", 1);
    run.eventTimeline = ["event-liquidity-crisis", ...(run.eventTimeline ?? []).slice(1)];

    const withEvent = getRoundQuotesForRun(run, 1).find((q) => q.id === "asset-stock");
    const baseline = getRoundQuotes(1).find((q) => q.id === "asset-stock");

    expect(withEvent && baseline).toBeTruthy();
    expect(withEvent!.currentPrice).toBeLessThan(baseline!.currentPrice);
  });
});

describe("event decision cards (E3)", () => {
  function decisionRun() {
    const run = createInitialRun("student-test", "class-test", "试点", 1);
    // liquidity-crisis is a decision card with protect/gamble/hold choices.
    run.eventTimeline = ["event-liquidity-crisis", ...(run.eventTimeline ?? []).slice(1)];
    return run;
  }

  it("applies a 'protect' choice as a cash cost and logs an event action", () => {
    const run = decisionRun();
    const next = applyEventChoice(run, "lc-protect");
    expect(next.cash).toBeLessThan(run.cash);
    expect(next.actionLog[0]?.type).toBe("event");
  });

  it("rejects choosing twice in the same round", () => {
    const once = applyEventChoice(decisionRun(), "lc-protect");
    expect(() => applyEventChoice(once, "lc-protect")).toThrow();
  });

  it("rejects an unknown choice id", () => {
    expect(() => applyEventChoice(decisionRun(), "no-such-choice")).toThrow();
  });
});
