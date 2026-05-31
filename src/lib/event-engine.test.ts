import { describe, expect, it } from "vitest";

import {
  buildEventTimeline,
  eventIdForRound,
  eventMarketEffect,
  eventTier,
  makeRng,
  resolveEventChoice,
} from "@/lib/event-engine";
import { eventCards } from "@/lib/market-data";
import type { EventCard } from "@/lib/types";

function cardById(id: string): EventCard {
  const card = eventCards.find((event) => event.id === id);
  if (!card) throw new Error(`missing test fixture card: ${id}`);
  return card;
}

describe("makeRng", () => {
  it("is deterministic for the same seed", () => {
    const a = makeRng(12345);
    const b = makeRng(12345);
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = makeRng(1);
    const b = makeRng(2);
    expect(a()).not.toEqual(b());
  });

  it("returns values in [0, 1)", () => {
    const rng = makeRng(99);
    for (let i = 0; i < 200; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("eventTier", () => {
  it("classifies black swan events as tier 3", () => {
    expect(eventTier(cardById("event-liquidity-crisis"))).toBe(3);
  });

  it("classifies early-stage macro events as tier 1", () => {
    expect(eventTier(cardById("event-rate-cut"))).toBe(1);
  });

  it("classifies middle-stage events as tier 2", () => {
    expect(eventTier(cardById("event-fomo-spread"))).toBe(2);
  });
});

describe("buildEventTimeline", () => {
  it("produces one event per round", () => {
    expect(buildEventTimeline(42, 12)).toHaveLength(12);
  });

  it("is reproducible for the same seed", () => {
    expect(buildEventTimeline(7, 12)).toEqual(buildEventTimeline(7, 12));
  });

  it("varies across seeds", () => {
    const a = buildEventTimeline(1, 12);
    const b = buildEventTimeline(2, 12);
    expect(a).not.toEqual(b);
  });

  it("only references events that exist", () => {
    const ids = new Set(eventCards.map((card) => card.id));
    for (const id of buildEventTimeline(123, 12)) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("keeps rounds 1-4 at tier 1 (gentle, no black swan early)", () => {
    const timeline = buildEventTimeline(123, 12);
    for (let round = 1; round <= 4; round++) {
      const card = cardById(timeline[round - 1]);
      expect(eventTier(card)).toBe(1);
      expect(card.category).not.toBe("black_swan");
    }
  });

  it("does not repeat events within the early tier window", () => {
    const timeline = buildEventTimeline(555, 12);
    const earlyFour = timeline.slice(0, 4);
    expect(new Set(earlyFour).size).toBe(4);
  });
});

describe("eventMarketEffect", () => {
  it("pushes an impacted category up for a bullish (利好) event", () => {
    const effect = eventMarketEffect(cardById("event-surprise-policy-pivot"), "stock");
    expect(effect).toBeGreaterThan(1);
  });

  it("pushes an impacted category down for a bearish (利空) event", () => {
    const effect = eventMarketEffect(cardById("event-liquidity-crisis"), "stock");
    expect(effect).toBeLessThan(1);
  });

  it("leaves non-impacted categories unchanged", () => {
    // liquidity-crisis impacts stock/etf/bond/fx but not commodity
    expect(eventMarketEffect(cardById("event-liquidity-crisis"), "commodity")).toBe(1);
  });

  it("scales magnitude with impact range (high deviates more than low)", () => {
    const high = eventMarketEffect(cardById("event-surprise-policy-pivot"), "stock"); // 利好 high
    const low = eventMarketEffect(cardById("event-consumer-recovery"), "stock"); // 利好 low
    expect(high - 1).toBeGreaterThan(low - 1);
  });
});

describe("resolveEventChoice", () => {
  it("a 'hold' choice changes nothing", () => {
    const result = resolveEventChoice(120_000, "hold", makeRng(1));
    expect(result.cashDelta).toBe(0);
    expect(result.tone).toBe("hold");
  });

  it("a 'protect' choice costs a small, bounded amount", () => {
    const result = resolveEventChoice(120_000, "protect", makeRng(1));
    expect(result.cashDelta).toBeLessThan(0);
    expect(Math.abs(result.cashDelta)).toBeLessThanOrEqual(120_000 * 0.05);
    expect(result.tone).toBe("protect");
  });

  it("a 'gamble' choice is high-variance and bigger than protecting", () => {
    const protect = Math.abs(resolveEventChoice(120_000, "protect", makeRng(1)).cashDelta);
    const gamble = Math.abs(resolveEventChoice(120_000, "gamble", makeRng(1)).cashDelta);
    expect(gamble).toBeGreaterThan(protect);
  });

  it("is reproducible for the same seed and varies across seeds", () => {
    const a = resolveEventChoice(120_000, "gamble", makeRng(7));
    const b = resolveEventChoice(120_000, "gamble", makeRng(7));
    expect(a).toEqual(b);
    // across many seeds a gamble produces both wins and losses
    const tones = new Set(
      Array.from({ length: 12 }, (_, i) => resolveEventChoice(120_000, "gamble", makeRng(i + 1)).tone),
    );
    expect(tones.has("win")).toBe(true);
    expect(tones.has("loss")).toBe(true);
  });

  it("never rewards an indebted (negative net worth) player — protect stays a cost", () => {
    const protectNeg = resolveEventChoice(-50_000, "protect", makeRng(1));
    expect(protectNeg.cashDelta).toBeLessThanOrEqual(0);
    const protectZero = resolveEventChoice(0, "protect", makeRng(1));
    expect(protectZero.cashDelta).toBeLessThanOrEqual(0);
  });

  it("keeps a gamble's cash delta sign aligned with its tone for any net worth", () => {
    for (const nw of [-80_000, 0, 50_000, 200_000]) {
      for (let s = 1; s <= 6; s++) {
        const result = resolveEventChoice(nw, "gamble", makeRng(s));
        if (result.tone === "win") expect(result.cashDelta).toBeGreaterThan(0);
        if (result.tone === "loss") expect(result.cashDelta).toBeLessThan(0);
      }
    }
  });
});

describe("eventIdForRound", () => {
  it("returns the timeline event for the round", () => {
    expect(eventIdForRound(["a", "b", "c"], 2, "fallback")).toBe("b");
  });

  it("falls back when no timeline is present", () => {
    expect(eventIdForRound(undefined, 2, "fallback")).toBe("fallback");
  });

  it("falls back when the round is out of range", () => {
    expect(eventIdForRound(["a", "b"], 9, "fallback")).toBe("fallback");
  });
});
