import { eventCards } from "@/lib/market-data";
import type { AssetCategory, EventCard } from "@/lib/types";

/**
 * Seeded random-event engine for the 12-round sandbox.
 *
 * Goals (see docs/product-optimization-audit-2026-05-30.md §5.1 / 附录 B):
 *  - Reproducible per `seed` so a teacher can replay an identical class scenario.
 *  - Varied across runs so replaying the sandbox is not the same script every time.
 *  - Events actually move the market (impactAssets × impactRange × signal),
 *    so outcomes read as "was I prepared?" rather than "the script said so".
 *
 * All functions are pure. No `Math.random()` — randomness is seeded so runs are
 * reproducible and unit-testable.
 */

/** Deterministic PRNG (mulberry32). Returns a function yielding values in [0, 1). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Difficulty tier derived from existing card metadata (no schema churn):
 * black swan → 3; early stage → 1; late stage → 3; everything else → 2.
 */
export function eventTier(event: EventCard): 1 | 2 | 3 {
  if (event.category === "black_swan") return 3;
  if (event.stage === "early") return 1;
  if (event.stage === "late") return 3;
  return 2;
}

function shuffle<T>(rng: () => number, items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Build a deterministic per-round event timeline from a seed.
 * Difficulty curve: early third = tier 1 (gentle, no black swan), middle third =
 * tier 2, final third = tier 3 + tier 2 advanced cards (black swan may appear).
 */
export function buildEventTimeline(seed: number, totalRounds = 12): string[] {
  const rng = makeRng(seed);
  const tier1 = eventCards.filter((card) => eventTier(card) === 1);
  const tier2 = eventCards.filter((card) => eventTier(card) === 2);
  const tier3 = eventCards.filter((card) => eventTier(card) === 3);

  const seg = Math.max(1, Math.floor(totalRounds / 3));
  const earlyCount = seg;
  const midCount = seg;
  const lateCount = totalRounds - earlyCount - midCount;

  const used = new Set<string>();
  const take = (pool: EventCard[], count: number): string[] => {
    const out: string[] = [];
    for (const card of shuffle(rng, pool)) {
      if (out.length >= count) break;
      if (used.has(card.id)) continue;
      used.add(card.id);
      out.push(card.id);
    }
    // Defensive padding if a tier pool is too small to fill its segment.
    while (out.length < count && pool.length > 0) {
      out.push(shuffle(rng, pool)[0]!.id);
    }
    return out;
  };

  return [
    ...take(tier1, earlyCount),
    ...take(tier2, midCount),
    ...take([...tier3, ...tier2], lateCount),
  ];
}

const RANGE_MAGNITUDE: Record<NonNullable<EventCard["impactRange"]>, number> = {
  low: 0.03,
  medium: 0.07,
  high: 0.14,
};

const ALL_CATEGORIES: AssetCategory[] = ["stock", "etf", "bond", "commodity", "fx"];

/**
 * Per-category price multiplier contributed by an event. 利好 lifts impacted
 * assets, 利空 depresses them, 中性 and non-impacted categories stay neutral (1).
 * Magnitude scales with the card's impactRange.
 */
export function eventMarketEffect(event: EventCard, category: AssetCategory): number {
  const impacted = event.impactAssets ?? ALL_CATEGORIES;
  if (!impacted.includes(category)) return 1;
  if (event.signal === "中性") return 1;
  const magnitude = RANGE_MAGNITUDE[event.impactRange ?? "medium"];
  const direction = event.signal === "利好" ? 1 : -1;
  return 1 + direction * magnitude;
}

/** Resolve the event id for a round from a run's timeline, falling back when absent/out-of-range. */
export function eventIdForRound(
  timeline: string[] | undefined,
  round: number,
  fallback: string,
): string {
  if (!timeline) return fallback;
  return timeline[round - 1] ?? fallback;
}
