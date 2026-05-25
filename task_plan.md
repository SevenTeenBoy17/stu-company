# Task Plan

## Goal

Complete the unfinished workflow gate safely: finish Stage 0 environment readiness and Stage 1.1 Supabase connection verification before any migration, schema, or seed work.

## Assumptions

- Stage 1.1 connection gate is now passed.
- `APP_URL`, `SESSION_SECRET`, Supabase URL, anon key, and service role key are present.
- Supabase connector can read public project metadata but cannot expose the database password or full service secrets.
- Stage 1.2 should stop after each numbered step and wait for confirmation.

## Phases

| Phase | Status | Notes |
| --- | --- | --- |
| Supervisor bootstrap | complete | Context snapshot and current goal created. |
| Environment completion | complete | `.env.local` has the required values and `DATABASE_URL` uses the working Supabase pooler host. |
| Required env verification | complete | Required keys are non-empty and `DATABASE_URL` shape is valid for Drizzle/Postgres. |
| Supabase connection test | complete | Stage 1.1 one-shot test returned `connection ok`. |
| Stage 1.2 step 1 migration generation | complete | Generated `drizzle/0000_regular_luminals.sql` and metadata; stopped before review/apply. |
| Stage 1.2 FK/index repair | complete | Added Drizzle references and lookup indexes in `src/lib/db/schema.ts`; regenerated migration. |
| Stage 1.2 step 2 migration review | complete | Re-review approved: 16 tables, 21 FKs, 25 indexes, PK/unique constraints reasonable. |
| Stage 1.2 step 3 migration apply | complete | `npx drizzle-kit migrate` applied the approved migration successfully to Supabase. |
| Stage 1.2 step 4 remote verification | complete | Drizzle introspect connected and fetched 16 tables but hit a Drizzle Kit check-constraint bug; read-only catalog verification confirmed tables/FKs/indexes remotely. |
| Stage 1.3 seed script | complete | `scripts/seed.ts` now writes the in-memory demo seed to Supabase idempotently; `npm run db:seed` confirmed 6 users / 1 classroom / 3 invites / 2 assignments / 3 runs / 1 growth report. |
| Stage 1.4 repo adapter | complete | Implemented `src/lib/db/repo.ts` Drizzle branches with fallback behavior and added `src/lib/db/repo.test.ts`; tsc, db tests, full tests, lint, build, read-only Supabase smoke, graph review, and reviewer audit passed. |
| Stage 2 API route migration | complete | Migrated Auth, Simulation, Role Dashboard, AI Session, and Market API batches from `@/lib/store` to `@/lib/db/repo`; added awaits and standardized touched error responses. |
| Stage 3 RLS & real auth hardening | complete | Added `drizzle/policies.sql`, `npm run db:apply-policies`, JWT `sub/role/classroomId` claims, and real Postgres RLS isolation tests. |
| Stage 4.1 UI token migration | complete | Applied primitive tokens, replaced the global Tailwind theme block, migrated global fonts to Noto Sans SC/Noto Serif SC/Inter/JetBrains Mono, built successfully, and captured screenshots. Component-level raw color/arbitrary class migration remains tracked as UI debt. |
| Stage 4.2 student dashboard refactor | complete | Refactored the student dashboard hero metrics, action panel, holdings/timeline rail, Mr.Brown tutor panel, leaderboard, and responsive ordering. Visual QA found and fixed an invisible allocation panel caused by an initial opacity animation. |
| Stage 4.3 student market refactor | complete | Refactored the student market board into a clearer responsive layout with watchlist grid, main stock card, key fields, radar + metric explanations, sector structure, rankings, heat bars, classroom tips, and content cards. |
| Stage 4.4 UI audit pass | complete | Added `docs/ui-spec/audit-2026-05-25.md` and page-level `UI-DEBT` comments for remaining token/type/spacing/loading-state work. |
| Redline review | complete | `.env.local` remains ignored and unstaged; no `git commit -a`, no `git add .`, no raw AI provider fetch outside `src/lib/ai.ts`, and reviewer found no blocker. |

## Verification Criteria

- `.env.local` has all required keys present and non-empty.
- `DATABASE_URL` starts with `postgresql://` or `postgres://`.
- Supabase connection test reports `connection ok`.
- Stage 1.2 step 1 generates a migration file under `drizzle/` without applying it.
- `git diff` shows no unintended business-code/schema/API changes from this round.
- `.env.local` remains untracked.

