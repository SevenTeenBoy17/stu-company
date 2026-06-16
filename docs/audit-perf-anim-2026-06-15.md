# Performance & Animation Audit — brown-zone-web

_Date: 2026-06-15 · Stack: Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, GSAP · Severities are the adversarially-confirmed verdict severities (not the original reporter severities)._

## Summary

This audit consolidates 24 adversarially-verified findings across performance (client/server boundaries, React render work, data/network access, asset bundling) and animation/interaction (GSAP lifecycle, jank/CLS, accessibility, interaction completeness). Every finding below was confirmed by reading the actual code. The single highest-leverage theme is **database access**: one shared anti-pattern — `selectAllRuns(db)` / `selectAllUsers(db)` loading entire tables (including heavy JSONB blobs) and then filtering in application code — recurs across six functions, and the worst instance (`getSimulationStateForUser`) sits on the hottest authenticated request path. The next theme is **public-bundle weight**: GSAP + ScrollTrigger and a 725-line AI assistant ship in the first-load JS of the marketing/LCP path even though nothing needs them before paint. The remaining findings are localized render memoization gaps, GSAP MutationObserver lifecycle/leak issues, two non-composited/always-on CSS animation problems, and a cluster of missing loading/empty/error states (including a WCAG 2.2.2 marquee-pause gap). No outright outages or data-loss bugs were found; the data-access items are scalability regressions that worsen as the DB and classroom count grow.

## Severity counts

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 4 |
| Medium   | 9 |
| Low      | 11 |
| **Total**| **24** |

### Cross-cutting root cause (data access)

Findings DB-1 through DB-6 all stem from one anti-pattern: **`selectAllRuns(db)` (`src/lib/db/repo.ts:744`) and `selectAllUsers(db)` (`src/lib/db/repo.ts:735`) are unbounded full-table reads** (no `WHERE`, no `LIMIT`, no column projection) whose results are then filtered/sliced in application code. `selectAllRuns` additionally maps every row through `toRun`, Zod-parsing five JSONB columns (`holdings`, `eventHistory`, `actionLog`, `snapshots`, `eventTimeline`) per row. The correct pattern already exists in the same file (`getPeerHeatForStudent` at `repo.ts:1211` and `getSeasonLeaderboard` at `repo.ts:1418` use `WHERE` + `inArray` + `LIMIT`). The unifying fix is to scope these queries in SQL (by `classroomId`, by `inArray(userId, …)`, and/or rank+`limit` in SQL using the materialized `netWorth` column + index). They are listed separately below because each call site has a distinct severity, hot-path exposure, and minimal fix.

---

## Performance

### [HIGH] DB-1 — `getSimulationStateForUser` full-table-scans `scenario_runs` and `users` on the hottest path — src/lib/db/repo.ts:1188

**Evidence.** `const [allUsers, allRuns] = await Promise.all([selectAllUsers(db), selectAllRuns(db)])` then immediately `.filter(item => item.classroomId === ready.user.classroomId)` on both. `selectAllRuns` (`repo.ts:744`) is `executor.select().from(scenarioRuns)` with no `where`/`limit`, loading every row's heavy JSONB and Zod-parsing each via `toRun`. `buildSimulationState` (`src/lib/simulation.ts:680-705`) only ever consumes the classroom-filtered subset. This function runs on the student dashboard plus ~12 sub-pages (market, history, wealth, risk-profile, auto-invest, life, credit, quests, fund-lab, goal-accounts, opportunity, protection), every `/api/sim/*` route, and `ai/tutor`, `ai/radar-chart`, `market/portfolio-intel`. Payload + parse cost scales with whole-DB size, not one classroom.

**Recommendation.** Filter in SQL, mirroring `getPeerHeatForStudent` (`repo.ts:1211`): `db.select().from(scenarioRuns).where(eq(scenarioRuns.classroomId, ready.user.classroomId))` and a classroom-scoped users query (`where(eq(users.classroomId, ready.user.classroomId))`). Behavior-preserving because `buildLeaderboard` only looks users up by `run.userId`.

