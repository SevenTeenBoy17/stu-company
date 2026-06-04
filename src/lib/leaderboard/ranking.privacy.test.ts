import { describe, expect, it } from "vitest";

import { rankLeaderboard, type RankScope, type RankSnapshot, type Viewer } from "./ranking";

// TEST-STRATEGY §4 R7: adversarial privacy. Complements ranking.test.ts with the
// two leak modes AI implementations most often get wrong:
//   (a) a hidden/high-power player creating a rank GAP that reveals "someone hid",
//   (b) a school_only player bleeding into city/province/nation scopes.
// Ranks must be contiguous over exactly the displayed set, in every scope.

function snap(over: Partial<RankSnapshot> & { userId: string; power: number }): RankSnapshot {
  return {
    alias: over.userId,
    tier: 1,
    schoolId: "s1",
    schoolName: "学校",
    cityCode: "5101",
    provinceCode: "51",
    visibility: "public",
    ...over,
  };
}

const viewer: Viewer = { userId: "me", schoolId: "s1", cityCode: "5101", provinceCode: "51" };
const ALL_SCOPES: RankScope[] = ["school", "city", "province", "nation"];

describe("ranking privacy — adversarial no-leak (R7)", () => {
  it("a high-power hidden player in the MIDDLE leaves no rank gap", () => {
    const data = [
      snap({ userId: "top", power: 1800 }),
      snap({ userId: "ghost", power: 1500, visibility: "hidden" }),
      snap({ userId: "me", power: 1200 }),
    ];
    const { entries } = rankLeaderboard(data, "nation", viewer);
    expect(entries.map((e) => e.userId)).toEqual(["top", "me"]);
    // 1,2 — NOT 1,3 (no gap where the hidden player sat by power).
    expect(entries.map((e) => e.rank)).toEqual([1, 2]);
  });

  it("hidden players never appear in ANY of the four scopes", () => {
    const data = [
      snap({ userId: "ghost", power: 1999, visibility: "hidden" }),
      snap({ userId: "me", power: 1200 }),
    ];
    for (const scope of ALL_SCOPES) {
      const { entries } = rankLeaderboard(data, scope, viewer);
      expect(entries.some((e) => e.userId === "ghost")).toBe(false);
    }
  });

  it("school_only players appear ONLY in the school scope", () => {
    const data = [
      snap({ userId: "so", power: 1700, schoolId: "s1", visibility: "school_only" }),
      snap({ userId: "me", power: 1200 }),
    ];
    const present = (scope: RankScope) =>
      rankLeaderboard(data, scope, viewer).entries.some((e) => e.userId === "so");
    expect(present("school")).toBe(true);
    expect(present("city")).toBe(false);
    expect(present("province")).toBe(false);
    expect(present("nation")).toBe(false);
  });

  it("ranks stay contiguous [1..n] over a mixed-visibility field", () => {
    const data = [
      snap({ userId: "a", power: 2000 }),
      snap({ userId: "ghost1", power: 1900, visibility: "hidden" }),
      snap({ userId: "b", power: 1800 }),
      snap({ userId: "so", power: 1700, schoolId: "s1", visibility: "school_only" }),
      snap({ userId: "ghost2", power: 1600, visibility: "hidden" }),
      snap({ userId: "me", power: 1500 }),
    ];
    const { entries, total } = rankLeaderboard(data, "nation", viewer);
    // nation drops both hidden and the school_only -> a, b, me.
    expect(entries.map((e) => e.userId)).toEqual(["a", "b", "me"]);
    expect(total).toBe(3);
    expect(entries.map((e) => e.rank)).toEqual([1, 2, 3]);
  });

  it("contiguity holds across a pagination boundary with hidden players removed", () => {
    const visible = Array.from({ length: 10 }, (_, i) =>
      snap({ userId: `v${i}`, power: 2000 - i * 10 }),
    );
    const hidden = Array.from({ length: 5 }, (_, i) =>
      snap({ userId: `h${i}`, power: 1995 - i * 10, visibility: "hidden" }),
    );
    const { entries, total } = rankLeaderboard([...visible, ...hidden], "nation", viewer, {
      page: 2,
      pageSize: 4,
    });
    expect(total).toBe(10); // hidden excluded from the count
    expect(entries.map((e) => e.rank)).toEqual([5, 6, 7, 8]);
  });
});
