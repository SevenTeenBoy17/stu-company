import { describe, expect, it } from "vitest";

import { buildMarketBoardPayload, buildTickerTapeItems } from "@/lib/market-watchlist";

describe("market watchlist builders", () => {
  it("builds a complete ticker tape for the fixed watchlist", () => {
    const items = buildTickerTapeItems();

    expect(items).toHaveLength(10);
    expect(items[0]?.symbol).toBe("MU");
    expect(items.at(-1)?.symbol).toBe("TSM");
  });

  it("builds a stable market board payload", () => {
    const payload = buildMarketBoardPayload({ selectedSymbol: "MU" });

    expect(payload.selected.symbol).toBe("MU");
    expect(payload.watchlist).toHaveLength(10);
    expect(payload.selected.metrics).toHaveLength(6);
    expect(payload.sectorPerformance).toHaveLength(6);
    expect(payload.contentCards).toHaveLength(4);
  });
});