### [HIGH] DB-2 — `getTeacherOverview` loads entire `scenario_runs`, `users`, and `inviteCodes` to render one classroom — src/lib/db/repo.ts:1783

**Evidence.** `Promise.all([selectAllUsers(db), selectAllRuns(db), db.select().from(assignments).where(eq(assignments.classroomId, classroom.id)), db.select().from(inviteCodes)])`, then everything is filtered in-app to `classroom.id` (students, runs, leaderboard, invites by `invite.classroomId === classroom.id || invite.createdBy === teacher.id`). The `assignments` query is already correctly SQL-scoped — proving the pattern — but `selectAllRuns` (full JSONB of the whole DB), `selectAllUsers`, and the unscoped `inviteCodes` select are not. Runs on every teacher dashboard load (`teacher/page.tsx:15`).

**Recommendation.** Scope each query in SQL like the `assignments` query already is: `where(eq(scenarioRuns.classroomId, classroom.id))`, a classroom-scoped users query, and `where(or(eq(inviteCodes.classroomId, classroom.id), eq(inviteCodes.createdBy, teacher.id)))`. All three columns are indexed (`schema.ts`).

### [HIGH] DB-3 — `listPremiumFamilyDigests` is an N+1 loop (2 user lookups + 1 run query per member, all sequential) — src/lib/db/repo.ts:1445

**Evidence.** `const members = await db.select().from(familyMembers); for (const member of members) { await selectUserById(db, member.ownerUserId); await selectUserById(db, member.studentUserId); await db.select().from(scenarioRuns).where(eq(scenarioRuns.userId, member.studentUserId)).limit(1); … }`. `selectUserById` (`repo.ts:647`) is a real `SELECT users LEFT JOIN profiles WHERE id=?`. That is 1 + 3M serial round-trips for M members. Called by the weekly-report cron (`api/cron/weekly-report/route.ts:28`), which then also `await sendEmail` per digest serially.

**Recommendation.** Replace the loop with set-based queries: collect `ownerUserIds`/`studentUserIds` and use `inArray` batch selects (or a single `familyMembers → users → scenarioRuns` join — `family_members_owner_user_id_idx` at `schema.ts:149` supports it), then assemble digests in memory. (Offline cron, so user-visible impact is bounded — but the N+1 is unambiguous.)

### [MEDIUM] DB-4 — `recomputeAllRankedUsers` runs a fully sequential N+1 (3 reads + 3 upsert transactions per user) — src/lib/leaderboard/service.ts:201

**Evidence.** `const userIds = await listRankedUserIds(); for (const userId of userIds) { await recomputePowerForUser(userId, opts); … }` — strictly one user at a time. `recomputePowerForUser` (`service.ts:167-188`) does 3 awaited reads (`getRankProfile`, `getRunForUser`, `getLearningProgress`) then loops `STANDING_PERIODS` = weekly/monthly/season calling `upsertLeaderboardSnapshot` — each a full `db.transaction` with `SELECT … FOR UPDATE` + UPDATE + INSERT `onConflictDoUpdate` (`repo.ts:2932`). So per user = 3 selects + 3 transactions = 6N awaited round-trips. Driven by the daily cron `api/cron/recompute-leaderboard/route.ts:26`.

**Recommendation.** Batch the three reads set-based via `inArray`, compute in memory, and bulk multi-row upsert per period (one insert with `onConflictDoUpdate`), or at minimum process users with bounded `Promise.all` concurrency. (Off-peak daily cron; risk is function-timeout / pool exhaustion scaling with student count rather than user-facing latency.)

### [MEDIUM] DB-5 — `getAdminOverview` loads every `scenario_run` with full JSONB just to compute counts and a top-5 list — src/lib/db/repo.ts:1960

