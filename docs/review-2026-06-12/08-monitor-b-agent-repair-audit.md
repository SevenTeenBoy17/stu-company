# Monitor B Agent Repair And Verification Audit

Date: 2026-06-13
Workspace: `D:\tree-shude-c2\brown-zone-web` (display alias; actual path contains Chinese characters)

## Purpose

This audit records the current state of the project-only Monitor B agent and the focused verification slices completed after the agent repair work.

Monitor B exists only for this Brown Zone project. Its job is to keep implementation aligned with the project review plan and the Codex execution manual stored in `docs/review-2026-06-12`.

## Monitor B Agent Status

Artifact:
- `.codex/agents/monitor_b.toml`

Current status:
- TOML parses successfully.
- The agent is project-scoped, not global.
- The agent is read-only by design.
- It references the local review plan and execution manual.
- It enforces the following project red lines:
  - Do not touch `.env.local`.
  - Do not use broad `git add .` / `git commit -a`.
  - Do not bypass `src/lib/ai.ts` for AI gateway calls.
  - Do not let UI implementation work drift into API/schema/payment/auth logic.
  - Do not let API migration work drift into UI/schema changes.
  - Keep front-end and back-end chains verifiable before delivery.

Verdict:
- Monitor B agent repair: APPROVE.
- Overall project goal: still ACTIVE, not complete. The requested final state is larger than this audit slice.

## Token Cleanup Slice Summary

The following UI slices were reviewed as focused visual-token cleanup work:

- `src/components/shared/global-ai-assistant.tsx`
- `src/components/shared/money-text.tsx`
- `src/components/site/site-header.tsx`
- `src/components/site/stock-ticker-tape.tsx`
- `src/lib/utils.ts`
- `src/components/student/student-tutor-radar.tsx`
- `src/components/student/student-allocation-panel.tsx`

For these slices:
- No `src/app/api/**` route was intentionally modified.
- No database schema or migration was intentionally modified.
- No payment logic was intentionally modified.
- No auth/session logic was intentionally modified.
- No raw external AI gateway fetch was introduced.
- Market color semantics remain: positive market movement uses up/red tokens, negative market movement uses down/green tokens.

Focused grep checks reported no hardcoded hex / rgba / arbitrary color values in the targeted files after cleanup.

## Automated Verification Already Completed

Recent command evidence:

- `npm.cmd run lint`: PASS
- `npx.cmd tsc --noEmit`: PASS
- `npm.cmd run test`: PASS
  - 52 test files
  - 370 tests
- `npm.cmd run build`: PASS
  - Next.js 16 production build compiled successfully
- `npx.cmd vitest run src/components/student/student-tutor-radar.test.tsx`: PASS
  - 5 tests

Code review graph:
- `python -m code_review_graph --help`: FAILED in the current Python environment.
- Error: `No module named code_review_graph`.
- Fallback used: manual focused review against diff scope, project red lines, and smoke evidence.

## Dev Server Chunk Diagnosis

Observed issue:
- A previous smoke run against `http://127.0.0.1:4173` returned 500 responses for stale chunk names.
- Example stale asset: `/_next/static/chunks/0x7rlp~v2phcc.css`.

Current evidence:
- The current `.next/static/chunks` directory does not contain the stale asset.
- The current production preview references current chunk assets instead.

Conclusion:
- The `4173` issue is most likely stale process / stale manifest state, not missing assets in the latest build.

## Stable Production Preview Smoke

Production preview probe:
- Started `next start -p 4301` from the current `.next` build.
- `GET http://127.0.0.1:4301/`: PASS
- HTTP status: 200
- Response length: 154643
- Root HTML referenced current chunk assets, including:
  - `/_next/static/chunks/0f3dje5uf56k-.css`
- That chunk exists in the current `.next/static/chunks` directory.

Playwright smoke:
- Started `next start -p 4302`.
- Opened pages with Playwright Chromium at `1440x1000`.

Routes checked:

1. `/`
   - Page loaded.
   - Product title rendered.
   - Homepage hero heading rendered.
   - Header nav rendered horizontally.
   - `scrollWidth === clientWidth`.
   - No resource response >= 400.
   - No collected console error/warning.
   - No `This page couldn't load`.

2. `/demo?auth=login`
   - Demo/login entry content rendered.
   - `scrollWidth === clientWidth`.
   - No resource response >= 400.
   - No collected console error/warning.
   - No `This page couldn't load`.

3. `/student` while unauthenticated
   - Redirected to `/demo?reason=login_required`.
   - No white screen.
   - `scrollWidth === clientWidth`.
   - No resource response >= 400.
   - No collected console error/warning.
   - No `This page couldn't load`.

