import { describe, expect, it } from "vitest";

import { buildMarketBoardPayload } from "@/lib/market-watchlist";

// itest7 P3：兜底行情必须标 source="fallback"，前端据此渲染「教学示意·非真实行情」徽标——
// 这是明列必守的护栏（教学模式伪造行情不能对未成年学生显示得像真实报价）。此前该链路零测试：
// 回归让缺失行情时 source 不再落 "fallback"（如错误继承上次 provider 标志）无人拦截。

describe("兜底行情来源标注 (itest7 P3)", () => {
  it("无任何真实 quote → selected + 全部 watchlist 项 source 均为 'fallback'", () => {
    const payload = buildMarketBoardPayload();
    expect(payload.selected.source).toBe("fallback");
    for (const item of payload.watchlist) {
      expect(item.source).toBe("fallback");
    }
  });

  it("选中标的有真实 quote(带 currentPrice) → source 落真实 provider，不再是 fallback", () => {
    const payload = buildMarketBoardPayload({
      quotes: { MU: { source: "tsanghi", currentPrice: 123.45 } },
    });
    expect(payload.selected.symbol).toBe("MU");
    expect(payload.selected.source).toBe("tsanghi");
  });

  it("quote 存在但 currentPrice 缺失 → 仍判为 fallback（不被假 quote 蒙混成真实）", () => {
    const payload = buildMarketBoardPayload({
      quotes: { MU: { source: "tsanghi", currentPrice: null } },
    });
    expect(payload.selected.source).toBe("fallback");
  });
});
