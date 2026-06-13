import { describe, expect, it } from "vitest";

import { buildWealthSummary, computeDiversificationScore } from "@/lib/allocation";
import { applySimulationAction, createInitialRun } from "@/lib/simulation";

describe("wealth allocation", () => {
  it("builds a wealth summary from the current simulation run", () => {
    let run = createInitialRun("student-wealth", "classroom-1");
    run = applySimulationAction(run, {
      type: "bank",
      action: "deposit",
      amount: 20_000,
    });
    run = applySimulationAction(run, {
      type: "trade",
      assetId: "asset-etf",
      side: "buy",
      quantity: 60,
      orderMode: "market",
    });
    run = applySimulationAction(run, {
      type: "venture",
      action: "invest",
      amount: 8_000,
    });

    const summary = buildWealthSummary(run);

    expect(summary.netWorth).toBeGreaterThan(0);
    expect(summary.grossAssets).toBeGreaterThanOrEqual(summary.netWorth);
    expect(summary.allocation.length).toBeGreaterThanOrEqual(3);
    expect(Math.round(summary.allocation.reduce((sum, slice) => sum + slice.weight, 0))).toBe(100);
    expect(summary.targetAllocation).toHaveLength(3);
    expect(summary.missions).toHaveLength(3);
  });

  it("penalizes concentration and debt in the diversification score", () => {
    const concentrated = computeDiversificationScore(
      [
        {
          id: "stock",
          label: "股票",
          value: 90_000,
          weight: 90,
          color: "red",
          riskBand: "growth",
          hint: "",
        },
        {
          id: "cash",
          label: "现金",
          value: 10_000,
          weight: 10,
          color: "gray",
          riskBand: "liquid",
          hint: "",
        },
      ],
      20_000,
      100_000,
    );
    const balanced = computeDiversificationScore(
      [
        {
          id: "cash",
          label: "现金",
          value: 30_000,
          weight: 30,
          color: "gray",
          riskBand: "liquid",
          hint: "",
        },
        {
          id: "bond",
          label: "债券",
          value: 25_000,
          weight: 25,
          color: "green",
          riskBand: "stable",
          hint: "",
        },
        {
          id: "etf",
          label: "ETF",
          value: 25_000,
          weight: 25,
          color: "orange",
          riskBand: "growth",
          hint: "",
        },
        {
          id: "property",
          label: "房产",
          value: 20_000,
          weight: 20,
          color: "brown",
          riskBand: "real",
          hint: "",
        },
      ],
      0,
      100_000,
    );

    expect(balanced).toBeGreaterThan(concentrated);
  });
});
