import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildEventTimeline, makeRng, resolveEventChoice } from "@/lib/event-engine";
import { currentSeasonKey, currentSeasonSeed, seasonSeed } from "@/lib/season";

// TEST-STRATEGY §4 R3: the sandbox/season "reproducibility" promise is only real
// if the deterministic core never reads a hidden input (system clock or RNG).
// Two guards: (1) behavioural — same seed => same output; (2) static — the pure
// modules contain no Math.random()/new Date() (a regression here silently breaks
// teacher replay and leaderboard fairness).

describe("seeded determinism (R3 — replay reproducibility)", () => {
  it("makeRng yields an identical sequence for the same seed", () => {
    const a = makeRng(12_345);
    const b = makeRng(12_345);
    const seqA = Array.from({ length: 6 }, () => a());
    const seqB = Array.from({ length: 6 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("makeRng diverges for different seeds", () => {
    const a = makeRng(1);
    const b = makeRng(2);
    const seqA = Array.from({ length: 4 }, () => a());
    const seqB = Array.from({ length: 4 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it("buildEventTimeline is reproducible for a fixed seed", () => {
    expect(buildEventTimeline(777)).toEqual(buildEventTimeline(777));
  });

  it("resolveEventChoice is deterministic given the rng (exact cash consequences)", () => {
    const netWorth = 100_000; // stake = max(netWorth, 20000) = 100000
    expect(resolveEventChoice(netWorth, "hold", () => 0.5)).toEqual({ cashDelta: 0, tone: "hold" });
    expect(resolveEventChoice(netWorth, "protect", () => 0.5)).toEqual({
      cashDelta: -2_000, // -round(100000 * 0.02)
      tone: "protect",
    });
    expect(resolveEventChoice(netWorth, "gamble", () => 0.9)).toEqual({
      cashDelta: 22_000, // rng >= 0.5 -> win: round(100000 * 0.22)
      tone: "win",
    });
    expect(resolveEventChoice(netWorth, "gamble", () => 0.1)).toEqual({
      cashDelta: -18_000, // rng < 0.5 -> loss: round(100000 * -0.18)
      tone: "loss",
    });
  });

  it("season key/seed are deterministic and the clock is an injectable param", () => {
    const epoch = new Date(Date.UTC(2026, 0, 5)); // S0 (epoch Monday)
    const nextWeek = new Date(Date.UTC(2026, 0, 12)); // S1 (+7 days)
    expect(currentSeasonKey(epoch)).toBe("S0");
    expect(currentSeasonKey(nextWeek)).toBe("S1");
    expect(seasonSeed("S0")).toBe(seasonSeed("S0")); // pure
    expect(currentSeasonSeed(epoch)).toBe(seasonSeed("S0"));
    expect(currentSeasonSeed(epoch)).not.toBe(currentSeasonSeed(nextWeek));
  });
});

describe("forbidden non-determinism scan (R3 — clock/RNG must not leak into the core)", () => {
  // Strip comments first: event-engine.ts mentions `Math.random()` in a JSDoc
  // ("No Math.random()"), which is documentation, not a call.
  const stripComments = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const readCode = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), "utf8"));

  // These modules MUST be pure: randomness is the seeded mulberry32; time is
  // injected by callers, never read here.
  const pureCore = [
    "src/lib/event-engine.ts",
    "src/lib/market-sentiment.ts",
    "src/lib/leaderboard/ranking.ts",
    "src/lib/leaderboard/power-score.ts",
  ];

  for (const file of pureCore) {
    it(`${file} contains no Math.random() or new Date()`, () => {
      const code = readCode(file);
      expect(code).not.toMatch(/Math\.random\(/);
      expect(code).not.toMatch(/new Date\(/);
    });
  }

  it("season.ts uses no Math.random() (its new Date() is an injectable default only)", () => {
    expect(readCode("src/lib/season.ts")).not.toMatch(/Math\.random\(/);
  });
});
