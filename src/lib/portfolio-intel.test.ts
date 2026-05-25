import { beforeEach, describe, expect, it } from "vitest";

import { buildPortfolioAiContext, buildPortfolioIntel } from "@/lib/portfolio-intel";
import { getSimulationStateForUser, resetStoreForTests } from "@/lib/store";

describe("portfolio intel", () => {
  beforeEach(() => {
    resetStoreForTests();
  });

  it("builds a fallback allocation panel from simulation state", () => {
    const state = getSimulationStateForUser("student-1");
    const intel = buildPortfolioIntel(state);

    expect(intel.provider).toBe("fallback");
    expect(intel.allocation).toHaveLength(5);
    expect(intel.suggestions.length).toBeGreaterThan(0);
    expect(intel.marketSignals.length).toBeGreaterThan(0);
  });

  it("injects market and holding context into the AI prompt block", () => {
    const state = getSimulationStateForUser("student-1");
    const intel = buildPortfolioIntel(state);
    const context = buildPortfolioAiContext(state, intel);

    expect(context).toContain(state.market.round.headline);
    expect(context).toContain("当前配置");
    expect(context).toContain("建议配置");
  });
});
