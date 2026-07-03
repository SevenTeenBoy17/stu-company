import { describe, expect, it } from "vitest";

import {
  rankLeaderboard,
  viewerPrivateRanks,
  type RankScope,
  type RankSnapshot,
  type Viewer,
} from "./ranking";

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

  // itest4 R3 P1 回归锁：个人卡「私有名次」必须与榜单「可见名次」在同一可见集上一致，
  // 否则 卡名次 − 榜名次 = 上方隐身玩家数，反推去匿名。此前 viewerPrivateRanks 把隐身
  // 玩家计入分母，导致公开玩家两值不等而泄露。
  it("public viewer's private card rank == board rank even when hidden players rank above (no hidden-count leak)", () => {
    const data = [
      snap({ userId: "ghostA", power: 1800, visibility: "hidden" }),
      snap({ userId: "ghostB", power: 1700, visibility: "hidden" }),
      snap({ userId: "top", power: 1600 }),
      snap({ userId: "me", power: 1400 }), // public viewer, 2 hidden players above
      snap({ userId: "low", power: 900 }),
    ];
    const boardRank = rankLeaderboard(data, "nation", viewer, { pageSize: 1 }).viewerRank;
    const cardRanks = viewerPrivateRanks(data, viewer);
    // Board sees only {top, me, low} → me is #2. Card must agree → difference is 0, nothing leaks.
    expect(boardRank).toBe(2);
    expect(cardRanks.nation).toBe(2);
    expect(cardRanks.nation).toBe(boardRank);
  });

  it("a hidden viewer still gets a board-consistent card rank (self counted, other hidden excluded)", () => {
    const data = [
      snap({ userId: "top", power: 1600 }),
      snap({ userId: "ghost", power: 1500, visibility: "hidden" }),
      snap({ userId: "me", power: 1400, visibility: "hidden" }), // hidden viewer
      snap({ userId: "low", power: 900 }),
    ];
    const meViewer: Viewer = { userId: "me", schoolId: "s1", cityCode: "5101", provinceCode: "51" };
    // Hidden viewer is absent from the board (viewerRank undefined) — nothing to compare against.
    expect(rankLeaderboard(data, "nation", meViewer, { pageSize: 1 }).viewerRank).toBeUndefined();
    // Card ranks the hidden viewer among visible players + self only (ghost excluded):
    // {top(1600), me(1400), low(900)} → me is #2, NOT #3 (which would count ghost).
    expect(viewerPrivateRanks(data, meViewer).nation).toBe(2);
  });
});
