import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

function loadEnvFile(fileName: string, override = false) {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) return;

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local", true);

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
});
