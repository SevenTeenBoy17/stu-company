# Brown Zone — Codex 执行手册：投资人格 AI 复评 + 任务翻卡抽卡（A2c → B3）

> **执行对象**：`docs/superpowers/plans/2026-06-18-risk-lab-and-quest-cards.md`（PRD/规格源）。
> **重要前提**：本计划的 **A1 / A2a / A2b 已在另一会话完成并提交**到分支 `feat/risk-lab-quest-cards`（6 个提交，`npm run test` 78 文件 / 498 测试全绿）。本手册让 Codex **从 A2c 续跑**，不要重做已落地的任务。
> **风格**沿用 `CODEX-WORKFLOW.md` 与既有 `05-CODEX执行手册.md`（目标 / 前置 / `提示词 N.N`(即粘即用) / ✅验收命令 / ❌回滚 / stop-gate / "Have <agent> ..."）。所有锚点已实测核验（2026-06-18）。
> `.codex/agents/` 可用：db_architect、api_wirer、ui_implementer、qa_engineer、reviewer、behavior_ai_analyst、teen_ux_specialist、education_narrative_designer、finance_event_simulator、monetization_wechat_engineer。

---

## 第 0 章 · Codex 效能最大化（防幻觉 / 防偷懒 / 防漂移，针对本任务）

> 你反复问"怎么让 Codex 发挥最大效能"。核心就三条：**①把已建好的契约喂给它(不让它臆造 API)；②让"完成"由机器闸门判定(不让它偷懒口头宣布)；③一个任务一开新上下文(不让它漂移)**。下面每条都针对本任务踩过的真坑。

### 0.1 Pre-flight（每次开工 3 分钟）
```powershell
cd "D:\树德实验中学（清波）\C2\brown-zone-web"
git switch feat/risk-lab-quest-cards          # 已存在的工作分支，别新建
git log --oneline -8                          # 确认看到 A1/A2a/A2b 的提交(见 0.3)，不要重做
npm run db:up                                 # 库必须 healthy —— A2d/B2a/B2c/验证都要写库
docker compose -f docker-compose.local.yml ps # STATUS = healthy
codex
# Codex 里输入 /agents 确认 db_architect / api_wirer / ui_implementer / qa_engineer / reviewer 已加载
```
全局 `~/.codex/config.toml` 已是 `model="gpt-5.5"` + `model_reasoning_effort="xhigh"`（最强档，本身就抗偷懒，保持）。

### 0.2 防幻觉——把"已建契约"钉死给 Codex（最关键）
本任务最容易翻车的点：Codex 会**臆造**不存在的函数名/列名。每条提示词都已内联**真实符号**。开工前让 Codex 先读这张表（也复制在文末附录 A）：

| 你要复用的东西 | 真实位置 / 签名（已核验） |
|---|---|
| 人格类型 | `BehaviorPersona`（`src/lib/types.ts`）：`{band:"defensive"|"steady"|"balanced"|"growth"; label; archetype; summary; evidence[]; nextSteps[]; confidence:"low"|"medium"|"high"}` |
| 人格纯逻辑 | `src/lib/behavior-persona.ts` 导出：`PersonaSignalInput`(L56)、`buildPersonaSignalInput(run,learning,savedQuestionnaireScore?)`(L122)、`ruleFallbackPersona(input)`(L231)、`normalizeBehaviorPersona(rawText,fallback)`(L370)、`personaInputDigest(input)`(L422) |
| AI 网关模板 | `src/lib/ai.ts`：`requestTutorRadarPayload`(L530，export，**照抄它**)、私有 `requestRemoteText`(L347)、`normalizeRadarPayload`(L307)、`buildTutorSystemPrompt`(L127) |
| 人格落库 | `risk_profiles` 已有列 `behavior_persona/persona_provider/analyzed_at/input_digest`；`upsertRiskProfile` 已接受 `{behaviorPersona,personaProvider,analyzedAt,inputDigest}`；`getRiskProfile` 已返回它们（`src/lib/db/repo.ts`） |
| 风险测评路由 | `src/app/api/student/risk-profile/route.ts`（GET/POST 已工作） |
| 抽卡幂等先例 | `round_predictions` 表 + `createRoundPredictionForUser`（`repo.ts:1387-1427`）；卡库 `card_collection` 仿它新建 |
| 行为信号源 | `detectAdaptiveEvents`(adaptive-events.ts)、`buildTutorRadarPayload`(tutor-radar.ts，吃 `SimulationState`)、`buildWealthSummary`(allocation.ts)、`bandFromScore`(risk-profile.ts，**已 export**) |