**Evidence.** `Promise.all([selectAllUsers(db), selectAllRuns(db), …])`, and `allRuns` is consumed ONLY by `buildLeaderboard(allRuns, allUsers)` (`repo.ts:1968`) whose output is sliced to `topUsers: leaderboard.slice(0, 5)` (`repo.ts:2013`). `buildLeaderboard` (`simulation.ts:561`) reads only `userId`, `classroomId`, and the last snapshot's `netWorth`/`disciplineScore` per run — none of the large JSONB. So the route fetches + Zod-parses every run's full JSONB in the DB to produce 5 rows.

**Recommendation.** A materialized `netWorth` column already exists (`schema.ts:175`) with composite index `scenario_runs_seed_net_worth_idx` (`schema.ts:180`). Rank in SQL via `orderBy(netWorth desc).limit(5)`, or at minimum project only `{ userId, classroomId, netWorth, snapshots }`. (Low-traffic role-gated route, but the unbounded scan degrades as run history grows.)

### [MEDIUM] DB-6 — `listAiSessionsForUser` fetches all of a user's session rows then slices to 10 in app (no SQL `LIMIT`) — src/lib/db/repo.ts:2144

**Evidence.** `listAiSessionRows(db, userId).then((items) => items.slice(0, 10))` — the 10-row bound is applied in JS. `listAiSessionRows` (`repo.ts:804`) is `.select().from(aiSessions).where(eq(aiSessions.userId, userId)).orderBy(desc(aiSessions.updatedAt))` with NO `.limit()`, and `.select()` pulls all columns including the `jsonb` `payload` (`schema.ts:208`), so every session's blob leaves the DB before slicing. `createAiSession` (`repo.ts:2077`) reuses the same unbounded query on every insert to compute `sessions.slice(10)` for pruning.

**Recommendation.** Push the bound into SQL with `.limit(10)` on the list path. The prune path needs the rows _after_ index 10, so give it its own bounded query (e.g. select only `id` with `LIMIT/OFFSET 10`) rather than sharing one `.limit(10)`. The dominant avoidable cost is the `SELECT *` of full JSONB payloads on the list path.

### [LOW] DB-7 — `getLeaderboardSnapshot` loads all runs and all users to return a single hardcoded classroom — src/lib/db/repo.ts:2031

**Evidence.** `const [allRuns, allUsers] = await Promise.all([selectAllRuns(db), selectAllUsers(db)]); const leaderboard = buildLeaderboard(allRuns, allUsers); … return leaderboard.filter((item) => item.classroomId === "class-1")`. The whole board is discarded down to the hardcoded `"class-1"`. The efficient pattern is already known here — `getSeasonLeaderboard` (`repo.ts:1418`) orders + `.limit(20)` at the DB and fetches matching users via `inArray`.

**Recommendation.** Scope the run query by `classroomId` and select only needed columns. **Note:** this function currently has **no live callers** (only its own definition + 2 unit tests, per full-repo grep) — it is effectively orphaned, so real-world impact is presently nil. Treat as latent code-quality cleanup, not an active request-path defect.

### [MEDIUM] PERF-CB-1 — Heavy `qrcode` lib eagerly imported into the public `/pricing` client bundle though only used after a click — src/components/billing/wechat-checkout-button.tsx:6

**Evidence.** Line 6 statically imports the whole encoder at module scope: `import QRCode from "qrcode";` (`qrcode` v1.5.4, ~155K of source in `node_modules/qrcode/lib`). Its only runtime call, `QRCode.toDataURL(...)` (line 158), is inside a `useEffect` gated on `payload?.codeUrl` (line 157); `payload` is set only by `startCheckout()`'s fetch (line 246), invoked from the 开通 button `onClick` (line 366). So `qrcode` is never executed for a visitor who does not start checkout, yet it ships in `/pricing`'s first-load client JS for every unauthenticated visitor (`src/app/(site)/pricing/page.tsx:157` renders `<WechatCheckoutButton/>`). No dynamic import of `qrcode` exists in `src/` today.

