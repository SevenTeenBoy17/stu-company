import { beforeEach, describe, expect, it } from "vitest";

import {
  findOrCreateSchool,
  resetStoreForTests,
  upsertLeaderboardSnapshot,
  upsertRankProfile,
} from "@/lib/store";

import { periodKey } from "./periods";
import { getLeaderboardBoard, getPowerCard } from "./service";

const comp = { riskAdjReturn: 0.6, discipline: 0.7, drawdown: 0.8, learning: 0.5, growth: 0.4 };
const now = new Date(Date.UTC(2026, 5, 1));
const key = periodKey("weekly", now);

function seedStudent(userId: string, power: number, opts: { consent?: number; visibility?: "public" | "school_only" | "hidden"; cityCode?: string; provinceCode?: string; schoolName?: string } = {}) {
  const cityCode = opts.cityCode ?? "5101";
  const provinceCode = opts.provinceCode ?? "51";
  const school = findOrCreateSchool({ name: opts.schoolName ?? `学校-${cityCode}`, provinceCode, cityCode });
  upsertRankProfile({
    userId,
    provinceCode,
    cityCode,
    schoolId: school.id,
    alias: userId,
    consent: opts.consent ?? 1,
    visibility: opts.visibility ?? "public",
  });
  upsertLeaderboardSnapshot({
    userId,
    period: "weekly",
    periodKey: key,
    power,
    netWorth: 100000 + power * 100,
    components: comp,
  });
}

describe("getLeaderboardBoard", () => {
  beforeEach(() => resetStoreForTests());

  it("ranks consented players in a scope and flags the viewer", async () => {
    seedStudent("me", 1200);
    seedStudent("rivalA", 1500);
    seedStudent("rivalB", 900);

    const board = await getLeaderboardBoard("me", "school", "weekly", { now });
    expect(board).not.toBeNull();
    expect(board!.total).toBe(3);
    expect(board!.entries.map((e) => e.userId)).toEqual(["rivalA", "me", "rivalB"]);
    expect(board!.viewerRank).toBe(2);
    expect(board!.entries.find((e) => e.isViewer)?.userId).toBe("me");
  });

  it("excludes unconsented players (guardian consent gate)", async () => {
    seedStudent("me", 1200);
    seedStudent("ghost", 1900, { consent: 0 });

    const board = await getLeaderboardBoard("me", "nation", "weekly", { now });
    expect(board!.total).toBe(1);
    expect(board!.entries.some((e) => e.userId === "ghost")).toBe(false);
  });

  it("returns null when the viewer has no rank profile", async () => {
    const board = await getLeaderboardBoard("nobody", "school", "weekly", { now });
    expect(board).toBeNull();
  });
});

describe("getPowerCard", () => {
  beforeEach(() => resetStoreForTests());

  it("reports power, tier, components, and 4-scope ranks for a consented player", async () => {
    seedStudent("me", 1200, { schoolName: "七中" });
    seedStudent("schoolmate", 1000, { schoolName: "七中" }); // same school, below me
    seedStudent("cityRival", 1500, { schoolName: "九中" }); // same city, above me
    seedStudent("provRival", 1700, { cityCode: "5103", schoolName: "绵中" }); // same province only

    const card = await getPowerCard("me", "weekly", { now });
    expect(card.hasProfile).toBe(true);
    expect(card.ranked).toBe(true);
    expect(card.power).toBe(1200);
    expect(card.components).toBeDefined();
    expect(card.ranks.school).toBe(1); // ahead of schoolmate in 七中
    expect(card.ranks.city).toBe(2); // behind cityRival in 成都
    expect(card.ranks.province).toBe(3); // + provRival in 四川
    expect(card.ranks.nation).toBe(3); // same 4 people, all in 四川
  });

  it("shows a private card with no ranks for an unconsented player", async () => {
    seedStudent("solo", 1300, { consent: 0 });
    const card = await getPowerCard("solo", "weekly", { now });
    expect(card.hasProfile).toBe(true);
    expect(card.power).toBe(1300); // own snapshot is private — visible to them
    expect(card.ranked).toBe(true); // has a snapshot
    expect(card.ranks.nation).toBeUndefined(); // but not on the board until consented
  });

  it("returns hasProfile=false before onboarding", async () => {
    const card = await getPowerCard("nobody", "weekly", { now });
    expect(card.hasProfile).toBe(false);
    expect(card.ranks.nation).toBeUndefined();
  });
});
