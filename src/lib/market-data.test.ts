import { describe, expect, it } from "vitest";

import { eventTier } from "@/lib/event-engine";
import { eventCards } from "@/lib/market-data";

const NEW_ADVANCED_CARD_IDS = [
  "event-dividend-payout",
  "event-stock-split",
  "event-rate-hike",
  "event-leverage-temptation",
  "event-currency-devaluation",
  "event-ponzi-scheme",
  "event-short-squeeze",
  "event-bank-run",
  "event-regulation-hammer",
  "event-corporate-default",
  "event-bankruptcy-zero",
  "event-geopolitical-shock",
  "event-capital-gains-tax",
  "event-v-recovery",
];

describe("event card library (E4 expansion)", () => {
  it("has an expanded library of at least 38 cards", () => {
    expect(eventCards.length).toBeGreaterThanOrEqual(38);
  });

  it("includes the new advanced teaching cards", () => {
    const ids = new Set(eventCards.map((card) => card.id));
    for (const id of NEW_ADVANCED_CARD_IDS) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("has unique card ids", () => {
    const ids = eventCards.map((card) => card.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps a healthy tier distribution for the 12-round difficulty curve", () => {
    const tier1 = eventCards.filter((card) => eventTier(card) === 1).length;
    const tier3 = eventCards.filter((card) => eventTier(card) === 3).length;
    // tier1 fills gentle rounds 1-4 (no repeats); tier3 fills advanced 9-12.
    expect(tier1).toBeGreaterThanOrEqual(5);
    expect(tier3).toBeGreaterThanOrEqual(6);
  });

  it("gives every card the teaching metadata the engine relies on", () => {
    for (const card of eventCards) {
      expect(card.teachingConcept, card.id).toBeTruthy();
      expect(card.impactAssets?.length, card.id).toBeTruthy();
      expect(card.impactRange, card.id).toBeTruthy();
      expect(card.stage, card.id).toBeTruthy();
    }
  });
});
