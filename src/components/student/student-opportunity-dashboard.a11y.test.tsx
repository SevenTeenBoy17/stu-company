import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { buildOpportunityPayload } from "@/lib/opportunity";
import { createInitialRun } from "@/lib/simulation";

import { StudentOpportunityDashboard } from "./student-opportunity-dashboard";

// itest10 #1: the theme "机会卡" are a single-select toggle group, but the
// buttons exposed no aria-pressed — the selected card was conveyed by color
// alone (WCAG 4.1.2 / 1.3.1). This locks the fix (mirrors goal-accounts cards).
describe("StudentOpportunityDashboard theme-card a11y (itest10 #1)", () => {
  beforeEach(() => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: query.includes("prefers-reduced-motion"),
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList,
    );
  });

  it("exposes aria-pressed on every theme card, with exactly one selected", () => {
    const run = createInitialRun("student-opp", "class-opp", "test", 20260706);
    const payload = buildOpportunityPayload(run);
    render(<StudentOpportunityDashboard initialPayload={payload} />);

    const cards = payload.cards.map((card) =>
      screen.getByTestId(`opportunity-card-${card.id}`),
    );
    expect(cards.length).toBeGreaterThan(0);

    // Every card exposes the pressed state (role/state present, not color-only).
    for (const card of cards) {
      expect(card.getAttribute("aria-pressed")).not.toBeNull();
    }
    // Exactly one card is announced as selected.
    const pressed = cards.filter((card) => card.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
  });
});
