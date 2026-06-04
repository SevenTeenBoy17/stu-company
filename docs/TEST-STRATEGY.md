# Brown Zone（Mr.Brown AI 经济沙盘）测试策略与实施蓝图

> **生成方式**：多智能体工作流（grounding → author → adversarial-verify）。
> **Ground truth 技术栈**：Next.js 16 (App Router) + React 19 + TypeScript strict + Drizzle ORM + Postgres(Supabase)；测试栈 Vitest `^4.1.4` + Playwright `^1.59.1` + @testing-library/react + jsdom（依据 `package.json`）。
> **反真声明（已逐条核对真实代码）**：本仓库**没有** Python / pytest / conftest.py、Vue / Vite、FastAPI、Monaco、SSE / WebSocket。模板术语已映射到真实特性 —— “AI 代码审查”→财务决策赛后复盘（`src/lib/history-review.ts`+`src/lib/ai.ts`）；“SSE 实时反馈”→嵌入 `/api/sim/*` 的自适应事件（`src/lib/adaptive-events.ts`）+ 10 分钟行情刷新（`src/lib/market-refresh.ts`）；“配对编程闭环”→12 回合模拟闭环；“计算思维”→财商战力决策质量分。

## 目录
- 1. 测试策略文档
- 2. 关键用户旅程全场景矩阵
- 3. 专项测试深挖
- 4. AI 生成代码风险点清单 + 针对性测试
- 5. 推荐目录结构 + 配置文件

---

## 1. 测试策略文档

> 适用对象：`brown-zone-web` = **Mr.Brown AI 经济沙盘**（K-12 财商经济模拟教学游戏）。技术栈：Next.js 16 App Router + React 19 + TypeScript strict + Drizzle ORM + Postgres(Supabase)。测试栈以 `package.json:35-51` 为准：Vitest `^4.1.4`、`@testing-library/react ^16.3.2`、`@testing-library/jest-dom ^6.9.1`、`@testing-library/user-event ^14.6.1`、`jsdom ^29.0.2`、`playwright ^1.59.1`。
>
> **反真声明（与模板术语的偏差，已逐条核对真实代码）**：本仓库**没有** Python、`pytest`、`conftest.py`、Vite、Vue、FastAPI、Monaco、SSE/WebSocket。模板里的 "pytest fixture / conftest.py" 在本栈无对应物——其职责由 Vitest 的 `setupFiles`（`vitest.config.ts:8` → `src/test/setup.ts`）+ 测试内 `beforeAll/afterAll` + `describe.skip` 门控（`tests/integration/rls.test.ts:31`）承担。"SSE 实时反馈" 不存在；真实实时面是嵌入 `/api/sim/*` 响应的自适应事件（`src/lib/adaptive-events.ts`）+ 10 分钟行情刷新（`src/lib/market-refresh.ts`）+ 榜单。"AI 代码审查" 不存在；真实物是对**财务决策**的赛后 AI 复盘（`src/lib/history-review.ts` + `src/lib/ai.ts`）。下文凡涉及这些术语，一律映射到真实特性。

### 1.1 现状基线（git 索引实测，非估算）

| 维度 | 现状 | 证据 |
| --- | --- | --- |
| 单元/组件测试文件 | **31 个**，全部为 `*.test.ts`；`*.test.tsx` **0 个** | `git ls-files "src/**/*.test.{ts,tsx}"` → 31；`*.test.tsx` → 空 |
| 集成测试文件 | 2 个（RLS、leaderboard repo） | `tests/integration/rls.test.ts`、`tests/integration/leaderboard.test.ts` |
| E2E 规格 | 5 个 spec | `tests/e2e/*.spec.ts`（prelaunch / ux-audit / ui-audit / ui-audit-stress / interactivity-audit）|
| 组件测试 | **缺口**：`@testing-library/react` + jsdom 已装但零 `.tsx` 用例 | `package.json:37-39,46`；`vitest.config.ts:6` 环境已是 `jsdom` |
| 外部边界 Mock 方式 | `vi.spyOn(globalThis,"fetch")`，**无 MSW** | `src/lib/ai.test.ts:52-53`；`package.json` 中 `msw` → 0 命中 |
| CI 流水线 | **不存在** `.github/workflows/` | `Glob .github/workflows/*` → No files found |

关键结论：单元层已扎实（尤以纯函数域为甚），**组件层从零起步**，**CI 从零起步**，外部边界 Mock 需从 `fetch` spy 升级到模块级方案。本策略据此定比例与建设优先级。

### 1.2 (a) 测试金字塔与目标层级比例

本仓库的架构形状直接决定金字塔的畸形（这是合理的，不是缺陷）：模拟/事件/榜单逻辑是**纯函数密集区**——`src/lib/simulation.ts`、`src/lib/event-engine.ts`（`mulberry32` 种子 PRNG，给定 seed 完全可复现）、`src/lib/leaderboard/*`（`power-score.ts`/`tiers.ts`/`run-power.ts`/`ranking.ts`/`periods.ts`/`school-normalize.ts`，已各配同名 `*.test.ts`）。这些无 I/O、无时钟（season 以 `currentSeasonSeed` epoch 2026-01-05 推导，可注入），单测**极廉价且确定性高**，所以金字塔底座要尽可能下压到单元层。

反向地，`repo.ts` 是双路径（DB 命中 → 失败/无 `DATABASE_URL` 则降级 `store.ts`，门控 `ALLOW_MEMORY_FALLBACK`，证据 `src/lib/db/repo.ts:113-114,142-173`），且 RLS 仅在 `DATABASE_ROLE=authenticated` + `withRls()` 下生效（`drizzle/policies.sql`）——这两类**无法用单测覆盖语义**，必须有真实 Postgres 集成层。AI/行情是 HTTP 边界，归 MSW（见 1.3b）。

| 层级 | 工具 | 目标占比(用例数) | 目标占比(投入) | RATIONALE（绑定本仓架构） |
| --- | --- | --- | --- | --- |
| 单元 Unit | Vitest (node/jsdom) | **65–72%** | ~45% | 纯函数域是核心 IP 且零 I/O：`simulation.ts`、`event-engine.ts`（种子可复现 `buildEventTimeline`）、`adaptive-events.ts`（每轮≤2 事件、1 警告+1 信息的 CLT 约束）、全部 `leaderboard/*`、`season.ts`、`billing/subscription.ts` 状态机、`api-response.ts`。极廉价→把比例顶到最大。已有 31 文件即此层主体。 |
| 组件 Component | Vitest + `@testing-library/react` + jsdom + `user-event` | **10–15%** | ~18% | 当前 **0 个** `.tsx` 用例是最大缺口。聚焦学生侧交互壳与共享语义组件：`components/student/*`（market board、tutor radar、allocation）、`components/shared/money-text`（涨红跌绿的中国市场色约定 + tabular-nums）、`access-gate`。环境已就绪（`vitest.config.ts:6`）。不测纯展示静态页。 |
| 集成 Integration | Vitest（独立 `vitest.integration.config.ts`，`environment:"node"`）+ 真实 Postgres | **8–12%** | ~20% | `repo.ts` 双路径 + RLS 只能在真库验证。现有 2 文件已示范金标准：`leaderboard.test.ts` 每次 repo 写都用**独立 raw-SQL 读**交叉校验，专防"静默落回内存 store 而假绿"（`tests/integration/leaderboard.test.ts:9-12,78-83`）；`rls.test.ts` 用 `set local role authenticated` + `set_config('request.jwt.claims',...)` 模拟四角色越权（`tests/integration/rls.test.ts:36-51,60-118`）。需扩到 repo 主写路径 + 软地板事务 `for("update")`。 |
| E2E | Playwright（自起 :4173 dev server） | **6–10%** | ~12% | 只覆盖 AGENTS.md 冒烟九页关键旅程（`/`、`/learn`、`/demo`、`/student`、`/student/market`、`/student/history`、`/teacher`、`/parent`、`/admin`，见 `AGENTS.md:100-108`）。慢且脆，刻意压到塔尖。webServer 已注入 `DB_QUERY_TIMEOUT_MS=350` 逼出降级路径（`playwright.config.ts:23`）。 |
| 专项 Specialized | 见下表 | **~5%**（横切，不与上重复计） | ~5% | 安全/契约/确定性回归横切层，独立门控。 |

专项（横切）细分：

| 专项 | 范围 | 工具 | RATIONALE |
| --- | --- | --- | --- |
| RLS 安全隔离 | 学生↔学生越权、家长↔未绑定学生报告、教师班级可见、admin 提权 | Vitest 集成 + Postgres | 默认 `owner` 连接**绕过** RLS（`AGENTS.md:25`），故 repo 应用层检查是主防线，但 `authenticated` 路径必须独立证伪。 |
| 契约 Contract | API 错误体 `{ error:<stable_code>, message:<中文> }`、七个稳定码 | Vitest 单元 | `src/lib/api-response.ts` 是全 API 错误契约源头，回归成本极低、收益高。 |
| 确定性回归 | 同 seed → 同行情/事件时间线；快照对比 | Vitest 单元 | `event-engine.ts`/`season.ts` 的可复现性是"教师可重放同一课堂场景"的产品承诺，必须锁死。 |
| 计费状态机 | trial → trial_degraded → expired/active；`canUserOperate()` 门控 | Vitest 单元 | `billing/subscription.ts` 已有 `store-billing.test.ts`/`store-family.test.ts`，纯状态迁移宜单测穷举。 |

### 1.3 (b) 工具选型与理由

| 工具 | 用途 | 选型理由（绑定本仓证据） |
| --- | --- | --- |
| **Vitest `^4.1.4`** | 单元 + 组件 + 集成 runner | 已是既有 runner（`package.json:10-12,50`）。两套 config 物理隔离单元与集成：`vitest.config.ts:13-14` 只收 `src/**/*.test.{ts,tsx}` 且排除 `tests/integration/**`；`vitest.integration.config.ts:11` 只收 `tests/integration/**`。`@` 别名两处一致（`vitest.config.ts:16-20`、`vitest.integration.config.ts:14-18`），与 `tsconfig` 的 `@/*→./src/*` 对齐。`globals:true` 免逐文件导入。 |
| **`@testing-library/react` + `jsdom` + `user-event`** | React 19 组件层 | 已装（`package.json:37-39,46`）。`vitest.config.ts:6` 环境已是 `jsdom`，`setupFiles` 已挂 `@testing-library/jest-dom/vitest`（`src/test/setup.ts:1`），落组件测试**零额外配置成本**。RTL 以用户可见行为断言（角色/文本/交互），契合学生侧组件。 |
| **MSW（建议新增 devDependency）** | Mock `src/lib/ai.ts` 与 `src/lib/alltick.ts` 的**网络出口** | **为何在网关模块边界而非 provider URL 设桩**：AGENTS.md 红线规定所有 AI 调用必须经 `src/lib/ai.ts`、所有行情经 `src/lib/alltick.ts`，"模块外直连 provider 即 blocker"（`AGENTS.md:27,53`）——即架构上每类外部依赖只有**单一收敛口**。在该收敛口（`ai.ts` 内的 `fetch` → `endpointForBase()` 推导出的 `/v1/messages`，证据 `src/lib/ai.ts:60-70`）拦截，既不耦合具体 provider 域名、又覆盖主/备 baseURL fallback 逻辑（`ai.test.ts:47-55` 已在测主→备重试）。当前用 `vi.spyOn(globalThis,"fetch")`（`ai.test.ts:52-53`）也是打在这一层、方向正确，但脆：手写 `Response`、逐用例 mock、无法表达"按 URL/方法路由"或网络错误语义。MSW 用请求级 handler 取代之，主/备/超时/500/合法 JSON 各一 handler，**断言 AI 不可用时返回 `provider:"fallback"` 兜底叙事**（`ai.test.ts:31-45` 已是此意图）；同理 alltick 在缺 key 时返回 `provider:"fallback"`、空 quotes（`alltick.test.ts:15-23`，注意它还需清 `globalThis.__alltick*Cache__` 三个缓存，`alltick.test.ts:8-13`——MSW 化后保留此 teardown）。**绝不 mock provider 本身**：只 mock 网关的网络出口。 |
| **Playwright `^1.59.1`** | E2E | 已装（`package.json:47`）。`playwright.config.ts:16-25` 自起 dev server（`PLAYWRIGHT_PORT` 默认 4173、`reuseExistingServer:true`、`baseURL=127.0.0.1:4173`），CI 无需手动拉服务。`trace:"retain-on-failure"`（`:14`）便于失败取证。注入 `DB_QUERY_TIMEOUT_MS=350`（`:23`）专门压低 DB 超时以驱动降级路径，使离线/降级也在 E2E 受覆盖。 |
| **`vitest.integration.config.ts` + 一次性 Postgres schema** | repo 双路径 + RLS DB 路径 | 独立 `environment:"node"`、`testTimeout:30_000`（`vitest.integration.config.ts:9,12`），与 jsdom 单元层互不污染。两个集成文件都自读 `.env`/`.env.local`、`describe.skip` 当无 `DATABASE_URL`（`rls.test.ts:27-31`、`leaderboard.test.ts:41-45`），所以本地缺库自动跳过、CI 注入库才跑——**必须指向可丢弃测试 schema，绝不指生产**（两文件头注释均明示，`vitest.integration.config.ts:4-6`、`leaderboard.test.ts:10-13`）。 |

**pytest / conftest.py 显式判定为 N/A**（本栈无 Python）。等价物对照：

| 模板(Python)概念 | 本仓真实等价物 | 证据 |
| --- | --- | --- |
| `pytest` runner | `vitest run`（`npm run test`） | `package.json:10` |
| `conftest.py` 全局 fixture/setup | `vitest.config.ts` 的 `setupFiles:["./src/test/setup.ts"]` | `vitest.config.ts:8`；`src/test/setup.ts:1` |
| `@pytest.fixture` | 测试内 `beforeAll/afterAll/beforeEach` + 工厂函数（如 `setClaims()`、`cleanup()`） | `rls.test.ts:36,56`；`leaderboard.test.ts:60-70` |
| `@pytest.mark.skipif(no db)` | `const describeWithDb = databaseUrl ? describe : describe.skip` | `rls.test.ts:31`；`leaderboard.test.ts:45` |
| `pytest.ini` / `tox.ini` 多配置 | 双 Vitest config（unit vs integration） | `vitest.config.ts` + `vitest.integration.config.ts` |
| `responses`/`respx`(HTTP mock) | MSW（建议）/ 当前 `vi.spyOn(globalThis,"fetch")` | `ai.test.ts:52` |
| `playwright-pytest` | 原生 `@playwright/test`（`npx playwright test`） | `playwright.config.ts` |

### 1.4 (c) CI/CD 流水线（GitHub Actions，将 AGENTS.md 质量门转为分阶段）

把 `AGENTS.md:90-96` 的质量门（`npm run lint` → `npx tsc --noEmit` → `npm run test` → `npm run build` → `npx playwright test`）加上 `npm run test:integration`（`package.json:12`）落为分阶段流水线。当前 `.github/workflows/` 为空，属新建。原则：**快而廉的门先跑、贵的门后跑并行化**；集成阶段挂 Postgres service container 并在测前依序 `db:generate`/迁移 + `db:apply-policies`（`package.json:13,15`；`drizzle/policies.sql`）；合并门由必过 job 守。

| 阶段 | Job | 命令 | 依赖/缓存 | 服务容器 | 合并门 |
| --- | --- | --- | --- | --- | --- |
| 0 安装 | `setup` | `npm ci` | `actions/setup-node` + `cache:"npm"`；缓存 `node_modules`/Playwright 浏览器 | — | — |
| 1 静态 | `lint` | `npm run lint` | 复用阶段0缓存 | — | ✅ 必过 |
| 1 静态 | `typecheck` | `npx tsc --noEmit` | 复用缓存（与 lint 并行） | — | ✅ 必过 |
| 2 单元+组件 | `unit` | `npm run test`（含 jsdom 组件层） | 复用缓存 | — | ✅ 必过 |
| 3 集成 | `integration` | 见下序列 | 复用缓存 | `postgres:16` service（`DATABASE_URL=postgres://...@localhost:5432/test`）；额外设 `DATABASE_ROLE=authenticated` 以激活 RLS 路径（`AGENTS.md:25`） | ✅ 必过 |
| 4 构建 | `build` | `npm run build` | 复用缓存；缓存 `.next/cache` | — | ✅ 必过 |
| 5 E2E | `e2e` | `npx playwright test` | 缓存 Playwright 浏览器；Playwright 自起 :4173（`playwright.config.ts:16-25`），失败上传 `trace` | 可选 `postgres:16`；否则走内存降级（`DB_QUERY_TIMEOUT_MS=350` 已在 config 注入） | ✅ 必过 |