> 提示词模板里固定加一句：`Only use the exact symbols I named. If a symbol or column doesn't exist, STOP and report — do NOT invent one.`

### 0.3 防偷懒——"完成"由机器闸门判定，不认口头
- **完成定义** ≡ 任务的 ✅验收命令全绿：`npm run lint` + `npx tsc --noEmit` + `npm run test -- <文件>` + 针对性 `git grep` 断言。模型说"应该好了"不算。
- **TDD 先红后绿**：纯逻辑/路由/判分先写失败测试再实现（本任务已建的 A1/A2b 都是这么做的，延续）。
- **写操作必须库 Up 实跑验证**：A2d 复评、B2c 抽卡改完后，**库 healthy 下真点一次 + 刷新看落库**，再**停库演练**（`npm run db:down` → 点一次确认中文错误+重试 → `npm run db:up` 复原）。只看 tsc 绿=偷懒。
- **要证据**：让 Codex 把真实命令输出（测试/grep/`\d` 表结构）贴进 `progress.md`，不许"稍后处理/应该可以"。

### 0.4 本任务三个会卡死 Codex 的真坑（提前喂解法）
1. **迁移生成器在非 TTY 下崩**：`npm run db:generate` 会因历史遗留的 `rank_profiles/risk_profiles` 命名冲突提示符卡死（Codex 无 TTY）。**解法**：像 `0015`/`0019` 那样**手写**幂等迁移 `.sql`(`ADD COLUMN/CREATE TABLE IF NOT EXISTS`) + 往 `drizzle/meta/_journal.json` 追加 `idx` 条目，再 `npm run db:migrate`。**绝不用 `drizzle-kit push`**（崩库）。
2. **`drizzle-kit push` 崩库**：迁移只走 `npm run db:migrate`。
3. **GSAP 不吃 CSS 的 reduced-motion**：翻卡动画必须在 JS 里单独挡（`matchMedia("(prefers-reduced-motion: reduce)")` 命中就 `gsap.set` 到终态）。照抄 `student-quest-dashboard.tsx:143-146` 现成范式。

### 0.5 红线（每条提示词都带）
- AI 调用**只在 `src/lib/ai.ts`**，别处直连 provider = blocker。
- 抽卡/任务奖励**只发装饰(皮肤/称号/卡)，绝不调 `recomputePowerForUser`、绝不改财务字段**（零战力耦合）。
- 新写函数进 `repo.ts` 的 fallback 白名单(`repo.ts:303-312`)，否则 `repo-fallback.audit.test.ts` 会红。
- 提交：显式 `git add <具体路径>`，**不要** `git add .` / `commit -a`；信息尾行 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。

### 0.6 防漂移 + 分组
- **一个任务一个 Codex 会话**；只读该提示词点名的文件，别漫游全仓。
- **实现者≠评审者**（AGENTS.md §3.1）：实现 db_architect/api_wirer/ui_implementer/behavior_ai_analyst；评审换 reviewer（+ a11y 任务加 testing-accessibility-auditor）。每阶段 `APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION` 收尾。

---

## Phase A 续 · 投资人格 AI 行为复评

