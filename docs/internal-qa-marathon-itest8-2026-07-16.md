# itest8 · 深度对抗内测报告（2026-07-16）

> 在 itest5/6/7 交付（PR #18）之上再深一层。刻意换角度：**攻我自己 itest7 的新代码 + 之前较少深挖的并发/幂等、DB-RLS-迁移、性能、计费状态机、错误边界、移动 i18n、AI 安全。**

## 0. 方法
- 8 维监工 Workflow（读源码 + 活探针）× 逐条对抗证伪 → **8 确认 / 5 证伪**。
- **我的独立实测**（代码审查证不了的）：真并发双花探针、畸形输入模糊测试、DomainError 覆盖全量 grep。

## 1. 我的独立实测结论（补充监工）
- **并发/双花**：生活账本同回合并发 `{200:1,400:5}` 幂等✓；推进回合并发 delta=6 但 `SELECT FOR UPDATE` 行锁保证无损坏(仅可重复,P3 去抖,非双花)；→ 写操作在并发下**抗损坏**。
- **畸形输入模糊**：SQL/NoSQL 注入、路径穿越、超大值、非 JSON 共 13 例 → 全 `400 {error,message}`、**0 个 500**、无形状异常 → 入参校验健壮。
- **DomainError 覆盖**：残留 `throw new Error(中文)` 全是有意保留的 infra/anomaly 守卫 → P3-5 治理无遗漏。

## 2. 监工确认 8 条 → 全修 + 复验

### 🔴 P1
**新生并发首屏创建重复 scenario_run** · `repo.ts` + `schema.ts` + `drizzle/0021`
- 根因：`user_id` 只有非唯一索引；`ensureStudentSandbox` 无锁 check-then-insert，`onConflictDoNothing()`（空目标）只对随机主键生效、永不冲突；`/student/market` 的 `Promise.all[getSimulationStateForUser, getPeerHeatForStudent]` 两独立事务并发 → 同一 user 两条 run（`limit(1)` 无序读写命中不同行=丢单/进度回退、赛季榜同名重复上榜、永久损坏）。
- 修复：① 新迁移 `0021_scenario_run_user_unique` 给 `scenario_runs.user_id` 加**唯一索引**（一名学生恒定一条 run，赛季重玩是原地重置同 row）；② `ensureStudentSandbox` 改 `onConflictDoNothing({ target: scenarioRuns.userId })` + re-select。
- **复验（活服务器铁证）**：删除 student-1 的 run → 并发打 **8 次** `/sim/state` → `scenario_runs` 该 user **恰好 1 条**（修前会建出多条）。

### 🟠 P2
**畸形 JSON 泄露 V8 英文 SyntaxError（22 路由）** · `api-response.ts`
- 根因：`schema.parse(await request.json())` 对非法 JSON 抛 V8 `SyntaxError`，handleRouteError 无对应分支 → 落默认把英文原生错误+回显输入返给（含匿名 auth）客户端，违反「中文错误文案」+ 轻度信息泄露。
- 修复：handleRouteError 加 `if (error instanceof SyntaxError)` 分支 → 中文 `invalid_input`，**一处修全 22 路由**。+ 单测。
- **复验**：活探针 `POST /api/sim/actions -d 'not json {{{'` → `{"error":"invalid_input","message":"请求格式不正确，请检查后重试。"}`。

### 🟡 P3（6）
| # | 修复 | 位置 |
|---|---|---|
| 3 | 赛季榜隐身文案收窄：「不进入任何榜单」→「不进入财商战力榜（跨校/省/市）」（班级记分牌同班本就互见） | rank-onboarding.tsx |
| 4 | 我的 CSRF 结构审计从 `includes("checkOrigin")`(import 亦命中)改匹配调用 `checkOrigin(` | csrf-checkorigin.test.ts |
| 5 | `profiles` / `ai_messages` 有 RLS 策略但漏 `enable row level security`（策略惰性、authenticated 可读全表）→ 补 enable | policies.sql |
| 6 | `auth/onboarding` 缺 try/catch（首次执行抛出返 500 裸栈）→ 包 handleRouteError | onboarding/route.ts |
| 7 | `getParentOverview` 成长报告「暂不可用」用普通 Error 误发 `[repo.fallback]` SLI → 改 DomainError | repo.ts |
| 8 | 首页股票跑马灯兜底免责标注 `hidden…lg:flex` → 移动端看不到「教学观察池模式」；fallback 时强制全视口可见 | stock-ticker-tape.tsx |

### 证伪剔除（5，非缺陷）
addFamilyMember 唯一约束(有 DB 约束)、risk_profiles/round_predictions/card_collection 在 RLS 外(repo 层为主防御)、战力榜全表扫(已分片/分页)、recomputePowerForUser 3× SELECT、recomputeAllRankedUsers O(N) cron(cron 可长跑)。

## 3. 全套复验（真结果）
```
tsc 0 · lint 0/0 · vitest 681/681（+SyntaxError 单测）· clean build ✓
api-probe 33/33（真 DB reseed）· fuzz 13 例 FUZZ_PASS（0×500）
P1 活证：删 run→8 并发 /sim/state→恰好 1 条 run
P2 活证：畸形 JSON→中文 invalid_input
迁移 0021 已 apply（scenario_runs_user_id_key 唯一索引在库）
```

## 4. 待跟进（低优先）
- 推进回合并发去抖（P3，FOR UPDATE 已防损坏，仅快速双击跳回合）。
- P1 并发的集成测试（当前以 DB 唯一约束为硬保证 + 活服务器 8 并发实证）。
- 生产若已有重复 run，迁移 0021 会 unique_violation 失败（故意不自动删数据）——需先手动去重。
