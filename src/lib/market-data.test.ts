import { beforeEach, describe, expect, it, vi } from "vitest";

import { eventTier } from "@/lib/event-engine";
import { eventCards, getMarketBoardPayload } from "@/lib/market-data";

vi.mock("@/lib/tsanghi", () => ({
  fetchTsanghiMarketBoardSnapshot: vi.fn(),
}));
vi.mock("@/lib/itick", () => ({
  fetchItickMarketBoardSnapshot: vi.fn(),
}));
vi.mock("@/lib/alltick", () => ({
  fetchMarketBoardSnapshot: vi.fn(),
}));

import { fetchMarketBoardSnapshot } from "@/lib/alltick";
import { fetchItickMarketBoardSnapshot } from "@/lib/itick";
import { fetchTsanghiMarketBoardSnapshot } from "@/lib/tsanghi";

type AlltickBoard = Awaited<ReturnType<typeof fetchMarketBoardSnapshot>>;
type ItickBoard = Awaited<ReturnType<typeof fetchItickMarketBoardSnapshot>>;
type TsanghiBoard = Awaited<ReturnType<typeof fetchTsanghiMarketBoardSnapshot>>;

const NEW_ADVANCED_CARD_IDS = [
  "event-dividend-payout",
  "event-stock-split",
  "event-rate-hike",
  "event-leverage-temptation",
  "event-currency-devaluation",
  "event-ponzi-scheme",
  "event-short-squeeze",
  "event-bank-run",
  "event-regulation-hammer",
  "event-corporate-default",
  "event-bankruptcy-zero",
  "event-geopolitical-shock",
  "event-capital-gains-tax",
  "event-v-recovery",
];

describe("event card library (E4 expansion)", () => {
  it("has an expanded library of at least 38 cards", () => {
    expect(eventCards.length).toBeGreaterThanOrEqual(38);
  });

  it("includes the new advanced teaching cards", () => {
    const ids = new Set(eventCards.map((card) => card.id));
    for (const id of NEW_ADVANCED_CARD_IDS) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("has unique card ids", () => {
    const ids = eventCards.map((card) => card.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps a healthy tier distribution for the 12-round difficulty curve", () => {
    const tier1 = eventCards.filter((card) => eventTier(card) === 1).length;
    const tier3 = eventCards.filter((card) => eventTier(card) === 3).length;
    // tier1 fills gentle rounds 1-4 (no repeats); tier3 fills advanced 9-12.
    expect(tier1).toBeGreaterThanOrEqual(5);
    expect(tier3).toBeGreaterThanOrEqual(6);
  });

  it("gives every card the teaching metadata the engine relies on", () => {
    for (const card of eventCards) {
      expect(card.teachingConcept, card.id).toBeTruthy();
      expect(card.impactAssets?.length, card.id).toBeTruthy();
      expect(card.impactRange, card.id).toBeTruthy();
      expect(card.stage, card.id).toBeTruthy();
    }
  });
});

describe("getMarketBoardPayload — live-AllTick chart source consistency", () => {
  // AllTick 实时在线、沧海/iTick 均回退时的看板路径。
  // AllTick 的看板快照只暴露收盘序列（selectedKline），没有 OHLC 蜡烛，
  // 所以蜡烛必须由 AllTick 自己的序列合成，绝不能借用 iTick 快照里的蜡烛——
  // 否则折线（AllTick）与蜡烛实体（iTick）会来自不同数据源而互相打架。
  const ALLTICK_SERIES = [10, 11, 12, 13, 14, 15];
  // iTick 回退快照里携带的“外源”哨兵蜡烛：收盘 999，与 AllTick 序列完全不同。
  const ITICK_SENTINEL_CANDLES = Array.from({ length: 4 }, (_, index) => ({
    time: `2026-01-0${index + 1}T00:00:00.000Z`,
    open: 999,
    high: 1000,
    low: 998,
    close: 999,
  }));

  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(fetchTsanghiMarketBoardSnapshot).mockResolvedValue({
      asOf: "2026-01-06T00:00:00.000Z",
      provider: "fallback",
      note: "",
      quotes: {},
    } as TsanghiBoard);

    vi.mocked(fetchItickMarketBoardSnapshot).mockResolvedValue({
      asOf: "2026-01-06T00:00:00.000Z",
      provider: "fallback",
      note: "",
      quotes: {},
      selectedKline: [999, 999, 999, 999, 999, 999],
      selectedCandles: ITICK_SENTINEL_CANDLES,
    } as ItickBoard);

    vi.mocked(fetchMarketBoardSnapshot).mockResolvedValue({
      asOf: "2026-01-06T00:00:00.000Z",
      provider: "alltick",
      note: "",
      quotes: {},
      selectedKline: ALLTICK_SERIES,
    } as AlltickBoard);
  });

  it("derives candlesticks from AllTick's own series, never the iTick snapshot", async () => {
    const board = await getMarketBoardPayload("MU");

    // 折线来自 AllTick 序列。
    expect(board.selected.miniSeries).toEqual(ALLTICK_SERIES);

    // 蜡烛实体与折线同源：由 AllTick 序列合成（收盘 == 序列值），而非 iTick 哨兵。
    const closes = board.selected.candles.map((candle) => candle.close);
    expect(closes).toEqual(ALLTICK_SERIES);
    expect(closes).not.toContain(999);
  });
});