### 提示词 A2c — ai.ts 增 `requestBehaviorPersona`（照抄雷达图范式）
```
Have behavior_ai_analyst add an AI behavior-persona request to the AI gateway, mirroring the existing radar pattern.

WRITE scope: src/lib/ai.ts ; src/lib/ai.behavior-persona.msw.test.ts (new, or extend an existing ai msw test). 
FORBIDDEN scope: components, api routes, db, behavior-persona.ts (reuse only), risk-profile.ts. AI must stay ONLY in ai.ts (red line).

Grounding (exact, verified — do NOT invent):
- Model to COPY: `requestTutorRadarPayload` at src/lib/ai.ts:530-558. It does: build messages → `requestRemoteText({ system: buildTutorSystemPrompt(), messages, fallbackText })` (private, L347) → `normalizeRadarPayload(response.text, fallback)` (private, L307). When AI is unconfigured/unreachable, requestRemoteText returns `fallbackText` (provider:"fallback").
- Reuse from src/lib/behavior-persona.ts: type `PersonaSignalInput` (L56), `ruleFallbackPersona(input)` (L231) → produces a complete BehaviorPersona, `normalizeBehaviorPersona(rawText, fallback)` (L370) → tolerant parse. `BehaviorPersona` is in src/lib/types.ts.

Steps (TDD):
1. Add `export async function requestBehaviorPersona(input: PersonaSignalInput): Promise<{ persona: BehaviorPersona; provider: string }>`:
   - const fallback = ruleFallbackPersona(input)
   - build a Chinese system prompt (a small `buildBehaviorPersonaSystemPrompt()` private fn, or reuse buildTutorSystemPrompt if its persona is generic enough) instructing the model to return ONLY a JSON object with keys band/label/archetype/summary/evidence/nextSteps/confidence; the user message carries the salient signals from `input` (triggered events, radar, wealth, action counts, round) as compact text.
   - const response = await requestRemoteText({ system, messages, fallbackText: JSON.stringify(fallback) })
   - const persona = normalizeBehaviorPersona(response.text, fallback)
   - return { persona, provider: response.provider }
2. Write src/lib/ai.behavior-persona.msw.test.ts mirroring the existing AI MSW tests (ai-gateway.msw.test.ts): (a) mock the provider returning a valid persona JSON → returned persona reflects it, provider !== "fallback"; (b) no AI env configured → returns ruleFallbackPersona, provider === "fallback"; (c) provider returns garbage → normalize yields the fallback, never throws. NEVER hit a real provider.
3. `npm run test -- ai` and `npx tsc --noEmit` → green. `git grep -n "fetch(" src/lib/ | grep -v ai.ts` must NOT show any new direct provider fetch.
4. Have reviewer confirm AI stays only in ai.ts + APPROVE.

Commit: git add src/lib/ai.ts src/lib/ai.behavior-persona.msw.test.ts ; commit -m "feat(risk-lab): requestBehaviorPersona via AI gateway with rule fallback".
```
✅ 验收：`npm run test -- ai` 绿；AI 不可用时返回 `ruleFallbackPersona`、`provider:"fallback"`；无新增直连 fetch。
❌ 回滚：`git checkout -- src/lib/ai.ts && rm src/lib/ai.behavior-persona.msw.test.ts`。

### 提示词 A2d — 行为复评路由（按钮触发、含 input_digest 跳算）
```
Have api_wirer add the behavior re-evaluation route.

WRITE scope: src/app/api/student/risk-profile/behavior/route.ts (new). 
FORBIDDEN scope: ai.ts, behavior-persona.ts, repo.ts internals, components (reuse only).

Grounding (verified):
- Auth/CSRF/error pattern: copy an existing student POST route, e.g. src/app/api/student/risk-profile/route.ts (uses checkOrigin + requireUser("student") + Chinese error shape {error,message}).
- Data: `getSimulationStateForUser(userId)` and `getLearningProgress(userId)` from repo.ts give run + learning.
- Logic: buildPersonaSignalInput(run, learning) → requestBehaviorPersona(input) (from ai.ts, A2c) → upsertRiskProfile(userId, { behaviorPersona: persona, personaProvider: provider, analyzedAt: new Date().toISOString(), inputDigest: personaInputDigest(input) }).
- Skip-recompute: read existing getRiskProfile(userId); if its inputDigest === personaInputDigest(input) AND a persona already exists, return the stored persona WITHOUT calling the AI (saves cost). Otherwise compute + store.

Steps:
1. POST handler: checkOrigin → requireUser("student") → (optional) rate-limit (reuse rate-limit.ts like other AI routes) → assemble input → digest check → requestBehaviorPersona if needed → upsert → return { persona, provider, analyzedAt }.
2. Route/integration test (read tests/ for an existing route test harness): asserts a successful POST stores a persona (DB up) and a second POST with unchanged behavior does NOT re-call AI (digest short-circuit). Chinese error shape on bad/unauth input.
3. VERIFY WITH DB UP: actually call the route (or via the page in A2e) → refresh → persona persisted. Then `npm run db:down`, call again → friendly Chinese error (no English code, no crash) → `npm run db:up`.
4. `npm run test` relevant + `npx tsc --noEmit`. reviewer + APPROVE.

Commit explicit paths; rollback = delete the route file.
```
✅ 验收：库 Up 下复评落库、刷新仍在、相同行为不重复打 AI；停库演练显示中文错误+重试。
❌ 回滚：`rm src/app/api/student/risk-profile/behavior/route.ts`。

