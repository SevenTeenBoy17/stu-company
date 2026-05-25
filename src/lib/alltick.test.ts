import { afterEach, describe, expect, it } from "vitest";

import { fetchAlltickMarketPulse, fetchWatchlistSnapshot } from "@/lib/alltick";

const originalKey = process.env.ALLTICK_API_KEY;

describe("alltick market helpers", () => {
  afterEach(() => {
    process.env.ALLTICK_API_KEY = originalKey;
    globalThis.__alltickPulseCache__ = undefined;
    globalThis.__alltickWatchlistCache__ = undefined;
    globalThis.__alltickBoardCache__ = undefined;
  });

  it("falls back cleanly when no token is configured", async () => {
    process.env.ALLTICK_API_KEY = "";

    const result = await fetchWatchlistSnapshot();

    expect(result.provider).toBe("fallback");
    expect(result.quotes).toEqual({});
    expect(result.note).toContain("AllTick");
  });

  it("keeps the legacy market pulse compatible during fallback", async () => {
    process.env.ALLTICK_API_KEY = "";

    const result = await fetchAlltickMarketPulse();

    expect(result.signals).toHaveLength(0);
    expect(result.note).toContain("AllTick");
  });
});
