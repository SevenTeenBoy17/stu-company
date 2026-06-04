import { describe, expect, it } from "vitest";

import {
  POWER_TIERS,
  applySoftFloor,
  nextTierGap,
  powerToNextTier,
  tierFromPower,
  tierInfo,
} from "./tiers";

describe("tierFromPower", () => {
  it("maps power to the 6 tiers at the thresholds", () => {
    expect(tierFromPower(0)).toBe(1);
    expect(tierFromPower(399)).toBe(1);
    expect(tierFromPower(400)).toBe(2);
    expect(tierFromPower(800)).toBe(3);
    expect(tierFromPower(1199)).toBe(3);
    expect(tierFromPower(1200)).toBe(4);
    expect(tierFromPower(1600)).toBe(5);
    expect(tierFromPower(1899)).toBe(5);
    expect(tierFromPower(1900)).toBe(6);
    expect(tierFromPower(2000)).toBe(6);
  });

  it("clamps below zero to tier 1", () => {
    expect(tierFromPower(-50)).toBe(1);
  });
});

describe("tierInfo", () => {
  it("returns the themed Chinese names", () => {
    expect(tierInfo(1).name).toBe("理财新手");
    expect(tierInfo(4).name).toBe("策略大师");
    expect(tierInfo(6).name).toBe("巅峰名人堂");
  });

  it("has 6 strictly-ascending tiers", () => {
    expect(POWER_TIERS).toHaveLength(6);
    for (let i = 1; i < POWER_TIERS.length; i++) {
      expect(POWER_TIERS[i].min).toBeGreaterThan(POWER_TIERS[i - 1].min);
    }
  });
});

describe("powerToNextTier", () => {
  it("returns the gap to the next tier", () => {
    expect(powerToNextTier(350)).toBe(50); // 400 - 350
    expect(powerToNextTier(1199)).toBe(1); // 1200 - 1199
  });

  it("returns 0 at the top tier", () => {
    expect(powerToNextTier(1950)).toBe(0);
  });
});

describe("nextTierGap (relative to the displayed/floor-held tier)", () => {
  it("measures from the tier above the displayed tier", () => {
    // normal: power 1411 displayed as tier 4 -> gap to tier 5 (1600)
    expect(nextTierGap(1411, 4)).toBe(189);
  });

  it("uses the displayed tier even when the soft floor holds it above raw power", () => {
    // floor-held: power 842 (raw tier 3) but displayed tier 4 -> gap to tier 5
    expect(nextTierGap(842, 4)).toBe(758); // 1600 - 842, NOT 1200 - 842
  });

  it("returns 0 at the top displayed tier", () => {
    expect(nextTierGap(1950, 6)).toBe(0);
  });
});

describe("applySoftFloor (decision 7: minors never drop tier within a season)", () => {
  it("never lowers the tier", () => {
    expect(applySoftFloor(4, 3)).toBe(4);
    expect(applySoftFloor(4, 4)).toBe(4);
  });

  it("allows promotion", () => {
    expect(applySoftFloor(2, 5)).toBe(5);
  });
});
