# Brown Zone — Codex Workflow Playbook

> 完整阶段化 playbook：每阶段含目标 → 前置 → Codex 粘贴提示词 → 验收命令 → 失败回滚。  
> 在 Codex CLI 里按顺序执行，**不要跳阶段**。

---

## 0. Pre-flight Checklist（开工前 5 分钟）

```powershell
cd D:\树德实验中学（清波）\C2\brown-zone-web

# 1. 确认 subagent 配置已就位
Get-ChildItem .codex\agents

# 2. 确认 docs 已就位
Get-ChildItem docs\ui-spec
Get-ChildItem docs\ENV-CHECKLIST.md

# 3. 确认 DB skeleton 已就位
Get-ChildItem src\lib\db\repo.ts, scripts\seed.ts

# 4. 确认 .env.local 完整（按 docs/ENV-CHECKLIST.md §4 模板）
Get-Content .env.local | Select-String -Pattern "DATABASE_URL|SESSION_SECRET|SUPABASE"

# 5. 确认 git 状态干净
git status

# 6. 启动 Codex
codex
```

第一次启动时 Codex 会读取项目根目录的 `AGENTS.md` 和 `.codex/agents/*.toml`，可以输入 `/agents` 确认 5 个 subagent 都识别到。

---

## 阶段 1 — Database Bootstrap（30-45 分钟）

### 目标
让 Drizzle migration 跑通、Postgres 表建好、seed 数据写入。

### 前置
- `docs/ENV-CHECKLIST.md` 里的 5 个必填变量都已填到 `.env.local`
- 已在 Supabase Dashboard 创建项目并拿到 Pooler URL

### 提示词 1.1 — Supabase 连接性自检

```
Have db_architect verify our Supabase connection:
1. Read docs/ENV-CHECKLIST.md to know what env vars are expected
2. Read drizzle.config.ts and src/lib/db/client.ts to confirm config
3. Run a one-shot connection test: write a temp script that calls getDb().execute(sql\`select 1\`) and report success / error
4. Do NOT make any schema changes yet.

Report: connection ok / failed (with exact error) and recommended fix.
```

✅ 验收：终端打印 `connection ok`。  
❌ 回滚：若报 ENOTFOUND，回 `docs/ENV-CHECKLIST.md §7` 检查 Pooler vs Direct。

### 提示词 1.2 — Generate + Apply Initial Migration

```
Have db_architect:
1. Run `npx drizzle-kit generate` and show the diff in drizzle/0000_*.sql.
2. Review it: confirm all 13 tables present, all enum types created, all FK constraints reasonable.
3. Apply the migration to Supabase:
   - For Windows: write a PowerShell one-liner using `npx drizzle-kit migrate` (Drizzle Kit's migrate command).
   - Alternative: pipe the SQL into psql via the Supabase connection string.
4. Verify with `npx drizzle-kit introspect` that all 13 tables exist in the remote DB.

Stop after each numbered step and wait for me to confirm.
```

✅ 验收：Supabase Dashboard → Table Editor 能看到 13 张表。  
❌ 回滚：在 Supabase Dashboard 直接 `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` 重来。

### 提示词 1.3 — Finish Seed Script

```
Have db_architect finish scripts/seed.ts following the TODO markers inside.

Constraints:
- IDs must be IDENTICAL to createSeedStore() in src/lib/store.ts (teacher-1, student-1..3, parent-1, admin-1, class-1, bond-1, invite IDs).
- Password hash must be bcrypt.hashSync("BrownZone2026!", 10).
- Use idempotent inserts: .onConflictDoNothing() on primary keys.
- For seedScenarioRuns(): import the same helpers from store.ts and run the same mutation pipeline in memory, then write the final state.
- Add `db:seed` npm script if missing.

After done, run `npm run db:seed` and confirm 6 users / 1 classroom / 3 invites / 2 assignments / 3 runs / 1 growth report exist in DB.
```

✅ 验收：Supabase Dashboard → users 表能看到 6 行；invite_codes 表能看到 3 行。  
❌ 回滚：`npm run db:reset`（如果有；否则手动 truncate 6 张表）。

### 提示词 1.4 — Finish repo.ts Adapter

