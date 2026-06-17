# DB latency, production region, and fast local dev

> Written 2026-06-04 after diagnosing the remote database timeout failure on
> classroom onboarding and leaderboard paths. This document explains the latency
> tradeoff and the local-first Postgres workflow used for development.

## The diagnosis

The Supabase database is in **`aws-1-us-east-2`** (US East / Ohio). The school and
its students are in **Chengdu, China**. Every DB round-trip crosses the Pacific.

Measured from a China dev machine (through the local TUN proxy):

| | latency |
|---|---|
| cold connection + first query | **~1.7 s** |
| warm query (same connection) | **~230 ms** |

The leaderboard onboarding is the most round-trip-heavy write path, so it was the
first to blow past the 5 s client query budget. Two code fixes already reduced the
exposure: a calm Chinese 503 instead of leaking the raw timeout, and
`findOrCreateSchool` collapsed from 2 round-trips to 1. But the **root cause is
physical distance**; code can only do so much.

Note: this is also the latency class already flagged for `getTeacherOverview` and
`getAdminOverview`. The remote schema was fully applied and healthy when this note
was first written; this is not a missing-migration problem.

## Production options

1. **Move Supabase to a closer region — recommended first step.**
   `ap-southeast-1` (Singapore) or `ap-northeast-1` (Tokyo) can cut RTT from
   hundreds of ms to tens of ms for China users. Caveat: traffic still crosses the
   GFW, so it helps a lot but is not as bulletproof as in-country hosting.
   Supabase cannot change a project's region in place; create a new project in the
   target region and migrate data.

2. **China-hosted Postgres (Aliyun RDS / Tencent Cloud / Huawei Cloud).**
   Best possible latency and stability for a China-only user base. Bigger lift:
   you leave Supabase conveniences and re-point `DATABASE_URL`. The app only needs
   a Postgres URL through Drizzle + `postgres`, so the data layer ports cleanly.
   Re-create the `auth` shim + roles (`scripts/ci-supabase-shims.sql`) and re-apply
   `drizzle/policies.sql`.

3. **Stay in us-east-2 + mitigate.**
   Keep round-trip minimization, ensure the Supabase transaction pooler is used
   with adequate `default_pool_size`, and size compute for classroom concurrency.
   Optionally raise `DB_QUERY_TIMEOUT_MS` for the slow link. This is the least
   robust option for China users under load.

### Region-migration runbook

1. Create a new Supabase project in `ap-southeast-1` or `ap-northeast-1`.
2. Export from old, import to new using the **direct** connection, not the pooler:

   ```bash
   pg_dump "postgresql://...OLD-direct..." --no-owner --no-privileges -Fc -f bz.dump
   pg_restore --no-owner --no-privileges -d "postgresql://...NEW-direct..." bz.dump
   ```

3. Run `npm run db:apply-policies` against the new project.
4. Smoke-test against the new URL locally, then update `DATABASE_URL` in Vercel
   and `.env.local` to the new project's pooler URL.
5. Redeploy and verify onboarding plus teacher/admin overview paths.

## Fast local dev with Docker Postgres

Local dev against the us-east-2 DB is trans-Pacific and slow. Use the checked-in
Docker Compose runbook instead of an ad-hoc `docker run` container. The Compose
service creates a named volume, restarts unless stopped, waits for a Postgres
healthcheck, applies the Supabase-compatible shims before migrations, then runs
migrations, RLS policies, and seed data in the required order.

Before running the local DB, make sure `.env.local` points to the local database:

```powershell
DATABASE_URL=postgres://postgres:postgres@localhost:5433/brownzone
SESSION_SECRET=<at least 32 random characters>
```

Start or repair the local database from scratch:

```powershell
npm run db:up
```

`npm run db:up` performs the full chain:

1. `docker compose -f docker-compose.local.yml up -d`
2. wait until `brownzone-pg` reports `healthy`
3. pipe `scripts/ci-supabase-shims.sql` into the container
4. `npm run db:migrate`
5. `npm run db:apply-policies`
6. `npm run db:seed`

Check the container health:

```powershell
docker compose -f docker-compose.local.yml ps
```

Stop the local database but keep data:

```powershell
npm run db:down
```

Reset the local database and delete the named volume:

```powershell
npm run db:down:hard
npm run db:up
```

To switch back to the remote DB, restore the original `DATABASE_URL` line in
`.env.local`. Alternatively, for a no-DB demo, comment out `DATABASE_URL` entirely:
the app falls back to the in-memory store (`src/lib/store.ts`), which also serves
the full leaderboard with seeded data.