### 提示词 A2e — 前端"用真实行为复评"按钮 + 人格渲染
```
Have teen_ux_specialist add the behavior re-evaluation UI to the risk-profile dashboard.

WRITE scope: src/components/student/student-risk-profile-dashboard.tsx (and a small sub-component if it grows). 
FORBIDDEN scope: api, lib, db.

Grounding:
- The dashboard already renders the questionnaire (A1 fixed selection) + payload. Add a section "用我的真实行为复评" with a button that POSTs to /api/student/risk-profile/behavior (A2d) and renders the returned BehaviorPersona: band/label/archetype/summary, an evidence[] list, a nextSteps[] list, and a small badge showing provider ("AI 生成" vs "本地教学兜底" when provider==="fallback") — mirror how existing surfaces show the tutor-radar provider.
- Reliability (this repo's core pain): use the project's async-submit pattern that actually tracks the request (NOT `void mutate`) so the button disables for the whole request — see wechat-checkout-button.tsx for the correct `startTransition(async () => await ...)` pattern. Three states: loading / error+retry (Chinese message, never English code) / empty.
- reduced-motion: any reveal animation must honor the JS guard pattern (student-quest-dashboard.tsx:143-146).

Steps: implement → component test (button triggers fetch, renders persona on success, shows Chinese error+retry on failure, button can't double-submit) → `npm run test -- student-risk-profile` + tsc → VERIFY with DB up by clicking it in `npm run dev`. reviewer + testing-accessibility-auditor + APPROVE.
Commit explicit paths; rollback = git checkout the component.
```
✅ 验收：库 Up 下点按钮出人格(含 provider 标)；连点不重复提交;失败中文+重试。
❌ 回滚：`git checkout -- src/components/student/student-risk-profile-dashboard.tsx`。

---

## Phase B · 任务中心翻卡 / 抽卡

### 提示词 B1 — 任务卡 GSAP 翻卡（正=任务/背=奖励，纯前端）
```
Have teen_ux_specialist turn the weekly quest cards into a 3D flip card (front = task, back = reward reveal).

WRITE scope: src/components/student/student-quest-dashboard.tsx (+ small sub-component if needed) and its *.test.tsx.
FORBIDDEN scope: api, lib, db. Use existing fields only.

Grounding (verified):
- Target cards: the weekly quest cards in student-quest-dashboard.tsx (~lines 547-605), which already have claim gating (`claimable`/`claimed`) and a `claimQuest` handler. Card fields already include title/category/progress/reward/coachNote (StudentQuestItem, lib/quests.ts) — front = title/category/progress, back = reward + coachNote. Do NOT change quest data or backend.
- Animation: GSAP only (the repo has @gsap/react, NO framer-motion). 3D is already proven here: premium-motion-provider.tsx:84-128 uses rotateY + transformPerspective:900. Implement flip with `transform-style:preserve-3d`, two faces `backface-visibility:hidden`, `gsap.to(card,{rotateY:180, ease: premiumMotion.ease.reward})` (reward ease from lib/motion-system.ts). Keep it a SEPARATE timeline from the entrance `data-motion-card` reveal.
- reduced-motion JS guard MANDATORY: copy student-quest-dashboard.tsx:143-146 — if reduce, `gsap.set` straight to the revealed back face, no rotation.
- a11y: card is keyboard-operable (button/role), aria-expanded or aria-pressed for flipped state, focus visible.

Steps: implement → component test (click flips to reveal reward; reduced-motion shows back immediately; keyboard toggles) → `npm run test -- student-quest` + tsc → VERIFY in `npm run dev`. reviewer + testing-accessibility-auditor + APPROVE.
Commit explicit paths.
```
✅ 验收：点击有 3D 翻转揭晓;reduced-motion 瞬显背面;键盘可操作。
❌ 回滚：`git checkout -- src/components/student/student-quest-dashboard.tsx`。

