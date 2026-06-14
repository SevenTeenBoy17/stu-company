import { describe, expect, it } from "vitest";

import { buildMarketBoardPayload } from "@/lib/market-watchlist";
import { createInitialRun } from "@/lib/simulation";
import { buildStudentWatchlistPayload, createStudentWatchlistAction } from "@/lib/student-watchlist";

describe("student watchlist", () => {
  it("builds daily brief and suggestions from market board data", () => {
    const run = createInitialRun("student-1", "class-1");
    const market = buildMarketBoardPayload({ selectedSymbol: "MU" });
    const payload = buildStudentWatchlistPayload(run, market);

    expect(payload.items).toHaveLength(0);
    expect(payload.suggested.length).toBeGreaterThan(0);
    expect(payload.temperature.label).toMatch(/市场/);
    expect(payload.dailyBrief.question).toContain("自选");
  });

  it("records add and remove actions without mutating wealth balances", () => {
    const run = createInitialRun("student-1", "class-1");
    const before = { cash: run.cash, savings: run.savings, debt: run.debt };
    const market = buildMarketBoardPayload({ selectedSymbol: "NVDA" });

    const addOutcome = createStudentWatchlistAction(run, {
      symbol: "NVDA",
      action: "add",
      reason: "AI 算力主线强，但波动也高，需要持续观察。",
    });
    const afterAdd = buildStudentWatchlistPayload(addOutcome.run, market);

    expect(addOutcome.run.cash).toBe(before.cash);
    expect(addOutcome.run.savings).toBe(before.savings);
    expect(addOutcome.run.debt).toBe(before.debt);
    expect(addOutcome.entry.type).toBe("watchlist");
    expect(afterAdd.items).toHaveLength(1);
    expect(afterAdd.items[0]?.symbol).toBe("NVDA");

    const removeOutcome = createStudentWatchlistAction(addOutcome.run, {
      symbol: "NVDA",
      action: "remove",
      reason: "今天先移出，换成更适合比较的样本。",
    });
    const afterRemove = buildStudentWatchlistPayload(removeOutcome.run, market);

    expect(afterRemove.items).toHaveLength(0);
    expect(afterRemove.historyCount).toBe(2);
  });
});
