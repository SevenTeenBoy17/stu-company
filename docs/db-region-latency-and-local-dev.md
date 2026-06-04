# DB latency, production region, and fast local dev

> Written 2026-06-04 after diagnosing the `findOrCreateSchool timed out after 5000ms`
> failure on the 财商战力榜 (PR #4). Companion to the code hardening in commit `089ecfa`.

## The diagnosis

The Supabase database is in **`aws-1-us-east-2`** (US East / Ohio). The school and
its students are in **成都 (China)**. Every DB round-trip crosses the Pacific.

Measured from a China dev machine (through the local TUN proxy):

| | latency |
|---|---|
| cold connection + first query | **~1.7 s** |
| warm query (same connection) | **~230 ms** |

The leaderboard onboarding is the most round-trip-heavy write path, so it was the
first to blow past the 5 s client query budget. Two code fixes already reduced the
exposure (commit `089ecfa`): a calm Chinese 503 instead of leaking the raw timeout,
and `findOrCreateSchool` collapsed from 2 round-trips to 1. But the **root cause is
physical distance** — code can only do so much.

Note: this is also the latency class already flagged for `getTeacherOverview` /
`getAdminOverview`. The remote **schema is fully applied and healthy** (verified
2026-06-04, ledger at migration 0012) — this is *not* a missing-migration problem.

## Production options (your decision)

1. **Move Supabase to a closer region — recommended first step.**
   `ap-southeast-1` (Singapore) or `ap-northeast-1` (Tokyo) cut RTT from ~230 ms to
   ~tens of ms for China users. Caveat: traffic still crosses the GFW, so it helps
   a lot but is not as bulletproof as in-country hosting. Supabase can't change a
   project's region in place — you create a new project in the target region and
   migrate data (runbook below).

2. **China-hosted Postgres (Aliyun RDS / Tencent Cloud / Huawei Cloud).**
   Best possible latency + stability for a China-only user base, and avoids the GFW
   entirely. Bigger lift: you leave Supabase (lose Auth/Storage/Studio niceties) and
   re-point `DATABASE_URL`. The app only needs a Postgres URL (Drizzle + `postgres`
   driver), so the data layer ports cleanly; re-create the `auth` shim + roles
   (`scripts/ci-supabase-shims.sql`) and re-apply `drizzle/policies.sql`.

3. **Stay in us-east-2 + mitigate.** Keep the round-trip minimization, ensure the
   Supabase **transaction pooler** (port 6543, already in use) with adequate
   `default_pool_size`, and size compute for classroom concurrency. Optionally raise
   `DB_QUERY_TIMEOUT_MS` for the slow link (trade-off: users wait longer on real
   failures). This is the least robust option for CN users under load.

### Region-migration runbook (option 1)

1. Create a new Supabase project in `ap-southeast-1` (or `ap-northeast-1`).
2. Export from old, import to new (use the **direct** connection, not the pooler):
   ```bash
   pg_dump "postgresql://...OLD-direct..." --no-owner --no-privileges -Fc -f bz.dump
   pg_restore --no-owner --no-privileges -d "postgresql://...NEW-direct..." bz.dump
   ```
   (Or `npm run db:migrate` against the new project, then `pg_dump --data-only`.)
3. `npm run db:apply-policies` against the new project (re-applies RLS).
4. Smoke-test against the new URL locally, then update `DATABASE_URL` in **Vercel**
   (and `.env.local`) to the new project's **pooler** URL (`:6543`).
5. Redeploy; verify the 战力榜 onboarding and a teacher/admin overview. Decommission
   the old project once confirmed.

## Fast local dev with Docker Postgres

Local dev against the us-east-2 DB is trans-Pacific and slow. Run a local Postgres
instead — onboarding drops from a 5 s timeout to **~114 ms**:

```powershell
# 1. start a local Postgres
docker run -d --name brownzone-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres `
  -e POSTGRES_DB=brownzone -p 5433:5432 postgres:16

# 2. provide the Supabase-compatible shims (roles + auth schema) BEFORE migrating
Get-Content scripts/ci-supabase-shims.sql | docker exec -i brownzone-pg psql -U postgres -d brownzone

# 3. point DATABASE_URL at it (in .env.local), then:
npm run db:migrate         # applies 0000-0012
npm run db:apply-policies   # RLS policies
npm run db:seed             # demo users / runs

# .env.local:
# DATABASE_URL=postgres://postgres:postgres@localhost:5433/brownzone
```

To switch back to the remote DB, restore the original `DATABASE_URL` line in
`.env.local`. The `brownzone-pg` container stops on machine restart — `docker start
brownzone-pg` to resume (data persists until the container is removed).

Alternatively, for a no-DB demo, comment out `DATABASE_URL` entirely — the app falls
back to the in-memory store (`src/lib/store.ts`), which also serves the full
leaderboard with seeded data.
