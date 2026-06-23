import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalToken = process.env.TSANGHI_API_TOKEN;
const originalBaseUrl = process.env.TSANGHI_REST_BASE_URL;

// 沧海 daily 返回的 4 根（故意打乱顺序，验证 provider 会在客户端按 date 升序排序）。
const SHUFFLED_DAILY = {
  msg: "操作成功",
  code: 200,
  data: [
    { ticker: "X", date: "2026-06-03", open: 108, high: 112, low: 105, close: 110, volume: 9_800 },
    { ticker: "X", date: "2026-06-01", open: 100, high: 106, low: 98, close: 104, volume: 10_000 },
    { ticker: "X", date: "2026-06-05", open: 110, high: 115, low: 106, close: 113, volume: 13_200 },
    { ticker: "X", date: "2026-06-02", open: 104, high: 109, low: 103, close: 108, volume: 11_000 },
  ],
};

function okDaily(close: number, prev: number) {
  return {
    msg: "操作成功",
    code: 200,
    data: [
      { ticker: "X", date: "2026-06-19", open: prev, high: prev + 2, low: prev - 2, close: prev, volume: 10_000 },
      { ticker: "X", date: "2026-06-22", open: prev, high: close + 2, low: prev - 2, close, volume: 12_000 },
    ],
  };
}

const tickerOf = (input: RequestInfo | URL) => new URL(String(input)).searchParams.get("ticker");

