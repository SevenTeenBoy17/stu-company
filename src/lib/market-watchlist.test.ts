import { describe, expect, it } from "vitest";

import { MARKET_WATCHLIST_SYMBOLS, buildMarketBoardPayload, buildTickerTapeItems } from "@/lib/market-watchlist";

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
    expect(payload.selected.candles.length).toBeGreaterThanOrEqual(4);
    expect(payload.sectorPerformance).toHaveLength(6);
    expect(payload.contentCards).toHaveLength(4);
  });

  it("scores the ranking from each symbol's real series when provided (Tsanghi coherence)", () => {
    const steepUp = [100, 125, 155, 195, 245, 305, 375, 460];
    const driftDown = [100, 99, 98, 99, 98, 97, 98, 97];
    const seriesBySymbol = Object.fromEntries(
      MARKET_WATCHLIST_SYMBOLS.map((symbol) => [symbol, symbol === "MU" ? steepUp : driftDown]),
    );

    // MU 拿到一条陡升的真实走势、其余皆走平偏弱：评分器若真的吃了 seriesBySymbol，
    // MU 应被顶到排行第一（证明评分与真实现价同源，而非合成兜底曲线）。
    const withReal = buildMarketBoardPayload({ selectedSymbol: "NVDA", seriesBySymbol });
    expect(withReal.marketSummary[0]?.symbol).toBe("MU");

    // 不传 seriesBySymbol 时（回退合成曲线），MU 不会因这条走势登顶。
    const base = buildMarketBoardPayload({ selectedSymbol: "NVDA" });
    expect(base.marketSummary[0]?.symbol).not.toBe("MU");
  });
});
