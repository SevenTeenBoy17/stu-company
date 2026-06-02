# Random event engine + teen-finance conversion, billing & family (Premium)

Branch: `feat/random-event-engine-and-conversion-p0` → `main` · **8 commits**

Delivers the random financial-event engine (the product's differentiator), the four
teen-finance conversion fixes from the audit, the Standard/Premium two-tier system
with all perks enforced, transactional email (Resend), email-verification (gray-launch),
self-service password reset, and the family-group Premium model (Option B) with a weekly
parent-report cron. Audit + roadmap: `docs/product-optimization-audit-2026-05-30.md`.

---

## ⚠️ Reviewer note — diff size vs actual change

`git diff main...HEAD --stat` reports **53 files, +5880 / −672**, which is **larger than
the work in this branch**. The working tree already had **extensive uncommitted WIP**
before this effort (50+ modified files from prior sessions). Several shared files
(`src/lib/simulation.ts`, `src/lib/db/repo.ts`, `src/lib/db/schema.ts`,
`src/components/student/student-sandbox.tsx`, `src/components/demo/demo-portal.tsx`,
`.env.example`, etc.) carried that pre-existing WIP, and committing this feature on top of
them bundled it in. Only explicit paths were staged (no `git add .`); untouched WIP files
(`src/lib/ai.ts`, `scripts/seed.ts`, etc.) were left uncommitted. **Review the commits
individually** (each is a coherent, self-contained feature) rather than the squashed diff.

---

## What's included (by feature)

### 1. Random financial-event engine — the differentiator (`812162b`, `70056e9`, `fd43027`)
- **`src/lib/event-engine.ts`** (pure, fully TDD'd): mulberry32 seeded PRNG, tier
  classification, a seeded 12-round event timeline, and an event→market effect
  (利好↑ / 利空↓ on `impactAssets`, scaled by `impactRange`).
- Each run now stores a `seed` + `eventTimeline` (`scenario_runs` cols, migration **0005**),
  so playthroughs **vary** and are **reproducible** (a teacher can replay an identical
  scenario). Legacy seed-less runs fall back to the old fixed script (backward compatible).
- **Event library 26 → 40 cards** (E4), tiered (fixes the thin tier-3 advanced bucket);
  every new card teaches an intermediate/advanced concept and moves the seeded market.
- **Interactive decision cards** (E3): `EventChoice` + `applyEventChoice` (one decision/
  round, seeded cash consequence: hold / protect / gamble) on 流动性危机 / 杠杆诱惑 / 逼空;
  `POST /api/sim/event-choice`; sandbox renders choice buttons + outcome.

### 2. Teen-finance conversion fixes (`812162b`, `fd43027`)
- **T1** — onboarding prediction quiz now responds to the learner's guess and reveals a
  **down** move (kills the "markets always go up" anchor).
- **B2** — trial restructure: full AI spans the trial, only the final day degrades.
- **B1** — student→parent one-tap pay: `POST /api/billing/parent-link` issues a signed
  `/pricing?upgrade=<token>` link; prepay lets a parent pay for the named student without
  linking; sandbox banner CTA + checkout honor the link. Removes the expiring-student
  dead-end.

### 3. Email, verification, password reset (`fd43027`, `e26ca50`, `52088e3`)
- **Resend** transactional email (`src/lib/email.ts`): verification + reset + weekly-report
  templates; degrades gracefully (reports `not_configured`, never throws) — auth works
  without a provider, surfacing a dev link instead.
- **A1 email verification**: signed token + `/api/auth/verify` + `users.email_verified_at`
  (migration **0006**); register emails the link. **Gray-launch gate**
  `REQUIRE_EMAIL_VERIFICATION` (default OFF) + pure `evaluatePersonalAiAccess` (TDD) gates
  the 4 AI-assessment routes — paid users never gated; flip the flag to enforce.
- **A2 self-service password reset**: signed reset token (distinct purpose, cross-purpose
  rejection tested) + `/api/auth/forgot` (anti-enumeration) + `/api/auth/reset` (bumps
  `tokenVersion` to revoke old sessions) + `/reset-password` page + "忘记密码？" in login.

### 4. Standard / Premium two tiers + perks (`e26ca50`, `52088e3`, `89516d8`)
- **Standard ¥15/月** (1 student) vs **Premium ¥30/月** (family) encoded as `TierFeatures`
  on `SubscriptionState` (`maxStudents` / `deepAiReport` / `weeklyParentEmail` /
  `seasonReplay`), TDD'd; prepay opens the premium SKU; tier-aware checkout + 2-tier pricing.
- **deepAiReport** → `deriveInvestorPersona(run)` (pure, deterministic, TDD); radar route
  returns a `persona` card only for Premium; surfaced in the sandbox.
- **seasonReplay** → `POST /api/sim/replay` resets the run to a fresh seed (403 for
  non-Premium); a "🔄 新赛季（高级版）" button in the sandbox.

### 5. Family groups (Option B) + weekly cron (`70313a6`, `7f52f03`)
- **`family_members`** table (migration **0007**): a Premium parent hosts up to
  `maxStudents` children who **inherit Premium**. Enforced: seat cap (`canAddFamilyMember`,
  TDD), Premium owner, parent-link. `applyFamilyEntitlement` runs once at the `requireUser`
  auth boundary so the effective tier is seen by every downstream gate/feature.
- `GET/POST/DELETE /api/family/members` + a `FamilyManager` UI on `/parent` (buy Premium
  for self, then add/remove children by email).
- **Vercel Cron weekly parent report**: `vercel.json` schedules `/api/cron/weekly-report`
  (Mon 09:00 UTC, guarded by `CRON_SECRET`); emails each Premium owner a digest
  (round / net worth / investor persona) via Resend.

---

## Database migrations (apply in order)
| File | Change |
|---|---|
| `drizzle/0005_scenario_run_event_seed.sql` | `scenario_runs.seed` (int) + `event_timeline` (jsonb), nullable |
| `drizzle/0006_user_email_verified.sql` | `users.email_verified_at` (timestamp), nullable |
| `drizzle/0007_family_members.sql` | new `family_members` table (owner/student, unique student) |

All additive and backward-compatible (nullable columns / new table). `_journal.json` updated.

## New environment variables (all optional; features degrade without them)
| Var | Purpose |
|---|---|
| `RESEND_API_KEY`, `EMAIL_FROM` | Transactional email delivery (verification / reset / weekly report) |
| `REQUIRE_EMAIL_VERIFICATION` | Gray-launch flag (default `false`) to enforce email verification |
| `CRON_SECRET` | Auth for the Vercel Cron weekly-report endpoint |

## New API routes
`/api/auth/verify`, `/api/auth/forgot`, `/api/auth/reset`, `/api/billing/parent-link`,
`/api/sim/event-choice`, `/api/sim/replay`, `/api/family/members`,
`/api/cron/weekly-report`; new page `/reset-password`.

---

## Testing
Quality bar **green** on the final commit:
- `npm run lint` — clean
- `npx tsc --noEmit` — clean
- `npm run test` — **126 unit tests pass** (event engine, decision cards, persona,
  subscription/tiers/gate/family-cap, email seam, token utils, family store)
- `npm run build` — succeeds
- `npx playwright test` — **17/17 e2e pass** (includes the parent-checkout billing path
  and student sandbox smoke; one transient dev-server cold-start flake observed once, green
  on re-run)

New TDD test files: `event-engine.test.ts`, `market-data.test.ts`, `email.test.ts`,
`email-verification.test.ts`, `password-reset.test.ts`, `store-family.test.ts`, plus
additions to `simulation.test.ts` and `subscription.test.ts`.

## Activation checklist (post-merge)
1. Set `RESEND_API_KEY` + `EMAIL_FROM`; register a test account and confirm the verification
   email arrives.
2. Set `CRON_SECRET` in Vercel; verify the weekly cron appears under Project → Cron Jobs.
3. Once email delivery is confirmed, set `REQUIRE_EMAIL_VERIFICATION=true` to enforce.
4. Apply migrations 0005–0007 to the database.

## Out of scope (P2, follow-on)
Streaks / season leaderboard / shareable persona card, behavior-bias overlay cards.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