### 提示词 B2a — `card_collection` 表（手写迁移 + repo）
```
Have db_architect add the card-collection table and repo functions. The local DB is UP (npm run db:up).

WRITE scope: src/lib/db/schema.ts ; src/lib/db/repo.ts ; src/lib/db/repo.test.ts ; drizzle/0020_card_collection.sql (new) ; drizzle/meta/_journal.json.
FORBIDDEN scope: components, api, leaderboard, power-score (zero coupling).

Grounding (verified):
- Mirror the newest decorative/zero-战力 precedent `round_predictions` (schema.ts:196-210) and `createRoundPredictionForUser` (repo.ts:1387-1427) for idempotency.
- MIGRATION GOTCHA: `npm run db:generate` is broken non-interactively here (rank_profiles/risk_profiles TTY prompt). HAND-AUTHOR the migration like 0015/0019 did, plus a journal entry. The journal currently ends at idx 19 (tag 0019_risk_profile_behavior_persona, when 1780000180000) — append idx 20, when 1780000190000, tag "0020_card_collection". Apply with `npm run db:migrate` (NEVER drizzle-kit push).

Table card_collection:
  id varchar(64) PK, userId varchar(64) NOT NULL FK→users.id ON DELETE CASCADE,
  cardId varchar(64) NOT NULL, source varchar(24) NOT NULL ('quest_claim'|'streak'|'achievement'),
  drawnAt timestamptz NOT NULL default now(), meta jsonb,
  UNIQUE(userId, cardId), index(userId).

Steps:
1. schema.ts: add the pgTable + unique + index (match the file's column style).
2. Hand-author drizzle/0020_card_collection.sql with `CREATE TABLE IF NOT EXISTS card_collection (...)` + the unique + index. Append the journal idx-20 entry (valid JSON, comma after idx-19). `npm run db:migrate`. Verify `docker exec brownzone-pg psql -U postgres -d brownzone -c "\d card_collection"`.
3. repo.ts: `drawCardForUser(userId, {cardId, source, meta})` [WRITE_FN — add to WRITE_FNS + fallback whitelist repo.ts:303-312], idempotent via the unique constraint (on conflict do nothing → return existing); `listCardCollectionForUser(userId)`. withDb + tx + in-memory fallback. NEVER call recomputePowerForUser; NEVER touch scenario_runs financials.
4. repo.test.ts: draw twice same (userId,cardId) → only one row; list returns it. zero-战力 (no power recompute) asserted.
5. `npm run test -- repo` + tsc. reviewer + APPROVE.

Commit explicit paths incl. drizzle/.
```
✅ 验收：`\d card_collection` 4+ 列就位;同卡幂等只一行;repo 测绿。
❌ 回滚：`npm run db:down:hard && npm run db:up` 重建 + `git checkout` 删迁移/schema/repo 改动。

