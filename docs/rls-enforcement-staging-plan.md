# RLS 逐请求强制执行 — 实施与 Staging 验证方案

> 状态：**P1 ✅ / P2（leaderboard + ai-history）✅ / 全场景实测 ✅** ｜ 作者：Codex/Claude ｜ 日期：2026-06-03
> 余下：P2 继续铺开其余只读端点（按既定套路）→ P3 真·staging（见 §11 关于 Supabase 分支的判定）→ P4 生产灰度。
>
> P2 已接：`/api/leaderboard/me`、`/board`、`/profile`(GET) + `/api/ai/history`、`/api/ai/history/[sessionId]` 经 `withUserRls`；repo 读函数 `getRankProfile`/`listRankSnapshots`/`getPowerSnapshot`/`listAiSessionsForUser`/`getAiSessionById` 改走 `withScopedDb`。`RLS_ENFORCE=true` 实测通过。
>
> **重要判定 — `/student` 维持 owner（不接 scoped）**：`getSimulationStateForUser` 不是纯读——它 ① `ensureStudentSandbox` 惰性**写** `scenario_runs`（该表无 authenticated 写策略）；② `selectAllUsers`/`selectAllRuns` 做**跨班级读**（学生在 RLS 下只看得到自己）。强行 scoped 会三处皆破。原则确立：**只 scope「纯读 + 用户私有」端点；任何写或跨用户读的路径留在 owner**（sim 动作、onboarding POST、班级花名册、cron、admin 同理）。
>
> **已拍板的决定**：① Staging = **Supabase 分支**；② 机制 = **请求级单事务**（ALS 共享一个 scoped tx）；③ `users` 表**不**加 teacher/admin 读策略，这些读**维持走 service**。
> 前置已完成：17 表 42 条策略已 DB 层验证 **15/15 强制正确**（`SET LOCAL ROLE authenticated` + claims，回滚事务）。
> 本文是「先出方案」的交付物；实现待本方案评审通过后再动手。

## 0. TL;DR

把 RLS 从「纵深防御（owner 连接绕过、策略不生效）」升级为「**用户请求层真正强制**」，同时**保留**服务端跨用户可信操作（cron / admin / 赛季总榜 / 登录引导）走 service 角色。
采用 **flag 门控、可灰度、可秒级回滚** 的方式：代码先合入且零行为变化，Staging 打开 `RLS_ENFORCE` 全量验证后，再灰度到生产。

## 1. 目标与非目标

**目标**
- 用户发起的请求，其 DB 查询以 `authenticated` 角色 + 该用户 JWT claims 执行 → 越权读写在 **DB 层**被拒（即便应用层有 bug 也兜底）。

**非目标**
- 不改写为 supabase-js / PostgREST（保留 Drizzle + postgres-js）。
- 不改动策略定义（已验证 15/15）。
- 不移除内存兜底（离线教师机 demo 仍需要）。
- 不让 cron / admin / 引导等**系统操作**走 RLS（它们本就需要跨用户）。

## 2. 现状（基于代码核实）

- 连接：`getDb()`（`src/lib/db/client.ts`）以 `postgres`（`rolbypassrls=true`）连 Supabase pooler(:6543, transaction mode)。
- **`withRls()` 是死代码**：仅 client.ts 定义、全仓 0 调用；且它只 `set_config` claims、**没有 `SET ROLE`**，即便被调用也不会强制 RLS。
- `repo.ts`：每个函数直接 `getDb()` 查询或开 `db.transaction()`；用户身份以**参数**(`userId`)穿透，连接层无 claims 上下文。已有 `executor: DbExecutor` 接缝（约 12 个 `select*` helper 接受 executor）。
- 路由：`requireUser(role)` → `{ user }`（含 `id/role/classroomId`），把 `user.id` 传给 service/repo（如 `getPowerCard(auth.user.id)`）。

### 2.1 必须保留 service（owner）的操作 — 强制 RLS 后会被拒

| 操作 | 为什么必须走 service |
|---|---|
| `recompute-leaderboard` cron（每天 00:30）| 给**所有** onboarded 用户写 snapshot |
| `weekly-report` cron（周一 09:00）| 跨家庭读取生成报告 |
| 赛季总榜 `getSeasonLeaderboard` | 按 seed 读**所有** run |
| admin 用户管理 | `users` 表**仅有 own-row 策略** → 即便 admin 也只看得到自己 |
| **登录 / 注册 / guest-upgrade 引导**（`authenticateUser` / `findUserByEmail`）| 会话建立**之前**还没有 claims，且要按 email 查 user |
| `applyFamilyEntitlement`（在 `requireUser` **内部**调用）| 在我们能建立 scoped 上下文**之前**就要读 family/subscription |
| `db:seed` / 运维脚本 | 全库写 |

> ⚠️ **关键陷阱**：`requireUser` 内部先 `findUserById` + `applyFamilyEntitlement`，发生在能建立 user-scoped 上下文**之前** → 这段必须 service。scoped 上下文只能在 `requireUser` 成功**之后**注入。

## 3. 目标架构