```
Have db_architect implement all `TODO(db_architect)` blocks in src/lib/db/repo.ts.

For each function:
1. Keep the function async; preserve the existing signature.
2. Use Drizzle eq/and/or builders, not raw SQL strings (unless absolutely necessary).
3. Reuse pure helpers from src/lib/simulation.ts (createInitialRun, applySimulationAction, advanceSimulationRun, buildSimulationState, buildGrowthReport, buildLeaderboard, buildBehaviorSignals).
4. For mutations (applyActionForUser, advanceRunForUser, registerUserByInvite), wrap in a Drizzle transaction.
5. Preserve the fallback behavior: when DATABASE_URL is missing or query fails, delegate to store.ts.

After implementation:
- Add src/lib/db/repo.test.ts covering each function (use existing vitest setup at src/test/setup.ts).
- Run `npx tsc --noEmit` and `npm run test -- src/lib/db`.

Then have reviewer audit: confirm zero changes outside src/lib/db/** and tests.
```

✅ 验收：`npm run test -- src/lib/db` 全绿 + tsc 无新错。

---

## 阶段 2 — API Route Migration（60-90 分钟，分 5 批）

### 目标
把 18 个 API route 的 `import { x } from "@/lib/store"` 全部换成 `from "@/lib/db/repo"`，并加 `await`。

### 提示词 2.1 — Batch 1：Auth（阻塞批，先做）

```
Have api_wirer migrate Batch 1 (auth):
- src/app/api/auth/login/route.ts
- src/app/api/auth/logout/route.ts
- src/app/api/auth/register-by-invite/route.ts
- src/app/api/invites/validate/route.ts

For each route:
1. Replace import "@/lib/store" with "@/lib/db/repo"
2. Add `await` at every call site (functions are now async)
3. Add zod validation for the request body if missing
4. Standardize error shape to { error: <code>, message: <中文> } with stable HTTP statuses (400 invalid_input, 401 unauthorized, 409 conflict, 503 db_unavailable)
5. Wrap with try/catch — on DB failure return 503 not 500

After done:
- Run `npm run test` (existing auth tests should still pass)
- Run `npm run build`
- Have reviewer audit and report

Stop and wait for my "next" before Batch 2.
```

### 提示词 2.2 — Batch 2：Simulation

```
Same contract as Batch 1, but for:
- src/app/api/sim/state/route.ts
- src/app/api/sim/actions/route.ts
- src/app/api/sim/advance-round/route.ts

Extra constraints:
- These routes are user-facing during a sandbox session — error messages must be friendly (use the existing error throws from store.ts as templates).
- Verify the cookie auth still works: read src/lib/session-user.ts to understand how the userId is extracted.

Run the same verification suite. Stop after.
```

### 提示词 2.3 — Batch 3：Role Dashboards

```
Migrate:
- src/app/api/teacher/classroom/route.ts
- src/app/api/teacher/assignments/route.ts
- src/app/api/parent/report/route.ts
- src/app/api/student/history-review/route.ts

Same migration rules. Pay attention: history-review route uses src/lib/history-review.ts which composes from store. After migration, history-review.ts may need to consume repo.ts too — flag it but DO NOT touch lib/ files in this batch (defer to a follow-up).

Run verification. Stop.
```

### 提示词 2.4 — Batch 4：AI Sessions

```
Migrate:
- src/app/api/ai/chat/route.ts
- src/app/api/ai/history/route.ts
- src/app/api/ai/history/[sessionId]/route.ts
- src/app/api/ai/tutor/route.ts
- src/app/api/ai/radar-chart/route.ts

Special handling:
- These routes already call src/lib/ai.ts which uses fetch to external AI gateway. Do NOT change ai.ts.
- The ai_sessions persistence is what changes (was store.createAiSession etc., now repo.createAiSession).

Run verification. Stop.
```

### 提示词 2.5 — Batch 5：Market

```
Migrate:
- src/app/api/market/ticker-tape/route.ts
- src/app/api/market/board/route.ts
- src/app/api/market/portfolio-intel/route.ts

Note: most market endpoints hit external AllTick API; they only touch the DB for portfolio-intel (which uses ai_sessions). Light migration.

After this batch, have reviewer run the full grep audit:
- `git grep -n "globalThis.__brownZoneStore__" src/app/api/` → MUST be 0
- `git grep -n "from \"@/lib/store\"" src/app/api/` → MUST be 0

Stop and report overall migration state.
```

---

## 阶段 3 — RLS & Real Auth Hardening（45 分钟）

### 提示词 3.1