**阶段3（集成）测前必跑序列**（顺序敏感）：
1. 等待 Postgres `pg_isready`（service container `--health-cmd`）。
2. 应用迁移：`npm run db:generate` 后 apply，或直接对测试库执行 `drizzle/0000`…`0012`（含 `0010_leaderboard_power_rank`、`0011_rank_profile_tier_season`、`0012_learning_progress`——leaderboard 集成测试断言这三个迁移已落，`tests/integration/leaderboard.test.ts:8`）。
3. **`npm run db:apply-policies`**（`package.json:15` → `drizzle/policies.sql`）——否则 `rls.test.ts` 的越权用例会因无策略而失真。
4. `npm run db:seed`（`package.json:14`）——两套集成测试都依赖种子 `student-1/2/3`、`teacher-1`、`parent-1`、`admin-1`、`class-1`（`rls.test.ts:60,96`；`leaderboard.test.ts:50` 用 `student-3`）。
5. `npm run test:integration`。

**门规则与护栏**：
- 合并门 = `lint` + `typecheck` + `unit` + `integration` + `build` + `e2e` 全绿（分支保护必过检查）。
- 集成 job 的 `DATABASE_URL` **只能**指向流水线内一次性 service container，**严禁**注入生产串（两套集成测试文件头注释强制此约定，`vitest.integration.config.ts:4-6`、`leaderboard.test.ts:10-13`）。
- 触发：`pull_request` 跑全量；`push` 到 `main` 跑全量并可加发布后冒烟。
- 缓存键以 `package-lock.json` 哈希为准；Playwright 浏览器单独缓存于 `~/.cache/ms-playwright`，命中则跳 `playwright install`。
- 失败取证：`unit/integration` 上传 Vitest reporter（CI 用 `--reporter=dot`+`junit`）；`e2e` 上传 `trace`（`retain-on-failure`）与首失败截图。
- 实现者/审查者分属不同责任组（`AGENTS.md:69-71`）：CI 由 `qa_engineer`/`testing-api-tester` 实现，`reviewer` 审查；每阶段以 `APPROVE`/`REQUEST_CHANGES`/`NEEDS_DISCUSSION` 收口（`AGENTS.md:72`）。

### 1.5 落地优先级（据 1.1 缺口排序）

1. **P0 组件层破零**：`money-text`（涨红跌绿 + tabular-nums，`CLAUDE.md` Design Tokens/Key Conventions）、`access-gate`、`student/market-board`、`student/tutor-radar` 首批 RTL 用例——环境零成本（`vitest.config.ts:6`、`src/test/setup.ts:1`）。
2. **P0 CI 建档**：新建 `.github/workflows/ci.yml`，先接 1/2/4 阶段（无需 DB），再补 3/5。
3. **P1 MSW 化**：`ai.test.ts`/`alltick.test.ts` 从 `vi.spyOn(fetch)` 迁到 MSW handler，覆盖主/备/超时/`fallback` 兜底（`ai.ts:60-70`、`ai.test.ts:31-55`、`alltick.test.ts:15-32`）。
4. **P1 集成扩面**：把 `repo.ts` 主写路径 + 软地板 `for("update")` 事务纳入 DB 路径测试，沿用"独立 raw-SQL 交叉校验防假绿"金标准（`leaderboard.test.ts:78-83,101-113`）。
5. **P2 专项门**：API 错误契约（`api-response.ts` 七码）、种子可复现快照（`event-engine.ts`/`season.ts`）独立用例。

---

## 2. 关键用户旅程全场景矩阵

> 本矩阵覆盖 student / teacher / parent / admin 四类角色，共 **15 条核心旅程**（含 12 条必测 + 3 条补充）。每条旅程均锚定 `brown-zone-web` 真实代码：所有"预期 ground truth"列均给出 `path:line` 或命名常量，未在代码中存在的行为以 **【不存在】** 显式标注，绝不臆造。
>
> 关键真值速查（全矩阵复用）：
> - 起始现金 `STARTING_CASH = 120_000`（`src/lib/simulation.ts:50`）；总回合 `totalRounds = 12`（`src/lib/simulation.ts:268`）。
> - Adaptive 每回合 ≤2 条（1 warning + 1 info/positive），CLT 约束在 `src/lib/adaptive-events.ts:213-224`。
> - Power 五权重 `.30 / .25 / .20 / .15 / .10`（`POWER_WEIGHTS`，`src/lib/leaderboard/power-score.ts:33-39`，总和=1.0），合成上限 `maxPower=2000`（`power-score.ts:47`）。
> - Season epoch `Date.UTC(2026, 0, 5)`（2026-01-05 周一，`src/lib/season.ts:7`）；周长 `WEEK_MS`（`season.ts:8`）。
> - 试用窗 `TRIAL_TOTAL_DAYS=3` / `TRIAL_FULL_DAYS=2`（`src/lib/billing/subscription.ts:60-61`）。
> - 内存兜底开关 `ALLOW_MEMORY_FALLBACK`（`src/lib/db/repo.ts:113-114`，生产默认关闭）。
> - 行情刷新 `MARKET_REFRESH_INTERVAL_MS = 10*60*1000`（`src/lib/market-refresh.ts:1`）。
> - API 错误码集合：`invalid_input / unauthorized / forbidden / not_found / conflict / db_unavailable / service_unavailable`（`src/lib/api-response.ts:6-13`）。
>
> **重要校正（对抗模板臆造）**：本系统 **无 SSE / WebSocket**——"实时反馈"= adaptive events 内嵌于 `/api/sim/*` JSON 响应 + 10 分钟行情刷新 + live leaderboard；**无"代码审查"**——"AI 双角色"= `adaptive-events.ts` 实时行为教练 + `history-review.ts`+`ai.ts` 赛后**财务决策**复盘。

---

### 旅程 J01 — 学生 12 回合模拟完整闭环（onboard → action → adaptive 注入 → advance → AI 复盘）

核心入口：`/api/sim/state`（GET）→ `/api/sim/actions`（POST）→ `/api/sim/event-choice`（POST）→ `/api/sim/advance-round`（POST）→ `/api/student/history-review`。

| 场景ID | 用例 | 类型 | 优先级 | 覆盖层 | 预期 ground truth (path:line / 常量) | 备注 |
|---|---|---|---|---|---|---|
| J01-01 | 新建初始 run，现金=120000、回合=1、首事件已入历史 | happy | P0 | 单元 | `createInitialRun` 返回 `cash: STARTING_CASH`(`simulation.ts:279`)、`currentRound:1`(`:276`)、`eventHistory:[firstEventId]`(`:287`) | 默认 seed=`currentSeasonSeed()`(`:266`) |
| J01-02 | 买入资产，现金扣减 = 数量×当回合报价 | happy | P0 | 单元 | `applySimulationAction` trade/buy：`cash -= notional`(`simulation.ts:315`)，`notional=quote.currentPrice*quantity`(`:309`) | quantity 下取整且≥1(`:308`) |
| J01-03 | 卖出后持仓清零则从 holdings 移除 | happy | P1 | 单元 | `upsertHolding` 数量≤0 时 filter 移除(`simulation.ts:228-230`) | 均价加权见 `:220` |
| J01-04 | 推进回合：储蓄按 1.012+liquidityBoost 计息、债务×1.018 | happy | P0 | 单元 | `advanceSimulationRun`：`savings*=1.012+...`(`simulation.ts:516`)、`debt*=1.018`(`:517`) | 回合自增 `:518` |
| J01-05 | 第 12 回合再 advance：停在 12，仅 commitSnapshot | edge | P0 | 单元 | `if (currentRound >= totalRounds) { commitSnapshot; return }`(`simulation.ts:510-513`) | 不会越界到 13 |
| J01-06 | 单回合连续 4 次 trade → 触发 overtrading(high) | unhappy | P0 | 单元 | `detectOvertrading` ≥4→high(`adaptive-events.ts:33`)；经 `/api/sim/actions` 回填 `adaptiveEvents`(`actions/route.ts:51`) | ≥3→medium(`:34`) |
| J01-07 | 同回合既触发 warning 又触发 info，响应仍只回 2 条 | 对抗 | P0 | 单元/集成 | CLT：`[topWarning, topOther].filter(...)`(`adaptive-events.ts:224`)，各取 1 条 | confidence=low 被丢弃(`:208`) |
| J01-08 | buy 现金不足 → 抛错"可用现金不足" | unhappy | P0 | 单元 | `if (cash < notional) throw`(`simulation.ts:312-314`)；路由经 `handleRouteError` 归一 `invalid_input/400`(`api-response.ts:34`) | |
| J01-09 | sell 持仓不足 → 抛错"持仓数量不足" | unhappy | P0 | 单元 | `if (!holding || holding.quantity < quantity) throw`(`simulation.ts:325-327`) | |
| J01-10 | actions 请求体非法（quantity≤0 / side 越界）→ invalid_input | 对抗 | P0 | 集成 | `actionSchema` zod 校验(`actions/route.ts:10-37`)；`ZodError→invalid_input/400`(`api-response.ts:20-22`) | |
| J01-11 | 未登录调用 actions → unauthorized | unhappy | P0 | 集成 | `requireUser("student")` 无 session→401(`api-guard.ts:8-9`) | |
| J01-12 | 非学生角色调用 actions → forbidden | 对抗 | P0 | 集成 | `requiredRole !== role → 403`(`api-guard.ts:23-25`) | |
| J01-13 | bank deposit 金额下限 500（输入 100 被夹到 500） | edge | P1 | 单元 | `amount = Math.max(500, round(amount))`(`simulation.ts:340`) | venture 下限 2000(`:422`) |
| J01-14 | 赛后 AI 复盘（history-review）正常返回结构化洞察 | happy | P1 | 集成/专项 | `/api/student/history-review`→`history-review.ts`+`ai.ts`；mock `ai.ts` 边界 | 真值=决策复盘非代码审查 |
| J01-15 | 提交后净值物化到 run.netWorth（供 SQL 排行榜） | happy | P1 | 单元 | `commitSnapshot`：`run.netWorth = evaluated.netWorth`(`simulation.ts:256`) | |

---

### 旅程 J02 — 教师控制台多学生监控 + assignment 下发/进度

核心入口：`/api/teacher/assignments`（GET/POST）、`/api/teacher/classroom`、`getTeacherOverview`。

| 场景ID | 用例 | 类型 | 优先级 | 覆盖层 | 预期 ground truth (path:line / 常量) | 备注 |
|---|---|---|---|---|---|---|
| J02-01 | 教师 GET 班级任务列表 | happy | P0 | 集成 | `requireUser("teacher")` + `getTeacherOverview`(`assignments/route.ts:19-23`) | |
| J02-02 | 教师发布任务（title/brief/difficulty/dueLabel）成功 | happy | P0 | 集成 | `assignmentSchema.parse`→`createAssignmentForTeacher`(`assignments/route.ts:35-41`) | 返回"任务已发布到班级面板"(`:46`) |
| J02-03 | brief 少于 10 字符 → invalid_input | unhappy | P0 | 集成/单元 | `brief: z.string().min(10).max(2000)`(`assignments/route.ts:13`) | M5 强边界，注释 `:8-10` |
| J02-04 | difficulty 传未知枚举值 → 被 zod 拒绝（非静默回退"策略"） | 对抗 | P1 | 单元 | `difficulty: z.enum(["基础","策略","联赛"])`(`assignments/route.ts:14`) | 注释明确拒绝 unknown(`:9`) |
| J02-05 | 学生角色尝试发布任务 → forbidden | 对抗 | P0 | 集成 | `requireUser("teacher")`→403(`api-guard.ts:23-25`) | |
| J02-06 | 多学生总览（净值/纪律/进度）聚合呈现 | happy | P1 | 集成 | `getTeacherOverview` 返回 assignments+学生概况；buildLeaderboard 按 classroom 过滤(`simulation.ts:675`) | |
| J02-07 | DB 抛错时 overview 读取降级（dev）或 db_unavailable（prod 关兜底） | edge | P1 | 集成 | `handleRouteError` 命中 db 正则→`db_unavailable/503`(`api-response.ts:26-28`)；兜底见 J05 | |
| J02-08 | 教师查看的 leaderboard 仅含本班 | edge | P1 | 单元 | `buildSimulationState`：`.filter(entry => entry.classroomId === classroom.id)`(`simulation.ts:675`) | 跨班不泄漏 |

---

### 旅程 J03 — 沙盘可复现性：seed 决定论 + 重放一致

核心：`mulberry32` PRNG、`buildEventTimeline`、`/api/sim/replay`、`scenario_run.seed`。

| 场景ID | 用例 | 类型 | 优先级 | 覆盖层 | 预期 ground truth (path:line / 常量) | 备注 |
|---|---|---|---|---|---|---|
| J03-01 | 同 seed 两次 `buildEventTimeline` 产出完全一致时间线 | happy | P0 | 单元 | `makeRng(seed)` 纯函数 mulberry32(`event-engine.ts:18-27`)，无 `Math.random`(`:13` 注释) | 决定论核心 |
| J03-02 | 不同 seed 产出不同时间线（多样性） | happy | P0 | 单元 | `buildEventTimeline` 经 `shuffle(rng,...)`(`event-engine.ts:54-86`) | 难度三段 tier1→2→3(`:54-55`) |
| J03-03 | 难度曲线：前三分之一 tier1（无黑天鹅）、末段含 tier3 | edge | P1 | 单元 | `take(tier1,early) / take([...tier3,...tier2],late)`(`event-engine.ts:81-85`)；`eventTier` 黑天鹅=3(`:33-38`) | |
| J03-04 | 事件选择 gamble 结果由 `seed+round*1000` 决定（可复现） | happy | P0 | 单元 | `makeRng((seed??1)+currentRound*1000)`(`simulation.ts:489`)；`resolveEventChoice` win=`rng()>=0.5`(`event-engine.ts:128`) | win+22%/loss-18%(`:129`) |
| J03-05 | protect 选项=净值 2% 确定成本；hold=0 | happy | P1 | 单元 | `protect: -round(stake*0.02)`(`event-engine.ts:127`)；`hold: cashDelta:0`(`:122`) | stake 地板=max(net,20000)(`:126`) |
| J03-06 | 负净值学生 gamble 仍方向正确（stake floor 防符号反转） | 对抗 | P0 | 单元 | `stake = Math.max(netWorth, 20_000)`(`event-engine.ts:126`) + 注释(`:123-125`) | 防奖励错误行为 |
| J03-07 | Premium replay 重置为新 seed，行情刷新 | happy | P1 | 集成 | `/api/sim/replay`→`replayRunForUser`(`replay/route.ts:30`)；返回"新赛季已开启"(`:32`) | |
| J03-08 | 非 Premium 调 replay → forbidden（seasonReplay gate） | 对抗 | P0 | 集成 | `if (!features.seasonReplay) return forbidden`(`replay/route.ts:21-27`)；Premium-only(`subscription.ts:39`) | |
| J03-09 | 旧 run 无 eventTimeline → 报价回退中性倍率 1（向后兼容） | edge | P1 | 单元 | `runEventMultiplier`：`if (!run?.eventTimeline) return 1`(`simulation.ts:71`) | 注释 `:61-65` |
| J03-10 | 事件本回合已选 → 再选抛"已经做过了" | unhappy | P1 | 单元 | `applyEventChoice` alreadyChose→throw(`simulation.ts:477-482`) | 一回合一选 |
| J03-11 | 同回合同 seed 重放整局，snapshots 序列逐项一致 | 专项 | P0 | 集成/专项 | seed 持久化于 `scenario_run`（迁移 `0005_scenario_run_event_seed.sql`）；`run.seed`(`simulation.ts:291`) | 教师可复刻同一课堂场景 |

---

### 旅程 J04 — AI 网关不可用 → ai.ts fallback narrative 不阻断教学

核心：`src/lib/ai.ts`（primary/secondary base URL + fallback）。**Mock `ai.ts` 边界，绝不 mock provider。**

| 场景ID | 用例 | 类型 | 优先级 | 覆盖层 | 预期 ground truth (path:line / 常量) | 备注 |
|---|---|---|---|---|---|---|
| J04-01 | 未配置 AI 端点 → 返回 fallback（provider:"fallback"） | happy(降级) | P0 | 单元/专项 | `getAiConfig` 未 opt-in 返回 null(`ai.ts:79-90` + 注释 `:79-87`)；`TutorInsightResponse.provider:"fallback"`(`ai.ts:23`) | 不泄漏 PII 到硬编码域 |
| J04-02 | AI 调用超时（>12s）→ AbortController 中止，落 fallback | unhappy | P0 | 单元/专项 | `fetchWithTimeout` 默认 `timeoutMs=12_000`(`ai.ts:65`)，`controller.abort()`(`ai.ts:67`) | 不挂起教学流 |
| J04-03 | primary 失败 → secondary base URL 接管 | edge | P1 | 单元 | primary/secondary 双 base（`ai.ts:88-90` 起，`AI_BASE_URL_PRIMARY`/`BROWN_AGENT_BASE_URL`） | 读 `process.env` 而非 env 快照(`:87`) |
| J04-04 | base URL 规范化：`/v1` 结尾拼 `/messages`，否则 `/v1/messages` | edge | P2 | 单元 | `endpointForBase`(`ai.ts:60-63`) | |
| J04-05 | AI 不可用时 history-review 仍返回 fallbackReview | happy(降级) | P0 | 集成 | `HistoryReviewInsightRequest.fallbackReview`(`ai.ts:42-45`) 作兜底 | 教学不中断 |
| J04-06 | 任何模块绕过 ai.ts 直连 provider | 对抗(架构红线) | P0 | 专项(静态扫描) | AGENTS.md 红线："Do not fetch AI providers directly outside src/lib/ai.ts" | grep 校验无旁路 fetch |