Temporary preview processes:
- Ports 4301 and 4302 were stopped or found not listening after smoke.

Verdict:
- Stable production preview smoke for `/`, `/demo?auth=login`, and unauthenticated `/student`: APPROVE.

## Mojibake Check

Reason:
- An early Playwright detector produced a false positive by treating a normal Chinese character as suspicious.

Follow-up:
- Checked the source tree with abnormal mojibake / replacement-character tokens only.
- The remaining hit is this audit document recording the historical grep check, not source UI copy.

Current status:
- This audit file was rewritten as UTF-8-safe English text to remove historical mojibake from the evidence record.

## Redline Review

No redline violations were found in this verification slice:

- No raw AI gateway call was added.
- No `.env.local` edit or commit occurred.
- No `git add .`, `git commit -a`, `git reset`, or `git checkout --` was run.
- No destructive filesystem operation was run.
- No API/schema/payment/auth logic was modified by UI token cleanup.
- No code was staged or committed.

## Remaining Work

This audit does not prove the entire long-running objective complete.

Still open:
- Full requirement-by-requirement verification against the referenced review plan and Codex execution manual.
- Authenticated student journey smoke with seeded or valid credentials.
- Guest upgrade / billing path smoke if payment route changes remain in scope.
- Admin console smoke if admin route changes remain in scope.
- Broader responsive UI review on mobile/tablet/desktop.
- Code-review-graph gate remains degraded until the local module is available.

Current overall conclusion:
- Monitor B repair and the stable production smoke slice are APPROVED.
- The active project goal remains open.

## Follow-up Fix 2026-06-13 / Authenticated Student, Guest, And Admin Smoke

Scope:
- Files intentionally touched in this slice:
  - `src/components/student/student-sandbox.tsx`
  - `src/components/student/onboarding-flow.tsx`
  - this audit document
- API / DB / payment / auth route logic touched: NO

Problem found:
- Production-preview smoke showed that authenticated student and guest pages could render, but the browser console reported failed 403 resources when client components auto-called full-AI endpoints before knowing the user's billing/subscription access.
- Guest account status was correctly expired/free, so the backend was right to reject full AI assessment endpoints.
- The front end needed to avoid making those calls for users without `canUsePersonalAiAssessment`.

Fix:
- `StudentSandbox` now reads `/api/billing/status` first and stores `canUsePersonalAiAssessment`.
- Portfolio intelligence and tutor radar remote refreshes only run when full personal AI access is available.
- When access is unavailable, the page keeps the deterministic local teaching fallback instead of hitting `/api/market/portfolio-intel` or `/api/ai/radar-chart`.
- `OnboardingFlow` now also checks `/api/billing/status` first.
- If full personal AI access is unavailable, onboarding uses the local teaching script instead of hitting `/api/ai/onboarding`.

Important CSRF note:
- `checkOrigin()` is active in `NODE_ENV=production` and compares request `Origin` to `APP_URL`.
- A first local smoke run used a random preview port while `.env.local` had a different `APP_URL`, so `POST /api/ai/radar-chart` returned 403 for a valid student.
- A second smoke run set `APP_URL` to the exact local preview URL before starting `next start`; same-origin POST then passed.
- This confirms the remaining 403 was an environment mismatch, not a broken student entitlement.

Fresh verification:
- `npm.cmd run lint`: PASS
- `npx.cmd tsc --noEmit`: PASS
- `npm.cmd run build`: PASS
- `npm.cmd run test`: PASS
  - 52 test files
  - 370 tests
- `python -m code_review_graph --help`: still unavailable (`No module named code_review_graph`), so manual focused review fallback was used.

Production-preview smoke with matching `APP_URL`:
- Started `next start -p 4307` with `APP_URL=http://127.0.0.1:4307`.
- Playwright Chromium viewport: `1440x1000`.

Accounts checked:

1. Student
   - Login: PASS, HTTP 200, redirect target `/student`.
   - Page: `/student`.
   - No white screen.
   - `scrollWidth === clientWidth`.
   - No resource response >= 400.
   - No collected console error/warning.
   - No `This page couldn't load`.
   - No technical invalid-request-parameter copy.

2. Superadmin
   - Login: PASS, HTTP 200, redirect target `/admin`.
   - Page: `/admin`.
   - No white screen.
   - `scrollWidth === clientWidth`.
   - No resource response >= 400.
   - No collected console error/warning.
   - No `This page couldn't load`.

