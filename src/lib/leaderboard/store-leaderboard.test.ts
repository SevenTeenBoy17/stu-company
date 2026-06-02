import { beforeEach, describe, expect, it } from "vitest";

import {
  findOrCreateSchool,
  getRankProfile,
  listLeaderboardSnapshots,
  listSchoolsByCity,
  resetStoreForTests,
  upsertLeaderboardSnapshot,
  upsertRankProfile,
} from "@/lib/store";

const components = { riskAdjReturn: 0.5, discipline: 0.5, drawdown: 0.5, learning: 0.5, growth: 0.5 };

describe("store: schools (dedup)", () => {
  beforeEach(() => resetStoreForTests());

  it("dedups by (city, normalized name) and ignores spacing/punctuation", () => {
    const a = findOrCreateSchool({ name: "成都  七中", provinceCode: "51", cityCode: "5101" });
    const b = findOrCreateSchool({ name: "成都七中", provinceCode: "51", cityCode: "5101" });
    expect(b.id).toBe(a.id);
    expect(listSchoolsByCity("5101")).toHaveLength(1);
  });

  it("keeps same-name schools in different cities distinct", () => {
    const cd = findOrCreateSchool({ name: "实验中学", provinceCode: "51", cityCode: "5101" });
    const gz = findOrCreateSchool({ name: "实验中学", provinceCode: "44", cityCode: "4401" });
    expect(gz.id).not.toBe(cd.id);
    expect(listSchoolsByCity("5101")).toHaveLength(1);
    expect(listSchoolsByCity("4401")).toHaveLength(1);
  });
});

describe("store: rank profiles", () => {
  beforeEach(() => resetStoreForTests());

  it("creates then updates idempotently on userId", () => {
    const school = findOrCreateSchool({ name: "成都七中", provinceCode: "51", cityCode: "5101" });
    upsertRankProfile({
      userId: "u1",
      provinceCode: "51",
      cityCode: "5101",
      schoolId: school.id,
      alias: "小财迷",
    });
    const updated = upsertRankProfile({
      userId: "u1",
      provinceCode: "51",
      cityCode: "5101",
      schoolId: school.id,
      alias: "财商达人",
      visibility: "school_only",
    });
    expect(updated.alias).toBe("财商达人");
    expect(updated.visibility).toBe("school_only");
    expect(getRankProfile("u1")?.alias).toBe("财商达人");
  });
});

describe("store: leaderboard snapshots + soft floor", () => {
  beforeEach(() => resetStoreForTests());

  function seedProfile() {
    const school = findOrCreateSchool({ name: "成都七中", provinceCode: "51", cityCode: "5101" });
    upsertRankProfile({
      userId: "u1",
      provinceCode: "51",
      cityCode: "5101",
      schoolId: school.id,
      alias: "小财迷",
    });
  }

  it("upserts idempotently on (user, period, periodKey)", () => {
    seedProfile();
    upsertLeaderboardSnapshot({ userId: "u1", period: "weekly", periodKey: "2026-W22", power: 800, netWorth: 200000, components, seasonKey: "2026H1" });
    upsertLeaderboardSnapshot({ userId: "u1", period: "weekly", periodKey: "2026-W22", power: 1300, netWorth: 260000, components, seasonKey: "2026H1" });
    const rows = listLeaderboardSnapshots("weekly", "2026-W22");
    expect(rows).toHaveLength(1);
    expect(rows[0].power).toBe(1300);
  });

  it("holds the soft floor within a season (decision 7)", () => {
    seedProfile();
    // power 1300 -> tier 4 (strategist); profile high-water becomes 4
    upsertLeaderboardSnapshot({ userId: "u1", period: "weekly", periodKey: "2026-W22", power: 1300, netWorth: 260000, components, seasonKey: "2026H1" });
    expect(getRankProfile("u1")?.lastTier).toBe(4);

    // a bad week (same season) drops raw power to tier 2, but the floor holds tier 4
    const dropped = upsertLeaderboardSnapshot({ userId: "u1", period: "weekly", periodKey: "2026-W23", power: 500, netWorth: 130000, components, seasonKey: "2026H1" });
    expect(dropped.tier).toBe(4);
    expect(getRankProfile("u1")?.lastTier).toBe(4);
  });

  it("resets the soft floor across seasons (decision 7: within-season only)", () => {
    seedProfile();
    upsertLeaderboardSnapshot({ userId: "u1", period: "weekly", periodKey: "2026-W22", power: 1300, netWorth: 260000, components, seasonKey: "2026H1" });
    expect(getRankProfile("u1")?.lastTier).toBe(4);

    // new semester: the floor resets to the current raw tier (500 -> tier 2)
    const fresh = upsertLeaderboardSnapshot({ userId: "u1", period: "weekly", periodKey: "2026-W40", power: 500, netWorth: 130000, components, seasonKey: "2026H2" });
    expect(fresh.tier).toBe(2);
    expect(getRankProfile("u1")?.lastTier).toBe(2);
    expect(getRankProfile("u1")?.lastTierSeason).toBe("2026H2");
  });

  it("separates periods by periodKey", () => {
    seedProfile();
    upsertLeaderboardSnapshot({ userId: "u1", period: "weekly", periodKey: "2026-W22", power: 800, netWorth: 200000, components, seasonKey: "2026H1" });
    upsertLeaderboardSnapshot({ userId: "u1", period: "monthly", periodKey: "2026-06", power: 900, netWorth: 210000, components, seasonKey: "2026H1" });
    expect(listLeaderboardSnapshots("weekly", "2026-W22")).toHaveLength(1);
    expect(listLeaderboardSnapshots("monthly", "2026-06")).toHaveLength(1);
  });
});