---

### 旅程 J05 — DATABASE_URL 缺失/查询抛错 → repo.ts 内存兜底 vs db_unavailable

核心：`withDb` 包装器 + `ALLOW_MEMORY_FALLBACK`（`src/lib/db/repo.ts`）。

| 场景ID | 用例 | 类型 | 优先级 | 覆盖层 | 预期 ground truth (path:line / 常量) | 备注 |
|---|---|---|---|---|---|---|
| J05-01 | 无 DATABASE_URL + 允许兜底 → 走 store 内存 fallback | happy(离线) | P0 | 集成 | `withDb`：`!isDatabaseConfigured()` 且允许→`fallback()`(`repo.ts:147-153`) | dev 默认允许(`:114`) |
| J05-02 | 无 DATABASE_URL + 关兜底（prod 默认）→ 抛错 | 对抗 | P0 | 集成 | `if (!ALLOW_MEMORY_FALLBACK) throw "DATABASE_URL not configured"`(`repo.ts:148-149`) | 路由层经 `handleRouteError`→`db_unavailable/503`(`api-response.ts:26-28`) |
| J05-03 | DB 客户端不可用（连接失败）+ 关兜底 → 抛错 | 对抗 | P0 | 集成 | `if (!db) { if(!ALLOW...) throw "DB client unavailable" }`(`repo.ts:156-158`) | |
| J05-04 | 查询抛异常 + 允许兜底 → logFallback 后回 store | unhappy | P0 | 集成 | `catch(err){ logFallback(...,"query_failed"); return fallback() }`(`repo.ts:166-171`) | |
| J05-05 | 查询抛异常 + 关兜底 → 原样 rethrow | 对抗 | P0 | 集成 | `if (!ALLOW_MEMORY_FALLBACK) throw err`(`repo.ts:168-169`) | |
| J05-06 | 查询超过 5s → withQueryTimeout 抛超时错 | edge | P1 | 单元 | `DB_QUERY_TIMEOUT_MS = 5000`(`repo.ts:108`)；`reject(... timed out)`(`repo.ts:129-130`) | |
| J05-07 | ALLOW_MEMORY_FALLBACK 真值解析（"true" 或 非 production） | edge | P1 | 单元 | `=== "true" || NODE_ENV !== "production"`(`repo.ts:113-114`) | |
| J05-08 | no_database_url 不打 warn 日志（避免噪音），其余打 | edge | P2 | 单元 | `logFallback`：`if (reason !== "no_database_url" && NODE_ENV !== "test")`(`repo.ts:116-119`) | |

---

### 旅程 J06 — 未授权/越权访问：api-guard 角色校验 + JWT tv 吊销 + RLS 跨租户隔离

核心：`requireUser`（`api-guard.ts`）、token version、`drizzle/policies.sql`+`withRls()`。

| 场景ID | 用例 | 类型 | 优先级 | 覆盖层 | 预期 ground truth (path:line / 常量) | 备注 |
|---|---|---|---|---|---|---|
| J06-01 | 无 session cookie → unauthorized 401 | unhappy | P0 | 集成 | `if (!session) return unauthorized(401)`(`api-guard.ts:8-9`) | |
| J06-02 | session 用户已被删 → "会话用户不存在" 401 | 对抗 | P0 | 集成 | `if (!loaded) return unauthorized`(`api-guard.ts:13-15`) | |
| J06-03 | tokenVersion 不匹配（登出/改密后旧 JWT）→ "会话已失效" 401 | 对抗 | P0 | 集成/单元 | `if ((loaded.tokenVersion??0) !== (session.tv??0)) → 401`(`api-guard.ts:19-21`) | H2 服务端吊销，注释 `:17-18` |
| J06-04 | 角色不符（student 调 teacher 接口）→ forbidden 403 | 对抗 | P0 | 集成 | `if (requiredRole && loaded.role !== requiredRole) → 403`(`api-guard.ts:23-25`) | |
| J06-05 | 伪造/篡改 JWT 签名 → readSession 拒绝（HS256 验签失败） | 对抗 | P0 | 集成/单元 | `readSession`(`auth.ts`)；cookie `brown_zone_session` HS256，claims userId/role/email/classroomId/tv | mock 边界 |
| J06-06 | 过期 JWT → readSession 返回 null → 401 | 对抗 | P0 | 集成 | 同 J06-01 路径（exp 校验在 `auth.ts`） | |
| J06-07 | 生产跨站 state-changing POST（sec-fetch-site:cross-site）→ 拒绝 | 对抗 | P1 | 集成 | `checkOrigin`：cross-site→`forbidden 403`(`api-response.ts:44-46`)；origin 不匹配→403(`:52-54`) | dev 不校验(`:38`) |
| J06-08 | RLS：authenticated 角色 + withRls 下跨租户读被策略拦截 | 对抗 | P0 | 专项(DB) | 仅当 `DATABASE_ROLE=authenticated` 且经 `withRls()`(client.ts) 生效；`drizzle/policies.sql` | 默认 owner 连接 **绕过** RLS，repo 应用层为主防线 |
| J06-09 | owner 连接下 RLS 不生效 → 依赖 repo 应用层校验防越权 | 对抗 | P0 | 专项 | CLAUDE.md/AGENTS.md 明确："owner connection bypasses RLS" | 反真测试点：勿误判 RLS 为主防线 |

---

### 旅程 J07 — 排行榜隐私：visibility + consent，隐身者不出现且不留 rank 空洞

核心：`src/lib/leaderboard/ranking.ts`（纯排序）+ `service.ts` + `/api/leaderboard/board`。

| 场景ID | 用例 | 类型 | 优先级 | 覆盖层 | 预期 ground truth (path:line / 常量) | 备注 |
|---|---|---|---|---|---|---|
| J07-01 | public 玩家在 school/city/province/nation 四 scope 均可见 | happy | P0 | 单元 | `visibleIn`：默认 `return true`(`ranking.ts:64`) | |
| J07-02 | school_only 玩家仅在 school scope 出现 | edge | P0 | 单元 | `if (visibility === "school_only") return scope === "school"`(`ranking.ts:63`) | |
| J07-03 | hidden 玩家任何 scope 都不出现、不参与排名 | 对抗 | P0 | 单元 | `if (visibility === "hidden") return false`(`ranking.ts:62`) | 注释 `:8-11` |
| J07-04 | 隐身者被过滤后，剩余名次连续无空洞 | 对抗 | P0 | 单元 | rank 在 `eligible`（已过滤集）上计算：`rank: start+i+1`(`ranking.ts:91-95`) | 不泄漏"谁隐身" |
| J07-05 | 隐身玩家自己仍能看到真实私有名次（含自己） | edge | P0 | 单元 | `viewerPrivateRanks` 忽略 visibility，含 self(`ranking.ts:120-139`)；注释 `:113-119` | 自卡私有 |
| J07-06 | 平分时按 userId 升序稳定打破 | edge | P1 | 单元 | `byPowerDesc`：power 相等→`userId < ... ? -1 : ...`(`ranking.ts:68-71`) | SQL 侧 RANK() 镜像 |
| J07-07 | 分页 page/pageSize 钳制（默认 50，最大 100） | edge | P1 | 单元/集成 | service 端 `pageSize=max(1, ?? 50)`(`ranking.ts:87-89`)；路由 `Math.min(100, max(1, ...||50))`(`board/route.ts:30`) | |
| J07-08 | 无 rank profile → board 返回 null + needsOnboarding | unhappy | P0 | 集成 | `if (!board) return { board:null, needsOnboarding:true }`(`board/route.ts:33-36`)；`viewerFor` 无 profile→null(`service.ts:58-66`) | |
| J07-09 | 未上榜（无 own snapshot）玩家 PowerCard ranked=false 但 power=0 | edge | P1 | 单元 | `ranked: Boolean(own)`(`service.ts:138`)，`power = own?.power ?? 0`(`service.ts:123`) | 卡文案引导上榜 |
| J07-10 | scope/period 非法查询参数 → 安全回退 school/weekly | 对抗 | P1 | 集成 | `coerceScope`/`coercePeriod` 白名单回退(`board/route.ts:13-18`) | |

---

### 旅程 J08 — 订阅/试用 gating：canUserOperate 各状态行为 + 家庭共享 Premium

核心：`src/lib/billing/subscription.ts` 状态机 + `applyFamilyEntitlement`（`api-guard.ts:29`）。

| 场景ID | 用例 | 类型 | 优先级 | 覆盖层 | 预期 ground truth (path:line / 常量) | 备注 |
|---|---|---|---|---|---|---|
| J08-01 | trial（剩余 > 1 天）→ canOperate=true, aiTier=full | happy | P0 | 单元 | `daysRemaining > TOTAL-FULL(=1)` → status:"trial", aiTier:"full"(`subscription.ts:130-145`) | |
| J08-02 | trial_degraded（剩余 1 天）→ canOperate=true, aiTier=basic | edge | P0 | 单元 | `daysRemaining > 0` 分支 status:"trial_degraded", aiTier:"basic"(`subscription.ts:147-162`) | banner 升级提示(`:154`) |
| J08-03 | expired（trial 用尽）→ canOperate=false | unhappy | P0 | 单元 | `daysRemaining<=0` → `expiredState(...)`(`subscription.ts:164`)；`canOperate:false`(`:72`) | |
| J08-04 | active（standard/premium 未到期）→ canOperate=true | happy | P0 | 单元 | tier∈{standard,premium} 且未过期 → status:"active", canOperate:true(`subscription.ts:98-121`) | |
| J08-05 | 付费已到期（expiresAt<=now）→ 回到 expired | unhappy | P0 | 单元 | `if (expiresAt <= now) return expiredState(...)`(`subscription.ts:100-105`) | |
| J08-06 | expired 学生调 sim/actions → forbidden + 升级文案 | 对抗 | P0 | 集成 | `if (!canUserOperate(...)) return forbidden("试用已结束...")`(`actions/route.ts:43-45`) | advance/event-choice 同(`advance-round/route.ts:14`,`event-choice/route.ts:22`) |
| J08-07 | Premium 家长名下学生继承 Premium（applyFamilyEntitlement） | happy | P0 | 集成 | `requireUser` 末尾 `applyFamilyEntitlement(loaded)`(`api-guard.ts:28-29`)；实现 `repo.ts:1013` | Option B 注释 `:27-28` |
| J08-08 | Premium 家庭席位上限 3 | edge | P0 | 单元 | `FEATURES_PREMIUM.maxStudents = 3`(`subscription.ts:37`)；`canAddFamilyMember(count < max)`(`subscription.ts:188-190`) | Standard=1(`:30`) |
| J08-09 | 家长添加第 4 个学生 → 超席位被拒 | 对抗 | P0 | 集成/单元 | `canAddFamilyMember` 返回 false → addFamilyMember 拒绝 | seat cap 守门 |
| J08-10 | 个性化 AI 在 trial_degraded 关闭（canUsePersonalAiAssessment=false） | edge | P1 | 单元 | trial_degraded 分支 `canUsePersonalAiAssessment:false`(`subscription.ts:159`)；`evaluatePersonalAiAccess→upgrade`(`:177`) | |
| J08-11 | 需邮箱验证灰度：trial 未验证 → reason="verify" | 对抗 | P1 | 单元 | `evaluatePersonalAiAccess`：`requireVerification && status!=="active" && !emailVerified → verify`(`subscription.ts:178-180`) | 付费用户不被验证门拦 |
| J08-12 | deepAiReport/seasonReplay/weeklyParentEmail 仅 Premium | edge | P1 | 单元 | `FEATURES_PREMIUM` 三项=true(`subscription.ts:35-40`)，Standard 全 false(`:29-34`) | |

---

### 旅程 J09 — 并发提交：同一 run 并发 sim actions + rate-limit + snapshot 幂等写入

核心：`applySimulationAction`（structuredClone 不可变）、`commitSnapshot` upsert、`rate-limit.ts`。

| 场景ID | 用例 | 类型 | 优先级 | 覆盖层 | 预期 ground truth (path:line / 常量) | 备注 |
|---|---|---|---|---|---|---|
| J09-01 | applySimulationAction 不就地改 run（structuredClone） | happy | P0 | 单元 | `const nextRun = structuredClone(run)`(`simulation.ts:300`)；event-choice 同(`:469`) | 纯函数，便于并发推理 |
| J09-02 | 同回合重复 commitSnapshot → 同 round 记录 Object.assign 覆盖（幂等） | 对抗 | P0 | 单元 | `commitSnapshot`：`if (existing) Object.assign(existing, snapshot) else push`(`simulation.ts:247-252`) | 不产生重复 round 行 |
| J09-03 | 两笔并发 buy 共耗现金 → 第二笔应因现金不足被拒（最终一致） | 对抗 | P0 | 集成 | 余额检查 `cash < notional`(`simulation.ts:312`)；repo 读改写经 `applyActionForUser` | 验证无超卖/负现金 |
| J09-04 | 限流命中（如 parent-link 10 分钟 8 次）→ 429 + 中文重试提示 | unhappy | P0 | 集成/单元 | `rateLimit(key, 8, 60_000*10)`(`parent-link/route.ts:30`)；`buildRateLimitMessage`(`rate-limit.ts:50-53`) | 滑动窗 `rate-limit.ts:21-41` |
| J09-05 | 限流 key 区分（有用户用 userId，匿名用 IP） | edge | P1 | 单元 | `rateLimitKey`：有 userId→`scope:user:id`，否则 `scope:ip:...`(`rate-limit.ts:43-47`) | |
| J09-06 | 限流桶上限 5000，溢出淘汰最旧 | edge | P2 | 单元 | `MAX_TRACKED_KEYS = 5_000`，溢出 `buckets.delete(oldestKey)`(`rate-limit.ts:13,26-30`) | 内存有界 |
| J09-07 | 限流为 per-process（多实例不共享）— 已知局限 | 对抗 | P1 | 专项 | 注释："Per-process only — not shared across serverless instances"(`rate-limit.ts:1-8`) | 反真：勿假设全局一致 |
| J09-08 | venture exit 金额超持仓 → 仅退到 stake 上限，stake 不为负 | edge | P1 | 单元 | `currentValue = min(getVentureValue, amount)`(`simulation.ts:436`)，`stake = max(0, stake-amount)`(`:438`) | |
| J09-09 | 事件 cash 下溢被夹到 0，日志记 realized 而非名义 | edge | P1 | 单元 | `cash = max(0, cash+cashDelta)`(`simulation.ts:493`)，`realized = cash - cashBefore`(`:496`) | 注释 `:494-495` |

---

### 旅程 J10 — 账号生命周期：邮箱验证/密码重置在 RESEND 未配置时离线降级

核心：`src/lib/email.ts`（`not_configured` → dev link）、`/api/auth/verify`、`/forgot`、`/reset`、`/register`。

| 场景ID | 用例 | 类型 | 优先级 | 覆盖层 | 预期 ground truth (path:line / 常量) | 备注 |
|---|---|---|---|---|---|---|
| J10-01 | RESEND 已配置 → sendEmail 投递成功返回 delivered:true+id | happy | P1 | 单元 | `isEmailConfigured()` 为真→fetch Resend→`delivered:true`(`email.ts:25-43`) | mock fetch 边界 |
| J10-02 | 未配置（无 key/from）→ not_configured，不抛错 | happy(降级) | P0 | 单元 | `if (!isEmailConfigured()) return {delivered:false, reason:"not_configured"}`(`email.ts:26`) | 注释 `:20-24` |
| J10-03 | 注册时邮件未配 → 调用方应回 dev 验证链接而非报错 | happy(降级) | P0 | 集成 | `sendEmail` 不 throw(`email.ts:26`)；调用方据 not_configured 暴露 dev link | `/api/auth/register` |
| J10-04 | Resend 返回非 2xx → reason:"error"，仍不抛 | unhappy | P1 | 单元 | `if (!response.ok) return {reason:"error"}`(`email.ts:41`) | |
| J10-05 | fetch 抛网络异常 → catch 落 error，不传播 | unhappy | P0 | 单元 | `catch { return {delivered:false, reason:"error"} }`(`email.ts:44-46`) | |
| J10-06 | 验证邮件/重置邮件名字含 HTML 特殊字符 → 转义防注入 | 对抗 | P0 | 单元 | `escapeHtml`(`email.ts:49-55`)；`verificationEmail` 用 `escapeHtml(name)`(`email.ts:73`)，reset 同(`:108`) | XSS 防护 |
| J10-07 | 密码重置链接 1 小时有效；非本人忽略 | edge | P1 | 集成/单元 | 文案"链接 1 小时内有效"(`email.ts:111`)；`/api/auth/reset` 校验 token 过期 | `password-reset.ts` |
| J10-08 | 改密后 tokenVersion bump → 旧会话失效（联动 J06-03） | 对抗 | P0 | 集成 | tv 不匹配→401(`api-guard.ts:19-21`) | 重置成功后强制重登 |
| J10-09 | 重复邮箱注册 → conflict 409 | unhappy | P1 | 集成 | `handleRouteError` 命中"已经被注册/duplicate/unique"→`conflict 409`(`api-response.ts:30-32`) | |