```
Have db_architect produce drizzle/policies.sql with Row Level Security policies:

- users:        SELECT own row only (auth.uid() = id)
- scenario_runs: student SELECT own (user_id = auth.uid())
                 teacher SELECT classroom's runs (joined via users.classroom_id)
                 parent SELECT bonded student's run (joined via student_parent_links)
- ai_sessions:  SELECT + UPDATE own only
- growth_reports: SELECT own student OR bonded parent
- assignments:  teacher + admin only for write; classroom members SELECT
- invite_codes: teacher + admin only

Enable RLS on each table. Provide both the policy CREATE statements AND a `npm run db:apply-policies` script.

Then update src/lib/auth.ts (read-only modify): when issuing the session JWT, embed { role, classroomId } as custom claims so Postgres RLS can read them via auth.jwt().
```

### 提示词 3.2

```
Have qa_engineer add cross-role isolation tests:

- tests/integration/rls.test.ts:
  - login as student-2, try to fetch student-1's scenario run → must be empty / 403
  - login as parent-1, try to fetch a non-bonded student's report → must be empty / 403
  - login as teacher-1, fetch their classroom's leaderboard → ok
  - login as admin-1, fetch any → ok

These tests must hit the real Postgres (or a transactional test DB). Set up a Supabase preview branch if needed.

Run and report.
```

---

## 阶段 4 — UI System Migration（90-120 分钟）

### 提示词 4.1 — Apply Design Tokens

```
Have ui_implementer apply docs/ui-spec/01-tokens.md:

1. Replace the entire @theme inline block in src/app/globals.css with §11 from the spec.
2. Add the §2 primitive scale (--amber-*, --ink-*, --up-*, --down-*, --info-*, --warning-*, --error-*) into the :root block.
3. In src/app/layout.tsx, load fonts via next/font/google:
   - Noto Sans SC (weights 400/500/600)
   - Noto Serif SC (weights 500/700)
   - Inter (weights 400/500/600, variable)
   - JetBrains Mono (weights 400/500)
   Expose them as CSS variables --font-sans / --font-display / --font-mono.
4. Grep for hex colors and arbitrary Tailwind values:
   - `git grep -nE "#[0-9a-fA-F]{3,8}" src/components/` → migrate to tokens
   - `git grep -nE "text-\\[|p-\\[|w-\\[|h-\\[" src/components/` → migrate to scale
5. Run `npm run build` — Tailwind v4 must compile new tokens into CSS.
6. Open http://localhost:3000/ and visually scan: any unintended color shift? Capture screenshots.

Stop and let me review the screenshots before any component refactor.
```

### 提示词 4.2 — Student Dashboard Refactor

```
Have ui_implementer refactor src/app/(platform)/student/page.tsx and related components to match docs/ui-spec/02-student-dashboard.md.

Work in this order (one slice at a time, stop after each):

Slice A: HERO 区 — 5 指标卡 with display-2xl numbers
Slice B: Action Panel — Tab 重构 + sticky behavior
Slice C: Holdings + Timeline 右栏
Slice D: Mr.Brown 导师板 — 整合现有 student-tutor-radar
Slice E: 排行榜区 + 当前用户位置高亮
Slice F: 移动端 Action Panel 抽屉

After each slice:
- `npm run dev` and screenshot the page
- Run `npm run lint`
- Have reviewer grep for any hex or arbitrary values introduced
```

### 提示词 4.3 — Student Market Refactor

```
Same approach as 4.2, but for docs/ui-spec/03-student-market.md:

Slice A: 网格容器 + 响应式重排
Slice B: 主股票卡 (K 线 + 关键指标)
Slice C: 6 维雷达 + 持仓饼图
Slice D: 行业热度 bar + AI 观察池 + 排行卡

Note: if a K-line library is needed, install `lightweight-charts` (small, TradingView open-source). Ask before adding any other dependency.
```

### 提示词 4.4 — Site Pages Consistency Pass

```
Have ui_implementer audit all pages under src/app/(site)/ and src/app/(platform)/ for token compliance. For each page, produce a 5-bullet checklist:

- Uses token colors only? Y/N
- Type scale followed? Y/N
- Spacing scale followed? Y/N
- Responsive breakpoints work? Y/N
- Loading + empty + error states present? Y/N

Where N: leave a `// UI-DEBT: <what's wrong>` comment in the file. Output the full audit as docs/ui-spec/audit-2026-XX.md.

Do NOT fix everything in this pass — just measure.
```

---

## 阶段 5 — Pre-launch Audit（30 分钟）

### 提示词 5.1

```
Have reviewer run a full audit and produce a checklist:

