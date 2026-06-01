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
npx vitest run src/lib/simulation.test.ts   # Run a single test file
npm run test:integration       # Integration tests (needs DATABASE_URL pointing at test schema)
npx playwright test            # E2E tests (tests/e2e/) — auto-starts its own dev server on :4173 (PLAYWRIGHT_PORT), reusing one if already running
npm run db:generate            # Generate Drizzle migrations
npm run db:seed                # Seed demo users, classrooms, invites, assignments, runs, reports
npm run db:apply-policies      # Apply RLS policies from drizzle/policies.sql
```

## Architecture

### Route Groups

Two Next.js route groups under `src/app/`:

- `(site)` — public marketing/auth pages: landing `/`, `/learn`, `/demo`, `/pricing`, `/reset-password`
- `(platform)` — authenticated app: `/student`, `/student/market`, `/student/history`, `/teacher`, `/parent`, `/admin`

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

Drizzle migrations live in `drizzle/`. RLS policies in `drizzle/policies.sql` are only enforced when `DATABASE_ROLE=authenticated` AND queries go through `withRls()` in `src/lib/db/client.ts`. The default `owner` connection bypasses RLS — application-layer checks in `repo.ts` are the primary defence.

### Simulation Engine

`src/lib/simulation.ts` — pure functions for the 12-round economic sandbox. Actions: trade (buy/sell assets), bank (deposit/withdraw/loan/repay), property (buy/sell), venture (invest/exit). Starting cash: 120,000. Market assets and 24 event cards defined in `src/lib/market-data.ts`.

### Seeded Event Engine

`src/lib/event-engine.ts` — the reproducible-but-varied market-event layer (distinct from Adaptive Events below). A seeded `mulberry32` PRNG builds a per-round event timeline from a run's stored seed (`buildEventTimeline`), so a teacher can replay an identical class scenario while a different seed produces a different run. Events move the market via `eventMarketEffect` (利好/利空 × `impactRange`); decision cards resolve to a cash consequence via `resolveEventChoice` (protect / hold / gamble). Difficulty ramps tier 1 → 3 across the three thirds of the game. The seed is persisted on `scenario_run` (migration `0005_scenario_run_event_seed.sql`) and surfaced through `/api/sim/event-choice` and `/api/sim/replay`.

### Adaptive Events

`src/lib/adaptive-events.ts` — behavior-triggered teaching interventions. Detects: overtrading, revenge trading, bond avoidance, concentration, cash hoarding, positive streaks. Returns max 2 events per round (CLT constraint: 1 warning + 1 info). Integrated into `/api/sim/state`, `/api/sim/actions`, `/api/sim/advance-round` responses.

### Subscription & Billing

`src/lib/billing/subscription.ts` — trial/subscription state machine. States: trial → trial_degraded → expired (free), active (standard/premium). `canUserOperate()` gates simulation actions and round advances. WeChat Pay scaffold in `src/lib/billing/wechat-pay.ts` (requires WECHAT_MCH_ID env vars); purchase-intent helpers in `src/lib/billing/billing-intent.ts`. Family linking (`/api/family/members`, `/api/billing/parent-link`) lets a parent account share a Premium plan with their student(s), which also powers the weekly parent report.

### AI Gateway

All AI provider calls must go through `src/lib/ai.ts`. Direct provider fetches elsewhere are blockers. Supports primary/secondary base URLs with fallback narratives when AI is unavailable.

### Market Data

Real-time quotes from AllTick (`src/lib/alltick.ts`) with a 10-minute refresh cadence (`src/lib/market-refresh.ts`). Teaching-mode fallback when AllTick key is absent. Watchlist tickers and board payload built in `src/lib/market-watchlist.ts`.

### Seasons & Leaderboard

`src/lib/season.ts` — each ISO-ish week is a "season" with a deterministic seed (`currentSeasonSeed`, epoch 2026-01-05). All new runs that week share the same market, so the cross-student weekly leaderboard (`/api/market/season-leaderboard`) is fair. Membership is derived by matching a run's stored seed to the current season seed — no extra column needed.

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

## Key Conventions

- Next.js 16 + React 19 + TypeScript strict. Path alias `@/*` maps to `./src/*`.
- Default to Server Components; `"use client"` only for browser APIs, state, or effects.
- Financial colors: red = up/positive, green = down/negative (Chinese market convention).
- User-facing error messages in Simplified Chinese.
- Validate external boundaries with zod.
- Money/market numbers use tabular figures (`font-variant-numeric: tabular-nums`).

## This is NOT the Next.js you know

This project runs Next.js 16 with breaking changes from older versions. Read relevant local docs in `node_modules/next/dist/docs/` before writing framework-sensitive code.