---

### 旅程 J11 — 行情数据：AllTick key 缺失 teaching fallback + 10 分钟刷新陈旧度

核心：`src/lib/alltick.ts`、`market-refresh.ts`、`/api/market/board`、`/api/market/ticker-tape`。**Mock alltick 边界。**

| 场景ID | 用例 | 类型 | 优先级 | 覆盖层 | 预期 ground truth (path:line / 常量) | 备注 |
|---|---|---|---|---|---|---|
| J11-01 | 无 ALLTICK_API_KEY → requestAlltick 直接回教学池提示 | happy(降级) | P0 | 单元 | `if (!env.ALLTICK_API_KEY) return {ok:false, message:"未配置 AllTick token，当前使用教学观察池..."}`(`alltick.ts:243-247`) | 含刷新标签 |
| J11-02 | 无 key 时 watchlist provider="fallback" | edge | P0 | 单元 | `fallbackWatchlist(...)` provider:"fallback"(`alltick.ts:233-236`)；无 key 分支(`:354-356`) | |
| J11-03 | 刷新周期常量 = 10 分钟 | edge | P0 | 单元 | `MARKET_REFRESH_INTERVAL_MS = 10*60*1000`(`market-refresh.ts:1`)，label "10 分钟"(`:2`) | |
| J11-04 | board 路由要求 student 登录，否则 unauthorized | unhappy | P0 | 集成 | `if (!session || session.role !== "student") return unauthorized(401)`(`board/route.ts:18-20`) | |
| J11-05 | symbol 查询参数超长/空 → zod 拒绝或回退默认 watchlist | 对抗 | P1 | 集成 | `symbol: z.string().trim().min(1).max(12).optional()`(`board/route.ts:11-13`)；`resolveMarketWatchlistSymbol`(`:25`) | |
| J11-06 | AllTick 请求超时 → fetchWithTimeout 落 fallback（不挂起） | unhappy | P1 | 单元 | `requestAlltick` try 内 `fetchWithTimeout`(`alltick.ts:250-251`)，异常落 fallback | mock 超时 |
| J11-07 | 部分实况：kline/staticInfo 非 live 时 provider 标 hybrid/fallback | edge | P2 | 单元 | provider 判定 `:407,444-445` | 陈旧度透明 |
| J11-08 | board 响应 no-store，避免 CDN 缓存陈旧行情 | edge | P2 | 集成 | `headers: { "cache-control": "no-store" }`(`board/route.ts:30`)；`dynamic="force-dynamic"`(`:9`) | |

---

### 旅程 J12 — 周报 cron：GET /api/cron/weekly-report 的 CRON_SECRET 授权

核心：`/api/cron/weekly-report`、`CRON_SECRET`、`listPremiumFamilyDigests`、`weeklyReportEmail`。

| 场景ID | 用例 | 类型 | 优先级 | 覆盖层 | 预期 ground truth (path:line / 常量) | 备注 |
|---|---|---|---|---|---|---|
| J12-01 | 生产环境未配 CRON_SECRET → service_unavailable 503 | 对抗 | P0 | 集成 | `if (NODE_ENV==="production" && !CRON_SECRET) return service_unavailable(503)`(`weekly-report/route.ts:18-20`) | 强制授权 |
| J12-02 | 配了 secret 但 Authorization 头错误 → unauthorized 401 | 对抗 | P0 | 集成 | `if (authorization !== "Bearer "+CRON_SECRET) return unauthorized(401)`(`weekly-report/route.ts:21-26`) | |
| J12-03 | 配了 secret 且 `Bearer <secret>` 正确 → 正常处理 | happy | P0 | 集成 | 头匹配后继续 `listPremiumFamilyDigests`(`weekly-report/route.ts:28`) | |
| J12-04 | 本地未配 secret（非 prod）→ 跳过鉴权可手测 | edge | P1 | 集成 | `if (env.CRON_SECRET)` 才校验(`weekly-report/route.ts:21`)；注释 `:16-17` | |
| J12-05 | 遍历 Premium 家庭逐个发周报，统计 processed/sent | happy | P1 | 集成 | for digests → sendEmail，`if (delivered) sent++`(`weekly-report/route.ts:29-34`)；返回 `{processed, sent}`(`:36`) | |
| J12-06 | 邮件未配（not_configured）→ sent 计数不增但不报错 | edge | P1 | 集成 | `sendEmail` 返回 not_configured(`email.ts:26`)，`delivered:false` 不计入 sent | 离线安全 |
| J12-07 | 周报正文 studentName/ownerName 转义 | 对抗 | P1 | 单元 | `weeklyReportEmail` 用 `escapeHtml`(`email.ts:88,94,95,99`) | 防注入 |
| J12-08 | 周报含回合/净值/投资人格三字段 | happy | P2 | 单元 | 表格渲染 round/netWorth/persona(`email.ts:97-99`) | persona 见 J13 |

---

### 旅程 J13 —（补充）Premium 深度报告：投资人格 + 连胜 + 分享卡（纯函数确定性）

核心：`deriveInvestorPersona`、`computeStreak`、`buildPersonaShareText`（`simulation.ts`）。gate=`features.deepAiReport`。

| 场景ID | 用例 | 类型 | 优先级 | 覆盖层 | 预期 ground truth (path:line / 常量) | 备注 |
|---|---|---|---|---|---|---|
| J13-01 | riskScore≥70 → "进取冒险家" | happy | P1 | 单元 | `deriveInvestorPersona`：`if (riskScore>=70) {label:"进取冒险家"}`(`simulation.ts:561-563`) | 纯函数无 AI |
| J13-02 | trades≤2 → "谨慎观望者" | edge | P1 | 单元 | `if (trades<=2) {label:"谨慎观望者"}`(`simulation.ts:564-566`) | |
| J13-03 | holdings≤1 → "集中押注者" | edge | P1 | 单元 | `if (holdings<=1) {label:"集中押注者"}`(`simulation.ts:567-569`) | |
| J13-04 | 连胜统计：仅净值严格上升才计 current，回撤清零 | edge | P1 | 单元 | `computeStreak`：`if (net[i]>net[i-1]) current++ else current=0`(`simulation.ts:584-590`) | best=max(`:586`) |
| J13-05 | 分享卡文案含人格/净值/连胜回合 | happy | P2 | 单元 | `buildPersonaShareText`(`simulation.ts:596-608`) | 增长闭环 |
| J13-06 | 同一 run 多次调用结果一致（确定性，可缓存） | 对抗 | P1 | 单元 | persona/streak 仅依赖 run 字段，无随机 | 反真：非 AI 生成 |

---

### 旅程 J14 —（补充）Power 战力计算正确性（反 YOLO 决策质量度量）

核心：`computePowerScore`、`POWER_WEIGHTS`、`recomputePowerForUser`（`leaderboard/`）。

| 场景ID | 用例 | 类型 | 优先级 | 覆盖层 | 预期 ground truth (path:line / 常量) | 备注 |
|---|---|---|---|---|---|---|
| J14-01 | 五权重总和=1.0 且为 .30/.25/.20/.15/.10 | happy | P0 | 单元 | `POWER_WEIGHTS`(`power-score.ts:33-39`)，`satisfies Record<...>` 约束(`:39`) | 透明面板展示 |
| J14-02 | 合成分钳制到 [0, maxPower=2000] | edge | P0 | 单元 | `Math.round(clamp01(raw)*POWER_TUNING.maxPower)`(`power-score.ts:87`)，`maxPower:2000`(`:47`) | |
| J14-03 | 纪律稳健者 power > 侥幸高波动赌徒（反 YOLO） | 对抗 | P0 | 单元 | riskAdjReturn=收益/波动(`power-score.ts:54-55`)，波动大则该分低；注释 `:5-8` | 决策质量非运气 |
| J14-04 | 学习项 total≤0 时 learning 分=0（不除零） | edge | P1 | 单元 | `learningTotal<=0 ? 0 : clamp01(completed/total)`(`power-score.ts:67`) | |
| J14-05 | 回撤≥50% 记 0 分 | edge | P1 | 单元 | `drawdown: clamp01(1 - maxDrawdownPct/drawdownCapPct)`，cap=50(`power-score.ts:66,45`) | |
| J14-06 | 无 rank profile 的玩家 recompute 返回 null（不写孤儿快照） | 对抗 | P0 | 单元/集成 | `if (!profile) return null`(`service.ts:167-168`)；无 run 同(`:169`) | 注释 `:160-166` |
| J14-07 | recompute 写入 weekly+monthly+season 三档幂等 | edge | P1 | 集成 | `for (period of STANDING_PERIODS) upsertLeaderboardSnapshot(...)`(`service.ts:178-188`)；档位 `:149` | advance 后 best-effort 调用(`advance-round/route.ts:24-28`) |
| J14-08 | advance-round 中 recompute 抛错被 swallow，不阻断推进 | 对抗 | P0 | 集成 | `try { recomputePowerForUser } catch {}`(`advance-round/route.ts:24-28`)，注释"never let leaderboard hiccup block" | |

---

### 旅程 J15 —（补充）Season 决定论与公平性（同周同市场）

核心：`src/lib/season.ts`、`buildSeasonLeaderboard`、`/api/market/season-leaderboard`。

| 场景ID | 用例 | 类型 | 优先级 | 覆盖层 | 预期 ground truth (path:line / 常量) | 备注 |
|---|---|---|---|---|---|---|
| J15-01 | epoch 当周 seasonKey="S0" | happy | P0 | 单元 | `SEASON_EPOCH_MS = Date.UTC(2026,0,5)`(`season.ts:7`)；`currentSeasonKey` floor 除 WEEK_MS(`:10-13`) | |
| J15-02 | seasonSeed 为 FNV-1a 正 31 位整数且确定 | happy | P0 | 单元 | `seasonSeed`：FNV-1a→`(hash>>>0)%0x7fffffff || 1`(`season.ts:15-23`) | 0 兜底为 1 |
| J15-03 | 新 run 默认采用当周 season seed（公平同市场） | happy | P0 | 单元 | `createInitialRun(seed = currentSeasonSeed())`(`simulation.ts:266`)；注释 `:263-265` | |
| J15-04 | season 榜仅纳入 seed==当周 seed 的 run | edge | P0 | 单元 | `buildSeasonLeaderboard`：`runs.filter(run => run.seed === seed)`(`simulation.ts:619-623`) | 无需额外列(`season.ts:5`) |
| J15-05 | season-leaderboard 接口需登录，截断前 20 名 | edge | P1 | 集成 | `requireUser()`(`season-leaderboard/route.ts:11-12`)；`leaderboard.slice(0,20)`(`:17`) | 返回 seasonKey+viewerId |
| J15-06 | 跨周（now 落入不同周）→ seasonKey 递增、seed 变化 | 对抗 | P1 | 单元 | `currentSeasonKey(now)` 随 now 变(`season.ts:10-13`)，驱动不同 seed | 上周 run 不污染本周榜 |
| J15-07 | Premium replay 用非当周 seed → 自动不进 season 榜 | 对抗 | P1 | 单元/集成 | replay 走 `replayRunForUser`（新 seed）；J15-04 过滤天然排除 | off-season 练习不破坏公平 |

---

> **覆盖优先级汇总**：P0 = 安全/资金正确性/降级不崩/越权防护（必须先绿）；P1 = 教学价值闭环与隐私/订阅 gating；P2 = 文案/缓存/有界性等加固项。
> **专项测试边界（务必 mock 而非打真实外部）**：`ai.ts`（J04）、`alltick.ts`（J11）、`email.ts` 的 Resend fetch（J10/J12）、DB 连接（J05）。RLS 类（J06-08/09）需以 `DATABASE_ROLE=authenticated`+`withRls()` 的专项 DB 测试覆盖，且必须验证"owner 连接绕过 RLS、repo 应用层为主防线"这一反直觉真值。

证据来源文件（均已逐行核对，绝对路径）：`D:\树德实验中学（清波）\C2\brown-zone-web\src\lib\simulation.ts`、`...\src\lib\adaptive-events.ts`、`...\src\lib\event-engine.ts`、`...\src\lib\season.ts`、`...\src\lib\billing\subscription.ts`、`...\src\lib\email.ts`、`...\src\lib\api-guard.ts`、`...\src\lib\api-response.ts`、`...\src\lib\rate-limit.ts`、`...\src\lib\alltick.ts`、`...\src\lib\market-refresh.ts`、`...\src\lib\leaderboard\ranking.ts`、`...\src\lib\leaderboard\service.ts`、`...\src\lib\leaderboard\power-score.ts`、`...\src\lib\db\repo.ts`、`...\src\app\api\sim\actions\route.ts`、`...\src\app\api\sim\advance-round\route.ts`、`...\src\app\api\sim\event-choice\route.ts`、`...\src\app\api\sim\replay\route.ts`、`...\src\app\api\cron\weekly-report\route.ts`、`...\src\app\api\teacher\assignments\route.ts`、`...\src\app\api\billing\parent-link\route.ts`、`...\src\app\api\family\members\route.ts`、`...\src\app\api\market\board\route.ts`、`...\src\app\api\market\season-leaderboard\route.ts`、`...\src\app\api\leaderboard\board\route.ts`、`...\src\app\api\auth\onboarding\route.ts`。

---

## 3. 专项测试深挖

> 说明（反真校验）：本节所有断言均落到仓库真实代码。**用户模板里的「SSE 实时反馈 / SSE 断线重连」在本仓库不存在** —— 全仓 `grep` 无 `EventSource`、`text/event-stream`、`WebSocket`、`new SSE`。本项目的「实时面」由三层构成：(a) 自适应教学事件随 `/api/sim/*` 响应内联返回（`src/lib/adaptive-events.ts`，挂载于 `src/app/api/sim/{state,actions,advance-round,event-choice}/route.ts`）；(b) 10 分钟节流的行情快照刷新（`src/lib/market-refresh.ts:1` 定义 `MARKET_REFRESH_INTERVAL_MS = 10*60*1000`，`src/lib/alltick.ts` 用 `globalThis.__alltick*Cache__` 做 TTL 缓存）；(c) 实时榜单（`src/lib/leaderboard/*`）。因此「弹性」的可测对象是**降级链路**（AI/AllTick/DB 三道兜底），而非「重连」。下文 (1) 给出与「断线重连」等价的真实弹性不变量。

### (1) 实时反馈与弹性 (Resilience)

实时反馈不靠长连接，而靠「每个请求都内联最新教学事件 + 行情快照」。弹性的核心是：任一外部边界（AI 网关 / AllTick / Postgres）失败时，沙盘**仍可继续推进**并返回结构完整、带 `provider` 标记的兜底内容。AI 与 AllTick 边界用 `fetch` mock，**绝不打真实 provider**。