**Recommendation.** Drop the top-level import and load lazily at the point of use, inside the existing try/catch: `const { default: QRCode } = await import("qrcode"); const url = await QRCode.toDataURL(payload.codeUrl, { width: 208, margin: 1 });`. Behavior-preserving — the QR only renders after the post-click network round-trip.

### [LOW] PERF-CB-2 — Presentational `SubscriptionBanner` shell forced fully client by one interactive child — src/components/shared/subscription-banner.tsx:1

**Evidence.** The module opens with `"use client";` (line 1) solely because the inner `StudentParentLinkCTA` (line 29) uses `useState`/`useTransition`/`fetch`. The exported `SubscriptionBanner` (line 96) is otherwise pure prop-branching markup — a static `<div>` with `<p>{displayMessage}</p>` and `<a href="/pricing">` — and only conditionally renders the client CTA for expired/trial_degraded students (`showStudentCta`, line 104). It is rendered by a Server Component (`src/app/(platform)/student/page.tsx:32`, an `async` page), so the whole banner shell hydrates as client JS for every student page load, including non-students who only get the static link.

**Recommendation.** Extract `StudentParentLinkCTA` into its own `"use client"` island (e.g. `src/components/shared/student-parent-link-cta.tsx`), then remove `"use client";` from `subscription-banner.tsx` so `SubscriptionBanner` becomes a Server Component that imports the CTA only when `showStudentCta`. Matches AGENTS.md ("Server Components by default").

### [MEDIUM] PERF-BUNDLE-1 — GSAP core + ScrollTrigger ship in the global client bundle on every public page (LCP-critical) — src/app/layout.tsx:4

**Evidence.** The root layout statically imports `PremiumMotionProvider` (`layout.tsx:4`, rendered at `:26`) for ALL routes — both route groups. That provider is `"use client"` and eagerly imports `gsap` + `gsap/ScrollTrigger` (`premium-motion-provider.tsx:4-5`, registered at `:10`), so GSAP core + ScrollTrigger become shared first-load JS on the public marketing routes. The provider returns `null` (`:687`) and is purely effect-driven (visibility safety-net at `:567-573`); the public landing (`(site)/page.tsx`, `section-reveal.tsx`) uses only declarative `data-motion-*` attributes — nothing needs GSAP before paint. Of 16 GSAP-importing files, the provider is the only one on the public path.

**Recommendation.** Defer the provider so GSAP leaves the critical path. **Caveat:** `layout.tsx` is an async Server Component, and Next.js forbids `next/dynamic({ ssr: false })` inside Server Components, so the naive one-line swap will not compile. Correct fix: move the `dynamic(() => import(...), { ssr: false })` import into a tiny `"use client"` wrapper component (or lazy-import `gsap` inside the effect). (KB figures in the original report are estimates, not measured here.)

### [MEDIUM] PERF-BUNDLE-2 — 725-line `GlobalAiAssistant` client component eagerly bundled into every page including the marketing LCP path — src/app/layout.tsx:3

**Evidence.** Root layout statically imports `GlobalAiAssistant` (`layout.tsx:3`, rendered at `:27`), mounting it on every route including `(site)/page.tsx`. The component (`global-ai-assistant.tsx:1`) is a 724-line `"use client"` module pulling 8 lucide-react icons (lines 7-16), `useFocusTrap`, fetch/session logic, and the full chat-panel JSX. The heavy panel is render-gated behind `{isOpen ? (...)` (line 479) — a runtime gate, not a bundle gate — so all of it is still downloaded/parsed at first paint while only a ~48-64px FAB is visible. Confirmed via grep: the repo has NO `next/dynamic` usage anywhere, so this is genuinely un-code-split.

**Recommendation.** Keep the tiny always-rendered FAB and `dynamic(() => import(...), { ssr: false })` the panel body so its code (icons, fetch logic, markup) loads only on first open / `AI_ASSISTANT_OPEN_EVENT`. Alternatively dynamic-import the whole component with `ssr: false` (it has no SSR-visible content of value beyond the FAB).