describe("tsanghi market helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.__tsanghiPulseCache__ = undefined;
    globalThis.__tsanghiWatchlistCache__ = undefined;
    globalThis.__tsanghiBoardCache__ = undefined;
  });

  afterEach(() => {
    process.env.TSANGHI_API_TOKEN = originalToken;
    process.env.TSANGHI_REST_BASE_URL = originalBaseUrl;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("falls back cleanly when no token is configured (no network call)", async () => {
    process.env.TSANGHI_API_TOKEN = "";
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const { fetchTsanghiWatchlistSnapshot } = await import("@/lib/tsanghi");
    const result = await fetchTsanghiWatchlistSnapshot();

    expect(result.provider).toBe("fallback");
    expect(result.quotes).toEqual({});
    expect(result.note).toContain("沧海");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("derives quote + sorted kline from shuffled daily bars", async () => {
    process.env.TSANGHI_API_TOKEN = "test-token";
    process.env.TSANGHI_REST_BASE_URL = "https://example.test/api/fin";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        if (url.pathname.includes("/daily")) return Response.json(SHUFFLED_DAILY);
        return Response.json({ code: 3002, msg: "参数异常", data: null });
      }),
    );

    const { fetchTsanghiMarketBoardSnapshot } = await import("@/lib/tsanghi");
    const result = await fetchTsanghiMarketBoardSnapshot("MU");

    expect(result.provider).toBe("tsanghi");
    expect(result.quotes.MU?.source).toBe("tsanghi");
    expect(result.quotes.MU?.currentPrice).toBe(113);
    expect(result.quotes.MU?.changePercent).toBeCloseTo(2.7273, 3);
    expect(result.selectedCandles).toHaveLength(4);
    expect(result.selectedCandles?.[0].close).toBe(104);
    expect(result.selectedKline?.at(-1)).toBe(113);
    expect(result.staticInfo?.exchange).toBe("NASDAQ");
    // asOf 应反映「最新交易日」(最后一根 candle 的日期) 而非拉取时刻。
    expect(result.asOf.slice(0, 10)).toBe("2026-06-05");
  });

  it("treats a permission error (3003) as a fallback, not live data", async () => {
    process.env.TSANGHI_API_TOKEN = "test-token";
    process.env.TSANGHI_REST_BASE_URL = "https://example.test/api/fin";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ code: 3003, msg: "权限不足，请升级套餐", data: null })),
    );

    const { fetchTsanghiWatchlistSnapshot } = await import("@/lib/tsanghi");
    const result = await fetchTsanghiWatchlistSnapshot();

    expect(result.provider).toBe("fallback");
    expect(result.quotes).toEqual({});
  });

  it("marks the provider hybrid when only some symbols return data", async () => {
    process.env.TSANGHI_API_TOKEN = "test-token";
    process.env.TSANGHI_REST_BASE_URL = "https://example.test/api/fin";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        // only MSFT returns valid bars; everyone else is a parameter error
        if (tickerOf(input) === "MSFT") return Response.json(okDaily(367, 379));
        return Response.json({ code: 3002, msg: "参数异常", data: null });
      }),
    );

    const { fetchTsanghiWatchlistSnapshot } = await import("@/lib/tsanghi");
    const result = await fetchTsanghiWatchlistSnapshot();

    expect(result.provider).toBe("hybrid");
    expect(Object.keys(result.quotes)).toEqual(["MSFT"]);
    expect(result.quotes.MSFT?.currentPrice).toBe(367);
  });

  it("treats code:200 with empty data[] as a per-symbol failure → fallback", async () => {
    process.env.TSANGHI_API_TOKEN = "test-token";
    process.env.TSANGHI_REST_BASE_URL = "https://example.test/api/fin";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ code: 200, msg: "操作成功", data: [] })),
    );

    const { fetchTsanghiWatchlistSnapshot } = await import("@/lib/tsanghi");
    const result = await fetchTsanghiWatchlistSnapshot();

    expect(result.provider).toBe("fallback");
    expect(result.quotes).toEqual({});
  });

  it("falls back without throwing when the network rejects (timeout/abort)", async () => {
    process.env.TSANGHI_API_TOKEN = "test-token";
    process.env.TSANGHI_REST_BASE_URL = "https://example.test/api/fin";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("aborted", "AbortError");
      }),
    );

    const { fetchTsanghiWatchlistSnapshot } = await import("@/lib/tsanghi");
    const result = await fetchTsanghiWatchlistSnapshot();

    expect(result.provider).toBe("fallback");
    expect(result.quotes).toEqual({});
  });

  it("serves the second call from cache without re-fetching", async () => {
    process.env.TSANGHI_API_TOKEN = "test-token";
    process.env.TSANGHI_REST_BASE_URL = "https://example.test/api/fin";

    const fetchMock = vi.fn(async () => Response.json(okDaily(208, 210)));
    vi.stubGlobal("fetch", fetchMock);

    const { fetchTsanghiWatchlistSnapshot } = await import("@/lib/tsanghi");
    const first = await fetchTsanghiWatchlistSnapshot();
    const callsAfterFirst = fetchMock.mock.calls.length;
    const second = await fetchTsanghiWatchlistSnapshot();

    expect(first.provider).toBe("tsanghi");
    expect(second).toBe(first); // same cached object
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst); // no extra fetch
  });

  it("market pulse returns empty signals on fallback and tsanghi signals when live", async () => {
    process.env.TSANGHI_API_TOKEN = "test-token";
    process.env.TSANGHI_REST_BASE_URL = "https://example.test/api/fin";

    vi.stubGlobal("fetch", vi.fn(async () => Response.json(okDaily(208, 210))));
    const live = await import("@/lib/tsanghi");
    const pulse = await live.fetchTsanghiMarketPulse();
    expect(pulse.signals.length).toBe(3);
    expect(pulse.signals.every((s) => s.source === "tsanghi")).toBe(true);
    expect(pulse.signals.map((s) => s.key).sort()).toEqual(["msft", "nvda", "tsm"]);
  });

  it("degrades the board to non-tsanghi when fewer than 4 kline bars are available", async () => {
    process.env.TSANGHI_API_TOKEN = "test-token";
    process.env.TSANGHI_REST_BASE_URL = "https://example.test/api/fin";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          msg: "操作成功",
          code: 200,
          data: [
            { ticker: "X", date: "2026-06-20", open: 1, high: 2, low: 0.5, close: 1.5, volume: 1 },
            { ticker: "X", date: "2026-06-21", open: 1.5, high: 2, low: 1, close: 1.8, volume: 1 },
            { ticker: "X", date: "2026-06-22", open: 1.8, high: 2.2, low: 1.6, close: 2.0, volume: 1 },
          ],
        }),
      ),
    );

    const { fetchTsanghiMarketBoardSnapshot } = await import("@/lib/tsanghi");
    const result = await fetchTsanghiMarketBoardSnapshot("NVDA");

    expect(result.provider).not.toBe("tsanghi");
    expect(result.selectedCandles).toBeUndefined();
    expect(result.selectedKline).toBeUndefined();
  });

  it("falls back on an HTTP error status (502) without throwing", async () => {
    process.env.TSANGHI_API_TOKEN = "test-token";
    process.env.TSANGHI_REST_BASE_URL = "https://example.test/api/fin";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ msg: "bad gateway" }, { status: 502 })),
    );

    const { fetchTsanghiWatchlistSnapshot } = await import("@/lib/tsanghi");
    const result = await fetchTsanghiWatchlistSnapshot();

    expect(result.provider).toBe("fallback");
    expect(result.quotes).toEqual({});
  });

  it("board provider is fallback when watchlist and kline both fail", async () => {
    process.env.TSANGHI_API_TOKEN = "test-token";
    process.env.TSANGHI_REST_BASE_URL = "https://example.test/api/fin";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ code: 3003, msg: "权限不足", data: null })),
    );

    const { fetchTsanghiMarketBoardSnapshot } = await import("@/lib/tsanghi");
    const result = await fetchTsanghiMarketBoardSnapshot("MU");

    expect(result.provider).toBe("fallback");
    expect(result.selectedCandles).toBeUndefined();
  });

  it("returns a null changePercent when the previous close is 0 (no divide-by-zero)", async () => {
    process.env.TSANGHI_API_TOKEN = "test-token";
    process.env.TSANGHI_REST_BASE_URL = "https://example.test/api/fin";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          msg: "操作成功",
          code: 200,
          data: [
            { ticker: "X", date: "2026-06-19", open: 0, high: 0, low: 0, close: 0, volume: 1 },
            { ticker: "X", date: "2026-06-22", open: 0, high: 100, low: 0, close: 100, volume: 1 },
          ],
        }),
      ),
    );

    const { fetchTsanghiWatchlistSnapshot } = await import("@/lib/tsanghi");
    const result = await fetchTsanghiWatchlistSnapshot();

    expect(result.quotes.MU?.currentPrice).toBe(100);
    expect(result.quotes.MU?.changePercent).toBeNull();
  });
});