| 能力点 | 可测不变量 / 断言 | 触发 / 构造方式 | 覆盖层 | 证据 path:line |
| --- | --- | --- | --- | --- |
| AI 主→备地址故障转移 | 主地址 `fetch` 返回非 2xx 时**自动重试次地址**；`fetchMock` 恰好被调用 2 次；`provider==="remote"`、`baseUrl==="https://secondary.example"`、文本来自次地址 | `vi.spyOn(globalThis,"fetch")` 首次 `Response(...,{status:500})`、二次 200 JSON；设 `AI_BASE_URL_PRIMARY`/`AI_BASE_URL_SECONDARY` 后调 `requestTutorInsight` | 单元（已存在） | 失败转移循环 `src/lib/ai.ts:363`-`411`（`for (const baseUrl of baseUrls)` + `catch{continue}`）；已有用例 `src/lib/ai.test.ts:47`-`78` |
| AI 全链路失败兜底叙事 | 两个地址都失败（或无 key）时**不抛异常**，返回 `provider==="fallback"` 且文本含教学锚点（如 `"Mr.Brown"` / `"流动性"` / `"Brown Zone"`） | 设 `AI_API_KEY=""`（`getAiConfig` 返回 `null`）；或两次 `fetch` 都 500 | 单元（已存在 + 可补「双失败」） | 兜底返回 `src/lib/ai.ts:354`-`359` 与 `:407`-`410`；已有用例 `src/lib/ai.test.ts:31`-`45`、`:80`-`106` |
| AI 空响应判失败 | 远端 200 但 `content` 为空字符串时**视为失败**并继续/兜底（不返回空 `text`） | mock 一次返回 `{content:[{type:"text",text:"  "}]}`，断言最终 `provider==="fallback"` | 单元（建议补） | `src/lib/ai.ts:387`-`396`（`if (!text) throw new Error("AI 响应为空")`）|
| AI 历史复盘结构鲁棒 | 即便远端文本不含 `【总结】/【诊断】/【建议】` 段，也回退到 `fallbackReview`：`summary` 非空、`analysis.length>=3`、`nextSteps.length>=3` | `AI_API_KEY=""` 后调 `requestHistoryReviewInsight`；或 mock 返回乱序文本 | 单元（已存在） | 解析+兜底 `src/lib/ai.ts:275`-`292`（`parseHistoryReviewText` + `parseBulletLines` 的 `minimum` 回退）；用例 `src/lib/ai.test.ts:108`-`123` |
| AI 雷达 JSON 解析容错 | 远端返回非法 JSON / 缺字段时，`normalizeRadarPayload` 落回 fallback：`metrics` 恰 6 项且每项 `score∈[0,100]`、`note` 截断到 18 字 | mock 返回 `"not-json"`；或缺 `metrics` | 单元（已存在 + 可补乱码用例） | `try/catch` 解析 `src/lib/ai.ts:307`-`345`（`extractJsonObject` + `clamp` + `slice(0,18)`）；用例 `src/lib/ai.test.ts:125`-`137` |
| AllTick 缺 key 教学兜底 | 无 `ALLTICK_API_KEY` 时 `fetchWatchlistSnapshot()` 返回 `provider==="fallback"`、`quotes==={}`、`note` 含 `"AllTick"`；**不发起任何网络请求** | `process.env.ALLTICK_API_KEY=""`，调 `fetchWatchlistSnapshot` / `fetchAlltickMarketPulse` | 单元（已存在） | 早退兜底 `src/lib/alltick.ts:243`-`248` 与 `:354`-`358`；用例 `src/lib/alltick.test.ts:15`-`32` |
| AllTick 请求失败/超时回退 | 上游 `ret!==200`、HTTP 非 2xx、或 `fetch` 抛错（超时）时统一回退教学池，`note` 含 `"自动重试"`；不抛异常 | mock `fetch` 抛 `AbortError`（超时路径）或返回 `{ret:500,msg:"x"}` | 单元（建议补 mock 用例） | `requestAlltick` 三分支 `src/lib/alltick.ts:254`-`278`（含 `catch{...自动重试}`）；落地到 `:369`-`375` |
| AllTick 快照缓存（陈旧/TTL 一致性） | 命中未过期缓存时**复用旧值不重新请求**；`expiresAt = now + MARKET_REFRESH_INTERVAL_MS`（= 10 分钟）；K 线不足 4 点时 `live:false` 并保留教学曲线 | 连续两次调 `fetchWatchlistSnapshot`，第二次断言 `fetch` 未再被调；或注入 `__alltickWatchlistCache__.expiresAt` 已过期 | 单元（建议补） | 缓存读 `src/lib/alltick.ts:349`-`351`；缓存写 `:203`-`210`；TTL 常量 `src/lib/market-refresh.ts:1`；K 线下限 `src/lib/alltick.ts:305`-`310` |
| DB 不可用 → 内存兜底 | `DATABASE_URL` 缺失 / 客户端不可用 / 查询抛错时，`withDb` 调用 `fallback()`（`store.ts`）而非抛错；当 `ALLOW_MEMORY_FALLBACK=false`（生产默认）时**显式抛 5xx**而非静默返回种子数据 | 单测设/不设 `ALLOW_MEMORY_FALLBACK`，对一个 repo 函数注入会 reject 的 `dbFn` | 单元 + 集成 | 三分支兜底 `src/lib/db/repo.ts:142`-`173`（`isDatabaseConfigured` / `getDb` / `try-catch`）；开关 `:113`-`114` |
| DB 查询超时熔断 | 查询超过 `DB_QUERY_TIMEOUT_MS`（默认 5000）时 `withQueryTimeout` reject，进而走 `query_failed` 兜底 | 注入一个永不 resolve 的 `dbFn`，配低 `DB_QUERY_TIMEOUT_MS` | 单元 | `src/lib/db/repo.ts:122`-`140`（`Promise.race` 超时）+ `:164`-`172` |
| 快照写入幂等 / 重试安全 | 对同一 `(user, period, periodKey)` 重复 `upsertLeaderboardSnapshot` **只产生一行**，且保留更高 power（1300 覆盖 800） | 同键调用两次（800、1300），`listLeaderboardSnapshots` 断言 `length===1 && power===1300` | 单元（已存在） | 用例 `src/lib/leaderboard/store-leaderboard.test.ts:74`-`81`；并见跨周期分离 `:107`-`113` |
| 自适应事件「随响应内联」即实时面 | `/api/sim/*` 每次响应都重新跑 `detectAdaptiveEvents(run)`，无需任何长连接即得到最新教学反馈 | 对 `state/actions/advance-round/event-choice` 四条路由做响应快照断言（`events` 字段存在且 `length<=2`） | 集成（路由层） | 挂载点 `src/app/api/sim/{state,actions,advance-round,event-choice}/route.ts`（均 `import detectAdaptiveEvents`）；上限见 (3) |

> 「断线重连」等价物（写进测试结论里，避免误导）：本项目无连接可断，弹性等价于 **(i) AI 故障转移 + 兜底叙事**、**(ii) AllTick 缺 key / 超时回退教学池 + 10 分钟 TTL 缓存**、**(iii) DB 失败的内存兜底 / 生产熔断**、**(iv) 快照 upsert 幂等（重试不产生脏数据）**。

### (2) 隐私合规 (Privacy & Compliance)

榜单面向未成年人，隐私不变量必须可测：隐身者「既不计名也不上榜且不产生名次空洞」、`school_only` 仅在校级可见、别名做安全字符硬化、家庭组共享范围受限、JWT `tv` 版本可撤销、租户隔离由 `repo.ts` 应用层兜底（RLS 仅在特定条件生效）。

| 能力点 | 可测不变量 / 断言 | 触发 / 构造方式 | 覆盖层 | 证据 path:line |
| --- | --- | --- | --- | --- |
| 隐身者永不可见且不计名 | `visibility==="hidden"` 的快照在任何 scope 都不出现在 `entries`，且不计入 `total` | 构造含 1 个 hidden 高分项的数据集，断言 `entries.some(hidden)===false && total` 不含之 | 单元（已存在） | 过滤逻辑 `src/lib/leaderboard/ranking.ts:61`-`65`（`visibleIn`）；用例 `ranking.test.ts:97`-`103` |
| 无名次空洞（不泄露「谁隐身了」） | 名次在**展示集合**上连续计算：隐身者所在位置不留 gap（`entries.map(rank)` 为 `[1,2,...]` 连续） | 数据集 `[hidden(1900), pub(1500), me(1200)]`，断言可见两项 rank 为 `[1,2]` 而非 `[2,3]` | 单元（已存在） | 名次基于已过滤集 `ranking.ts:79`-`95`（先 filter 后 `rank=start+i+1`）；用例 `ranking.test.ts:110`-`113` |
| `school_only` 作用域收敛 | `school_only` 仅在 `scope==="school"` 出现；在 city/province/nation 被排除 | 同一数据集分别取 `school` 与 `nation`，断言 schoolonly 仅前者命中 | 单元（已存在） | `ranking.ts:62`-`64`（`if school_only return scope==="school"`）；用例 `ranking.test.ts:89`-`108` |
| scope 租户/地域隔离 | `school/city/province` 仅保留同 `schoolId/cityCode/provinceCode`；`nation` 全量；跨省项被排除 | 跨校/跨市/跨省数据集，逐 scope 断言 `total` 与 `other-prov` 不出现 | 单元（已存在） | `inScope` `ranking.ts:48`-`59`；用例 `ranking.test.ts:57`-`87` |
| 隐身者「私有名次」不外泄 | 隐身玩家自己仍能看到真实位次（`viewerPrivateRanks` 计入全部已授权字段、含其他 hidden 者），但 `viewerScopeRanks`（上榜口径）对其返回 `undefined` —— 两条口径分离，互不泄露 | `me=hidden`，断言 `rankLeaderboard().entries` 无 me、`viewerPrivateRanks().nation===2`、`viewerScopeRanks().nation===undefined` | 单元（已存在） | `viewerPrivateRanks` `ranking.ts:120`-`139`；用例 `ranking.test.ts:129`-`156` |
| 别名/校名安全字符硬化 | `sanitizeDisplayText` 去除控制符 `\p{Cc}` 与格式符 `\p{Cf}`（零宽 + bidi 覆盖 `‮`），折叠内部空白、trim；**保留全角**（不破坏昵称观感） | 输入 `"小\u200b财‮迷"`→`"小财迷"`；`"稳健  小   能手"`→`"稳健 小 能手"`；`"财商达人ＡＢ"` 原样 | 单元（已存在） | 实现 `src/lib/leaderboard/school-normalize.ts:31`-`36`；用例 `school-normalize.test.ts:29`-`46` |
| 分享卡不泄露净值/PII | `buildPowerShareText` 只输出战力分、段位名、各级名次，**不含真实净值/姓名/邮箱**，并以「比的是决策质量」收尾 | 传入 `power/tierName/ranks`，断言文本不含 `netWorth`/email 字样，含「决策质量」 | 单元（**已存在** `share.test.ts`，可补 PII 断言） | `src/lib/leaderboard/share.ts:11`-`23`（输出仅 power/tier/ranks）|
| 校名归一仅去标点不并同义词 | `normalizeSchoolName` 做 NFKC + 去空白/标点 + 小写，但**不**把「七中」并成「第七中学」（避免错并，交人工审核）；同名跨市 `schoolDedupKey` 仍区分 | 断言 `normalizeSchoolName("七中")!==normalizeSchoolName("第七中学")`；`schoolDedupKey("实验中学","5101")!==(...,"4401")` | 单元（已存在） | `school-normalize.ts:9`-`20`；用例 `school-normalize.test.ts:23`-`56` |
| 家庭组共享范围受限于角色+座位 | 仅 `parent` 角色可增删/列出家庭成员（`requireUser("parent")`）；加成员前校验学生存在（`findUserByEmail` 不存在→`not_found 404`）；写操作校验 `Origin`（CSRF） | 以非 parent 角色调 `GET/POST/DELETE` 断言 `unauthorized/forbidden`；伪造 Origin 断言被 `checkOrigin` 拦截 | 集成（路由层，建议补） | `src/app/api/family/members/route.ts:23`-`27`（GET 守卫）、`:31`-`46`（POST 校验+座位语义）、`:32`-`33`/`:54`-`59`（`checkOrigin`）|
| JWT `tv` 版本撤销 | 当用户 `tokenVersion` 与会话 `tv` 不一致（登出/改密后 bump）时，`getCurrentUser()` 返回 `null` —— 旧 JWT 立即失效 | 构造 `session.tv=0` 但 `user.tokenVersion=1`，断言解析为 `null` | 单元（建议补） | 校验 `src/lib/session-user.ts:18`（`if ((user.tokenVersion??0)!==(session.tv??0)) return null`）；claim 定义见 `auth.ts:14`-`15` |
| RLS 仅条件生效，应用层为主防线 | 断言「默认 `owner` 连接绕过 RLS」这一事实被测试覆盖：跨租户读取必须由 `repo.ts` 应用层 `schoolId/userId` 过滤拦截，而非依赖 `policies.sql` | 集成：用 `owner` 连接直查另一 classroom 的 run，断言 repo 层函数拒绝/过滤（而非 DB 拒绝） | 集成（建议补，需 `DATABASE_URL`） | 文档化前提 CLAUDE.md「RLS」节 + AGENTS.md 第 2 表；防线落点为 `ranking.ts` 的 `inScope`/`visibleIn` 与 repo 层校验 |
| 日志不含 PII | 兜底告警 `logFallback` 在 `NODE_ENV==="test"` 静默，且打印内容仅含函数名/原因/错误对象，**不打印用户邮箱/JWT/别名** | 断言 `console.warn` 调用参数不含 email / token 字段 | 单元（建议补） | `src/lib/db/repo.ts:116`-`119`（`logFallback` 仅 `fn,reason,err`，test 环境跳过）|

### (3) 教学闭环有效性 (Does the loop actually teach)

闭环要「真的教会」，必须证明两件事：自适应事件在**阈值边界**上正确触发（行为→干预映射可靠）；战力分具备**反 YOLO**性质（守纪律的稳健者必须压过靠运气的莽夫），且各分项**单调**（回撤更低→回撤分更高、学习更多→学习分更高）。后者最强的形式是**性质测试（property-based）**：构造两个 `PowerScoreInput` 并断言序关系。

| 能力点 | 可测不变量 / 断言 | 触发 / 构造方式 | 覆盖层 | 证据 path:line |
| --- | --- | --- | --- | --- |
| 过度交易阈值边界 | 同回合 trade 次数 `>=4`→`high`、`==3`→`medium`、`<3`→不触发（`low` 被过滤）；触发项 `tone==="warning"` | 构造 `actionLog` 恰 2/3/4 笔同回合 trade，逐档断言 | 单元（已存在 4 笔档 + 建议补 3 笔/2 笔边界） | 检测器 `src/lib/adaptive-events.ts:29`-`36`；过滤 `low` `:208`；用例 `adaptive-events.test.ts:16`-`27` |
| 报复性交易阈值边界 | 仅当 `currentRound>=3` 且上一回合净值下跌（`prev<prevPrev`）且亏后 trade `>=3`→`high`、`>=2`→`medium`；否则不触发 | 注入 `snapshots` 让 R-1 < R-2，再放 2/3 笔本回合 trade | 单元（建议补，现有套件未直接覆盖） | `src/lib/adaptive-events.ts:38`-`53`（含 `hadLoss` 与 `tradesAfterLoss` 双条件）|
| 集中持仓 / 羊群阈值 | `herd_following`：单只股票权重 `>0.7 && round>=5`→`high`、`>0.6`→`medium`；`never_diversified`：`round>=3` 且持仓 `<=1` 触发（`>=5` 升 `high`） | 构造仅 `asset-stock` 高权重持仓；或仅 1 个 holding 推进到 R3/R5 | 单元（已存在聚合断言 + 建议补精确权重边界） | `herd` `:105`-`120`；`never_div` `:67`-`73`；用例 `adaptive-events.test.ts:29`-`58` |
| 现金囤积阈值边界 | `round>=5` 且 `(cash+savings)/netWorth > 0.85`→`high`、`>0.7`→`medium`；教学点含「机会成本」 | 不操作推进到 R5（现金占比≈1.0），断言命中且 `teachingPoint` 含「机会成本」 | 单元（已存在） | 检测器 `:75`-`84`；文案 `:176`-`182`；用例 `adaptive-events.test.ts:60`-`72` |
| 债券回避阈值 | `round>=4` 且无债券交易且无 `asset-bond` 持仓→触发（`>=6` 升 `high`） | 推进到 R4/R6 且从不碰债券，断言 `bond_avoidance` 命中 | 单元（建议补精确边界） | `src/lib/adaptive-events.ts:55`-`65` |
| CLT 输出上限（认知负荷约束） | 任一回合**最多 2 条**事件：恰 1 条 `warning` + 1 条 `info/positive`（各取最高置信度）；`low` 置信度全过滤 | 同时制造过度交易(warning)+现金囤积(info)，断言 `events.length<=2` 且类型组合正确 | 单元（已存在） | 取顶逻辑 `:213`-`224`（`topWarning`+`topOther`）；用例 `adaptive-events.test.ts:74`-`90` |
| **战力反 YOLO（性质测试）** | **守纪律稳健者** 必须 **>** **靠运气暴富的莽夫**：`computePowerScore(disciplined).power > computePowerScore(gamblerWin).power`，即便莽夫净值更高（260k vs 150k） | 构造 `disciplined{netWorth:150k,vol:0.06,discipline:95,dd:4,learn:10/10}` vs `gamblerWin{netWorth:260k,vol:0.7,discipline:25,dd:48,learn:1/10}`，断言序关系 | 单元（已存在，**核心教学不变量**） | 权重 `src/lib/leaderboard/power-score.ts:33`-`39`；合成 `:78`-`88`；用例 `power-score.test.ts:98`-`118` |
| 战力反 YOLO（亏损莽夫） | 稳健者 > 亏损莽夫（70k）：`steady.power > gamblerLoss.power` | 见用例两组输入 | 单元（已存在） | `power-score.test.ts:76`-`96` |
| 风险调整收益是反 YOLO 的机制根因 | `riskAdjReturn = totalReturn / max(vol, ε)` 经 `[-cap,+cap]→[0,1]` 映射：**同等收益下波动越大该分越低**，使高波动暴富被惩罚（权重 .30 最高） | 固定 `totalReturn`，对比 `vol=0.06` 与 `vol=0.7` 两输入的 `components.riskAdjReturn`，断言前者更高 | 单元（性质，建议补） | 公式 `power-score.ts:54`-`64`；设计注释 `:56`-`60`；映射常量 `:42`-`48` |
| 回撤分项单调性 | 回撤越小该分越高：`maxDrawdownPct=0→drawdown===1`，且 `dd(0) > dd(40)`；达 `drawdownCapPct=50` 记 0 | 同 base 仅变 `maxDrawdownPct`，断言单调下降 | 单元（已存在） | `drawdown: clamp01(1 - dd/50)` `power-score.ts:66`；用例 `power-score.test.ts:54`-`59` |
| 学习分项单调性 + 除零安全 | 完成项越多该分越高：`learningCompleted/learningTotal`；`learningTotal<=0` 时 `learning===0` 且有限（不 NaN） | `learnTotal=0`→断言 `0 && Number.isFinite`；再比较 5/10 与 9/10 | 单元（已存在除零 + 建议补单调） | `learning` 三元 `power-score.ts:67`；用例 `power-score.test.ts:43`-`47` |
| 纪律分项线性映射 | `disciplineScore 0..100 → 0..1`：`100→1`、`0→0`，且严格单调 | 取 `disciplineScore=0/50/100`，断言映射值 | 单元（已存在 0/100） | `discipline: clamp01(d/100)` `power-score.ts:65`；用例 `power-score.test.ts:49`-`52` |
| 权重归一 + 战力有界 | `POWER_WEIGHTS` 五项和 `≈1.0`；`computePowerScore` 输出 `power∈[0, maxPower=2000]`（极端输入不溢出） | 断言权重和 `toBeCloseTo(1,6)`；对超优输入断言 `0<=power<=2000` | 单元（已存在） | 权重和 `power-score.test.ts:21`-`26`；有界 `:62`-`74`；常量 `power-score.ts:33`-`48` |
| run→战力 适配口径一致 | `runToPowerInput` 用与历史复盘相同的「峰值追踪最大回撤 + 每回合纪律」，保证榜单分与历史页**不打架**；学习项缺省 0/0（对所有人公平、透明面板提示可提升） | 用一条真实 `ScenarioRun` 跑 `computeRunPower`，对照 `history-review.buildMetrics` 的回撤值 | 单元（建议补一致性断言） | 适配器 `src/lib/leaderboard/run-power.ts:29`-`60`（peak-tracking `:44`-`49`）；缺省说明注释 `:5`-`9` |
| 段位软地板（学期内不掉段） | 同 `seasonKey` 内坏一周（power 跌到 tier2）仍保 `tier===4`（高水位地板）；跨 `seasonKey` 重置为当周真实段位 | 先 1300(→tier4)，同季再 500 断言 `tier===4`；换季 500 断言 `tier===2` | 单元（已存在） | 用例 `store-leaderboard.test.ts:83`-`105`（decision 7 软地板）|