3. Guest
   - Login: PASS, HTTP 200, redirect target `/student`.
   - Page: `/student`.
   - No white screen.
   - `scrollWidth === clientWidth`.
   - No resource response >= 400.
   - No collected console error/warning.
   - No `This page couldn't load`.
   - Expired/free guest stays on local teaching fallback instead of auto-calling full-AI endpoints.

Direct API evidence:
- Invalid login returns stable mainstream copy:
  - HTTP 401
  - Response body contains `error: unauthorized` and the friendly invalid-login message.
- Student billing status:
  - `canUsePersonalAiAssessment: true`
  - `aiTier: "full"`
- Guest billing status:
  - `canUsePersonalAiAssessment: false`
  - `trialMode: "expired"`
  - `bannerMessage`: upgrade required for full AI assessment.

Redline review:
- No raw external AI gateway fetch was added.
- No `.env.local` edit or commit occurred.
- No `src/app/api/**`, schema, migration, auth, or payment route was modified in this slice.
- No git staging, commit, reset, checkout, or destructive command was run.

Current conclusion:
- Authenticated production smoke for student, superadmin, and guest: APPROVE.
- Guest AI entitlement degradation now avoids noisy 403 frontend resources: APPROVE.
- Overall active goal remains open because the full referenced plan still requires broader requirement-by-requirement verification.

---

## Round: Monitor B Chain Smoke Follow-up, 2026-06-12

Scope:
- Re-checked the project-only Monitor B agent configuration.
- Reviewed guest upgrade checkout, billing prepay permissions, and superadmin user-management chain.
- Ran production-preview smoke tests for guest, student, and superadmin paths.

Finding:
- `brown-zone-web/.codex/agents/monitor_b.toml` contained mojibake in the developer instructions, which made it unsafe as a durable stage-gate monitor.
- Guest users could reach `/student`, but the onboarding overlay could intercept the visible "upgrade monthly card" button. This contradicted the requirement that a guest can immediately reach the payment/upgrade path.

Fix:
- Replaced `monitor_b.toml` with an ASCII-only, project-specific, read-only stage-gate monitor contract.
- Added `id="guest-upgrade-checkout"` and `scroll-mt-24` to the guest upgrade card.
- Passed `showUpgradeShortcut` from the student page to the onboarding flow only for the shared guest account.
- Added an onboarding button labeled "先开通完整 AI" that completes/skips the overlay and scrolls to the guest upgrade card.
- Did not change payment authorization rules, DB schema, API routes, or subscription economics.

Verification:
- `npm.cmd run lint`: PASS
- `npx.cmd tsc --noEmit`: PASS
- `npm.cmd run build`: PASS
- `npm.cmd run test`: PASS
  - 52 test files
  - 370 tests
- `git diff --check` on the touched UI/agent files: PASS
- `python -m code_review_graph --help`: unavailable (`No module named code_review_graph`), so manual focused review fallback was used.

Production-preview smoke:
- Started `next start -p 4312` with `APP_URL=http://127.0.0.1:4312`.
- Playwright Chromium viewport: `1440x1000`.
- Browser plugin was attempted first, but the exposed browser object did not match the documented API (`browser.nameSession` and `browser.tabs.selected` unavailable), so the run used Playwright fallback.

Smoke results:
- Guest login: HTTP 200, redirect `/student`.
- Guest onboarding upgrade shortcut: clicked successfully.
- Guest upgrade form: visible with email input and submit button.
- Guest `/student`: no white screen, no horizontal overflow, no console errors, no resource response >= 400.
- Shared guest direct prepay from page context: HTTP 403 with message "请先升级为个人账号，再开通月卡。"
- Student login: HTTP 200, redirect `/student`.
- Student `/student`: no white screen, no horizontal overflow, no console errors, no resource response >= 400.
- Superadmin login: HTTP 200, redirect `/admin`.
- Superadmin `/admin`: no white screen, no horizontal overflow, no console errors, no resource response >= 400.
- Superadmin user search refresh: clicked successfully and showed the refresh success message.
- Invalid login copy: HTTP 401 with message "账号或密码错误，请重新输入。"

Redline review:
- No raw external AI gateway fetch was added.
- No `drizzle-kit push` execution occurred.
- No `.env.local` edit or commit occurred.
- No API route, schema, migration, auth, or payment route was modified in this follow-up.
- No git staging, commit, reset, checkout, or destructive command was run.

Current conclusion:
- Monitor B agent durability: APPROVE.
- Guest upgrade access while onboarding is active: APPROVE.
- Guest shared-account payment safety: APPROVE.
- Superadmin non-mutating user-management smoke: APPROVE.
- Overall active goal remains open because the full referenced upgrade plan still needs broader stage-by-stage completion evidence.