### 3.1 两个显式 DB 入口
- `getServiceDb()` —— 现有 owner 连接，绕过 RLS。用于系统 / 跨用户 / 引导。
- `withUserRls(claims, fn)` —— 在**事务**内执行：
  ```sql
  -- (claims 先以 postgres 身份、is_local=true 设置，跨 set role 仍有效)
  select set_config('request.jwt.claim.sub', $sub, true);
  select set_config('request.jwt.claim.role', $role, true);
  select set_config('request.jwt.claim.classroomId', $classroom, true);
  set local role authenticated;   -- 该角色不绕过 RLS → 策略强制
  -- fn 内的查询在此事务中执行
  ```
  机制已被本会话的验证脚本证明可用（同一个 :6543 transaction pooler，15/15）。

### 3.2 身份传播（避免改每个函数签名）
用 `AsyncLocalStorage<RlsContext>`：在 `requireUser` 成功后注入 `{ sub, role, classroomId }`；repo 的**用户作用域**函数从 ALS 取上下文、走 `withUserRls`；**系统**函数显式 `getServiceDb()`。

### 3.3 安全默认（最重要的设计决定）
- **默认 service（保持现状行为），逐端点 opt-in 到 scoped。**
  不是「默认 scoped、出错再 opt-out」——后者一旦漏标一处就是线上误拒。增量、可控、低风险。
- 一个请求常调用多个 repo 函数（如 `getPowerCard` = `getRankProfile` + `getPowerSnapshot` + `listRankSnapshots`）。
  **首选**：请求级开**一个** scoped 事务，经 ALS 让该请求所有 repo 调用复用同一 tx（一致身份 + 原子性）。
  次选：每次调用各自 `withUserRls`（更简单，但同请求多事务、无跨调用原子性）。

### 3.4 Flag 门控
`RLS_ENFORCE`（默认 `off`）：
- `off`：`withUserRls` 直接走 owner（**零行为变化**）→ 代码可安全先合入。
- `on`：才 `set role` + claims → RLS 强制。Staging/灰度时打开。

## 4. 触点与工作量（估）

- **新增**：`getServiceDb()` / `withUserRls()` / `src/lib/db/rls-context.ts`（ALS）。
- **改造**：`requireUser` 注入 ALS；约 20–30 个**用户作用域** repo 函数切到 scoped；系统函数显式 service。
- **估**：实现 2–3 天 + Staging 验证 1–2 天。

## 5. Staging 环境

| 选项 | 说明 | 取舍 |
|---|---|---|
| **A. Supabase Branch（推荐）** | 用 `supabase` MCP `create_branch` 从生产 schema 拉隔离分支库，独立 `DATABASE_URL`，灌 seed，用完即弃 | 最接近生产；需 Supabase 分支能力 |
| B. 独立 Supabase project（免费档）| `db:migrate` + `db:apply-policies` + `db:seed` | 干净隔离；与生产环境略有差异 |
| C. 本地 Postgres(docker) | 同上 + 补 `auth.jwt()` 等 Supabase 内置的 shim | 最快；与 Supabase 差异需补齐 |

Staging 配置：`RLS_ENFORCE=on`、`ALLOW_MEMORY_FALLBACK=false`（让 RLS 拒绝**显式暴露**、不被内存兜底掩盖）、独立 `SESSION_SECRET`。

## 6. 验证矩阵（Staging 必过）

### 6.1 自动化（`tests/integration/rls.test.ts`，DATABASE_URL 指向 staging）
把本会话的 15 条 DB 级断言固化为集成测试，并扩展为：
- 每张表 × {own 读 OK ／ 跨用户读（私有表应拒、榜单表应允许）／ own 写 OK ／ 跨用户写 拒}
- 角色 student/teacher/parent/admin 各自**可见集合的精确计数**（如 admin=6, teacher(class-1)=4, parent=1）
- 越权**负例**必须被拒（写他人 `rank_profiles`/`snapshots`）

### 6.2 端到端（用户作用域端点 × 角色）
| 端点 | student 本人 | student 越权(负例) | teacher | parent | admin |
|---|---|---|---|---|---|
| `/api/leaderboard/me`、`/board`、`/profile` | 200 自己 | 看不到他人私有 | — | — | — |
| `/student`、`/student/history`、`/api/ai/history` | 200 自己 | 拿不到他人 session/run | — | — | — |
| `/api/sim/*`(state/actions/advance/event-choice) | 200 自己 run | 改不动他人 run | — | — | — |
| `/teacher` 班级数据 | — | — | 仅本班 | — | 全部 |
| `/parent` 报告 | — | — | — | 仅绑定学生 | 全部 |
| `/admin/users` | — | — | — | — | 全部（注意 `users` 策略，见 §9）|

### 6.3 系统操作（强制后**必须仍工作**）
- `GET /api/cron/recompute-leaderboard`（Bearer CRON_SECRET）→ 给所有 onboarded 用户写 snapshot 成功（走 service）。
- `GET /api/cron/weekly-report` → 跨家庭成功。
- 赛季总榜跨用户读成功；`/api/auth/login`、`/register`、`/guest-upgrade`（无会话引导）成功。

