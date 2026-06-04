import { describe, expect, it } from "vitest";

import { PROVINCES } from "./regions.data";
import {
  citiesOf,
  isValidCity,
  isValidProvince,
  provinceOfCity,
  provinces,
  regionLabel,
} from "./regions";

describe("region dataset integrity", () => {
  it("every city code is unique and prefixed by its province code", () => {
    const seen = new Set<string>();
    for (const p of PROVINCES) {
      expect(p.code).toHaveLength(2);
      for (const c of p.cities) {
        expect(c.code.startsWith(p.code)).toBe(true);
        expect(seen.has(c.code)).toBe(false);
        seen.add(c.code);
      }
    }
  });
});

describe("provinces / citiesOf", () => {
  it("lists provinces and their cities", () => {
    expect(provinces().length).toBeGreaterThan(0);
    const sichuanCities = citiesOf("51").map((c) => c.name);
    expect(sichuanCities).toContain("成都市");
  });

  it("returns an empty list for an unknown province", () => {
    expect(citiesOf("99")).toEqual([]);
  });
});

describe("validation (decision 2: structured, not free text)", () => {
  it("accepts a city that belongs to its province", () => {
    expect(isValidProvince("51")).toBe(true);
    expect(isValidCity("51", "5101")).toBe(true);
  });

  it("rejects a city that does not belong to the given province", () => {
    expect(isValidCity("44", "5101")).toBe(false); // 成都 is not in 广东
  });

  it("rejects unknown codes", () => {
    expect(isValidProvince("99")).toBe(false);
    expect(isValidCity("51", "9999")).toBe(false);
  });
});

describe("provinceOfCity / regionLabel", () => {
  it("maps a city back to its province", () => {
    expect(provinceOfCity("5101")).toBe("51");
    expect(provinceOfCity("9999")).toBeUndefined();
  });

  it("builds a human label", () => {
    expect(regionLabel("51", "5101")).toBe("四川省 · 成都市");
    expect(regionLabel("51")).toBe("四川省");
  });
});
