import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PowerCard } from "./power-card";
import type { FormulaDTO, PowerCardDTO, RankScope } from "./types";

const formula: FormulaDTO = {
  maxPower: 2000,
  weights: {
    riskAdjReturn: 0.3,
    discipline: 0.25,
    drawdown: 0.2,
    learning: 0.15,
    growth: 0.1,
  },
  tiers: [
    { tier: 1, name: "稳健学徒", min: 0 },
    { tier: 2, name: "策略练习生", min: 500 },
  ],
};

const card: PowerCardDTO = {
  period: "weekly",
  periodKey: "2026-W26",
  seasonName: "本周",
  hasProfile: true,
  ranked: true,
  alias: "学习者",
  visibility: "school_only",
  consent: 1,
  power: 820,
  tier: { tier: 2, key: "steady", name: "策略练习生", min: 500 },
  toNextTier: 180,
  components: {
    riskAdjReturn: 0.5,
    discipline: 0.7,
    drawdown: 0.8,
    learning: 0.6,
    growth: 0.4,
  },
  ranks: { school: 2, city: 8, province: 18, nation: 80 },
};

function mockReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)" ? matches : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderPowerCard(scope: RankScope = "school") {
  const onScopeChange = vi.fn();
  render(
    <>
      <PowerCard card={card} formula={formula} scope={scope} onScopeChange={onScopeChange} />
      <div id="rank-board" />
    </>,
  );
  return { onScopeChange };
}

describe("PowerCard reduced-motion navigation", () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    scrollIntoView.mockClear();
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses smooth scrolling for scope navigation by default", async () => {
    mockReducedMotion(false);
    const { onScopeChange } = renderPowerCard();

    await userEvent.click(screen.getByTestId("rank-scope-city"));

    expect(onScopeChange).toHaveBeenCalledWith("city");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "nearest" });
  });

  it("uses instant scrolling when the user prefers reduced motion", async () => {
    mockReducedMotion(true);
    const { onScopeChange } = renderPowerCard();

    await userEvent.click(screen.getByTestId("rank-scope-nation"));

    expect(onScopeChange).toHaveBeenCalledWith("nation");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "nearest" });
  });
});