## Current Stop Point

Stage 4.2, Stage 4.3, and Stage 4.4 are complete. The remaining UI work is the documented debt from `docs/ui-spec/audit-2026-05-25.md`; do not treat those audit comments as blockers for the current stage.

Generated files:

- `drizzle/0000_regular_luminals.sql`
- `drizzle/meta/0000_snapshot.json`
- `drizzle/meta/_journal.json`

Observed summary:

- `CREATE TYPE`: 1
- `CREATE TABLE`: 16
- `ALTER TABLE`: 0
- `CREATE INDEX`: 0
- unique constraints: 2

Important review note for Stage 1.2 step 2:

- Workflow text says to confirm 13 tables, but generated SQL currently creates 16 tables.
- Generated SQL currently has no FK or index statements, so Stage 1.2 step 2 must decide whether this is acceptable or whether `src/lib/db/schema.ts` needs relationship/index definitions before applying.

## Stage 1.2 Step 2 Initial Review Result

Decision: `blocked`.

Passed checks:

- `role` enum values match the app roles: `student`, `teacher`, `parent`, `admin`.
- Generated SQL has 16 tables, exactly matching the 16 `pgTable(...)` declarations in `src/lib/db/schema.ts`.
- The workflow's "13 tables" note is stale relative to the current product data model and schema.
- Primary keys exist for all 16 tables.
- Unique constraints exist for `users.email` and `invite_codes.code`.

Blocking issue:

- The generated migration has zero `REFERENCES` / foreign-key constraints.
- Clear relational fields are currently unconstrained: `profiles.user_id`, `classrooms.teacher_id`, `scenario_runs.user_id`, `scenario_runs.classroom_id`, `portfolio_snapshots.run_id`, `holdings.run_id`, `cash_ledger.run_id`, `assignments.classroom_id`, `assignments.created_by`, `ai_sessions.user_id`, `growth_reports.student_user_id`, `growth_reports.parent_user_id`, and related link fields.

Recommended next step:

- Do not apply this migration yet.

## Stage 1.3 Seed Result

Decision: `complete`.

Implemented:

- Exported `createSeedStore()` from `src/lib/store.ts` so Postgres seed data reuses the exact in-memory demo source.
- Replaced the `scripts/seed.ts` skeleton with idempotent Drizzle inserts and a small `.env/.env.local` loader.
- Added `npm run db:seed`.
- Seed handles circular FK dependencies by inserting users without relationship FKs first, inserting classrooms/parent links, then updating user relationship columns.
- Seed makes generated scenario/action IDs deterministic inside the script so repeat runs do not duplicate scenario runs.

Verification:

- `npx tsc --noEmit`
- `npm run db:seed` twice; counts stayed `6 users / 1 classroom / 3 invites / 2 assignments / 3 runs / 1 growth report`.
- `npm run test`
- `npm run lint`
- `npm run build`
- `python -m code_review_graph build --repo . --skip-flows`
- `python -m code_review_graph detect-changes --repo . --base HEAD --brief`

## Stage 1.4 Repo Adapter Result

Decision: `complete`.

Implemented:

- Replaced the `src/lib/db/repo.ts` skeleton with Drizzle-based DB branches for users, profiles, invites, auth, registration, simulation state, run mutations, teacher/parent/admin overview data, leaderboards, assignments, and AI session history.
- Preserved transparent fallback behavior to `src/lib/store.ts` when `DATABASE_URL` is missing or a query fails.
- Wrapped `registerUserByInvite`, `applyActionForUser`, and `advanceRunForUser` in Drizzle transactions.
- Reused simulation helpers: `createInitialRun`, `applySimulationAction`, `advanceSimulationRun`, `buildSimulationState`, `buildGrowthReport`, `buildLeaderboard`, and `buildBehaviorSignals`.
- Added `src/lib/db/repo.test.ts`, covering every exported repo function/helper in fallback mode.

Verification:

