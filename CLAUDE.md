# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```powershell
npm run dev                    # Start Next.js dev server (default :3000)
npm run dev -- -p 3100         # Use alternate port
npm run build                  # Production build
npm run start                  # Serve the production build
npm run lint                   # ESLint
npx tsc --noEmit               # Type-check without emitting
npm run test                   # Vitest unit tests (src/**/*.test.ts)
npm run test:watch             # Vitest in watch mode
npm run test:coverage          # Vitest with v8 coverage
npx vitest run src/lib/simulation.test.ts   # Run a single test file
npm run test:integration       # Integration tests (needs DATABASE_URL pointing at test schema)
npx playwright test            # E2E tests (tests/e2e/) — auto-starts its own dev server on :4173 (PLAYWRIGHT_PORT), reusing one if already running
npm run db:generate            # Generate Drizzle migrations from schema.ts changes
npm run db:migrate             # Apply pending migrations to DATABASE_URL (canonical path — `drizzle-kit push` crashes on this DB)
npm run db:seed                # Seed demo users, classrooms, invites, assignments, runs, reports
npm run db:apply-policies      # Apply RLS policies from drizzle/policies.sql
npm run env:doctor             # Diagnose env config at runtime (scripts/runtime-env-doctor.ts)
```

Unit tests live next to their source as `*.test.ts` / `*.test.tsx`. Integration tests are under `tests/integration/` (need `DATABASE_URL`); Playwright E2E specs under `tests/e2e/`.

## Architecture

### Route Groups

Two Next.js route groups under `src/app/`:

- `(site)` — public marketing/auth pages: landing `/`, `/learn`, `/demo`, `/pricing`, `/reset-password`
- `(platform)` — authenticated app: `/student` (+ the 理财 sub-pages `/student/market`, `/student/history`, `/student/rank`, `/student/wealth`, `/student/risk-profile`, `/student/auto-invest`, `/student/life`, `/student/credit`, `/student/quests`), `/teacher`, `/parent`, `/admin`

`(platform)/layout.tsx` is the single auth boundary — redirects unauthenticated users to `/demo?reason=login_required`. Individual pages enforce their own role check.

### Data Flow

```
API route  →  src/lib/api-guard.ts (auth + role check)
           →  src/lib/db/repo.ts   (repository layer — single bridge to persistence)
           →  src/lib/db/client.ts  (Drizzle + Postgres)
           ↘  src/lib/store.ts      (in-memory fallback when DATABASE_URL is absent)
