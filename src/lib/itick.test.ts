import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalToken = process.env.ITICK_API_TOKEN;
const originalBaseUrl = process.env.ITICK_REST_BASE_URL;

describe("itick market helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.__itickPulseCache__ = undefined;
    globalThis.__itickWatchlistCache__ = undefined;
    globalThis.__itickBoardCache__ = undefined;
  });

  afterEach(() => {
    process.env.ITICK_API_TOKEN = originalToken;
    process.env.ITICK_REST_BASE_URL = originalBaseUrl;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("falls back cleanly when no token is configured", async () => {
    process.env.ITICK_API_TOKEN = "";
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const { fetchItickWatchlistSnapshot } = await import("@/lib/itick");
    const result = await fetchItickWatchlistSnapshot();

    expect(result.provider).toBe("fallback");
    expect(result.quotes).toEqual({});
    expect(result.note).toContain("iTick");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("normalizes quote and kline payloads from the iTick REST boundary", async () => {
    process.env.ITICK_API_TOKEN = "test-token";
    process.env.ITICK_REST_BASE_URL = "https://example.test";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));

        if (url.pathname.endsWith("/stock/kline")) {
          return Response.json({
            code: 0,
            data: [
              { t: 1713139200, o: 100, h: 106, l: 98, c: 104, v: 10_000 },
              { t: 1713225600, o: 104, h: 109, l: 103, c: 108, v: 11_000 },
              { t: 1713312000, o: 108, h: 112, l: 105, c: 107, v: 9_800 },
              { t: 1713398400, o: 107, h: 115, l: 106, c: 113, v: 13_200 },
            ],
          });
        }

        const code = url.searchParams.get("code") ?? "MU.US";
        const price = code.startsWith("MU") ? 439.15 : 128.88;
        return Response.json({
          code: 0,
          data: {
            code,
            latest_price: price,
            prev_close_price: price * 0.98,
          },
        });
      }),
    );

    const { fetchItickMarketBoardSnapshot } = await import("@/lib/itick");
    const result = await fetchItickMarketBoardSnapshot("MU");

    expect(result.provider).toBe("itick");
    expect(result.quotes.MU?.source).toBe("itick");
    expect(result.quotes.MU?.currentPrice).toBeCloseTo(439.15);
    expect(result.selectedCandles).toHaveLength(4);
    expect(result.selectedKline?.at(-1)).toBe(113);
  });
});