- `npx tsc --noEmit`
- `npm run test -- src/lib/db`
- Read-only Supabase smoke through `repo.ts`: user/profile/invite/auth/simulation/teacher/parent/admin/leaderboard all returned expected seeded data.
- `npm run test`
- `npm run lint`
- `npm run build`
- `python -m code_review_graph build --repo . --skip-flows`
- `python -m code_review_graph detect-changes --repo . --base HEAD --brief`
- Reviewer subagent audit: no blockers, no redlines touched.

Scope note:

- Current working tree still contains prior Stage 1.2/1.3 changes outside `src/lib/db/**`.
- The Stage 1.4 work itself was limited to `src/lib/db/repo.ts` and `src/lib/db/repo.test.ts`.
- Add Drizzle `.references(...)` definitions and likely basic lookup indexes in `src/lib/db/schema.ts`, regenerate the migration, then rerun Stage 1.2 step 2.

## Stage 2 API Route Migration Result

Decision: `complete`.

Implemented:

- Batch 2.1 Auth: migrated login/logout/register/invite validation routes to async repo calls and stable error shapes.
- Batch 2.2 Simulation: migrated state/actions/advance-round routes to async repo calls while preserving friendly sandbox errors.
- Batch 2.3 Role dashboards: migrated teacher classroom/assignments, parent report, and student history-review routes.
- Batch 2.4 AI Sessions: migrated chat/history/tutor/radar API persistence and simulation state reads to repo; `src/lib/ai.ts` was not changed.
- Batch 2.5 Market: migrated portfolio-intel simulation state read to repo and standardized market route errors.
- Updated shared auth helpers `src/lib/api-guard.ts` and `src/lib/session-user.ts` to await repo-backed user lookup.
- Added `src/lib/api-response.ts` for consistent `{ error, message }` error responses and DB-unavailable 503 handling.

Verification:

- Batch-level `npx tsc --noEmit` and `npm run test` passed after Batch 3, Batch 4, and Batch 5.
- Final `npm run lint` passed.
- Final `npm run build` passed.
- `git grep -n "globalThis.__brownZoneStore__" src/app/api/` returned 0 matches.
- `git grep -n "from \"@/lib/store\"" src/app/api/` returned 0 matches.
- `python -m code_review_graph build --repo . --skip-flows` succeeded.
- `python -m code_review_graph detect-changes --repo . --base HEAD --brief` reported 0 affected flows / 0 test gaps / risk 0.00.
- Reviewer subagent audit found no blockers and no redline violations.

Redline review:

- No `git commit -a` used.
- No `git add .` used.
- `.env.local` remains ignored and unstaged.
- No raw AI provider fetch was introduced outside `src/lib/ai.ts`.
- Stage 2 API scope did not modify UI or schema files.

## Stage 3 RLS & Real Auth Hardening Result

Decision: `complete`.

Implemented:

- Added `drizzle/policies.sql` with RLS enabled for `users`, `scenario_runs`, `ai_sessions`, `growth_reports`, `assignments`, and `invite_codes`.
- Added helper functions under `app_private` so policies can safely read string user IDs from JWT `sub`, role, and classroom claims without relying on UUID-only `auth.uid()` casts.
- Added `npm run db:apply-policies` via `scripts/apply-policies.ts`.
- Applied policies to the configured Supabase Postgres database; command returned `RLS policies applied`.
- Updated `src/lib/auth.ts` session JWT creation to set `sub = userId` and carry `role` plus `classroomId`.
- Updated login/register routes to pass `classroomId` into `persistSession`.
- Added `tests/integration/rls.test.ts` for real Postgres role isolation.

Verification:

- `npm run db:apply-policies`
- `npx vitest run tests/integration/rls.test.ts`: 4 tests passed.
- `npx tsc --noEmit`
- `npm run test`: 10 files / 33 tests passed.

## Stage 4.1 Design Token Migration Result

Decision: `review-gate`.

Implemented:

- Added §2 primitive color scale to `:root` in `src/app/globals.css`.
- Replaced the global `@theme inline` block with the token set from `docs/ui-spec/01-tokens.md` §11.
- Updated global font loading in `src/app/layout.tsx` to use `Noto Sans SC`, `Noto Serif SC`, `Inter`, and `JetBrains Mono` through `next/font/google`.
- Updated the root body classes from old `bg-background text-foreground` to new token names.
- Captured screenshots for review:
  - `.codex-supervisor/screenshots/stage4-1-home-1440.png`
  - `.codex-supervisor/screenshots/stage4-1-home-390.png`

