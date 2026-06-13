import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

// DATABASE_URL is loaded by tests/integration/setup-env.ts (a vitest setupFile)
// before this file's imports evaluate, so @/lib/env and this raw client agree.
const databaseUrl = process.env.DATABASE_URL;
const describeWithDb = databaseUrl ? describe : describe.skip;
const TEST_TIMEOUT_MS = 30_000;

type SqlTransaction = postgres.TransactionSql;

async function setClaims(
  sql: SqlTransaction,
  claims: {
    sub: string;
    role: "student" | "teacher" | "parent" | "admin";
    classroomId?: string | null;
  },
) {
  await sql.unsafe("set local role authenticated");
  await sql`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`;
  await sql`select set_config('request.jwt.claim.sub', ${claims.sub}, true)`;
  await sql`select set_config('request.jwt.claim.role', ${claims.role}, true)`;
  if (claims.classroomId) {
    await sql`select set_config('request.jwt.claim.classroomId', ${claims.classroomId}, true)`;
  }
}

describeWithDb("postgres row level security isolation", () => {
  const client = postgres(databaseUrl ?? "", { prepare: false, max: 1 });

  afterAll(async () => {
    await client.end();
  });

  it("blocks student-2 from reading student-1's scenario run", async () => {
    const rows = await client.begin(async (sql) => {
      await setClaims(sql, { sub: "student-2", role: "student", classroomId: "class-1" });
      return await sql`select id from scenario_runs where user_id = 'student-1'`;
    });

    expect(rows).toHaveLength(0);
  }, TEST_TIMEOUT_MS);

  it("blocks parent-1 from reading a non-bonded student's report", async () => {
    const reportId = "rls-test-non-bonded-report";

    const rows = await client.begin(async (sql) => {
      try {
        await sql`
          insert into growth_reports (id, student_user_id, parent_user_id, payload)
          values (
            ${reportId},
            'student-2',
            'parent-1',
            ${JSON.stringify({ source: "rls-test" })}
          )
          on conflict (id) do nothing
        `;

        await setClaims(sql, { sub: "parent-1", role: "parent" });
        return await sql`select id from growth_reports where id = ${reportId}`;
      } finally {
        await sql.unsafe("reset role");
        await sql`delete from growth_reports where id = ${reportId}`;
      }
    });

    expect(rows).toHaveLength(0);
  }, TEST_TIMEOUT_MS);

  it("allows teacher-1 to read their classroom scenario runs for leaderboard data", async () => {
    const rows = await client.begin(async (sql) => {
      await setClaims(sql, { sub: "teacher-1", role: "teacher", classroomId: "class-1" });
      return await sql`
        select id, user_id
        from scenario_runs
        where classroom_id = 'class-1'
        order by user_id
      `;
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((row) => row.user_id === "student-1")).toBe(true);
  }, TEST_TIMEOUT_MS);

  it("allows admin-1 to read protected scenario runs", async () => {
    const rows = await client.begin(async (sql) => {
      await setClaims(sql, { sub: "admin-1", role: "admin" });
      return await sql`select id from scenario_runs order by id limit 1`;
    });

    expect(rows.length).toBeGreaterThan(0);
  }, TEST_TIMEOUT_MS);

  // ── leaderboard layer (policies added 2026-06-03) ──────────────────────────
  it("leaderboard tables are cross-user readable; learning_progress is private", async () => {
    let seen: { profiles: number; snapshots: number; learning: number } | undefined;
    try {
      await client.begin(async (sql) => {
        // Robust to rows committed by other integration tests (leaderboard.test
        // upserts a rank_profile for student-1). Clear the ids this test owns
        // first — it all rolls back at the end, so nothing persists.
        await sql`delete from learning_progress where user_id in ('student-1','student-2')`;
        await sql`delete from leaderboard_snapshots where user_id in ('student-1','student-2')`;
        await sql`delete from rank_profiles where user_id in ('student-1','student-2')`;
        await sql`delete from schools where id = 'rls-sch'`;
        await sql`insert into schools (id,name,normalized_name,province_code,city_code,status,created_by)
                  values ('rls-sch','RLS校','RLS校','51','5101','approved','student-1')`;
        await sql`insert into rank_profiles (user_id,province_code,city_code,school_id,alias)
                  values ('student-1','51','5101','rls-sch','A'),('student-2','51','5101','rls-sch','B')`;
        await sql`insert into leaderboard_snapshots (id,user_id,period,period_key,power,tier,net_worth,components)
                  values ('rls-1','student-1','weekly','W',1,1,1,'{}'::jsonb),('rls-2','student-2','weekly','W',2,2,2,'{}'::jsonb)`;
        await sql`insert into learning_progress (id,user_id,module_key)
                  values ('rls-l1','student-1','m'),('rls-l2','student-2','m')`;
        await setClaims(sql, { sub: "student-1", role: "student", classroomId: "class-1" });
        // Filter to the rows this test controls so it is robust to other data:
        // student-1 should see BOTH leaderboard rows (cross-user) but only its OWN
        // learning row (private).
        const ids = ["student-1", "student-2"];
        seen = {
          profiles: Number((await sql`select count(*)::int n from rank_profiles where user_id in ${sql(ids)}`)[0].n),
          snapshots: Number((await sql`select count(*)::int n from leaderboard_snapshots where user_id in ${sql(ids)}`)[0].n),
          learning: Number((await sql`select count(*)::int n from learning_progress where user_id in ${sql(ids)} and module_key='m'`)[0].n),
        };
        throw new Error("__rollback__");
      });
    } catch (e) {
      if ((e as Error).message !== "__rollback__") throw e;
    }
    expect(seen).toEqual({ profiles: 2, snapshots: 2, learning: 1 });
  }, TEST_TIMEOUT_MS);

  it("blocks a student from writing another user's rank_profile", async () => {
    let denied = false;
    try {
      await client.begin(async (sql) => {
        await sql`insert into schools (id,name,normalized_name,province_code,city_code,status,created_by)
                  values ('rls-sch2','RLS校2','RLS校2','51','5101','approved','student-1')`;
        await setClaims(sql, { sub: "student-1", role: "student", classroomId: "class-1" });
        try {
          await sql`insert into rank_profiles (user_id,province_code,city_code,school_id,alias)
                    values ('student-2','51','5101','rls-sch2','x')`;
        } catch {
          denied = true;
        }
        throw new Error("__rollback__");
      });
    } catch (e) {
      if ((e as Error).message !== "__rollback__") throw e;
    }
    expect(denied).toBe(true);
  }, TEST_TIMEOUT_MS);

  // ── gap tables (policies added 2026-06-03) ─────────────────────────────────
  it("scopes classrooms to the member and student_parent_links to the parties", async () => {
    const classroomsSeen = await client.begin(async (sql) => {
      await setClaims(sql, { sub: "student-1", role: "student", classroomId: "class-1" });
      return Number((await sql`select count(*)::int n from classrooms`)[0].n);
    });
    expect(classroomsSeen).toBe(1);

    const parentBonds = await client.begin(async (sql) => {
      await setClaims(sql, { sub: "parent-1", role: "parent" });
      return Number((await sql`select count(*)::int n from student_parent_links`)[0].n);
    });
    expect(parentBonds).toBeGreaterThanOrEqual(1);

    const strangerBonds = await client.begin(async (sql) => {
      await setClaims(sql, { sub: "student-2", role: "student", classroomId: "class-1" });
      return Number((await sql`select count(*)::int n from student_parent_links`)[0].n);
    });
    expect(strangerBonds).toBe(0);
  }, TEST_TIMEOUT_MS);
});

// The withUserRls() mechanism: the same enforcement, but reached through the app's
// db layer (drizzle) rather than raw SQL. Dynamic imports defer @/lib/db/client so
// loadEnvFile() above has populated DATABASE_URL before env.ts parses it.
describeWithDb("withUserRls mechanism", () => {
  it("enforces own-only when RLS_ENFORCE=true, owner-wide when off", async () => {
    const prev = process.env.RLS_ENFORCE;
    const { withUserRls, getRequestExecutor } = await import("@/lib/db/rls-context");
    const { scenarioRuns } = await import("@/lib/db/schema");
    const claims = { sub: "student-1", role: "student" as const, classroomId: "class-1" };
    const runQuery = () =>
      withUserRls(claims, async () => {
        const ex = getRequestExecutor();
        return ex ? (await ex.select().from(scenarioRuns)).length : -1;
      });
    try {
      process.env.RLS_ENFORCE = "true";
      const enforced = await runQuery();
      process.env.RLS_ENFORCE = "";
      const ownerWide = await runQuery();
      expect(enforced).toBeGreaterThanOrEqual(1); // student-1 has a seeded run
      expect(ownerWide).toBeGreaterThan(enforced); // owner sees other users' runs too
    } finally {
      if (prev === undefined) delete process.env.RLS_ENFORCE;
      else process.env.RLS_ENFORCE = prev;
    }
  }, TEST_TIMEOUT_MS);
});
