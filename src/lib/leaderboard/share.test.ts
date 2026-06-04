import { describe, expect, it } from "vitest";

import { buildPowerShareText } from "./share";

describe("buildPowerShareText", () => {
  it("includes power, tier, and every available rank", () => {
    const text = buildPowerShareText({
      power: 1411,
      tierName: "策略大师",
      ranks: { school: 1, city: 2, province: 3, nation: 5 },
    });
    expect(text).toContain("1411（策略大师）");
    expect(text).toContain("校内第 1");
    expect(text).toContain("全国第 5");
    expect(text).toContain("决策质量"); // anti-YOLO framing
  });

  it("omits missing ranks and falls back to an encouraging line", () => {
    const text = buildPowerShareText({ power: 600, tierName: "稳健学徒", ranks: {} });
    expect(text).not.toContain("第");
    expect(text).toContain("目标冲段位");
  });

  it("keeps only the ranks that are present", () => {
    const text = buildPowerShareText({ power: 900, tierName: "精明投资者", ranks: { school: 2 } });
    expect(text).toContain("校内第 2");
    expect(text).not.toContain("全国第");
  });
});