Verification:

- `npm run lint`
- `npm run build`
- `python -m code_review_graph build --repo . --skip-flows`
- `python -m code_review_graph detect-changes --repo . --base HEAD --brief`

Review-gate note:

- Component grep still reports existing hardcoded component styles: `205` hex color matches and `191` `text-[|p-[|w-[|h-[` matches under `src/components/`.
- Per workflow 4.1, the next component-level migration/refactor is intentionally stopped until screenshots are reviewed.

## Stage 1.2 FK Repair Result

Implemented in `src/lib/db/schema.ts`:

- Added Drizzle `.references(...)` constraints for user/profile/classroom/invite/link/run/report/assignment/session/run-child relationships.
- Added basic lookup indexes for role, classroom, user, run, link, asset, scope, and type columns.
- Regenerated migration after deleting the old unapplied `drizzle/` output.

Regenerated migration:

- `drizzle/0000_minor_wonder_man.sql`
- `drizzle/meta/0000_snapshot.json`
- `drizzle/meta/_journal.json`

Re-review result: `approved`.

Generated migration now contains:

- 1 enum
- 16 tables
- 16 primary keys
- 2 unique constraints
- 21 foreign keys
- 25 indexes

Verification:

- `npx tsc --noEmit`: passed
- `npm run test`: passed, 8 files / 23 tests
- `npm run lint`: passed with existing warning in `scripts/seed.ts` (`db` unused)

Current stop point:

- Wait for user confirmation before Stage 1.2 step 3 apply migration.
- Seed work in Stage 1.3 must insert circular data in phases: create users with nullable `classroom_id` / `student_link_id` where needed, insert classrooms/links, then update user link fields before dependent rows.

## Final FK Repair Review

Decision: `approved for Stage 1.2 step 3 confirmation`.

- `src/lib/db/schema.ts`: 16 tables, 21 references, 25 indexes.
- `drizzle/0000_minor_wonder_man.sql`: 16 `CREATE TABLE`, 21 FK constraints, 25 `CREATE INDEX`, 2 unique constraints.
- `npx tsc --noEmit`: passed.
- `npm run test`: passed.
- `npm run lint`: passed with one pre-existing warning in `scripts/seed.ts`.
- `code-review-graph build/detect-changes`: passed, 0 affected flows, 0 test gaps.
- Reviewer found no redline violations or blockers.

Next stop:

- Stage 1.2 step 3 is complete.
- Wait for user confirmation before Stage 1.2 step 4 introspect.

## Stage 1.2 Step 3 Apply Result

Decision: `complete`.

Sanitized command:

- `npx drizzle-kit migrate`

Sanitized result:

- Drizzle read `drizzle.config.ts`.
- Drizzle used the Postgres driver.
- Migrations applied successfully.

Not run:

- Stage 1.2 step 4 introspect.
- Any reset/drop operation.
- Any API/seed/repo migration work.

## Stage 1.2 Step 4 Remote Verification Result

Decision: `complete with fallback verification`.

`npx drizzle-kit introspect` result:

- Connected to the remote database.
- Fetched 16 public tables and 1 enum.
- Then crashed in Drizzle Kit while parsing check constraints: `TypeError: Cannot read properties of undefined (reading 'replace')`.
- Temporary introspect output directory was removed.

Read-only remote catalog verification:

- public tables: 16
- role enum: 1, labels `student`, `teacher`, `parent`, `admin`
- primary keys: 16
- foreign keys: 21
- unique constraints: 2
- lookup indexes ending `_idx`: 25
- Drizzle migration table present: yes

Verified table names:

- `ai_sessions`
- `assignments`
- `cash_ledger`
- `classrooms`
- `event_cards`
- `growth_reports`
- `holdings`
- `invite_codes`
- `leaderboards`
- `portfolio_snapshots`
- `profiles`
- `property_positions`
- `scenario_runs`
- `student_parent_links`
- `users`
- `venture_positions`

Next stop:

- Stage 1.2 is complete enough to move to Stage 1.3 seed work, but note the introspect command itself has a Drizzle Kit bug on check constraints. Use the catalog verification as the authoritative remote DB check for this round.