> 闭环有效性的「最强证据」是 `power-score.test.ts:98`-`118` 这条反 YOLO 性质断言：它把「教学目标（不奖励赌博）」编码成了**可证伪的序关系**——只要有人把战力公式改成「净值优先」，该用例立即红灯。配合自适应事件的阈值边界用例，覆盖了「行为→即时干预」与「结果→分数激励」两条教学反馈回路。

---

证据文件（均为仓库真实路径）：
- `D:\树德实验中学（清波）\C2\brown-zone-web\src\lib\ai.ts:88-99,275-345,347-411`（AI 网关配置 + 主备故障转移 + 兜底/解析容错）
- `D:\树德实验中学（清波）\C2\brown-zone-web\src\lib\ai.test.ts:31-138`（已存在的失败转移 + 兜底用例）
- `D:\树德实验中学（清波）\C2\brown-zone-web\src\lib\alltick.ts:203-310,348-358`（缺 key / 超时回退 + 10 分钟 TTL 缓存）
- `D:\树德实验中学（清波）\C2\brown-zone-web\src\lib\market-refresh.ts:1`（`MARKET_REFRESH_INTERVAL_MS = 10*60*1000`）
- `D:\树德实验中学（清波）\C2\brown-zone-web\src\lib\db\repo.ts:113-173`（`ALLOW_MEMORY_FALLBACK` + `withDb` 三分支 + 5s 超时熔断）
- `D:\树德实验中学（清波）\C2\brown-zone-web\src\lib\leaderboard\ranking.ts:48-139`（scope/visibility 过滤 + 无名次空洞 + 私有名次）
- `D:\树德实验中学（清波）\C2\brown-zone-web\src\lib\leaderboard\ranking.test.ts:89-156`（隐私/隐身用例）
- `D:\树德实验中学（清波）\C2\brown-zone-web\src\lib\leaderboard\school-normalize.ts:9-36`（校名归一 + 别名安全硬化）
- `D:\树德实验中学（清波）\C2\brown-zone-web\src\lib\leaderboard\share.ts:11-23`（分享卡仅输出战力/段位/名次）
- `D:\树德实验中学（清波）\C2\brown-zone-web\src\lib\session-user.ts:18`（JWT `tv` 撤销校验）
- `D:\树德实验中学（清波）\C2\brown-zone-web\src\app\api\family\members\route.ts:23-71`（家庭组角色 + Origin/CSRF 守卫）
- `D:\树德实验中学（清波）\C2\brown-zone-web\src\lib\adaptive-events.ts:29-131,208-224`（八类检测器阈值 + CLT 上限）
- `D:\树德实验中学（清波）\C2\brown-zone-web\src\lib\leaderboard\power-score.ts:33-88`（权重 + 反 YOLO 合成）
- `D:\树德实验中学（清波）\C2\brown-zone-web\src\lib\leaderboard\power-score.test.ts:76-118`（反 YOLO 性质断言）
- `D:\树德实验中学（清波）\C2\brown-zone-web\src\lib\leaderboard\run-power.ts:29-60`（run→战力适配，回撤口径一致）
- `D:\树德实验中学（清波）\C2\brown-zone-web\src\lib\leaderboard\store-leaderboard.test.ts:74-105`（upsert 幂等 + 软地板）

ground-truth 偏差提示：用户模板中的「SSE 实时反馈 / SSE 断线重连」在本仓库**不存在**（无 `EventSource`/`text/event-stream`/`WebSocket`）；已在 (1) 用「AI 故障转移 + AllTick 回退 + DB 内存兜底 + 快照 upsert 幂等」作为真实弹性等价物替代，请勿据模板补 SSE 测试。

---

## 4. AI 生成代码风险点清单 + 针对性测试

> 本节聚焦"AI 辅助编码"在 Brown Zone 仓库里留下的**隐蔽缺陷模式**。每条风险都锚定真实文件与行号，给出"为何 AI 易踩"的归因，并配一条**断言行为而非断言 mock**的针对性测试。优先级：P0 = 可致数据错误/隐私泄漏/静默错配，P1 = 生产环境行为偏差，P2 = 可维护性/回归风险。
>
> 反真说明：本仓库**不存在** SSE/WebSocket、Python/pytest、Vite/Vue。所谓"实时反馈"实为 `/api/sim/*` 响应内联的 adaptive events + 10 分钟行情刷新；所谓"AI 代码审查"实为对**财务决策**的复盘（`src/lib/history-review.ts` + `src/lib/ai.ts`），并非代码审查。下文测试均落在真实存在的 Vitest/Playwright 体系内。

### 4.1 风险清单

| 风险ID | 风险描述 | 为何 AI 易踩 | 触发条件 | 真实证据(path:line) | 针对性测试 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| **R1** 静默内存兜底掩盖真实 DB 缺陷 | `withDb()` 用一个大 try/catch 把**任何** DB 异常（含逻辑 bug、约束冲突、超时）翻译成"回退到 `store.ts` 内存路径"，调用方拿到的是 200 + 种子数据，真实写入失败被吞掉。DB 路径与内存路径若行为不一致，bug 会潜伏到生产。 | AI 倾向"让 demo 永不崩"，于是把 catch 写得过宽；它不会区分"DB 不可用"与"我的 SQL 写错了"。`catch (err)` 后直接 `return fallback()` 是 AI 最常见的"容错"惯用法。 | `DATABASE_URL` 已配置但某次查询抛错（约束冲突/超时/拼写错误的列）；且 `ALLOW_MEMORY_FALLBACK !== false`。 | `src/lib/db/repo.ts:142`(withDb 签名) · `:164-172`(try → catch → `return await fallback()`，仅当 `!ALLOW_MEMORY_FALLBACK` 才 `throw err`) · `:113-114`(生产默认禁用兜底) · `:122-140`(`withQueryTimeout` 5s 超时也走同一 catch) | **DB-内存路径奇偶校验 + 失败显形**（集成测试，扩展 `tests/integration/rls.test.ts` 同目录）：(a) 对同一输入分别走 DB 路径与内存路径，断言返回结构**逐字段相等**（捕获静默分叉）；(b) 注入会抛错的 `dbFn`（mock `getDb()` 返回一个 query 抛 `new Error`），在 `ALLOW_MEMORY_FALLBACK="false"` 下断言抛出/上层得到 `db_unavailable`，**而非**伪装成功；(c) 在 `="true"` 下断言确实回退且 `logFallback` 以 `query_failed` 触发。已有 `c2da07d test: DB-path integration tests` 可作起点扩展。 | **P0** |
| **R2** 幻觉式 AI 建议被当作权威输出 | `requestRemoteText()` 失败时返回 `provider:"fallback"` 文案；若兜底文案**捏造具体数字/价格/收益率**，学生会把"教学占位文"误读为真实测算。 | LLM 与 AI 写的兜底文案天然爱"编一个看起来专业的数字"让输出更可信；AI 写 fallback 时容易抄一段带 `+12%`、`￥35,000` 之类的硬编码示例。 | AI 网关未配置（`getAiConfig()` 返回 null）或两个 baseUrl 均失败 → 走 `fallbackText`。 | `src/lib/ai.ts:347-360`(无 config 直接返回 fallback) · `:402-410`(全部 baseUrl catch 后 fallback) · `:170-187`(`buildLocalTutorNarrative` 仅从 `input.state.run/market` 读字段，**不**自造数字) · `:189-212`(chat 兜底为纯定性文案) · `:553`(`provider` 透传) | **兜底有界性测试**（单元，扩展 `src/lib/ai.test.ts`）：清空 `AI_API_KEY/AI_BASE_URL_*`，对 tutor/chat/allocation/historyReview 四种兜底断言：① `provider === "fallback"`；② 文案包含"模拟/教育"类边界声明（如 `buildLocalChatNarrative` 的"本地教学兜底模式"）；③ **不含**任何未在 `input.state` 中出现的数字字面量（用正则抽取兜底里的数字，逐个断言能在输入 state 中找到来源，捕获"凭空造价"）；④ 不含"保证/必涨/稳赚"等承诺词。断言**行为**（输出内容契约），不 mock provider。 | **P0** |
| **R3** 时钟泄漏进领域逻辑破坏可复现性 | 赛季/排行/沙盘宣称"种子确定性"，但 `simulation.ts` 在领域路径里直接 `new Date()`：`appendAction` 给每条操作打 `timestamp: new Date().toISOString()`；`buildSeasonLeaderboard(now = new Date())` 默认实参取真实时钟。一旦快照/回放比较把 timestamp 纳入，或测试不注入 `now`，结果随挂钟漂移。 | AI 默认"要时间戳就 `new Date()`"，不会主动把时间作为参数注入；它把"纯函数"理解为"不写文件"，忽视了**隐藏输入**（system clock）。 | 任意 `appendAction` 调用；或调用 `buildSeasonLeaderboard` 不传 `now`，跨周边界即换种子。 | `src/lib/simulation.ts:196-201`(`appendAction` 内 `new Date().toISOString()`) · `:614-624`(`buildSeasonLeaderboard(now = new Date())`) · 对照确定性证据：`src/lib/event-engine.ts:18-27`(mulberry32) · `:13`("No `Math.random()`") · `src/lib/season.ts:15-23`(FNV-1a) · **反例污染源**：`src/lib/db/repo.ts:1231` 与 `src/lib/store.ts:1392` 用 `Math.floor(Math.random()*…)` 生成 seed | **回放等值 + 禁用 API 静态扫描**（单元）：① 固定 `seed` 两次 `buildEventTimeline(seed)` 断言数组**全等**；② 用 `vi.useFakeTimers()`/`vi.setSystemTime` 切到不同挂钟，对同一 `seed` 跑沙盘推进，断言 `snapshots`（除 timestamp 外）逐字段一致 —— 证明**净值路径不依赖时钟**；③ 给 `buildSeasonLeaderboard` 传两个不同 `now`（跨周）断言席位按种子变化、传同一 `now` 断言稳定；④ **元扫描测试**：grep `src/lib/{simulation,event-engine,season,leaderboard}/**` 断言领域计算分支内**不出现** `Math.random(`（seed 生成须由 store/repo 注入，而非领域层自取）。 | **P0** |
| **R4** 12 回合浮点货币累积漂移 | 净值/均价/储蓄复利在每回合做乘除（`savings *= 1.012…`、`debt *= 1.018`、均价加权摊销）。若不在每步取整，浮点误差 12 回合累积，导致排行分歧、`tabular-nums` 显示出现 `.0000001` 尾差。 | AI 写金融计算惯性用 `float * rate`，很少主动加"每步 `Math.round` 且以分/整数为单位"的不变量；它认为"差一分无所谓"。 | 任意买入（更新 `averageCost`）+ 连续 `advanceRound` 复利 12 次。 | `src/lib/simulation.ts:220-222`(均价 `Math.round` 摊销) · `:186/190`(`netWorth/riskScore` 取整) · `:516-517`(`savings`/`debt` 复利后 `Math.round`) · `:153-156`(纪律分基于整数惩罚) · 显示侧约定见 `CLAUDE.md` "tabular-nums" | **取整不变量测试**（单元）：① 构造一条 12 回合脚本，断言每回合 `snapshot.netWorth === Math.round(snapshot.netWorth)`（`Number.isInteger`），杜绝小数潜入；② 对均价摊销做"买入两笔再断言 `averageCost` 为整数且等于手算加权值"；③ 复利路径断言无累积误差：对 `savings` 跑 12 回合后与"逐步取整"参考实现比对相等；④ 组件层快照测试断言金额渲染节点含 `tabular-nums`（已在 `globals.css`/spec 约定）。 | **P1** |
| **R5** 限流器按"单进程"假设，serverless 多实例失效 | `rateLimit()` 用模块级 `Map<string,Bucket>`，每个 serverless 实例独立计数。N 个实例 → 实际放行 ~N×limit。文件已注释此局限，但代码本身不阻止误用为"全局配额"。 | AI 写限流默认内存 Map（教程里最常见），不会主动接 Redis/KV；它把"单机能跑"当成"生产正确"。 | 同一 key 的请求被负载均衡分散到多个 Lambda/Edge 实例。 | `src/lib/rate-limit.ts:10-12`(模块级 `const buckets = new Map`) · `:1-8`(文档已警示"per-process… replace with Upstash Redis / Vercel KV") · `:21-41`(纯内存滑窗) | **限流行为 + 生产警示双轨**（单元）：① 单进程内断言第 `limit+1` 次 `rateLimit` 返回 `ok:false` 且 `retryAfterMs>0`，窗口过期后恢复（验证算法正确）；② 断言 `MAX_TRACKED_KEYS` 驱逐逻辑（塞满后最老 key 被删，内存有界）；③ **文档断言/守卫测试**：用一行测试 + 注释固化"多实例下计数不共享"的已知缺陷，防止后人误当全局配额（在 PR 描述与本清单同时标注生产 caveat：上线多区前必须替换为 KV）。 | **P1** |
| **R6** 默认 owner 连接绕过 RLS，跨租户隔离形同虚设 | `DATABASE_ROLE` 默认 `"owner"`，RLS 被旁路；只有 `=authenticated` **且**查询走 `withRls()` 注入 JWT claims 时策略才生效。真正的跨租户防线是 `repo.ts` 应用层 `eq(userId, …)` 检查 —— 若某新函数漏写该过滤，owner 连接下会跨租户读到数据。 | AI 看到"有 RLS policies.sql"就默认"数据库会兜底权限"，在 `repo.ts` 新函数里省略 `where userId =` 应用层过滤；它不知道默认连接旁路 RLS。 | 生产用默认 `owner` 连接 + 某 repo 函数缺少 owner/classroom 过滤；或误以为不调 `withRls` 也有 RLS。 | `src/lib/db/client.ts:8-13`(`DB_ROLE = … ?? "owner"`，注释"RLS is bypassed; authorisation must be enforced in repo.ts") · `:50-58`(`withRls` 仅在 authenticated 下生效，owner 为 no-op) · `CLAUDE.md`/`AGENTS.md` RLS 段 | **RLS 双态隔离证明**（集成，落在 `tests/integration/rls.test.ts`，需 `DATABASE_URL` 指向测试 schema）：① 在 `DATABASE_ROLE=authenticated` + `withRls(claimsA)` 下，断言 A 租户**读不到** B 租户行（策略生效）；② 在默认 `owner` 下，断言**不**靠 RLS——而是靠 `repo.ts` 应用层过滤拦截跨租户读（对一个有 `userId` 过滤的函数证明隔离成立，对一个故意去掉过滤的探针证明 owner 会泄漏 → 反向证明应用层检查是真防线）；③ 断言 `withRls` 在 owner 下为 no-op（不报错但也不注入）。 | **P0** |
| **R7** 排行榜隐私泄漏：隐身玩家现身或留下名次空洞 | 隐私三态（`public/school_only/hidden`）若实现错误，会出现两类泄漏：隐身玩家出现在他人榜上；或"先过滤后用原始下标算 rank"导致名次出现空洞（第 1、第 3、缺第 2）从而暴露"有人隐身了"。 | AI 实现分页排名常犯"先 slice 再用全量 index 标 rank"或"过滤后仍按原数组位置编号"的错；可见性 × 作用域 × 分页三者交叉，AI 难一次写对。 | 任意含 `hidden`/`school_only` 玩家的榜单查询，跨 school/city/province/nation 四作用域 + 分页。 | `src/lib/leaderboard/ranking.ts:61-65`(`visibleIn`：hidden 全隐、school_only 仅校内) · `:79-97`(rank 在**已过滤集合**上用 `start+i+1` 计算 → 无空洞) · `:120-139`(`viewerPrivateRanks`：隐身者自己仍能看到真实名次，但不出现在他人榜) | **穷举可见性排名测试**（单元，落在 `src/lib/leaderboard/ranking.test.ts`）：构造含三态玩家的数据集，断言：① 任一作用域结果集**不含** `hidden` 玩家；② `school_only` 仅在 `scope==="school"` 出现，city/province/nation 不出现；③ 名次**连续无空洞**（`entries.map(e=>e.rank)` === `[start+1 … start+n]`）—— 直接捕获"空洞泄漏"；④ 分页边界（page2）rank 接续正确；⑤ `viewerPrivateRanks` 让隐身 viewer 看到自身真实排名，且该 viewer**不出现**在 `rankLeaderboard` 他人视角结果里；⑥ 平分时按 `userId` 升序稳定 tie-break（`byPowerDesc`）。 | **P0** |
| **R8** zod 边界缺口：畸形请求体打成 500 而非 invalid_input | JSONB 列用 `.passthrough()` 宽松校验，仅校核心字段；若 API 路由层对**请求体**漏接 zod，畸形输入会穿透到领域逻辑抛 `TypeError`，返回 500（栈泄漏）而非约定的 `{error:"invalid_input"}`。 | AI 给"happy path"写得很顺，但常忘记对**外部边界**（请求 body、第三方响应）做 `safeParse`；它信任入参已是正确类型。 | 向 sim/billing/auth 等代表性路由 POST 缺字段/错类型/超界的 body。 | `src/lib/db/payload-schemas.ts:11-20`(loose `.passthrough()`，注释"corrupted data 应 surface 为 boundary error") · `:22-30`(ActionLog enum 限定 6 种 type) · 错误码契约 `src/lib/api-response.ts`(`invalid_input` 等稳定码) | **畸形 body 模糊测试**（单元/路由级）：对代表性路由（如 `/api/sim/actions`、`/api/billing/*`）喂一批 fuzz body：空对象、`amount:"abc"`、`type:"hack"`(越过 enum)、超大数、`null`、深层嵌套。断言**全部**返回 `400 + {error:"invalid_input", message:<中文>}`，**绝不**出现 500 或未捕获异常；并对 `ActionLogSchema.safeParse` 直接断言越界 `type` 被拒。覆盖"边界拒绝"这一行为，而非内部实现。 | **P1** |
| **R9**（元检查）AI 自写测试断言 mock 而非行为（同义反复测试） | AI 生成的测试常见反模式：mock `ai.ts`/`alltick.ts` 后又断言"mock 被调用了"或断言 mock 的固定返回值，等于在测自己写的桩，永远绿，零回归价值（重灾区：AI 网关、行情、DB 兜底）。 | AI 写测试追求"通过率"，最省力的方式是 mock 一切再断言 mock；它分不清"验证契约"与"复述桩"。 | 任何对 `ai.ts`/`alltick.ts`/`getDb` 打桩的测试，若仅断言调用次数或桩返回值。 | 边界 mock 是**正确**做法（`ai.ts:88-99` getAiConfig 读 env、`alltick.ts` 教学兜底均为应 mock 的边界）；风险在于 mock 后**断言对象错位**。证据：本仓库已有真实行为测试可作正例（`src/lib/simulation.test.ts`、`tests/integration/leaderboard.test.ts`）。 | **测试审查守则（非自动断言，列为 review checklist + 抽样元测试）**：① 每个 mock 边界的测试必须至少有一条断言落在**被测模块的输出契约**上（如 `provider` 值、净值数值、错误码），而非 `expect(mockFn).toHaveBeenCalled()` 单独成立；② 抽样统计：若某测试文件的断言 100% 指向 mock 返回值/调用计数 → 标记为同义反复，打回；③ 优先对纯函数（`simulation/ranking/event-engine`）写**无 mock** 的真实计算断言，把 mock 仅限于 `ai.ts`/`alltick.ts`/`getDb` 三个真实外部边界。 | **P2** |