1. `git grep -n "globalThis.__brownZoneStore__" src/app/api/` → expect 0
2. `git grep -n "import .* from .@/lib/store" src/app/api/` → expect 0
3. Every route file has zod validation on request body
4. Every route file has consistent error shape { error, message }
5. .env.example matches .env.local keys exactly (no missing keys, no extras)
6. README updated with Supabase setup steps
7. vercel.json env var requirements documented
8. AGENTS.md still accurate (subagent contract, demo accounts, etc.)
9. No leaked secrets in any committed file (`git grep -nE "sk_|pk_|ey[A-Z]" src/`)

Have qa_engineer run the full pipeline:
- npm run lint
- npx tsc --noEmit
- npm run test
- npm run build
- npx playwright test (after starting dev server)

Output: a markdown checklist with PASS / FAIL for each gate and any blockers.
```

### 提示词 5.2 — Deployment

```
Have qa_engineer prepare a Vercel deployment checklist:

1. Confirm vercel.json env var requirements
2. Verify build succeeds with NODE_ENV=production locally first: `NODE_ENV=production npm run build`
3. List the exact env variables needed in Vercel Dashboard (compare against .env.example)
4. Suggest the deploy command: `vercel --prod` or via git push

Then I'll run the deploy manually and report back.
```

---

## 阶段 6 — UI 视觉资产升级（可选，60 分钟）

如果想进一步打磨视觉，回到 **Claude Code** 而不是 Codex（Claude Code 有 ckm-banner-design、brandkit、anthropic-skills:canvas-design 等 skill）：

在 Claude Code 里：

```
/brandkit

为 Brown Zone / Mr.Brown 经济沙盘 生成品牌资产：
1. 替换 src/components/site/hero-stage-art.tsx 里的临时插画
2. 设计 4 个角色的统一头像风格
3. 重做 site-footer 的品牌底纹

风格：教育温度、克制金融感、有中国校园感、暖琥珀主色，配色严格遵循 docs/ui-spec/01-tokens.md
```

生成后把图片放到 `public/brand/` 下，再回 Codex 让 `ui_implementer` 引入。

---

## 阶段 7 — 提交与上线（15 分钟）

```powershell
cd D:\树德实验中学（清波）\C2\brown-zone-web

# 1. 审一遍 diff
git status
git diff --stat

# 2. 分阶段 commit（建议每个阶段一个 commit）
git add .codex/ docs/ AGENTS.md CODEX-WORKFLOW.md
git commit -m "chore: add Codex subagents + design spec + DB skeleton"

git add src/lib/db/ scripts/seed.ts drizzle/
git commit -m "feat(db): Drizzle migration + Postgres adapter (transparent fallback)"

git add src/app/api/
git commit -m "feat(api): wire all routes to db adapter with zod + consistent errors"

git add src/components/ src/app/globals.css src/app/layout.tsx
git commit -m "style(ui): apply v1 design tokens + refactor student dashboard & market"

# 3. push
git push origin main

# 4. 部署
vercel --prod
```

---

## 附录 A — 常用 Codex 操作

| 命令 | 用途 |
|---|---|
| `/agents` | 查看已加载的 subagent 列表 |
| `/agent <name>` | 切到某个 subagent 的会话 |
| `/threads` | 查看所有打开的 agent thread |
| Esc | 中断当前 agent 工作 |
| 输入 "have <agent_name> ..." | 在主对话里 spawn subagent |

## 附录 B — 当出错时

| 症状 | 第一动作 |
|---|---|
| Codex 自动改了禁区文件 | `git checkout -- <file>` + 重申 contract |
| subagent 跑出范围 | `Esc` 中断，重新发更窄的指令 |
| migration 把表搞坏 | Supabase Dashboard → drop schema + 重跑阶段 1 |
| 测试在 CI 过但本地 fail | 删 .next/ + node_modules/.cache/ 重试 |
| AI 总是返回本地兜底 | 查 AI_API_KEY，查 gpt-agent.cc 余额 |

## 附录 C — 不要做的事

- 不要让 ui_implementer 改 src/app/api/**
- 不要让 api_wirer 改 schema 或组件
- 不要在 Codex 主对话里让 reviewer 写代码（它是 read-only）
- 不要跳过阶段（每阶段都有依赖）
- 不要绕过 src/lib/ai.ts 直接 fetch Anthropic
- 不要在 globals.css 之外定义颜色 token
