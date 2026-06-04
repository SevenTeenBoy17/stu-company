import { describe, expect, it } from "vitest";

import { currentSeasonKey } from "@/lib/season";

import { monthlyKey, periodKey, seasonLabel, semesterKey } from "./periods";

describe("monthlyKey", () => {
  it("formats UTC year-month", () => {
    expect(monthlyKey(new Date(Date.UTC(2026, 5, 1)))).toBe("2026-06");
    expect(monthlyKey(new Date(Date.UTC(2026, 0, 31)))).toBe("2026-01");
  });
});

describe("semesterKey (校历-aligned: 9/1 and 2/1 term starts)", () => {
  it("Feb–Aug is the spring season (summer folds in)", () => {
    expect(semesterKey(new Date(Date.UTC(2026, 1, 1)))).toBe("2026-S"); // Feb 1
    expect(semesterKey(new Date(Date.UTC(2026, 5, 1)))).toBe("2026-S"); // Jun
    expect(semesterKey(new Date(Date.UTC(2026, 7, 31)))).toBe("2026-S"); // Aug 31
  });

  it("Sep–Dec is the autumn season", () => {
    expect(semesterKey(new Date(Date.UTC(2026, 8, 1)))).toBe("2026-A"); // Sep 1
    expect(semesterKey(new Date(Date.UTC(2026, 11, 31)))).toBe("2026-A"); // Dec 31
  });

  it("January belongs to the prior year's autumn season", () => {
    expect(semesterKey(new Date(Date.UTC(2027, 0, 10)))).toBe("2026-A");
  });
});

describe("seasonLabel", () => {
  it("renders human season names", () => {
    expect(seasonLabel("2026-S")).toBe("2026 春季赛季");
    expect(seasonLabel("2026-A")).toBe("2026 秋季赛季");
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
    expect(periodKey("season", now)).toBe("2026-S");
  });
});
