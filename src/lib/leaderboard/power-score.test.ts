import { describe, expect, it } from "vitest";

import {
  POWER_TUNING,
  POWER_WEIGHTS,
  computePowerScore,
  powerComponents,
  type PowerScoreInput,
} from "./power-score";

const base: PowerScoreInput = {
  startCapital: 120_000,
  netWorth: 120_000,
  returnVolatility: 0.1,
  disciplineScore: 50,
  maxDrawdownPct: 10,
  learningCompleted: 0,
  learningTotal: 10,
};

describe("POWER_WEIGHTS", () => {
  it("sums to 1.0 (so raw score maps cleanly to 0..1)", () => {
    const sum = Object.values(POWER_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
  });
});

describe("powerComponents", () => {
  it("returns all five components within [0,1]", () => {
    const c = powerComponents({
      ...base,
      netWorth: 150_000,
      disciplineScore: 80,
      maxDrawdownPct: 5,
      learningCompleted: 8,
    });
    for (const value of Object.values(c)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("avoids divide-by-zero when there are no learning items", () => {
    const c = powerComponents({ ...base, learningTotal: 0, learningCompleted: 0 });
    expect(c.learning).toBe(0);
    expect(Number.isFinite(c.learning)).toBe(true);
  });

  it("maps discipline 0..100 -> 0..1", () => {
    expect(powerComponents({ ...base, disciplineScore: 100 }).discipline).toBe(1);
    expect(powerComponents({ ...base, disciplineScore: 0 }).discipline).toBe(0);
  });

  it("rewards smaller drawdown (capital protection)", () => {
    const low = powerComponents({ ...base, maxDrawdownPct: 0 }).drawdown;
    const high = powerComponents({ ...base, maxDrawdownPct: 40 }).drawdown;
    expect(low).toBe(1);
    expect(low).toBeGreaterThan(high);
  });
});

describe("computePowerScore", () => {
  it("returns power within [0, maxPower]", () => {
    const { power } = computePowerScore({
      ...base,
      netWorth: 240_000,
      returnVolatility: 0.05,
      disciplineScore: 100,
      maxDrawdownPct: 0,
      learningCompleted: 10,
    });
    expect(power).toBeGreaterThanOrEqual(0);
    expect(power).toBeLessThanOrEqual(POWER_TUNING.maxPower);
  });

  it("ranks a disciplined steady investor above a reckless gambler who lost", () => {
    const steady = computePowerScore({
      startCapital: 120_000,
      netWorth: 138_000,
      returnVolatility: 0.08,
      disciplineScore: 85,
      maxDrawdownPct: 6,
      learningCompleted: 9,
      learningTotal: 10,
    }).power;
    const gamblerLoss = computePowerScore({
      startCapital: 120_000,
      netWorth: 70_000,
      returnVolatility: 0.6,
      disciplineScore: 20,
      maxDrawdownPct: 45,
      learningCompleted: 2,
      learningTotal: 10,
    }).power;
    expect(steady).toBeGreaterThan(gamblerLoss);
  });

  it("anti-YOLO: a disciplined player beats a LUCKY reckless gambler (the core pedagogy)", () => {
    const gamblerWin = computePowerScore({
      startCapital: 120_000,
      netWorth: 260_000, // got rich...
      returnVolatility: 0.7, // ...by gambling
      disciplineScore: 25,
      maxDrawdownPct: 48,
      learningCompleted: 1,
      learningTotal: 10,
    }).power;
    const disciplined = computePowerScore({
      startCapital: 120_000,
      netWorth: 150_000,
      returnVolatility: 0.06,
      disciplineScore: 95,
      maxDrawdownPct: 4,
      learningCompleted: 10,
      learningTotal: 10,
    }).power;
    expect(disciplined).toBeGreaterThan(gamblerWin);
  });
});