### 提示词 B2b — `lib/cards.ts` 牌库 + 加权随机抽稀有卡
```
Have finance_event_simulator add the deck + weighted-random draw logic (pure, deterministic).

WRITE scope: src/lib/cards.ts (new) ; src/lib/cards.test.ts (new) ; src/lib/content.ts (deck definitions only). 
FORBIDDEN: db, api, components, power-score.

Grounding:
- Deck content (card id, name, rarity 普通/稀有/史诗, art key, teaching line) → src/lib/content.ts (next to learningModules). Art key points to a file under public/brand/quest-cards/ (B3 produces the images).
- Pure draw logic → src/lib/cards.ts: `drawCard(deck, ownedCardIds, seed) → Card` using weighted-random by rarity, DETERMINISTIC via mulberry32 (copy the seeded-PRNG style from src/lib/event-engine.ts — NO Math.random, NO Date). Bias away from already-owned where appropriate. Expose rarity weights as named constants.
- Test: same (deck, owned, seed) → same card; rarity distribution over many seeds roughly matches weights; owned-dedup behaves.

Steps: implement → cards.test.ts (determinism + distribution + dedup) → `npm run test -- cards` + tsc → reviewer + APPROVE. Commit explicit paths.
```
✅ 验收：同 seed 同结果;稀有度分布符合权重;确定性测绿。
❌ 回滚：`git checkout -- src/lib/content.ts && rm src/lib/cards.ts src/lib/cards.test.ts`。

### 提示词 B2c — 抽卡 API 路由（幂等 / 装饰 / 零战力）
```
Have api_wirer add the draw-card route. DB up.

WRITE scope: src/app/api/student/quests/draw/route.ts (new). FORBIDDEN: power-score/leaderboard (must stay untouched), db internals, components.

Grounding:
- checkOrigin + requireUser("student") + Chinese error shape (copy an existing student POST route).
- Eligibility: the caller proves a claim/completion trigger (e.g. body {source, questId}); validate server-side against real quest state via existing quest payload builder (buildStudentQuestPayload) — do not trust client.
- Draw: load owned via listCardCollectionForUser, pick via drawCard(deck, ownedIds, seed) (seed derived deterministically, e.g. from userId+questId+round — NOT random per request so retries are stable), then drawCardForUser(userId, {cardId, source, meta}). Idempotent: same trigger returns the same already-owned card (the unique constraint + the deterministic seed guarantee this).
- ZERO 战力: do NOT import or call anything from leaderboard/** or recomputePowerForUser; do NOT modify scenario_runs financials. Add a test asserting net worth + power unchanged after a draw.

Steps: implement → route/integration test (idempotent draw; zero-战力 assertion; Chinese errors) → VERIFY DB up (draw → 我的卡库 has it → refresh persists) + stop-db drill → `npm run test` relevant + tsc → reviewer + APPROVE.
Commit explicit paths; rollback = delete route.
```
✅ 验收：同触发只得同一张卡;净值/战力不变;停库中文错误。
❌ 回滚：`rm src/app/api/student/quests/draw/route.ts`。

### 提示词 B2d — 前端接抽卡 + "我的卡库"
```
Have teen_ux_specialist wire the flip card (B1) to the draw endpoint (B2c) and add a "我的卡库".

WRITE scope: src/components/student/student-quest-dashboard.tsx (+ a small QuestCard / CardCollection sub-component) and its test. FORBIDDEN: api/lib/db.

Grounding:
- On claim/complete → POST /api/student/quests/draw → flip the card to reveal the drawn rarity card (reuse B1's GSAP flip + premiumMotion.ease.reward; reduced-motion guard). Show the card art via next/image from public/brand/quest-cards/ (B3). Add a "我的卡库" grid fed by the collection (GET — add a tiny GET to the draw route or a quests payload field; coordinate with api_wirer if a new GET is needed).
- Reliability: real async-submit (no `void mutate`), three states, Chinese errors, double-submit guard.

Steps: implement → component test (draw → reveal; collection renders; no double-submit; reduced-motion) → VERIFY DB up in dev → `npm run test -- student-quest` + tsc → reviewer + a11y + APPROVE. Commit explicit paths.
```
✅ 验收：完成任务→翻牌揭晓稀有卡→入"我的卡库"刷新仍在;连点不重复。
❌ 回滚：`git checkout -- src/components/student/student-quest-dashboard.tsx`。

