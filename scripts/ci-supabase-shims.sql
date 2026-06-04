-- Supabase-compatible shims for a vanilla Postgres (CI Integration DB + local dev).
--
-- Supabase provides the `authenticated`/`anon` roles AND an `auth` schema with an
-- `auth.jwt()` function. A plain `postgres:16` image has neither. Migration
-- 0002_rls_policies.sql creates SQL functions whose bodies reference `auth.jwt()`,
-- and with the default `check_function_bodies = on` Postgres validates those
-- references AT CREATE TIME — so the whole migration aborts with
-- "schema \"auth\" does not exist" before any leaderboard table (0010+) is created.
--
-- Apply this BEFORE running migrations so `drizzle-kit migrate` / `npm run db:migrate`
-- and `drizzle/policies.sql` apply cleanly. Idempotent — safe to run repeatedly.
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;

create schema if not exists auth;

-- Faithful-enough stub: real Supabase reads the request JWT; here the RLS test
-- harness sets `request.jwt.claims` (and the per-claim GUCs), and app_private.*
-- already coalesces auth.jwt() with the per-claim current_setting() fallbacks.
create or replace function auth.jwt() returns jsonb language sql stable as $fn$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$fn$;

create or replace function auth.uid() returns text language sql stable as $fn$
  select nullif(current_setting('request.jwt.claim.sub', true), '')
$fn$;

grant usage on schema auth to authenticated, anon;