### 6.4 韧性 & 性能
- 故障：`RLS_ENFORCE=on` 且 `fallback=off` → 用户请求 5xx 显式暴露（不静默兜底）；`fallback=on`（离线 demo）行为符合预期。
- 性能：对比 off/on 的 p50/p95（每请求多一次 `BEGIN`+`SET ROLE`+`set_config`）；门槛：增量 **< 15ms p95**、无显著退化。
- 并发：pooler transaction 模式下 `SET LOCAL ROLE` 不串台（每事务独立）——并发压测复核。

## 7. 灰度与回滚
- 合入即 `RLS_ENFORCE=off`（零影响）。
- Staging 全量验证通过 → 生产灰度：**先开只读**用户端点，观察「RLS 拒绝/异常」SLI，再开写端点。
- **回滚**：`RLS_ENFORCE=off`（秒级，无需回滚代码或 DB）。
- 监控：新增「RLS 拒绝/异常」SLI（区别于业务 403），配告警阈值。

## 8. 验收标准（Sign-off）
1. §6.1 自动化 100% 通过（含越权负例）。
2. §6.2 端点矩阵全绿；越权负例全部被拒。
3. §6.3 系统操作全部仍工作。
4. §6.4 性能退化在门槛内；故障行为符合预期。
5. 生产灰度 48h 无异常「RLS 拒绝」告警 → 全量。

## 9. 风险登记
| 风险 | 缓解 |
|---|---|
| 漏标某用户作用域函数仍走 service（该路径 RLS 未覆盖）| 默认 service + 逐端点 opt-in；覆盖度清单评审；负例测试 |
| 误把系统操作标成 scoped → cron/admin/登录挂 | 系统操作显式 `getServiceDb()`；§6.3 必过 |
| 事务化带来连接放大 / 延迟 | §6.4 性能门；必要时只对敏感表 scoped |
| **`users` 仅 own 策略** → admin/teacher 读不到他人基本信息 | 维持 admin 走 service；或补 `users` 的 teacher/admin 读策略（需单独评审，本方案不默认改）|
| `SET LOCAL ROLE` 与 postgres-js 池/预处理交互 | `prepare:false` 已设；Staging 并发压测复核 |
| 登录引导在 claims 之前 | 明确 §2.1：`requireUser` 内部读取走 service，scoped 只在其后注入 |

## 10. 实施阶段（评审通过后）
- **P1**（零影响）：加 `getServiceDb()`/`withUserRls()`/ALS + `RLS_ENFORCE` flag（默认 off）+ 把 §6.1 集成测试落地。合入、CI 绿。
- **P2**：逐端点把用户作用域读路径接 scoped（先 leaderboard / student / ai-history）。
- **P3**：Staging 开 flag，跑 §6 全量矩阵，修正覆盖度。
- **P4**：生产灰度（只读→写）→ 全量；监控 + 回滚预案就位。

---
**评审问题（已拍板）**
1. Staging：**A Supabase 分支** ✅
2. `users`：**不补策略，teacher/admin 读维持 service** ✅
3. 机制：**请求级单事务** ✅

## 11. 测试与交付结论（2026-06-03）

### Supabase staging 分支 — 判定为「本轮不创建」
落地时发现：本项目 Supabase 端 `list_migrations` 为**空**（一直是 push + 直跑 SQL 管理，从未走 Supabase 迁移）。因此 `create_branch`（"apply all migrations from main"）会得到一个**空库**，需经 MCP 全量手工灌 schema+policies+seed；且 MCP **不暴露分支库的 Postgres 密码**，无法把 app/dev-server 指向分支——分支只能做 SQL 级校验，而 SQL 级 RLS 校验本会话已做（15/15）。结论：分支对本次验证**无增量价值且产生真实计费**，改为对**当前 demo Supabase 跑真·全场景 app 实测**（更彻底）。真要做隔离 staging，建议先让 Supabase 端纳入迁移（或用独立 project + `db:migrate`/`db:apply-policies`/`db:seed`）。

### 全场景全仿真实测（4 轮，HTTP 全角色旅程）
覆盖：公开页(/、/learn、/demo、/pricing) + 学生沙盘写循环(action/advance) + 5 个已接 RLS 读端点 + 教师/家长/管理员控制台。

| 轮次 | RLS_ENFORCE | 结果 |
|---|---|---|
| 1–3 | off（交付默认）| **26/26 × 3** 全过 |
| 4 | on（强制）| **26/26** 全过：5 个已接端点在 authenticated 角色下命中真实 DB（无兜底）、其余路径(sim 写/teacher/parent/admin) 经 owner 正常 |

另：unit **328/328**、集成 **11/11**、`tsc`/`lint` 0、DB 级 RLS 断言 **15/15**。

### 待跟进（非本次 RLS 引入）
- **`getTeacherOverview` / `getAdminOverview` 偶发 5s 超时 → 内存兜底**：重查询 + 本地到 us-east-2 高延迟所致，与 RLS 无关（这两个未接 scoped）。生产关兜底时高延迟下可能 503，建议优化这两个查询或调 `DB_QUERY_TIMEOUT_MS`。
