# Findings

## Environment Checklist

Required keys from `docs/ENV-CHECKLIST.md`:

- `APP_URL`
- `SESSION_SECRET`
- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional or fallback keys already present before this round included AI and AllTick variables.

## Current Blocker

Stage 1.1 cannot run until the four Supabase values are filled:

- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Supabase Connector Result

- Supabase plugin/tool discovery succeeded.
- Initial `_list_projects` returned an empty project list: `projects: []`.
- After opening the dashboard, `_list_projects` returned project `brone-web` with id/ref `pdxrgsseoxiliotjzsiu`, status `COMING_UP`.
- Project URL and anon key were retrievable through the connector and written to `.env.local`.
- The connector does not expose the database password/pooler URI or service role secret, so `DATABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must still be copied from Supabase Dashboard.

## Error Log

| Error | Attempt | Resolution |
| --- | --- | --- |
| `RandomNumberGenerator.Fill` not available | First attempt to generate `SESSION_SECRET` with newer .NET API | Switch to `RNGCryptoServiceProvider` compatible generation. |

## Stage 3 RLS Review Notes

- RLS policies are installed and real Postgres isolation tests pass when queries run as role `authenticated` with `request.jwt.claims` set.
- Current app repo traffic still uses the configured server-side `DATABASE_URL`; it does not yet inject request JWT claims or `set local role authenticated` into every Drizzle query.
- Therefore, Stage 3 establishes and tests database policies, but full request-by-request RLS enforcement for server repo calls should be treated as a follow-up architecture task if required.
- The policy set intentionally follows the requested `ai_sessions` scope of `SELECT + UPDATE own only`; inserts/deletes remain service-side responsibilities unless a later stage broadens authenticated write policies.

## Reflection - Quest flip aria-label test mismatch
Vitest/JSDOM returned an empty accessible name for flip controls that also carry changing aria-hidden state. The product issue is whether the back-side label leaks task titles, so the focused test should assert the aria-label attribute directly instead of relying on the environment-specific computed accessible name. Fix: replace the three toHaveAccessibleName checks with toHaveAttribute('aria-label', ...), then rerun focused tests.
