import { describe, expect, it } from "vitest";

import type { PortfolioSnapshot, ScenarioRun } from "@/lib/types";

import { computeRunPower, runToPowerInput } from "./run-power";

function snap(round: number, netWorth: number, disciplineScore = 70, riskScore = 40): PortfolioSnapshot {
  return { round, netWorth, cash: netWorth, savings: 0, debt: 0, riskScore, disciplineScore, reflection: "" };
}

function run(over: Partial<ScenarioRun> & { snapshots: PortfolioSnapshot[] }): ScenarioRun {
  return {
    id: "r1",
    userId: "u1",
    classroomId: "c1",
    scenarioName: "s",
    currentRound: over.snapshots.length,
    totalRounds: 12,
    cash: 0,
    savings: 0,
    debt: 0,
    propertyUnits: 0,
    propertyBasis: 0,
    ventureStake: 0,
    ventureBasis: 0,
    holdings: [],
    eventHistory: [],
    actionLog: [],
    lastInsight: undefined,
    ...over,
  } as ScenarioRun;
}

describe("runToPowerInput", () => {
  it("uses the materialized netWorth when present, else the last snapshot", () => {
    const r = run({ snapshots: [snap(1, 120000), snap(2, 150000)], netWorth: 155000 });
    expect(runToPowerInput(r).netWorth).toBe(155000);

    const r2 = run({ snapshots: [snap(1, 120000), snap(2, 150000)] });
    expect(runToPowerInput(r2).netWorth).toBe(150000);
  });

  it("computes peak-tracking max drawdown as a percentage", () => {
    // peak 200k then down to 150k -> 25% drawdown
    const r = run({ snapshots: [snap(1, 120000), snap(2, 200000), snap(3, 150000)] });
    expect(runToPowerInput(r).maxDrawdownPct).toBeCloseTo(25, 5);
  });

  it("reports zero volatility for a flat curve and positive for a choppy one", () => {
    const flat = run({ snapshots: [snap(1, 120000), snap(2, 120000), snap(3, 120000)] });
    expect(runToPowerInput(flat).returnVolatility).toBe(0);

    const choppy = run({ snapshots: [snap(1, 100000), snap(2, 150000), snap(3, 90000)] });
    expect(runToPowerInput(choppy).returnVolatility).toBeGreaterThan(0);
  });

  it("passes through discipline and learning", () => {
    const r = run({ snapshots: [snap(1, 120000, 55), snap(2, 130000, 82)] });
    const input = runToPowerInput(r, { completed: 3, total: 6 });
    expect(input.disciplineScore).toBe(82);
    expect(input.learningCompleted).toBe(3);
    expect(input.learningTotal).toBe(6);
  });

  it("defaults to start capital for an empty run without throwing", () => {
    const r = run({ snapshots: [] });
    const input = runToPowerInput(r);
    expect(input.netWorth).toBe(120000);
    expect(input.maxDrawdownPct).toBe(0);
    expect(input.returnVolatility).toBe(0);
  });
});

describe("computeRunPower", () => {
  it("returns a bounded power and the five components", () => {
    const r = run({ snapshots: [snap(1, 120000, 60), snap(2, 180000, 85)], netWorth: 180000 });
    const { power, components } = computeRunPower(r, { completed: 6, total: 6 });
    expect(power).toBeGreaterThanOrEqual(0);
    expect(power).toBeLessThanOrEqual(2000);
    expect(Object.keys(components).sort()).toEqual(
      ["discipline", "drawdown", "growth", "learning", "riskAdjReturn"],
    );
  });
});

describe("max drawdown clamp（内测 rank5）", () => {
  it("净值跌为负数时回撤按定义封顶 100%，不产生 141% 这类读数", () => {
    const r = run({ snapshots: [snap(1, 120_000), snap(2, -50_000)] });
    expect(runToPowerInput(r).maxDrawdownPct).toBe(100);
  });
});
