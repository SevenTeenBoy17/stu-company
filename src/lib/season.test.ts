import { describe, expect, it } from "vitest";

import { currentSeasonKey, seasonSeed } from "@/lib/season";

describe("season", () => {
  it("returns the same key within a week and a different key across weeks", () => {
    const monday = new Date("2026-05-25T00:00:00Z");
    const sameWeek = new Date("2026-05-28T12:00:00Z");
    const nextWeek = new Date("2026-06-02T00:00:00Z");
    expect(currentSeasonKey(monday)).toBe(currentSeasonKey(sameWeek));
    expect(currentSeasonKey(monday)).not.toBe(currentSeasonKey(nextWeek));
  });

  it("derives a deterministic positive seed from a season key", () => {
    const key = currentSeasonKey(new Date("2026-05-25T00:00:00Z"));
    const seed = seasonSeed(key);
    expect(seed).toBe(seasonSeed(key));
    expect(seed).toBeGreaterThan(0);
    expect(Number.isInteger(seed)).toBe(true);
  });

  it("gives different weeks different season seeds", () => {
    const a = seasonSeed(currentSeasonKey(new Date("2026-05-25T00:00:00Z")));
    const b = seasonSeed(currentSeasonKey(new Date("2026-06-02T00:00:00Z")));
    expect(a).not.toBe(b);
  });
});
