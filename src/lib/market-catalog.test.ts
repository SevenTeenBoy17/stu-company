import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CN_INSTRUMENTS,
  FUND_INSTRUMENTS,
  HK_INSTRUMENTS,
  MARKET_CATEGORY_ORDER,
  industryImagePath,
} from "@/lib/market-catalog";
import {
  MARKET_CATALOG,
  buildCategoryBoardPayload,
  getCategoryInstruments,
  resolveCategoryInstrumentId,
  resolveMarketCategory,
} from "@/lib/market-watchlist";

describe("market catalog", () => {
  it("exposes four categories with non-empty, uniquely-identified instruments", () => {
    expect(MARKET_CATEGORY_ORDER).toEqual(["us", "cn", "hk", "fund"]);
    const allIds = MARKET_CATEGORY_ORDER.flatMap((category) =>
      getCategoryInstruments(category).map((instrument) => instrument.id),
    );
    expect(allIds.length).toBe(new Set(allIds).size); // 跨分类 id 无碰撞
    expect(getCategoryInstruments("us")).toHaveLength(10);
    expect(CN_INSTRUMENTS.length).toBeGreaterThanOrEqual(6);
    expect(HK_INSTRUMENTS.length).toBeGreaterThanOrEqual(6);
    expect(FUND_INSTRUMENTS.length).toBeGreaterThanOrEqual(6);
  });

  it("ships an industry image for every instrument's industryKey", () => {
    const publicDir = join(process.cwd(), "public");
    for (const category of MARKET_CATEGORY_ORDER) {
      for (const instrument of getCategoryInstruments(category)) {
        const rel = industryImagePath(instrument.industryKey).replace(/^\//, "");
        expect(existsSync(join(publicDir, rel)), `missing image for ${instrument.id} (${rel})`).toBe(true);
      }
    }
  });

  it("non-US instruments carry sane routing for the Tsanghi daily endpoint", () => {
    for (const instrument of [...CN_INSTRUMENTS, ...HK_INSTRUMENTS, ...FUND_INSTRUMENTS]) {
      expect(["stock", "etf"]).toContain(instrument.kind);
      expect(instrument.exchange).toMatch(/^X[A-Z]{3}$/);
      expect(instrument.ticker.length).toBeGreaterThan(0);
      expect(instrument.fallbackPrice).toBeGreaterThan(0);
      expect(instrument.fallbackSeries.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("builds a coherent board payload for every category", () => {
    for (const category of MARKET_CATEGORY_ORDER) {
      const payload = buildCategoryBoardPayload(category);
      const instruments = MARKET_CATALOG[category];
      expect(payload.category).toBe(category);
      expect(payload.categories).toHaveLength(4);
      expect(payload.categories.every((tab) => tab.defaultSymbol.length > 0)).toBe(true);
      expect(payload.watchlist).toHaveLength(instruments.length);
      // 默认选中该分类首个标的，且详情带行业示意图与币种。
      expect(payload.selected.symbol).toBe(instruments[0].id);
      expect(payload.selected.imageUrl).toBe(industryImagePath(instruments[0].industryKey));
      expect(payload.selected.currency).toBe(instruments[0].currency);
      expect(payload.selected.metrics).toHaveLength(6);
      expect(payload.selected.candles.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("resolves categories and instrument ids defensively", () => {
    expect(resolveMarketCategory("HK")).toBe("hk");
    expect(resolveMarketCategory("nope")).toBe("us");
    expect(resolveMarketCategory(undefined)).toBe("us");
    expect(resolveCategoryInstrumentId("cn", "600519")).toBe("600519");
    expect(resolveCategoryInstrumentId("hk", "0700")).toBe("0700");
    // 非法 symbol → 回退该分类首个标的，而不是抛错。
    expect(resolveCategoryInstrumentId("fund", "not-a-ticker")).toBe(getCategoryInstruments("fund")[0].id);
  });

  it("honors an explicit selection within a category", () => {
    const payload = buildCategoryBoardPayload("hk", { selectedSymbol: "0700" });
    expect(payload.selected.symbol).toBe("0700");
    expect(payload.selected.name).toBe("腾讯控股");
  });
});