```

`repo.ts` is the only module that API routes call for data access. When `DATABASE_URL` is missing or the DB query fails, every function delegates to the in-memory store (`store.ts`) so the offline teacher-laptop demo keeps working. The flag `ALLOW_MEMORY_FALLBACK=true` controls whether this silent fallback is allowed.

### Auth

HTTP-only cookie `brown_zone_session` containing a HS256 JWT. Claims: `userId`, `role`, `email`, `classroomId`, `tv` (token version). Token version is bumped on logout/password change to server-side revoke outstanding JWTs.

- `src/lib/auth.ts` — JWT creation, reading, cookie management
- `src/lib/session-user.ts` — `getCurrentUser()` with `React.cache` for per-request dedup in Server Components
- `src/lib/api-guard.ts` — `requireUser(role?)` for API routes
- `src/lib/rate-limit.ts` — in-memory sliding-window limiter (`rateLimit()` / `rateLimitKey()`) guarding auth and AI routes (login, register, guest-upgrade, `/api/ai/*`, portfolio-intel). Per-process only — not shared across serverless instances.

### RLS

Drizzle migrations live in `drizzle/` (currently through `0013_app_settings`). RLS policies in `drizzle/policies.sql` are only enforced when `DATABASE_ROLE=authenticated` AND queries go through `withRls()` in `src/lib/db/client.ts`. The default `owner` connection bypasses RLS — application-layer checks in `repo.ts` are the primary defence. `src/lib/db/rls-context.ts` (`withUserRls()` / `rlsClaimsForUser()`) is the per-user wrapper that sets the request's JWT claims for an RLS-scoped query — used by the AI-history routes.

### Security Hardening Conventions

Recent hardening (commits P1–P8) established invariants that new code must preserve:

- **CSRF**: state-changing routes call `checkOrigin()` from `src/lib/api-response.ts` to reject cross-origin requests. Applied to `/api/sim/*` and billing routes; add it to any new mutating route.
- **No silent write-fallback**: `repo.ts` may fall back to the in-memory store for *reads* when the DB is down, but *writes* must surface the DB error instead of silently writing to memory (P2). `ALLOW_MEMORY_FALLBACK` gates the read fallback only.
- **Query timeout**: the Postgres client sets server-side `statement_timeout` (`DB_QUERY_TIMEOUT_MS`, default 5000ms) in `src/lib/db/client.ts` so slow queries are cancelled rather than hanging.
- **Rate limiting**: extend `src/lib/rate-limit.ts` coverage when adding auth, AI, or payment-intent routes (e.g. `/api/billing/prepay`).

### Simulation Engine

`src/lib/simulation.ts` — pure functions for the 12-round economic sandbox. Actions: trade (buy/sell assets), bank (deposit/withdraw/loan/repay), property (buy/sell), venture (invest/exit). Starting cash: 120,000. Market assets and 24 event cards defined in `src/lib/market-data.ts`.

### Seeded Event Engine

`src/lib/event-engine.ts` — the reproducible-but-varied market-event layer (distinct from Adaptive Events below). A seeded `mulberry32` PRNG builds a per-round event timeline from a run's stored seed (`buildEventTimeline`), so a teacher can replay an identical class scenario while a different seed produces a different run. Events move the market via `eventMarketEffect` (利好/利空 × `impactRange`); decision cards resolve to a cash consequence via `resolveEventChoice` (protect / hold / gamble). Difficulty ramps tier 1 → 3 across the three thirds of the game. The seed is persisted on `scenario_run` (migration `0005_scenario_run_event_seed.sql`) and surfaced through `/api/sim/event-choice` and `/api/sim/replay`.

### Adaptive Events

`src/lib/adaptive-events.ts` — behavior-triggered teaching interventions. Detects: overtrading, revenge trading, bond avoidance, concentration, cash hoarding, positive streaks. Returns max 2 events per round (CLT constraint: 1 warning + 1 info). Integrated into `/api/sim/state`, `/api/sim/actions`, `/api/sim/advance-round` responses.

### Financial-Planning (理财) Layer

The 2.0 multi-tool teaching layer — pure-core modules (each with a sibling `*.test.ts`) that derive 理财 lessons from a finished/in-progress `ScenarioRun`, mirroring the simulation engine's no-IO style. `src/lib/allocation.ts` (`buildWealthSummary()`) is the shared core the others build on:

- `risk-profile.ts` — risk-tolerance questionnaire → risk band (`defensive`/`steady`/`balanced`/`growth`).
- `auto-invest.ts` — 定投 / dollar-cost-averaging planner.
- `life-cashflow.ts` — household budgeting + insurance plan teaching (budget/insurance presets).
- `quests.ts` — financial-literacy quest/checklist progression.
- `credit-lab.ts` — credit-score sandbox.

Thin routes under `src/app/api/student/**` (`wealth-summary`, `risk-profile`, `auto-invest`, `life-cashflow`, `quests`, `credit-lab`) feed the matching `(platform)/student/*` pages.

### Subscription & Billing

`src/lib/billing/subscription.ts` — trial/subscription state machine. States: trial → trial_degraded → expired (free), active (standard/premium). `canUserOperate()` gates simulation actions and round advances. WeChat Pay scaffold in `src/lib/billing/wechat-pay.ts` (requires WECHAT_MCH_ID env vars); purchase-intent helpers in `src/lib/billing/billing-intent.ts`. Family linking (`/api/family/members`, `/api/billing/parent-link`) lets a parent account share a Premium plan with their student(s), which also powers the weekly parent report.

**Manual WeChat collection** (`src/lib/billing/manual-wechat.ts`) is the live fallback while the merchant API is not provisioned: an admin configures a collection QR + payee (`/api/admin/billing/manual-config`), a buyer submits payment proof (`/api/billing/manual-proof`), and an admin confirms it (`/api/admin/billing/manual-confirm`). Operator-managed, non-secret config is stored in the `app_settings` table (migration `0013_app_settings`, key `billing.manual_wechat`) via `getAppSetting()`/`upsertAppSetting()` in `repo.ts` — secrets still belong in env.

### AI Gateway

All AI provider calls must go through `src/lib/ai.ts`. Direct provider fetches elsewhere are blockers. Supports primary/secondary base URLs with fallback narratives when AI is unavailable. The global assistant is wired via `src/lib/assistant-config.ts` + `assistant-context.ts`. AI chat sessions are persisted and read back per-user through `/api/ai/history` (+ `/[sessionId]`), which reads via the RLS-scoped `withUserRls()` path.

### Market Data

Real-time quotes come from the external `MarketDataProvider`s AllTick (`src/lib/alltick.ts`) and/or iTick (`src/lib/itick.ts`) — selectable individually or combined (`hybrid`) — on a 10-minute refresh cadence (`src/lib/market-refresh.ts`). Teaching-mode `fallback` kicks in when no provider key is present. Watchlist tickers and board payload built in `src/lib/market-watchlist.ts`.

### Seasons & Leaderboard

`src/lib/season.ts` — each ISO-ish week is a "season" with a deterministic seed (`currentSeasonSeed`, epoch 2026-01-05). All new runs that week share the same market, so the cross-student weekly leaderboard (`/api/market/season-leaderboard`) is fair. Membership is derived by matching a run's stored seed to the current season seed — no extra column needed.

### 财商战力 Power Rank

`src/lib/leaderboard/**` — the 王者-style competitive ranking layer (migrations `0010`–`0012`), separate from the seed-based season leaderboard above. The pipeline is pure-core + thin-service:

- `power-score.ts` — `computePowerScore()` maps a run to **财商战力** (0–2000): a weighted composite of risk-adjusted return (.30), discipline (.25), drawdown control (.20), learning completion (.15), and growth (.10). Ranks decision *quality*, not luck (anti-YOLO) — weights are surfaced to students in a transparency panel (`powerFormula()`). Pure, no IO.
- `run-power.ts` — adapter from a sim run + `learning_progress` into `PowerScoreInput`.
- `tiers.ts` — power→tier bands; `periods.ts` — `weekly` / `monthly` / `season` period keys (season uses a 校历-aligned semester key).
- `ranking.ts` — pure ranker over snapshots across four scopes (`school` / `city` / `province` / `nation`), mirroring the SQL `RANK() OVER (PARTITION BY scope)` path. Enforces visibility privacy (`public` / `school_only` / `hidden`); ranks are computed over exactly the displayed set so hiding leaks no rank gaps.
- `service.ts` — the bridge API routes call: `getLeaderboardBoard()`, `getPowerCard()` (private to the player, works even when hidden/unconsented), and `recomputePowerForUser()` / `recomputeAllRankedUsers()` (writes a snapshot into all live period buckets; no-op for non-onboarded users so the hot gameplay path never writes orphan rows).
- `regions.ts` / `school-normalize.ts` — region code + school-name normalization for scope assignment.

Routes under `src/app/api/leaderboard/**` (`board`, `me`, `profile`, `regions`, `schools`); UI at `/student/rank`. A student must onboard a rank profile (alias + region + consent) before appearing on any board. Snapshots are refreshed by the Vercel Cron `GET /api/cron/recompute-leaderboard` (same `CRON_SECRET` Bearer auth as the weekly report). The learning-completion input (`.15` of the power score) is fed by `/api/learn/progress` and `/api/learn/complete`, persisted to `learning_progress` (migration `0012`).

### Transactional Email & Cron

`src/lib/email.ts` — Resend transactional email (`RESEND_API_KEY` + `EMAIL_FROM`). Degrades gracefully: when unconfigured, `sendEmail` returns `not_configured` and callers surface a dev link instead of throwing, so email verification (`src/lib/email-verification.ts`, `/api/auth/verify`) and password reset (`src/lib/password-reset.ts`, `/api/auth/forgot`, `/api/auth/reset`) keep working offline. The Premium weekly parent report is a Vercel Cron `GET /api/cron/weekly-report`, authorised by `Authorization: Bearer $CRON_SECRET` (mandatory in production).

### Design Tokens

Tailwind v4 CSS custom properties in `src/app/globals.css`. Key semantic scales:

- `--amber-*` — brand
- `--ink-*` — neutrals
- `--up-*` (red) — positive market moves; `--down-*` (green) — negative market moves
- `--info-*`, `--warning-*`, `--error-*` — status

Token spec: `docs/ui-spec/01-tokens.md`

### Component Organization

```
src/components/
  site/       — public pages (header, footer, hero, ticker tape, learn catalog)
  platform/   — authenticated shell (platform-layout)
  student/    — student dashboard, market board, history review, allocation, tutor radar
  teacher/    — teacher console
  admin/      — admin user manager
  demo/       — demo portal
  shared/     — cross-cutting (money-text, access-gate, global-ai-assistant)
```

### API Error Shape

All route errors use: `{ error: <stable_code>, message: <中文提示> }`. Error codes defined in `src/lib/api-response.ts`: `invalid_input`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `db_unavailable`, `service_unavailable`.

### Env Validation

`src/lib/env.ts` validates all environment variables with zod at startup. Most are optional for dev (the app degrades gracefully without DATABASE_URL or AI keys). `SESSION_SECRET` must be >= 32 chars in production.

### Testing Layers

Beyond plain unit tests, the suite mixes several techniques — match the existing pattern when touching these areas:

- **Property-based** (`fast-check`): determinism/invariant guards, e.g. `determinism.guard.test.ts`, `simulation.money.test.ts`. The seeded engines (`event-engine`, `season`) must stay reproducible.
- **MSW** (`msw`): the AI gateway (`src/lib/ai.ts`) is tested against mocked provider responses (`ai-gateway.msw.test.ts`, `ai-format-drift.test.ts`) — never hit a real provider in tests.
- **Accessibility** (`axe-core` / `vitest-axe`): component a11y assertions.
- **Audit tests**: `repo-fallback.audit.test.ts` / `repo-logging.test.ts` enforce the no-silent-write-fallback and logging invariants above — keep them green when changing `repo.ts`.

## Key Conventions

- Next.js 16 + React 19 + TypeScript strict. Path alias `@/*` maps to `./src/*`.
- Default to Server Components; `"use client"` only for browser APIs, state, or effects.
- Financial colors: red = up/positive, green = down/negative (Chinese market convention).
- User-facing error messages in Simplified Chinese.
- Validate external boundaries with zod.
- Money/market numbers use tabular figures (`font-variant-numeric: tabular-nums`).

## This is NOT the Next.js you know

This project runs Next.js 16 with breaking changes from older versions. Read relevant local docs in `node_modules/next/dist/docs/` before writing framework-sensitive code.
