import { describe, expect, it } from "vitest";

import {
  rankLeaderboard,
  viewerPrivateRanks,
  viewerScopeRanks,
  type RankSnapshot,
  type Viewer,
} from "./ranking";

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

// Viewer is in 成都七中 (s1) / 成都(5101) / 四川(51).
const viewer: Viewer = { userId: "me", schoolId: "s1", cityCode: "5101", provinceCode: "51" };

describe("rankLeaderboard ordering", () => {
  const data = [
    snap({ userId: "a", power: 1500 }),
    snap({ userId: "me", power: 1200 }),
    snap({ userId: "b", power: 1800 }),
  ];

  it("orders by power desc and assigns 1-based ranks", () => {
    const { entries } = rankLeaderboard(data, "nation", viewer);
    expect(entries.map((e) => [e.userId, e.rank])).toEqual([
      ["b", 1],
      ["a", 2],
      ["me", 3],
    ]);
  });

  it("flags the viewer and reports their rank + total", () => {
    const res = rankLeaderboard(data, "nation", viewer);
    expect(res.total).toBe(3);
    expect(res.viewerRank).toBe(3);
    expect(res.entries.find((e) => e.isViewer)?.userId).toBe("me");
  });

  it("breaks ties deterministically by userId", () => {
    const tied = [snap({ userId: "z", power: 900 }), snap({ userId: "a", power: 900 })];
    const { entries } = rankLeaderboard(tied, "nation", viewer);
    expect(entries.map((e) => e.userId)).toEqual(["a", "z"]);
  });
});

describe("scope filtering", () => {
  const data = [
    snap({ userId: "same-school", power: 1000, schoolId: "s1", cityCode: "5101", provinceCode: "51" }),
    snap({ userId: "same-city", power: 1100, schoolId: "s2", cityCode: "5101", provinceCode: "51" }),
    snap({ userId: "same-prov", power: 1700, schoolId: "s9", cityCode: "5103", provinceCode: "51" }),
    snap({ userId: "other-prov", power: 1900, schoolId: "s7", cityCode: "4401", provinceCode: "44" }),
    snap({ userId: "me", power: 1200, schoolId: "s1", cityCode: "5101", provinceCode: "51" }),
  ];

  it("school scope keeps only same school", () => {
    const { entries, total } = rankLeaderboard(data, "school", viewer);
    expect(total).toBe(2);
    expect(entries.map((e) => e.userId)).toEqual(["me", "same-school"]);
  });

  it("city scope keeps only same city", () => {
    const { total, viewerRank } = rankLeaderboard(data, "city", viewer);
    expect(total).toBe(3); // same-school(1000), same-city(1100), me(1200)
    expect(viewerRank).toBe(1); // me(1200) is the highest in 成都
  });

  it("province scope excludes other provinces", () => {
    const { entries, total } = rankLeaderboard(data, "province", viewer);
    expect(total).toBe(4);
    expect(entries.some((e) => e.userId === "other-prov")).toBe(false);
  });

  it("nation scope includes everyone", () => {
    expect(rankLeaderboard(data, "nation", viewer).total).toBe(5);
  });
});

describe("privacy / visibility (decision 3)", () => {
  const data = [
    snap({ userId: "pub", power: 1500, visibility: "public" }),
    snap({ userId: "schoolonly", power: 1600, schoolId: "s1", visibility: "school_only" }),
    snap({ userId: "hidden", power: 1900, visibility: "hidden" }),
    snap({ userId: "me", power: 1200 }),
  ];

  it("hidden players never appear and are not ranked", () => {
    const nation = rankLeaderboard(data, "nation", viewer);
    expect(nation.entries.some((e) => e.userId === "hidden")).toBe(false);
    // nation eligible = pub + me; schoolonly is school_only (excluded here), hidden excluded
    expect(nation.total).toBe(2);
    expect(nation.entries.some((e) => e.userId === "schoolonly")).toBe(false);
  });

  it("school_only players appear only in the school scope", () => {
    const school = rankLeaderboard(data, "school", viewer);
    expect(school.entries.some((e) => e.userId === "schoolonly")).toBe(true);
  });

  it("no rank gaps: ranks are contiguous over the visible set", () => {
    const { entries } = rankLeaderboard(data, "nation", viewer);
    expect(entries.map((e) => e.rank)).toEqual([1, 2]); // pub, me — contiguous, no gap where hidden sat
  });
});

describe("pagination", () => {
  const many = Array.from({ length: 120 }, (_, i) =>
    snap({ userId: `u${String(i).padStart(3, "0")}`, power: 2000 - i }),
  );

  it("returns the requested page window", () => {
    const page2 = rankLeaderboard(many, "nation", viewer, { page: 2, pageSize: 50 });
    expect(page2.entries).toHaveLength(50);
    expect(page2.entries[0].rank).toBe(51);
    expect(page2.total).toBe(120);
  });
});

describe("viewerPrivateRanks (own card, visibility-independent)", () => {
  it("gives a hidden viewer their true position while the board hides them", () => {
    const data = [
      snap({ userId: "top", power: 1800 }),
      snap({ userId: "me", power: 1200, visibility: "hidden" }),
      snap({ userId: "below", power: 900 }),
    ];
    // Board (visibility-filtered): hidden me is absent.
    expect(rankLeaderboard(data, "nation", viewer).entries.some((e) => e.userId === "me")).toBe(false);
    // But the private card rank counts the full consented field: top(1800) > me -> #2.
    expect(viewerPrivateRanks(data, viewer).nation).toBe(2);
    // And the visibility-honouring variant returns undefined for hidden.
    expect(viewerScopeRanks(data, viewer).nation).toBeUndefined();
  });

  it("counts other hidden players in the field too", () => {
    const data = [
      snap({ userId: "secretLeader", power: 1900, visibility: "hidden" }),
      snap({ userId: "me", power: 1200 }),
    ];
    expect(viewerPrivateRanks(data, viewer).nation).toBe(2);
  });

  it("returns undefined when the viewer has no snapshot", () => {
    const data = [snap({ userId: "other", power: 1000 })];
    expect(viewerPrivateRanks(data, viewer).nation).toBeUndefined();
  });
});

describe("viewerScopeRanks (power card)", () => {
  it("computes the viewer's rank across all four scopes", () => {
    const data = [
      snap({ userId: "me", power: 1200 }),
      snap({ userId: "school-rival", power: 1300, schoolId: "s1", cityCode: "5101", provinceCode: "51" }),
      snap({ userId: "city-rival", power: 1400, schoolId: "s2", cityCode: "5101", provinceCode: "51" }),
      snap({ userId: "prov-rival", power: 1500, schoolId: "s3", cityCode: "5103", provinceCode: "51" }),
      snap({ userId: "nation-rival", power: 1600, schoolId: "s4", cityCode: "4401", provinceCode: "44" }),
    ];
    const ranks = viewerScopeRanks(data, viewer);
    expect(ranks.school).toBe(2); // behind school-rival
    expect(ranks.city).toBe(3); // behind school-rival + city-rival
    expect(ranks.province).toBe(4); // + prov-rival
    expect(ranks.nation).toBe(5); // + nation-rival
  });
});