### [LOW] PERF-RENDER-1 — Expensive payload builders run in `StudentSandbox` render body on every unrelated keystroke (no `useMemo`) — src/components/student/student-sandbox.tsx:324

**Evidence.** Lines 324-325 call `buildStudentHomeHubPayload(state.run)` and `buildStudentPetPayload(state.run)` unconditionally in the render body. Both depend only on `state.run` but the component re-renders on changes that do not touch `state.run` — typing in trade quantity (line 693), `bankAmount` (728), `ventureAmount` (779), `activeTab`, message/pending (all `useState` at 99-119). `buildStudentHomeHubPayload` (`student-service-map.ts:184`) does ~9 `actionLog.filter` passes + `computeMarketTemperature`; `buildStudentPetPayload` (`pet-rewards.ts:364`) calls `buildWealthSummary`/`computeStreak`/etc.

**Recommendation.** `const homeHubPayload = useMemo(() => buildStudentHomeHubPayload(state.run), [state.run])` and likewise for `petRewardPayload`. The component already uses `useMemo` for `selectedAsset`/`streak` (lines 138, 142). (Data is a 12-round sandbox — tens of entries, sub-ms recompute — so wasteful but unlikely to cause perceptible jank.)

### [LOW] PERF-RENDER-2 — `StudentMarketBoard` SVG-path derivations recompute on every search keystroke despite depending only on payload — src/components/student/student-market-board.tsx:268

**Evidence.** `search` is component state (line 153) updated on every keystroke via `onChange` (line 388), and `value={search}` (line 387) is non-deferred, so each keystroke re-renders the whole body. Lines 268-282 are plain `const`s re-executed every render though they depend only on `payload`: `selectedMetricValues` (`payload.selected.metrics.map`), `radarPath = buildRadarShape(...)`, `linePath`/`areaPath` (`buildLinePath`/`buildAreaPath`), `sectorTotal` (reduce) + `sectorSlices` (map). The path builders do `Math.min/max` + string-building `.map`. Inconsistent with the adjacent `candleGeometry`, which IS `useMemo`'d (line 273); the expensive `filteredWatchlist` is correctly `useDeferredValue`'d (line 162).

