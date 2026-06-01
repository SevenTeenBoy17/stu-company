import { describe, expect, it } from "vitest";

import { currentSeasonKey } from "@/lib/season";

import { monthlyKey, periodKey, semesterKey } from "./periods";

describe("monthlyKey", () => {
  it("formats UTC year-month", () => {
    expect(monthlyKey(new Date(Date.UTC(2026, 5, 1)))).toBe("2026-06");
    expect(monthlyKey(new Date(Date.UTC(2026, 0, 31)))).toBe("2026-01");
  });
});

describe("semesterKey (placeholder until 校历 dates)", () => {
  it("Feb–Jul is H1 of that year", () => {
    expect(semesterKey(new Date(Date.UTC(2026, 2, 15)))).toBe("2026H1");
    expect(semesterKey(new Date(Date.UTC(2026, 6, 1)))).toBe("2026H1");
  });

  it("Aug–Dec is H2 of that year", () => {
    expect(semesterKey(new Date(Date.UTC(2026, 8, 1)))).toBe("2026H2");
  });

  it("January rolls into the prior year's H2", () => {
    expect(semesterKey(new Date(Date.UTC(2027, 0, 10)))).toBe("2026H2");
  });
});

describe("periodKey dispatch", () => {
  it("weekly delegates to the season key (same fair-seed cohort)", () => {
    const now = new Date(Date.UTC(2026, 5, 1));
    expect(periodKey("weekly", now)).toBe(currentSeasonKey(now));
  });

  it("monthly and season delegate correctly", () => {
    const now = new Date(Date.UTC(2026, 5, 1));
    expect(periodKey("monthly", now)).toBe("2026-06");
    expect(periodKey("season", now)).toBe("2026H1");
  });
});
