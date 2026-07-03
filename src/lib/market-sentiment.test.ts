import { describe, expect, it } from "vitest";

import { computeMarketTemperature, computeMarketTemperatureFromMoves } from "@/lib/market-sentiment";
import { createInitialRun } from "@/lib/simulation";

describe("market sentiment temperature", () => {
  it("is deterministic for the same seed and round", () => {
    const first = createInitialRun("student-1", "class-1", "春季校内试点", 20260613);
    const second = createInitialRun("student-1", "class-1", "春季校内试点", 20260613);

    expect(computeMarketTemperature(first)).toEqual(computeMarketTemperature(second));
  });

  it("detects an overheated all-up market and shows a contrarian hint", () => {
    const payload = computeMarketTemperatureFromMoves([9, 8, 7, 6, 5], {
      liquidityBoost: 0.8,
      eventTitle: "追涨情绪快速扩散",
      eventSignal: "中性",
    });

    expect(payload.level).toBe("hot");
    expect(payload.score).toBeGreaterThanOrEqual(80);
    expect(payload.contrarianHint).toContain("别人贪婪我恐惧");
  });

  it("detects an extremely cold all-down market and keeps the lesson non-advisory", () => {
    const payload = computeMarketTemperatureFromMoves([-9, -8, -7, -6, -5], {
      liquidityBoost: 0,
      eventTitle: "恐慌性抛售蔓延",
      eventSignal: "利空",
    });

    expect(payload.level).toBe("cold");
    expect(payload.score).toBeLessThanOrEqual(25);
    expect(payload.contrarianHint).toContain("别人恐惧我先验证");
    expect(payload.summary).toContain("不代表真实买卖建议");
  });

  it("keeps a flat market in the balanced teaching zone", () => {
    const payload = computeMarketTemperatureFromMoves([0, 0, 0, 0, 0]);

    expect(payload.level).toBe("balanced");
    expect(payload.label).toBe("冷热均衡");
    expect(payload.summary).toContain("上涨占比 50%");
  });
});