### 提示词 B3 — 卡面美术（全位图，GPT 生图 → 导入）
> ⚠️ **工具决策点**：用户选了"GPT 生图"。**当前 Claude 会话无原生 GPT 生图工具**；Codex 侧若有 OpenAI 生图能力可直接用，否则用 Gemini Nano Banana / Adobe Firefly 替代或人工出图。本提示词只负责"出图后导入代码"，出图本身按你定的工具走。
```
Have ui_implementer import the generated card art and render it.

PRECONDITION: card art已生成为 webp(带 png 兜底)放在 public/brand/quest-cards/ —— 命名按稀有度/卡 id（front-{cardId}.webp、back-{rarity}.webp）。风格暖琥珀+金融教育调，色板对齐 module-illustration.tsx:21-22(红涨绿跌、amber/ink)。当前全站零位图、纯 SVG —— 卡面是新资产类，OK。

WRITE scope: src/components/student/** card components ; public/brand/quest-cards/** (assets). FORBIDDEN: api/lib/db.
Steps:
1. Confirm each deck card (content.ts art key) has a matching image file; for any missing, render a templated fallback (SVG frame + dynamic text) so the UI never shows a broken image.
2. Render via next/image (copy hero-stage-art.tsx:15-23 for sizes/priority), with dynamic text (task title / reward) overlaid on the raster as DOM text (so文案可改、清晰、可 i18n) — do NOT bake variable text into the image.
3. VERIFY in dev: cards crisp on desktop+mobile, no layout shift, dark-panel contrast OK, reduced-motion fine. `npm run lint` + tsc. reviewer + a11y + APPROVE.
Commit explicit paths incl. public/brand/quest-cards/.
```
✅ 验收：卡面清晰、无 broken image、暗底对比达标。
❌ 回滚：`git checkout` 组件 + `rm public/brand/quest-cards/*`。

---

## 收尾 · 全量验证（所有任务后）
```
Have qa_engineer run the full gate + failure drill, output a PASS/FAIL checklist.
1) DB up: npm run lint ; npx tsc --noEmit ; npm run test ; npm run build → each PASS.
2) e2e (tests/e2e/): 情境选择做满6题→生成人格→行为复评落库刷新仍在；任务翻卡→抽卡→我的卡库刷新仍在.
3) Failure drill: npm run db:down → 复评/抽卡页显示中文错误+重试(无英文码/无白屏) → npm run db:up.
4) Objective gates: `git grep -n "void mutate" src/components/student/` near 0 on touched files; no direct provider fetch outside ai.ts; no recomputePowerForUser in draw route.
Have reviewer + reality-checker confirm "actually works", not "compiles".
```

---

## 附录 A · 已建契约速查（贴给每个 Codex 会话，防臆造）
- `BehaviorPersona`(types.ts)：band/label/archetype/summary/evidence[]/nextSteps[]/confidence。
- `behavior-persona.ts`：PersonaSignalInput / buildPersonaSignalInput(run,learning,score?) / ruleFallbackPersona(input) / normalizeBehaviorPersona(text,fallback) / personaInputDigest(input)。
- `ai.ts` 范式：照抄 requestTutorRadarPayload(L530)；用私有 requestRemoteText(L347) + 自己的 normalize；AI 只在此文件。
- `repo.ts`：upsertRiskProfile 已接受 {behaviorPersona,personaProvider,analyzedAt,inputDigest}；getRiskProfile 已返回；新写函数进 WRITE_FNS + fallback 白名单(303-312)。
- 迁移：手写 `.sql`(IF NOT EXISTS) + journal 追加 idx；只 `npm run db:migrate`；当前 journal 末尾 idx 19。
- 抽卡幂等先例：round_predictions / createRoundPredictionForUser(repo.ts:1387)。零战力=不碰 leaderboard/**、不调 recomputePowerForUser。

## 附录 B · 当 Codex 跑偏
| 症状 | 第一动作 |
|---|---|
| 臆造了不存在的函数/列 | 打回：贴附录 A，要求只用真实符号，不存在就 STOP |
| `db:generate` 卡住/无输出 | 改手写迁移(0015/0019 范式)+journal，再 db:migrate |
| "tsc 绿就说好了" | 打回：库 Up 实点 + 停库演练 |
| 抽卡/任务给了战力 | 打回：删除任何 leaderboard/recompute 调用,零耦合 |
| 翻卡在 reduced-motion 卡死 | JS 守卫 gsap.set 终态(quest:143-146) |
| 改了禁区文件 | `git checkout -- <file>` + 重申 scope |
