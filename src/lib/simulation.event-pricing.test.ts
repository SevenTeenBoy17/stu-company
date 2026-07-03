import { describe, expect, it } from "vitest";

import { eventMarketEffect } from "@/lib/event-engine";
import { eventCards, marketAssets, marketRounds } from "@/lib/market-data";
import { createInitialRun, getRoundQuotes, getRoundQuotesForRun } from "@/lib/simulation";

type ScenarioRunLike = ReturnType<typeof createInitialRun>;

const ROUNDS = marketRounds.length;

function cardForEventId(eventId: string) {
  return eventCards.find((card) => card.id === eventId) ?? eventCards[0];
}

/**
 * #6 event-driven pricing — the event card the student actually sees is the real
 * cause of the round's price move. These are invariants (no magic numbers), in the
 * same property-style as the rest of the simulation suite.
 */
describe("event-driven pricing (#6)", () => {
  it("leaves the public ticker (no run) bit-for-bit identical to the canonical round multipliers", () => {
    // Legacy / offline-demo safety net: with no run there is no seeded timeline, so
    // pricing must collapse to the original basePrice × round multiplier formula.
    for (let round = 1; round <= ROUNDS; round++) {
      const canonical = marketRounds[round - 1].assetMultipliers;
      for (const quote of getRoundQuotes(round)) {
        expect(quote.currentPrice).toBe(Math.round(quote.basePrice * canonical[quote.category]));
      }
    }
  });

  it("moves every impacted category in the direction of the run's displayed card", () => {
    // For each category a round's seeded card impacts (and the round gives non-zero
    // volatility to), the price must move the way the shown card implies — so the card
    // is never decoupled from the price action.
    const seeds = [20260613, 20260101, 19990417];
    let asserted = 0;
    for (const seed of seeds) {
      const run = createInitialRun("student-pricing", "class-pricing", "test", seed);
      const timeline = run.eventTimeline ?? [];
      for (let round = 1; round <= ROUNDS; round++) {
        const card = cardForEventId(timeline[round - 1] ?? marketRounds[round - 1].eventId);
        const multipliers = marketRounds[round - 1].assetMultipliers;
        for (const quote of getRoundQuotesForRun(run, round)) {
          if (quote.id === "asset-gold" || quote.id === "asset-index") continue;
          const magnitude = Math.abs(multipliers[quote.category] - 1);
          const cardEffect = eventMarketEffect(card, quote.category);
          if (magnitude === 0 || cardEffect === 1) continue; // no move to direct / card neutral here
          asserted++;
          expect(Math.sign(quote.currentPrice - quote.basePrice)).toBe(Math.sign(cardEffect - 1));
        }
      }
    }
    expect(asserted).toBeGreaterThan(0); // never let this pass vacuously
  });

  it("preserves each round's volatility magnitude (price is the canonical value or its mirror)", () => {
    // The card can flip a move's direction but must not inflate its size: the seeded
    // price is always the canonical price or its reflection around basePrice. This is
    // what keeps the difficulty ramp and money-conservation balance intact.
    const run = createInitialRun("student-envelope", "class-envelope", "test", 20260613);
    for (let round = 1; round <= ROUNDS; round++) {
      const multipliers = marketRounds[round - 1].assetMultipliers;
      for (const quote of getRoundQuotesForRun(run, round)) {
        if (quote.id === "asset-gold" || quote.id === "asset-index") continue;
        const magnitude = Math.abs(multipliers[quote.category] - 1);
        const up = Math.round(quote.basePrice * (1 + magnitude));
        const down = Math.round(quote.basePrice * (1 - magnitude));
        expect([up, down]).toContain(quote.currentPrice);
      }
    }
  });

  it("makes the same round move a category up or down purely from the displayed card", () => {
    // The audit's exact scenario: hold everything fixed and swap only the shown card —
    // a 利好 card lifts the asset, a 利空 card depresses it. Cause = displayed card.
    const category = "stock" as const;
    const round = marketRounds.findIndex((r) => Math.abs(r.assetMultipliers[category] - 1) > 0) + 1;
    expect(round).toBeGreaterThan(0);

    const bull = eventCards.find(
      (c) => c.signal === "利好" && (!c.impactAssets || c.impactAssets.includes(category)),
    );
    const bear = eventCards.find(
      (c) => c.signal === "利空" && (!c.impactAssets || c.impactAssets.includes(category)),
    );
    expect(bull).toBeDefined();
    expect(bear).toBeDefined();

    const baseRun = createInitialRun("student-cause", "class-cause", "test", 20260613);
    const withCard = (eventId: string) => {
      const timeline = [...(baseRun.eventTimeline ?? [])];
      timeline[round - 1] = eventId;
      return { ...baseRun, eventTimeline: timeline };
    };
    const stockOf = (run: ScenarioRunLike) =>
      getRoundQuotesForRun(run, round).find((q) => q.category === category)!;

    const bullQuote = stockOf(withCard(bull!.id));
    const bearQuote = stockOf(withCard(bear!.id));

    expect(bullQuote.currentPrice).toBeGreaterThan(bullQuote.basePrice); // 利好 → up
    expect(bearQuote.currentPrice).toBeLessThan(bearQuote.basePrice); // 利空 → down
    expect(bullQuote.currentPrice).toBeGreaterThan(bearQuote.currentPrice);
  });
});

describe("C-7 gold and index market assets", () => {
  const pathFor = (assetId: string, seed: number) => {
    const run = createInitialRun(`student-${assetId}`, "class-pricing", "test", seed);
    return Array.from({ length: ROUNDS }, (_, index) => {
      const quote = getRoundQuotesForRun(run, index + 1).find((item) => item.id === assetId);
      return quote?.currentPrice;
    });
  };

  it("exposes gold and broad index assets to the simulation market", () => {
    expect(marketAssets.some((asset) => asset.id === "asset-gold")).toBe(true);
    expect(marketAssets.some((asset) => asset.id === "asset-index")).toBe(true);
  });

  it("keeps gold and index trajectories deterministic for the same seed", () => {
    expect(pathFor("asset-gold", 20260618)).toEqual(pathFor("asset-gold", 20260618));
    expect(pathFor("asset-index", 20260618)).toEqual(pathFor("asset-index", 20260618));
  });

  it("moves gold opposite stocks under a risk-off event", () => {
    const run = createInitialRun("student-risk-off", "class-pricing", "test", 20260618);
    const timeline = [...(run.eventTimeline ?? [])];
    timeline[8] = "event-global-recession-warning";
    run.eventTimeline = timeline;

    const quotes = getRoundQuotesForRun(run, 9);
    const stock = quotes.find((item) => item.id === "asset-stock");
    const gold = quotes.find((item) => item.id === "asset-gold");

    expect(stock).toBeDefined();
    expect(gold).toBeDefined();
    expect(stock!.currentPrice).toBeLessThan(stock!.basePrice);
    expect(gold!.currentPrice).toBeGreaterThan(gold!.basePrice);
  });

  it("does not make gold a risk-free appreciation path", () => {
    const path = pathFor("asset-gold", 20260618).filter((price): price is number => typeof price === "number");
    const deltas = path.slice(1).map((price, index) => price - path[index]);

    expect(deltas.some((delta) => delta > 0)).toBe(true);
    expect(deltas.some((delta) => delta < 0)).toBe(true);
  });
});
