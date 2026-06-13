/**
 * DB-path integration tests for the 财商战力 leaderboard repo functions
 * (code-review M2). Exercises the real Drizzle queries — the onConflict targets,
 * the `for("update")` soft-floor transaction, and the 3-table join — against a
 * live Postgres with migrations 0010–0012 applied.
 *
 * Gated on DATABASE_URL (skips otherwise; never touches a DB you didn't point it
 * at). Every repo write is cross-checked with an INDEPENDENT raw-SQL read, so if
 * the repo silently fell back to the in-memory store (e.g. tables missing) the
 * cross-check finds nothing and the test fails loudly instead of passing falsely.
 *
 * Run: DATABASE_URL=postgres://... npm run test:integration
 */
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  findOrCreateSchool,
  getRankProfile,
  upsertLeaderboardSnapshot,
  upsertRankProfile,
} from "@/lib/db/repo";
import { normalizeSchoolName } from "@/lib/leaderboard/school-normalize";

// DATABASE_URL is loaded by tests/integration/setup-env.ts (a vitest setupFile)
// BEFORE this file's imports evaluate, so @/lib/env (read at import time) sees it
// and the repo + the raw cross-check client below target the SAME database.
const databaseUrl = process.env.DATABASE_URL;
const describeWithDb = databaseUrl ? describe : describe.skip;
const TEST_TIMEOUT_MS = 30_000;

// student-3 is seeded; the leaderboard feature adds no seeded rank_profiles, so
// creating/deleting one for them is safe + self-cleaning.
const TEST_USER = "student-3";
const TEST_CITY = "5101";
const TEST_PROVINCE = "51";
const TEST_SCHOOL_NAME = "集成测试专用中学ZZ";
const components = { riskAdjReturn: 0.6, discipline: 0.7, drawdown: 0.8, learning: 0.5, growth: 0.4 };

describeWithDb("leaderboard repo (DB path)", () => {
  const client = postgres(databaseUrl ?? "", { prepare: false, max: 1 });
  const normalized = normalizeSchoolName(TEST_SCHOOL_NAME);

  async function cleanup() {
    await client`delete from leaderboard_snapshots where user_id = ${TEST_USER} and period_key like 'INTEG%'`;
    await client`delete from rank_profiles where user_id = ${TEST_USER}`;
    await client`delete from schools where city_code = ${TEST_CITY} and normalized_name = ${normalized}`;
  }

  beforeAll(cleanup);
  afterAll(async () => {
    await cleanup();
    await client.end();
  });

  it("findOrCreateSchool dedups under the (city, normalized_name) unique index", async () => {
    const a = await findOrCreateSchool({ name: TEST_SCHOOL_NAME, provinceCode: TEST_PROVINCE, cityCode: TEST_CITY });
    // spacing/punctuation differences normalize to the same key -> same row
    const b = await findOrCreateSchool({ name: ` ${TEST_SCHOOL_NAME} `, provinceCode: TEST_PROVINCE, cityCode: TEST_CITY });
    expect(b.id).toBe(a.id);

    // independent cross-check: exactly one row actually landed in the DB
    const rows = await client`
      select id from schools where city_code = ${TEST_CITY} and normalized_name = ${normalized}
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(a.id);
  }, TEST_TIMEOUT_MS);

  it("upsertLeaderboardSnapshot holds the soft floor in-season and resets across, via the real for(update) txn", async () => {
    const school = await findOrCreateSchool({ name: TEST_SCHOOL_NAME, provinceCode: TEST_PROVINCE, cityCode: TEST_CITY });
    await upsertRankProfile({
      userId: TEST_USER,
      provinceCode: TEST_PROVINCE,
      cityCode: TEST_CITY,
      schoolId: school.id,
      alias: "集成测试",
      consent: 1,
    });

    // power 1300 -> tier 4
    await upsertLeaderboardSnapshot({ userId: TEST_USER, period: "weekly", periodKey: "INTEG-W1", power: 1300, netWorth: 260000, components, seasonKey: "INTEG-S1" });
    expect((await getRankProfile(TEST_USER))?.lastTier).toBe(4);

    // bad week, SAME season -> floor holds at 4 (cross-checked in the DB)
    const dropped = await upsertLeaderboardSnapshot({ userId: TEST_USER, period: "weekly", periodKey: "INTEG-W2", power: 500, netWorth: 130000, components, seasonKey: "INTEG-S1" });
    expect(dropped.tier).toBe(4);
    const w2 = await client`select tier from leaderboard_snapshots where user_id = ${TEST_USER} and period_key = 'INTEG-W2'`;
    expect(w2[0].tier).toBe(4);

    // NEW season -> floor resets to the raw tier (500 -> tier 2)
    const fresh = await upsertLeaderboardSnapshot({ userId: TEST_USER, period: "weekly", periodKey: "INTEG-W3", power: 500, netWorth: 130000, components, seasonKey: "INTEG-S2" });
    expect(fresh.tier).toBe(2);
    const profileRow = await client`select last_tier, last_tier_season from rank_profiles where user_id = ${TEST_USER}`;
    expect(profileRow[0].last_tier).toBe(2);
    expect(profileRow[0].last_tier_season).toBe("INTEG-S2");
  }, TEST_TIMEOUT_MS);

  it("upsertLeaderboardSnapshot is idempotent on (user, period, period_key)", async () => {
    const school = await findOrCreateSchool({ name: TEST_SCHOOL_NAME, provinceCode: TEST_PROVINCE, cityCode: TEST_CITY });
    await upsertRankProfile({ userId: TEST_USER, provinceCode: TEST_PROVINCE, cityCode: TEST_CITY, schoolId: school.id, alias: "集成测试", consent: 1 });

    await upsertLeaderboardSnapshot({ userId: TEST_USER, period: "weekly", periodKey: "INTEG-IDEM", power: 800, netWorth: 200000, components, seasonKey: "INTEG-S1" });
    await upsertLeaderboardSnapshot({ userId: TEST_USER, period: "weekly", periodKey: "INTEG-IDEM", power: 1300, netWorth: 260000, components, seasonKey: "INTEG-S1" });

    const rows = await client`select power from leaderboard_snapshots where user_id = ${TEST_USER} and period_key = 'INTEG-IDEM'`;
    expect(rows).toHaveLength(1);
    expect(rows[0].power).toBe(1300);
  }, TEST_TIMEOUT_MS);
});
