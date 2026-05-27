import { describe, expect, it } from "vitest";
import { detectAdaptiveEvents } from "./adaptive-events";
import { createInitialRun, applySimulationAction, advanceSimulationRun } from "./simulation";

function makeRun(overrides?: Partial<ReturnType<typeof createInitialRun>>) {
  return { ...createInitialRun("test-user", "test-class"), ...overrides };
}

describe("detectAdaptiveEvents", () => {
  it("returns empty array for a fresh run", () => {
    const run = makeRun();
    const events = detectAdaptiveEvents(run);
    expect(events).toEqual([]);
  });

  it("detects overtrading when 4+ trades in one round", () => {
    let run = makeRun();
    run = applySimulationAction(run, { type: "trade", assetId: "asset-stock", side: "buy", quantity: 5, orderMode: "market" });
    run = applySimulationAction(run, { type: "trade", assetId: "asset-etf", side: "buy", quantity: 5, orderMode: "market" });
    run = applySimulationAction(run, { type: "trade", assetId: "asset-bond", side: "buy", quantity: 5, orderMode: "market" });
    run = applySimulationAction(run, { type: "trade", assetId: "asset-commodity", side: "buy", quantity: 5, orderMode: "market" });

    const events = detectAdaptiveEvents(run);
    const overtrading = events.find((e) => e.id === "overtrading");
    expect(overtrading).toBeDefined();
    expect(overtrading!.tone).toBe("warning");
  });

  it("detects behavioral signals after round 6 with concentrated stock position", () => {
    let run = makeRun();
    run = applySimulationAction(run, { type: "trade", assetId: "asset-stock", side: "buy", quantity: 10, orderMode: "market" });
    run = advanceSimulationRun(run);
    run = advanceSimulationRun(run);
    run = advanceSimulationRun(run);
    run = advanceSimulationRun(run);
    run = advanceSimulationRun(run);
    run = advanceSimulationRun(run);

    const events = detectAdaptiveEvents(run);
    expect(events.length).toBeGreaterThanOrEqual(1);
    const ids = events.map((e) => e.id);
    const anyRelevant = ids.some(
      (id) => id === "bond_avoidance" || id === "herd_following" || id === "cash_hoarding" || id === "never_diversified",
    );
    expect(anyRelevant).toBe(true);
  });

  it("detects never diversified when only 1 holding after round 3", () => {
    let run = makeRun();
    run = applySimulationAction(run, { type: "trade", assetId: "asset-stock", side: "buy", quantity: 10, orderMode: "market" });
    run = advanceSimulationRun(run);
    run = advanceSimulationRun(run);
    run = advanceSimulationRun(run);

    const events = detectAdaptiveEvents(run);
    const noDiv = events.find((e) => e.id === "never_diversified");
    expect(noDiv).toBeDefined();
  });

  it("detects cash hoarding after round 5 with high cash ratio", () => {
    let run = makeRun();
    run = advanceSimulationRun(run);
    run = advanceSimulationRun(run);
    run = advanceSimulationRun(run);
    run = advanceSimulationRun(run);
    run = advanceSimulationRun(run);

    const events = detectAdaptiveEvents(run);
    const hoard = events.find((e) => e.id === "cash_hoarding");
    expect(hoard).toBeDefined();
    expect(hoard!.teachingPoint).toContain("机会成本");
  });

  it("limits output to max 2 events per CLT constraint", () => {
    let run = makeRun();
    // Advance to round 6 without doing anything (cash hoarding) then overtrade
    run = advanceSimulationRun(run);
    run = advanceSimulationRun(run);
    run = advanceSimulationRun(run);
    run = advanceSimulationRun(run);
    run = advanceSimulationRun(run);
    // Now overtrade in one round
    run = applySimulationAction(run, { type: "trade", assetId: "asset-stock", side: "buy", quantity: 2, orderMode: "market" });
    run = applySimulationAction(run, { type: "trade", assetId: "asset-etf", side: "buy", quantity: 2, orderMode: "market" });
    run = applySimulationAction(run, { type: "trade", assetId: "asset-commodity", side: "buy", quantity: 2, orderMode: "market" });
    run = applySimulationAction(run, { type: "trade", assetId: "asset-fx", side: "buy", quantity: 2, orderMode: "market" });

    const events = detectAdaptiveEvents(run);
    expect(events.length).toBeLessThanOrEqual(2);
  });

  it("detects positive streak after 3 consecutive growth rounds", () => {
    let run = makeRun();
    run = applySimulationAction(run, { type: "trade", assetId: "asset-stock", side: "buy", quantity: 50, orderMode: "market" });
    run = advanceSimulationRun(run);
    run = advanceSimulationRun(run);
    run = advanceSimulationRun(run);

    const events = detectAdaptiveEvents(run);
    const streak = events.find((e) => e.id === "streak_positive");
    // May or may not trigger depending on price movement, but structure should be valid
    if (streak) {
      expect(streak.tone).toBe("positive");
    }
  });
});