### 4.2 落地优先级与归并建议

- **P0（先做，五条）**：R1 静默兜底奇偶校验、R2 幻觉数字有界性、R3 回放确定性+禁用 API 扫描、R6 RLS 双态隔离、R7 排行隐私穷举。这五条直接对应"数据正确性 / 隐私 / 静默错配"三类**反真**高危面，且都能在现有 `tests/integration/{rls,leaderboard}.test.ts` 与 `src/lib/*.test.ts` 体系内落地，无需新基础设施。
- **P1（次之）**：R4 货币取整不变量、R5 限流多实例 caveat、R8 zod 模糊测试 —— 偏"生产行为偏差"，可与功能回归一起跑。
- **P2（持续）**：R9 作为 code-review 守则常驻，配合 `qa_engineer`/`reviewer` 双人复核（实现者与审查者须来自不同责任组，见 `AGENTS.md` §3.1）。

### 4.3 共性根因（写给后续 AI 编码者）

1. **过宽 catch = 把"我写错了"伪装成"环境不可用"**（R1）。容错必须区分 infra 故障与逻辑 bug；生产默认 `ALLOW_MEMORY_FALLBACK=false`（`repo.ts:113-114`）已是正确取向，测试要守住它。
2. **隐藏输入 = system clock 与 `Math.random()`**（R3）。领域层只接受**显式注入**的 `seed`/`now`；种子生成允许用 `Math.random()`，但只能发生在 store/repo 边界（`repo.ts:1231`、`store.ts:1392`），**不得**下沉到 `simulation/event-engine` 计算分支。
3. **"有 policies.sql ≠ 有权限"**（R6）。默认 `owner` 旁路 RLS，`repo.ts` 应用层 `where userId=` 才是真防线；新增任何读函数都要带租户过滤并配隔离测试。
4. **mock 边界，断言行为**（R2/R9）。只 mock `ai.ts`/`alltick.ts`/`getDb` 三个真实外部边界，断言永远落在被测模块的**输出契约**上，而非桩本身。

---

## 5. 推荐目录结构与配置

> 本节在**不改变**现有三套配置语义的前提下做**增量扩展**。务必保留：Playwright 的 `:4173 / PLAYWRIGHT_PORT / reuseExistingServer` 自启服务器（`playwright.config.ts:3,17-19`）、Vitest 单元/集成的 include 切分（`vitest.config.ts:13-14`）、集成套件的 `DATABASE_URL` 守卫（`tests/integration/rls.test.ts:30-31`）。下文标注 `(EXISTING)` 的行表示已存在、必须原样保留;标注 `(NEW)` 的是本节新增。

### 5.0 现状基线（已落地，勿回退）

| 文件 | 关键事实 | 证据 |
| --- | --- | --- |
| `vitest.config.ts` | `environment: "jsdom"`、`globals: true`、`setupFiles: ["./src/test/setup.ts"]`、`include: ["src/**/*.test.ts","src/**/*.test.tsx"]`、显式排除 `tests/integration/**` 与 `tests/e2e/**` | `vitest.config.ts:6-14` |
| `vitest.integration.config.ts` | `environment: "node"`、`include: ["tests/integration/**/*.test.ts"]`、`testTimeout: 30_000` | `vitest.integration.config.ts:9-12` |
| `playwright.config.ts` | `port = PLAYWRIGHT_PORT ?? "4173"`、`reuseExistingServer: true`、`trace: "retain-on-failure"`、仅 `chromium` project、webServer 注入 `DB_QUERY_TIMEOUT_MS` | `playwright.config.ts:3,14,19,21-24,26-31` |
| `src/test/setup.ts` | 当前**只**导入 `@testing-library/jest-dom/vitest`，**尚无 MSW** | `src/test/setup.ts:1` |
| `package.json` scripts | `test`=`vitest run`、`test:integration`=`vitest run tests/integration --config vitest.integration.config.ts`；已装 `@testing-library/react@16`、`@testing-library/user-event@14`、`jsdom@29`、`playwright@1.59`、`vitest@4` | `package.json:11-12,37-50` |

> 注意：单元 setup 现位于 `src/test/setup.ts`（**不是** `tests/setup.ts`）。任务目标树把全局 wiring 收敛到 `tests/setup.ts`。为不破坏现有 `vitest.config.ts:8` 的路径，**推荐做法**是新建 `tests/setup.ts` 作为唯一真源，并让 `src/test/setup.ts` 改为一行 `import "../tests/setup";` 重导出（保持旧路径可用），随后把 `setupFiles` 指向新文件。下文 5.2 给出两处改动。

### 5.1 目标测试目录树

```text
brown-zone-web/
├─ src/
│  ├─ lib/
│  │  ├─ simulation.ts
│  │  ├─ simulation.test.ts            # 单元：纯函数 12 轮引擎 (jsdom 也可，纯逻辑)
│  │  ├─ event-engine.ts
│  │  ├─ event-engine.test.ts          # 单元：mulberry32 种子时间线可复现
│  │  ├─ adaptive-events.ts
│  │  ├─ adaptive-events.test.ts       # 单元：每轮最多 2 事件 (CLT) 约束
│  │  ├─ season.ts
│  │  ├─ season.test.ts                # 单元：currentSeasonSeed 周边界 (epoch 2026-01-05)
│  │  └─ billing/
│  │     └─ subscription.test.ts       # 单元：canUserOperate 状态机
│  ├─ components/
│  │  ├─ student/
│  │  │  ├─ student-market-board.tsx
│  │  │  └─ student-market-board.test.tsx  # 组件：@testing-library/react + jsdom
│  │  └─ shared/
│  │     └─ money-text.test.tsx         # 组件：tabular-nums / 红涨绿跌渲染
│  └─ test/
│     └─ setup.ts                       # (EXISTING) 改为 re-export → ../tests/setup
├─ tests/
│  ├─ setup.ts                          # (NEW) 全局 wiring：jest-dom + MSW 生命周期
│  ├─ integration/                      # (EXISTING) 真 Postgres：repo + RLS
│  │  ├─ rls.test.ts                    # (EXISTING) RLS 策略 (withRls / authenticated)
│  │  ├─ leaderboard.test.ts            # (EXISTING) repo DB-path 集成
│  │  └─ helpers/
│  │     └─ db.ts                       # (NEW) loadEnvFile + describeWithDb + sql 句柄
│  ├─ e2e/                              # (EXISTING) Playwright
│  │  ├─ prelaunch.spec.ts              # (EXISTING)
│  │  ├─ ux-audit.spec.ts               # (EXISTING)
│  │  ├─ ui-audit.spec.ts               # (EXISTING)
│  │  ├─ ui-audit-stress.spec.ts        # (EXISTING)
│  │  └─ interactivity-audit.spec.ts    # (EXISTING)
│  ├─ msw/                              # (NEW) 网络边界 mock
│  │  ├─ server.ts                      # setupServer(...handlers)
│  │  └─ handlers.ts                    # 拦截 src/lib/ai.ts 与 src/lib/alltick.ts 出站请求
│  ├─ factories/                        # (NEW) 数据构造器 (= pytest fixtures 的等价物)
│  │  ├─ run.ts                         # ScenarioRun builder（带 seed）
│  │  └─ user.ts                        # 各角色 user/JWT claims builder
│  └─ fixtures/                         # (NEW) 静态样例：AllTick K线、AI 回包样本
│     ├─ alltick-kline.json
│     └─ ai-tutor-insight.json
├─ vitest.config.ts                     # (EDIT) +coverage v8 +setup 路径
├─ vitest.integration.config.ts         # (EDIT) +单线程/顺序 +显式跳过守卫说明
├─ playwright.config.ts                 # (EDIT) +mobile project +trace on-first-retry
└─ .github/workflows/ci.yml             # (NEW) install→lint→typecheck→unit→build→integration→e2e
```

> **conftest.py / pytest 不适用**：本仓库是 Next.js 16 + TypeScript，**没有 Python**（`package.json` 无任何 Python 依赖；不存在 `conftest.py`/`pytest.ini`/`requirements.txt`）。Python 测试栈到本栈的映射为：`conftest.py`（全局夹具与 autouse wiring）→ **`tests/setup.ts`**（`setupFiles`，每个测试文件前执行）;pytest `@fixture` 工厂 → **`tests/factories/**`**（显式调用的数据构造器）;`monkeypatch`/`responses` → **`tests/msw/**`**（在 HTTP 边界拦截，而非打补丁打到 provider SDK）。

### 5.2 `vitest.config.ts`（扩展现有 — 复制即用）

保留 jsdom/globals/include 切分，新增 v8 覆盖率与阈值;把 setup 指向收敛后的 `tests/setup.ts`。

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",          // (EXISTING) 组件测试需要 DOM
    globals: true,                 // (EXISTING) describe/it/expect 全局
    setupFiles: ["./tests/setup.ts"], // (EDIT) 旧值 ./src/test/setup.ts —— 见下方迁移说明
    // (EXISTING) 单元(src/**) 与 集成(tests/integration/**) 严格切分：
    // `npm run test` 只跑单元；集成走 `npm run test:integration`（需 DATABASE_URL 指向测试库）。
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: [
      "tests/e2e/**",            // (EXISTING) Playwright 由 playwright.config.ts 驱动
      "tests/integration/**",    // (EXISTING) 走 node 配置 + 真 DB
      "node_modules/**",
      ".next/**",
    ],
    // (NEW) 覆盖率：v8 provider，与单元 include 对齐，排除框架/类型/测试自身。
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/lib/**", "src/components/**"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/types.ts",
        "src/app/**",            // 路由/页面壳由 e2e 覆盖，不计入单元覆盖率
        "**/*.d.ts",
      ],
      // 起步阈值：核心逻辑(src/lib) 已是纯函数、易测，可设较高门槛。
      // 组件刚起步，故全局阈值保守，待 *.test.tsx 增多后再上调。
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
        "src/lib/**": { lines: 85, functions: 85, branches: 75, statements: 85 },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"), // (EXISTING) 对齐 tsconfig 的 @/* → ./src/*
    },
  },
});
```

迁移说明（两步，保持旧路径可用）：

```ts
// tests/setup.ts  —— (NEW) 唯一真源；见 5.6 完整内容
```

```ts
// src/test/setup.ts  —— (EDIT) 由原来的单行 jest-dom 导入改为转发，避免任何遗留引用断裂
import "../../tests/setup";
```

### 5.3 `vitest.integration.config.ts`（扩展现有 — 复制即用）

集成套件命中真 Postgres，必须**串行**（RLS/事务/seed 互相影响），并保留“无 `DATABASE_URL` 即跳过”的语义 —— 该跳过逻辑现由测试文件内 `databaseUrl ? describe : describe.skip` 实现（`tests/integration/rls.test.ts:30-31`），此处通过统一 helper 复用，不在配置层硬失败。

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

// (EXISTING 语义) 集成套件只跑 tests/integration/**，命中由 DATABASE_URL 指示的真 Postgres。
// 把它指向一次性测试 schema，绝不要指向生产。CI 在调用本配置前注入 DATABASE_URL。
export default defineConfig({
  test: {
    environment: "node",                         // (EXISTING) 无 DOM，跑 repo/SQL
    globals: true,                               // (EXISTING)
    include: ["tests/integration/**/*.test.ts"], // (EXISTING)
    testTimeout: 30_000,                         // (EXISTING) 真 DB round-trip 容忍更长
    hookTimeout: 30_000,                         // (NEW) beforeAll 里建表/applyPolicies 也需放宽
    // (NEW) 串行：RLS 会话变量(set_config)、事务回滚、seed 数据彼此不可并发。
    fileParallelism: false,
    pool: "threads",
    poolOptions: { threads: { singleThread: true } },
    // (NEW) 全局 setup：仅做“有无 DATABASE_URL”的可见提示，不在此处抛错——
    // 真正的跳过仍交给各文件的 describeWithDb（见 tests/integration/helpers/db.ts）。
    globalSetup: ["./tests/integration/global-setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),     // (EXISTING)
    },
  },
});
```

```ts
// tests/integration/global-setup.ts  —— (NEW) 只打印一次性提示，永不阻断
export default function () {
  if (!process.env.DATABASE_URL) {
    // 与 rls.test.ts:30-31 的 describe.skip 一致：缺库时整套优雅跳过，而非 CI 红灯。
    console.warn(
      "[integration] DATABASE_URL 未设置 —— 集成用例将被 describeWithDb 跳过。",
    );
  }
}
```

```ts
// tests/integration/helpers/db.ts  —— (NEW) 抽取 rls.test.ts 已验证的 loadEnvFile + 守卫
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";
import { describe } from "vitest";

// 复刻 tests/integration/rls.test.ts:6-28 的 .env 装载（.env 不覆盖，.env.local 覆盖）。
function loadEnvFile(fileName: string, override = false) {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i <= 0) continue;
    const key = trimmed.slice(0, i).trim();
    const value = trimmed.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
    if (override || process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvFile(".env");
loadEnvFile(".env.local", true);

export const DATABASE_URL = process.env.DATABASE_URL;
// (EXISTING 语义, tests/integration/rls.test.ts:31) 缺库则整组跳过。
export const describeWithDb = DATABASE_URL ? describe : describe.skip;
export const TEST_TIMEOUT_MS = 30_000;

export function makeSql() {
  if (!DATABASE_URL) throw new Error("DATABASE_URL required for makeSql()");
  // RLS 路径用 authenticated 角色才生效（drizzle/policies.sql + withRls）。
  return postgres(DATABASE_URL, { max: 1, prepare: false });
}
```