**Recommendation.** Memoize on `payload.selected` / `payload.sectorPerformance`, mirroring `candleGeometry`. (Arrays are tiny and fixed-size — 6 metrics, 6 sectors — and memoizing path strings doesn't avoid the inline-SVG DOM diff, so this borders on a consistency micro-optimization, but the mechanism is real.)

---

## Animation & Interaction

### [MEDIUM] ANIM-GSAP-1 — MutationObserver-attached elements leak: pointer listeners + GSAP instances + detached DOM nodes retained until navigation — src/components/shared/premium-motion-provider.tsx:601

**Evidence.** The `dynamicObserver` (lines 601-622) handles only `mutation.addedNodes` — there is no `removedNodes` path. For each added node it calls `attachLiftTarget`/`attachDepthTarget`, which `cleanups.push(addLiftInteraction(target, lift))` (lines 442-452). `addLiftInteraction` binds 5 pointer listeners and returns a cleanup capturing `element`; `addDepthInteraction` registers 3 `gsap.quickTo` + 3 listeners. `cleanups` is drained ONLY by the `useGSAP` teardown (`forEach(cleanup => cleanup())`, line 659), which runs solely on unmount or `pathname` change (deps `[pathname]`, line 684). On long-lived authenticated pages where rows/drawers/panels mount/unmount without a route change (confirmed: `student-market-board.tsx:1040` `.map` cards re-mount on the 10-min refresh/after trades; `global-ai-assistant.tsx` mounts/unmounts drawer/overlay nodes on open/close), `cleanups` grows monotonically, each entry pinning a detached node + listeners + tweens, blocking GC. The `liftAttached`/`depthAttached` WeakSets only prevent re-binding; they don't release removed nodes.

**Recommendation.** Detach per-node on removal: track each element's cleanup in a `Map`/`WeakMap` keyed by node; in the observer also iterate `mutation.removedNodes` (plus their `querySelectorAll` matches) and call+delete the stored cleanup. Bounds memory to live DOM. (Self-clears on every route change and leaked nodes are detached so listeners never fire — a steadily-growing leak, not a short-session crash.)

### [MEDIUM] ANIM-GSAP-2 — MutationObserver runs ~11 `querySelectorAll` scans per added node with no batching, on a `subtree:true` observer — src/components/shared/premium-motion-provider.tsx:602

**Evidence.** `dynamicObserver.observe(document.body, { childList: true, subtree: true })` (line 622) fires for every DOM insertion anywhere in the app. For each added node the callback runs `motionElementsFromNode(...)` eleven times (reveal, card, button, depth, draw, bar, viz, overlay, modal, drawer, reward — lines 604-618), and `motionElementsFromNode` (lines 347-354) does `node.matches(selector)` + `node.querySelectorAll(selector)` each call — ~11 full subtree queries per inserted node, synchronously, with no microtask/rAF coalescing. React re-renders that insert list rows/banners/holdings/timeline entries (135 `data-motion-*` markers across 18 student components; `student-market-board.tsx` alone has 26 `.map` renders) trigger this repeatedly. The 11 selectors are all simple single-attribute selectors (`motion-system.ts:28-46`).

**Recommendation.** Collapse the 11 selectors into one combined `querySelectorAll` (`[data-motion-reveal],[data-motion-card],…`) and dispatch each match to its handler by inspecting `dataset`; and/or coalesce mutations into a microtask/rAF buffer (collect added nodes, process once per frame). (The WeakSet idempotency guards run _after_ the 11 queries, so they don't blunt this cost.)

### [LOW] ANIM-GSAP-3 — Dynamic entrance tweens (overlay/modal/drawer/reward) are never killed for nodes added after mount — src/components/shared/premium-motion-provider.tsx:476

**Evidence.** `animateOverlayTarget`/`animateModalTarget`/`animateDrawerTarget`/`animateRewardTarget` (lines 476-546) create `gsap.fromTo(...)` but, unlike every sibling helper, never push a kill closure to `cleanups`. They run both initially (lines 625-628) and from the observer callback (lines 615-618). The only teardown targeting them is `gsap.killTweensOf([...overlayTargets, ...modalTargets, ...drawerTargets, ...rewardTargets])` (lines 660-681), but those arrays are the static snapshot captured at effect setup (lines 380-384) — observer-added nodes are never in them. Because the observer callback is async, `revertOnUpdate` (line 684) can't catch them either (`@gsap/react` only tracks objects created synchronously during the `useGSAP` callback; delayed creators must use `contextSafe`). Targets are genuinely conditionally-rendered (`global-ai-assistant`, `demo-portal`, site-header mobile nav).

**Recommendation.** Capture the tween and push a kill closure: `const tween = gsap.fromTo(target, …); cleanups.push(() => tween.kill());`, or run the helpers through `contextSafe`. (Every leaked entrance tween is short and self-terminating — 0.22s/0.32s/0.34s/0.66s, none use `repeat:-1` — so this only manifests in a sub-second navigation race; real hygiene gap inconsistent with the file's own pattern, but minimal practical impact.)

### [MEDIUM] ANIM-JANK-1 — Progress bar animates `width` via `transition-all` (non-composited reflow jank) — src/components/student/rank/power-card.tsx:235

**Evidence.** The 财商战力 score-breakdown bar renders `<div className="h-full rounded-full bg-brand transition-all" style={{ width: `${row.valuePct}%` }} />`. `transition-all` animates every changed property including the layout property `width`; when `row.valuePct` (from `card.components` props) changes (e.g. after the recompute refetch), the browser tweens `width` on the main thread and forces a layout reflow each frame. This contradicts the project's own correct pattern two divs up — the tier-progress bar (`power-card.tsx:141-145`) uses `data-motion-bar`, animated by the motion system via GPU-composited `scaleX` (`premium-motion-provider.tsx:177-188`) — and `student-allocation-panel.tsx:220`, which sets `width` statically with no transition.

**Recommendation.** Drop `transition-all`: either render the width statically like the sibling bars (no transition → no animation → no reflow), or add `data-motion-bar` (+ `data-motion-origin="left center"`) and let `motion-system.ts` animate `scaleX`. At minimum replace `transition-all` with `transition-[transform]` and animate `transform: scaleX()`.

### [LOW] ANIM-JANK-2 — Permanent `will-change` on 100+ elements (always-on layer promotion → GPU memory pressure) — src/app/globals.css:358

**Evidence.** `globals.css:358-379` unconditionally and permanently applies `will-change: transform, opacity` (and `will-change: transform`) to ~17 `data-motion-*` selectors. `data-motion-reveal` alone has 74 instances across 28 files, plus card/button/bar/viz/draw markers. But the targeted markers don't need a permanent layer: reveal/bar/draw/viz are **one-shot** (`observeOnce` / ScrollTrigger `once:true`), and card/button animate transform only on **hover** (transient). Keeping `will-change` on permanently is the documented anti-pattern (it should be short-lived and removed after the animation), forcing the browser to hold a compositor layer per element for the whole page lifetime.

**Recommendation.** Remove the blanket rule. **Important — two claims in the original recommendation are FALSE:** GSAP's `CSSPlugin` does NOT add `will-change` per tween (only `ScrollSmoother` does, which this provider never registers), and the reveal/bar tweens do NOT call `clearProps` (only `addSceneTimeline` does). So simply deleting the CSS yields no hint and never releases the layer regardless. Correct fix: drop/scope the blanket rule AND, if a hint is still wanted for the genuinely-continuous loops only (`data-motion-float`, `data-motion-shine`), set `willChange` explicitly in the provider per-tween and clear it on complete. (Real GPU overhead concentrated on low-end mobile; modest on desktop.)

### [MEDIUM] ANIM-A11Y-1 — Infinite ticker marquee can only be paused by mouse hover — no keyboard/focus/touch pause (WCAG 2.2.2) — src/components/site/stock-ticker-tape.tsx:68

**Evidence.** The market ticker is a continuously-looping CSS animation (`globals.css:391-397`: `animation: stock-ticker-marquee var(--ticker-duration,30s) linear infinite;`, 28s here) whose ONLY pause affordance is `group-hover:[animation-play-state:paused]` (line 68) — it fires only on pointer hover of the parent `.group` (line 61). The marquee items (lines 72-104) are plain non-interactive `<div>`/`<span>` with no `tabindex`/`<a>`/`<button>`, so keyboard-only, touch, and AT users cannot produce a hover-equivalent and have no way to pause >5s of moving content. Repo-wide grep confirms this is the sole pause mechanism (no pause/stop button). Live on the public landing (`(site)/page.tsx:22`). The `prefers-reduced-motion` reset (`globals.css:331-339`) is a partial mitigation only; WCAG 2.2.2 applies regardless of the OS setting.

**Recommendation.** Add a user-operable, non-hover pause control: an explicit 暂停/播放 toggle button next to the tape that toggles a state adding/removing `[animation-play-state:paused]` on the marquee element, plus pause on `group-focus-within` as well as hover. The button is the load-bearing part for keyboard/touch/AT users.

### [MEDIUM] ANIM-INTER-1 — Guest-upgrade payment-proof submit button has no in-flight (loading/disabled) state — src/components/billing/guest-upgrade-checkout.tsx:264

**Evidence.** `submitProof()` (lines 107-125) is an async `fetch` to `/api/billing/manual-proof` with NO in-flight flag (no `useState`/`useTransition` toggle). The trigger (lines 264-271) is `onClick={submitProof} disabled={proofNote.trim().length < 2}` with a static label 我已付款，提交核验 — `disabled` checks only note length, never whether a request is in flight, so a double-tap or slow-network re-tap fires duplicate POSTs with no feedback (and the note is never cleared on success). The functionally-identical sibling proves the omission: `wechat-checkout-button.tsx:126` declares `const [isSubmittingProof, startProofTransition] = useTransition()`, wraps its fetch in it (306-327), and does `disabled={isSubmittingProof || …}` with label `{isSubmittingProof ? "正在提交..." : "我已付款，提交核验"}` (564-571).

**Recommendation.** Add `const [submittingProof, setSubmittingProof] = useState(false)`, set true at start / false in `finally`, then `disabled={submittingProof || proofNote.trim().length < 2}` and swap the label to `{submittingProof ? "正在提交..." : "我已付款，提交核验"}`. (Submits a proof record, not an actual charge — impact is duplicate admin-review noise + missing feedback, not a double-charge.)

### [LOW] ANIM-INTER-2 — Market board ticker search has no empty/no-results state — src/components/student/student-market-board.tsx:396

**Evidence.** The watchlist search input (lines 386-391) drives `filteredWatchlist` (lines 260-266: returns `[]` when a non-empty keyword matches no ticker). The grid renders `{filteredWatchlist.map(...)}` (line 396) with NO fallback branch, so a typo produces a completely blank result area under the 市场信息 header with no 未找到 feedback. This is the lone exception in the file: the My Watchlist list (line 466 ternary → empty card 514-537) and peer-heat list (line 910 ternary → empty card 938-941) both have explicit empty states.

**Recommendation.** Wrap the grid: `{filteredWatchlist.length > 0 ? (<grid>…</grid>) : (<div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-base font-semibold text-slate-500">没有匹配“{search}”的股票，换个关键词或代码试试。</div>)}`. (Read-only filter, no data loss; recovery is trivial — polish gap.)

### [LOW] ANIM-INTER-3 — Quest list shows a blank area when a filter matches zero quests — src/components/student/student-quest-dashboard.tsx:546

**Evidence.** The 本周任务栏 filter chips 全部/进行中/已完成/需观察 (`filterLabels` 34-39; buttons 527-541) set `filter`, driving `visibleQuests` (`useMemo` 166-173). The grid renders `{visibleQuests.map(...)}` (line 546) with no empty fallback. The empty state is reachable on a normal first-session path: `lib/quests.ts` builds a fixed 10-item array whose status comes from `statusFrom(progress)` (`progress>=1 ? "done" : …`); a new student has ~0 progress everywhere, so tapping 已完成 shows header + highlighted chip + a blank grid. The 全部 view is never empty, so only the filtered view can legitimately be empty.

**Recommendation.** Guard the grid: `{visibleQuests.length > 0 ? (<grid>…</grid>) : (<p className="rounded-[1.7rem] border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">该分类暂时没有任务，去完成更多沙盘动作来解锁吧。</p>)}`. (Cosmetic/confusing only; user recovers by switching filters.)

### [LOW] ANIM-INTER-4 — Rank 编辑档案 action gives no loading state and silently swallows fetch failure — src/components/student/rank/rank-dashboard.tsx:104

**Evidence.** `openEdit` (lines 28-56) `await fetch("/api/leaderboard/profile", …)` then `setEditing(true)`; its catch block (53-55) is empty except for a comment, so failures are silently swallowed (and line 43 `if (!payload?.profile) return;` is another silent no-op). The trigger (104-110) has no `disabled` and no busy indicator, so a slow fetch produces no visible feedback (inviting repeat clicks) and a failure shows nothing. By contrast the initial board load (75-82) renders a proper `Loader2` spinner. No toast/sonner anywhere in `rank/`.

**Recommendation.** Add `openingEdit` state (set true before fetch, false in `finally`); `disabled={openingEdit}` + `{openingEdit ? "正在打开…" : "编辑档案 / 隐私设置"}`. In the catch, surface a brief inline `editError` near the button instead of returning silently. (Secondary action off the hot path; worst outcome is confusion/retry.)
