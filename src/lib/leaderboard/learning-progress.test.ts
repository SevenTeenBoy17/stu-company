import { beforeEach, describe, expect, it } from "vitest";

import { learningModules } from "@/lib/content";
import {
  findOrCreateSchool,
  getLearningProgress,
  markModuleComplete,
  resetStoreForTests,
  upsertRankProfile,
} from "@/lib/store";

import { recomputePowerForUser } from "./service";

const now = new Date(Date.UTC(2026, 5, 1));

describe("learning progress store (Option A)", () => {
  beforeEach(() => resetStoreForTests());

  it("starts empty and counts completions against the catalog size", () => {
    expect(getLearningProgress("u1")).toEqual({
      completed: 0,
      total: learningModules.length,
      completedKeys: [],
    });
  });

  it("marks modules learned idempotently", () => {
    markModuleComplete("u1", "equities");
    markModuleComplete("u1", "equities"); // no double count
    markModuleComplete("u1", "portfolio");
    const p = getLearningProgress("u1");
    expect(p.completed).toBe(2);
    expect(p.completedKeys.sort()).toEqual(["equities", "portfolio"]);
  });

  it("ignores unknown module keys in the count", () => {
    markModuleComplete("u1", "not-a-real-module");
    expect(getLearningProgress("u1").completed).toBe(0);
  });
});

describe("learning raises power through recompute", () => {
  beforeEach(() => resetStoreForTests());

  it("completing every module increases the learning component and total power", async () => {
    // student-1 has a seeded run; give them a rank profile so recompute runs.
    const school = findOrCreateSchool({ name: "成都七中", provinceCode: "51", cityCode: "5101" });
    upsertRankProfile({
      userId: "student-1",
      provinceCode: "51",
      cityCode: "5101",
      schoolId: school.id,
      alias: "一号",
      consent: 1,
    });

    const before = await recomputePowerForUser("student-1", { now });
    expect(before).not.toBeNull();

    for (const m of learningModules) markModuleComplete("student-1", m.key);
    const after = await recomputePowerForUser("student-1", { now });
    expect(after).not.toBeNull();

    expect(after!.power).toBeGreaterThan(before!.power);
  });
});