### 5.4 `playwright.config.ts`（扩展现有 — 复制即用）

保留自启 `:4173` 服务器与 `reuseExistingServer`;新增**移动端 project** 与 `trace: "on-first-retry"`（首次失败重试时抓 trace，比 `retain-on-failure` 更省盘且能定位 flake）。

```ts
import { defineConfig, devices } from "playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "4173"; // (EXISTING)
const baseURL = `http://127.0.0.1:${port}`;          // (EXISTING)

export default defineConfig({
  testDir: "./tests/e2e",                            // (EXISTING)
  timeout: 30_000,                                   // (EXISTING)
  expect: { timeout: 10_000 },                       // (EXISTING)
  forbidOnly: !!process.env.CI,                      // (NEW) CI 里禁止误提交 test.only
  retries: process.env.CI ? 2 : 0,                   // (NEW) 配合 on-first-retry 抓 flake
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]      // (NEW) CI 注解 + 可下载报告
    : [["list"]],
  use: {
    baseURL,                                         // (EXISTING)
    trace: "on-first-retry",                         // (EDIT) 原 "retain-on-failure"
    screenshot: "only-on-failure",                   // (NEW)
  },
  webServer: {                                       // (EXISTING) —— 整块保留
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,                       // (EXISTING) 复用已起的 dev server
    timeout: 120_000,                                // (EXISTING)
    env: {
      ...process.env,
      DB_QUERY_TIMEOUT_MS: process.env.DB_QUERY_TIMEOUT_MS ?? "350", // (EXISTING)
    },
  },
  projects: [
    {
      name: "chromium",                              // (EXISTING)
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-safari",                         // (NEW) 学生端以手机为主，验证响应式
      use: { ...devices["iPhone 14"] },
    },
  ],
});
```

### 5.5 MSW —— 只 mock 真实出站边界（`src/lib/ai.ts` / `src/lib/alltick.ts`）

> 黄金规则：**永远 mock 边界、绝不 mock provider 内部**。AI 走 `src/lib/ai.ts` 网关，向 `…/v1/messages` POST（端点由 `endpointForBase` 拼接，`src/lib/ai.ts:60-63`）;行情走 `src/lib/alltick.ts`，base 默认 `https://quote.alltick.co/quote-stock-b-api`（`src/lib/alltick.ts:106`，env `ALLTICK_STOCK_BASE_URL` 见 `src/lib/env.ts:19-20`）。这两类 URL 即 MSW 的拦截点。需要 `msw`（开发依赖，见 5.8）。

```ts
// tests/msw/handlers.ts  —— (NEW)
import { http, HttpResponse } from "msw";

// AI 网关：匹配任意 base 下的 /v1/messages（src/lib/ai.ts:60-63 的端点形状）。
// 返回最小可用的 Anthropic-风格回包，让上层把 provider 标成 "remote"。
const aiMessages = http.post(/\/v1\/messages$/, async () => {
  return HttpResponse.json({
    id: "msg_test",
    type: "message",
    role: "assistant",
    content: [{ type: "text", text: "【测试桩】导师点评：本轮过度交易，建议持有。" }],
    stop_reason: "end_turn",
  });
});

// AllTick：拦截 quote.alltick.co 下的全部行情/K线端点（src/lib/alltick.ts:106 的 base）。
// 同时拦截可被 env 覆写的自定义 base：测试里设 ALLTICK_STOCK_BASE_URL 时改用具名 host。
const alltickBase = process.env.ALLTICK_STOCK_BASE_URL ?? "https://quote.alltick.co/quote-stock-b-api";
const alltickQuotes = http.get(`${alltickBase}/*`, () => {
  return HttpResponse.json({
    ret: 200,
    msg: "ok",
    trace: "test-trace",
    data: {
      tick_list: [
        { code: "AAPL.US", price: "190.50", prev_close: "188.00", change_rate: "1.33", tick_time: "2026-06-02T00:00:00Z" },
      ],
      kline_list: [
        { timestamp: "2026-06-02T00:00:00Z", open_price: "188.0", close_price: "190.5", high_price: "191.2", low_price: "187.6" },
      ],
    },
  });
});

export const handlers = [aiMessages, alltickQuotes];
```

```ts
// tests/msw/server.ts  —— (NEW) Node 端 server（Vitest 用 setupServer，浏览器才用 setupWorker）
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

### 5.6 `tests/setup.ts` —— 全局 wiring（jest-dom + MSW 生命周期）

> 等价于 pytest 的 `conftest.py`（autouse 全局夹具）。这是 `setupFiles` 指向的唯一文件。`onUnhandledRequest: "warn"` 保证“漏网的真实请求”不会静默打到外网。

```ts
// tests/setup.ts  —— (NEW)
import "@testing-library/jest-dom/vitest"; // (EXISTING 行为) 原 src/test/setup.ts:1
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server";

// 启动 MSW；任何未被 handler 覆盖的出站请求都告警——逼迫显式 mock 每个外部边界。
beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
// 每个用例后重置 runtime handler，避免 server.use(...) 的逐例覆写泄漏到下一例。
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### 5.7 `tests/factories/run.ts` —— ScenarioRun 构造器（带 seed）

> 字段对齐 `ScenarioRun`（`src/lib/types.ts:124-155`：`seed?: number` 用于复现事件时间线;`netWorth?` 由 commitSnapshot 维护）。默认起始现金 120,000（沙盘约定）;默认 12 轮。`season` 工厂用周种子 epoch `Date.UTC(2026,0,5)`（`src/lib/season.ts:7`）使运行落入当周排行榜。

```ts
// tests/factories/run.ts  —— (NEW)
import type { ScenarioRun } from "@/lib/types";
import { currentSeasonSeed } from "@/lib/season";

let seq = 0;

// 仅显式传入的字段会覆盖默认值（pytest fixture 的等价物：构造器而非自动注入）。
export function makeScenarioRun(overrides: Partial<ScenarioRun> = {}): ScenarioRun {
  seq += 1;
  return {
    id: `run_${seq}`,
    userId: `student_${seq}`,
    classroomId: "class_demo",
    scenarioName: "12 轮经济沙盘",
    currentRound: 1,
    totalRounds: 12,            // 12-round loop
    cash: 120_000,             // 起始现金（CLAUDE.md / simulation.ts 约定）
    savings: 0,
    debt: 0,
    propertyUnits: 0,
    propertyBasis: 0,
    ventureStake: 0,
    ventureBasis: 0,
    holdings: [],
    eventHistory: [],
    actionLog: [],
    snapshots: [],
    seed: 1234,                // 固定种子 → buildEventTimeline 可复现（event-engine.ts）
    netWorth: 120_000,
    ...overrides,
  };
}

// 让运行落入“当前赛季”：种子 = currentSeasonSeed()，季排行榜按种子匹配成员（season.ts）。
export function makeSeasonRun(overrides: Partial<ScenarioRun> = {}): ScenarioRun {
  return makeScenarioRun({ seed: currentSeasonSeed(), ...overrides });
}
```

### 5.8 新增依赖与 npm scripts

```jsonc
// package.json —— devDependencies 追加（其余已具备：@testing-library/*, jsdom, playwright, vitest）
{
  "devDependencies": {
    "@vitest/coverage-v8": "^4.1.4", // (NEW) 对齐 vitest@4（package.json:50）
    "msw": "^2.7.0"                  // (NEW) Node 端 setupServer 拦截 ai.ts/alltick.ts 边界
  }
}
```

```jsonc
// package.json —— scripts 追加（保留现有 test / test:integration —— package.json:11-12）
{
  "scripts": {
    "test:coverage": "vitest run --coverage",                 // (NEW)
    "test:e2e": "playwright test",                            // (NEW) 等价 npx playwright test
    "typecheck": "tsc --noEmit"                               // (NEW) CI typecheck 阶段调用
  }
}
```

### 5.9 `.github/workflows/ci.yml`（新增 — 复制即用）

阶段：install+cache → lint → typecheck → unit(coverage) → build → integration(postgres:16 service) → e2e(playwright)。`integration` 在跑用例前执行 `db:generate` + 迁移 + `db:apply-policies`（RLS 仅在 `authenticated` 角色 + `withRls()` 下生效，故 service 用 owner 连接建表、用例内切 authenticated）。`e2e` 复用 `playwright.config.ts` 的自启 server（CI 中无既有 server，`reuseExistingServer: true` 会自动新起）。

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

env:
  # 单元/构建阶段不需要真库；保持内存回退打开，保证离线 demo 路径被覆盖。
  ALLOW_MEMORY_FALLBACK: "true"

jobs:
  # 1) install + cache —— 产出可复用的 node_modules（actions/setup-node 内置 npm 缓存）
  setup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20            # 对齐 @types/node@20（package.json:40）
          cache: npm
      - run: npm ci

  lint:
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint           # eslint（package.json:9）

  typecheck:
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run typecheck      # tsc --noEmit（5.8 新增 script）

  unit:
    needs: [lint, typecheck]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run test:coverage  # vitest run --coverage（只跑 src/** 单元）
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage
          path: coverage/

  build:
    needs: unit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run build          # next build（package.json:7）

  integration:
    needs: build
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: brownzone_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      # owner 连接：建表/迁移用；用例内自行 set role authenticated 验证 RLS。
      DATABASE_URL: postgres://postgres:postgres@127.0.0.1:5432/brownzone_test
      DATABASE_ROLE: authenticated   # 让 withRls() 路径真正受 policies.sql 约束
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run db:generate     # drizzle-kit generate（package.json:13）
      # 应用迁移（drizzle/ 下 SQL）。若仓库已有 migrate 脚本则替换此行；
      # 否则用 drizzle-kit 的 migrate 子命令对 DATABASE_URL 推送 schema。
      - run: npx drizzle-kit migrate
      - run: npm run db:apply-policies  # 写入 drizzle/policies.sql（package.json:15）
      - run: npm run test:integration   # vitest --config vitest.integration.config.ts
        # 注意：缺 DATABASE_URL 时会被 describeWithDb 跳过（rls.test.ts:30-31）；
        # CI 这里一定有库，故用例真实执行。

  e2e:
    needs: build
    runs-on: ubuntu-latest
    env:
      PLAYWRIGHT_PORT: "4173"        # 对齐 playwright.config.ts:3 默认端口
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium webkit  # chromium + mobile-safari(webkit)
      - run: npm run test:e2e        # playwright test（自启 :4173，CI 内无既有 server 则新起）
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

### 5.10 关于 conftest.py / pytest 的明确说明

- **不适用**：本仓库无任何 Python（无 `conftest.py`、无 `pytest.ini`/`pyproject.toml`、无 `requirements.txt`;`package.json:35-51` 全为 JS/TS 开发依赖）。所谓 “pytest fixture / conftest” 在本栈没有对应物，**不要**为此新建 Python 文件。
- **等价物映射**：
  - 全局 wiring（autouse、生命周期 hook）→ **`tests/setup.ts`**（`setupFiles`，5.6;jest-dom + MSW `beforeAll/afterEach/afterAll`）。
  - 夹具/工厂（`@pytest.fixture`）→ **`tests/factories/**`**（5.7 的 `makeScenarioRun`/`makeSeasonRun`，显式调用，无魔法注入）。
  - 外部依赖打桩（`responses`/`monkeypatch`）→ **`tests/msw/**`**（5.5，在 `src/lib/ai.ts` 的 `/v1/messages` 与 `src/lib/alltick.ts` 的 `quote.alltick.co` HTTP 边界拦截，**不**侵入 provider SDK）。
  - 数据库夹具（pytest-postgres）→ **`tests/integration/helpers/db.ts`** + CI `postgres:16` service（5.3 / 5.9）。

### 5.11 落地校验清单

1. `npm i -D @vitest/coverage-v8 msw`（5.8）。
2. 新建 `tests/setup.ts`（5.6），并把 `src/test/setup.ts` 改为 `import "../../tests/setup";`;`vitest.config.ts:8` 的 `setupFiles` 指向新文件（5.2）。
3. 新建 `tests/msw/{server,handlers}.ts`、`tests/factories/run.ts`、`tests/integration/helpers/db.ts`、`tests/integration/global-setup.ts`。
4. 按 5.4 扩展 `playwright.config.ts`（加 `mobile-safari` project 与 `trace: "on-first-retry"`）。
5. `npm run test:coverage` 应只跑 `src/**`、产出 `coverage/`;`npm run test:integration` 在无 `DATABASE_URL` 时优雅跳过、有库时执行（与 `rls.test.ts:30-31` 一致）。
6. 提交 `.github/workflows/ci.yml`（5.9）。

> 相关文件（均为绝对路径）：`D:\树德实验中学（清波）\C2\brown-zone-web\vitest.config.ts`、`…\vitest.integration.config.ts`、`…\playwright.config.ts`、`…\src\test\setup.ts`、`…\src\lib\ai.ts`、`…\src\lib\alltick.ts`、`…\src\lib\env.ts`、`…\src\lib\types.ts`、`…\src\lib\season.ts`、`…\tests\integration\rls.test.ts`。

---

## 6. 验证附录（对抗式反真审查留痕）

> 本文档经一轮**对抗式 fabrication-critic 审查**：5 个独立审查 agent（每章 1 个）逐条比对正文的 `path:line`、命名常量与行为断言与真实源码，覆盖 200+ 条断言。**未发现任何被捏造的常量或行为**；全部高风险常量（120000 起始现金、12 回合、adaptive 每回合 ≤2、power 权重 .30/.25/.20/.15/.10、maxPower 2000、season epoch 2026-01-05、`ALLOW_MEMORY_FALLBACK`、RLS 仅在 `authenticated`+`withRls` 生效、ranking 隐身无名次空洞、Playwright 4173）均与源码逐字一致。

### 6.1 各章保真度

| 章 | 审查断言数 | 保真度 | 备注 |
| --- | --- | --- | --- |
| 1 测试策略 | 62 | 高 ~95% | 1 处事实错误（已修正 6.2-#1）+ 个别行号微漂 |
| 2 场景矩阵 | 155 | 极高 | 全部高风险常量逐字命中；仅个别 ±1~2 行号 |
| 3 专项深挖 | — | 高 ~95% | 1 处覆盖状态高估（已修正 6.2-#2）|
| 4 AI 风险 | — | 高 | 全部承重常量/行为命中；1 处措辞（已修正 6.2-#3）|
| 5 目录/配置 | — | 高 | 全部配置行号命中；1 处文件名（已修正 6.2-#4）|

### 6.2 已应用修正（substantive，影响正确性）

| # | 位置 | 原值 → 修正 | 证据 |
| --- | --- | --- | --- |
| 1 | §1.2 / §1.5 契约 | API「八码 / 8 个稳定码」→ **七码** | `src/lib/api-response.ts:7-13` 仅 7 个 code；§2 全程写的是 7，内部现已一致 |
| 2 | §3(2) 隐私「分享卡」 | 覆盖「建议补」→ **已存在 `share.test.ts`** | `src/lib/leaderboard/share.test.ts` 已断言无 PII / 反 YOLO |
| 3 | §4.1 R2 | 「新增 `ai.test.ts`」→ **扩展** | `src/lib/ai.test.ts` 已存在 |
| 4 | §5.1 目录树 | `MarketBoard.tsx` → **`student-market-board.tsx`** | 仓库实为 kebab-case，`MarketBoard.tsx` 不存在 |

### 6.3 残留轻微引用漂移（cosmetic — 文件与结论均正确，仅行号 ±1~2 或引文归属偏松；不影响落地）

| 位置 | 说明 | 实测正确值 |
| --- | --- | --- |
| §2 J02-02 | assignments 提示语行号 | `teacher/assignments/route.ts:45`（文写 :46）|
| §2 J10-06 | reset 邮件 `escapeHtml(name)` | `email.ts:110`（文写 :108）|
| §2 J13-04 | `computeStreak` 的 `best=Math.max` | `simulation.ts:587`（文写 :586）|
| §5.0 / §5.8 | `package.json` scripts 行跨 | `test`=:10、`test:integration`=:12（文写 11-12）|
| §2 J09-07 | 「per-process…」英文引文归属 | 概念确在 `rate-limit.ts:1-8`；逐字串源自 `CLAUDE.md`（结论为真）|
| §2 J04-01 | `getAiConfig` 的 `return null` | `ai.ts:93`（文写落在 :79-90；:79-87 为其文档注释，正确）|
| §2 J03-02 | 难度三段 tier 曲线位置 | 实现于 `event-engine.ts:81-85`（文写 :54-55 为签名/注释；J03-03 引的 :81-85 才精确）|

> **审查即主张的实践**：本附录正是 §4「反真」原则的现场留痕 —— 任何 `path:line` 落地前都应被独立复核。生成 agent 与审查 agent 相互独立（对应 `AGENTS.md` §3.1「实现者与审查者分属不同责任组」）。
