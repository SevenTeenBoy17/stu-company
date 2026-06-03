# 审计报告 · `src/lib/db/repo.ts`（R1 旗舰 · 反真视角）

> 范围：2531 行的仓库层（API 唯一数据桥）。审计聚焦「AI 生成常见问题」：错误处理不全、权限检查缺失、性能隐患、监控/日志缺位、隐私。所有结论均带 `file:line` 证据。
> 配套失败优先测试：`src/lib/db/repo-fallback.audit.test.ts`（已验证，2 passed）。

## 0. 执行摘要

| # | 等级 | 风险 | 证据 | 教育场景影响 |
|---|---|---|---|---|
| F1 | 🔴 高 | 写操作静默落回内存 → 数据丢失 | `repo.ts:164-172` + `:113-114` | 学生交易/进度「假成功」，重启即丢；DB 与内存源静默分叉 |
| F2 | 🟠 中 | 查询超时不取消底层 query | `repo.ts:122-140` | 课堂 30 人并发下慢 DB → 重复写 + 连接池耗尽 |
| F3 | 🟠 中 | 租户作用域不一致（部分函数无 ownership 过滤） | `repo.ts:927`(无) vs `:933`(有) | 路由漏检 + owner 连接绕过 RLS → 跨班级/学生越权读 |
| F4 | 🟠 中 | 兜底仅 `console.warn`、无指标/告警；`no_database_url` 永不记录 | `repo.ts:116-119` | 误配生产（缺 DATABASE_URL + 兜底误开）→ 全平台跑临时内存、全员数据重启即丢，**零告警** |
| F5 | 🟡 低 | 兜底日志无限流 | `repo.ts:118` | 持续 DB 故障 → 日志洪泛、淹没告警 |
| F6 | 🟡 低 | 兜底日志直接打印原始 `err`（含查询参数/PII） | `repo.ts:118,167` | 学生邮箱/会话等敏感字段可能进日志 |

## 1. 详细风险与影响

### F1 🔴 写操作静默落回内存 → 静默数据丢失
`withDb` 的 `catch` 分支（`repo.ts:164-172`）对**所有**函数（含 `applyActionForUser`、`upsertLeaderboardSnapshot` 等写）施加同一套「DB 失败 → 落回 `store` 内存」。门控 `ALLOW_MEMORY_FALLBACK`（`:113-114`）在 `NODE_ENV !== "production"` 时**默认开启**。
- 读兜底是合理的（离线演示显示种子数据）；**写兜底是危险的** —— 失败的写「成功」进了内存，DB 从未收到。下一个请求（新 serverless 实例 / 内存重置）就丢了，且 DB 与内存源**静默分叉**。
- 生产（`NODE_ENV=production`）默认关闭兜底 → 写失败抛 5xx（**正确**）。风险面：(a) 误以 `NODE_ENV != production` 部署；(b) 生产手滑设 `ALLOW_MEMORY_FALLBACK=true`；(c) 开发期掩盖真实写 bug（看起来绿）。
- **教育影响**：学生一笔交易/一次进度更新「成功」提示，实则没落库；隔天/换设备数据不见 → 信任崩塌。

### F2 🟠 查询超时不取消底层 query
`withQueryTimeout`（`:122-140`）用 `Promise.race` 实现超时，但超时只是 reject 了竞速 promise，**底层 DB 查询仍在运行**：连接被占住，且可能在兜底已执行后才提交 → **双写 / 竞态**。
- **教育影响**：课堂同时段 30+ 学生并发推进回合，慢 DB 触发超时 → 既落了 DB 又落了内存（双写），或连接池被未取消的查询耗尽 → 雪崩。

### F3 🟠 租户作用域不一致
`getRunForUser(userId)`（`:933`）按 `userId` 收敛 ✅；但 `getClassroomById(classroomId)`（`:927`）接收裸 id、**无 ownership 过滤**，完全依赖「路由 + RLS」兜底。而默认 `owner` 连接**绕过 RLS**（`CLAUDE.md` / `client.ts:8-13`）。任一路由漏写 `where userId=` → 跨租户读。
- **教育影响**：构造请求读到别的班级/学生数据（隐私违规，未成年人数据尤其敏感）。

### F4 🟠 监控/日志缺位
`logFallback`（`:116-119`）只 `console.warn`，无结构化指标/告警；且 `reason === "no_database_url"` **永不记录**（`:117`）。误配生产（缺 `DATABASE_URL` + 兜底误开）→ 全平台静默跑临时内存、**零信号**。
- **教育影响**：学校自部署忘配库 → 全员数据重启即丢，无人察觉，直到家长投诉。

### F5/F6 🟡 日志洪泛 + PII 泄漏
持续故障下 `logFallback` 无限流（`:118`）→ 日志洪泛淹没真告警；且直接打印原始 `err`（`:167→:118`），错误对象可能含查询参数（学生邮箱、会话 id）。

## 2. 修复建议（重构片段）

### 修 F1 —— 读/写兜底分离（写永不静默落回）
```ts
type DbMode = "read" | "write";
async function withDb<T>(fn: string, mode: DbMode, dbFn: (db: Db) => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  // ...configured / client checks...
  try {
    return await withQueryTimeout(fn, dbFn(db));
  } catch (err) {
    logFallback(fn, "query_failed", err);
    // 写操作永不静默落回：失败必须 surface，避免「假成功 + 数据丢失」。
    if (mode === "write" || !ALLOW_MEMORY_FALLBACK) throw err;
    return await fallback(); // 仅读操作、且显式允许时才兜底
  }
}
// 调用点：写函数传 "write"（applyActionForUser / upsert* / create*），读传 "read"。
```

### 修 F2 —— 真正可取消的超时（驱动层）
```ts
// 用 postgres.js 的 AbortSignal / 或在连接上设 statement_timeout，确保超时即取消底层查询。
const controller = new AbortController();
const t = setTimeout(() => controller.abort(), DB_QUERY_TIMEOUT_MS);
try { return await dbFn(db, controller.signal); } finally { clearTimeout(t); }
// 同时给连接设 SET LOCAL statement_timeout 作为第二道防线。
```

### 修 F3 —— ownership 收敛进仓库层
```ts
export async function getClassroomById(classroomId: string, viewer: { id: string; role: Role; classroomId?: string }) {
  // 应用层防线（owner 连接绕过 RLS，这里是主防线）：非 admin 只能读自己班级。
  if (viewer.role !== "admin" && viewer.classroomId !== classroomId) {
    throw new Error("forbidden: cross-classroom read");
  }
  return withDb("getClassroomById", "read", (db) => selectClassroomById(db, classroomId), () => store.getClassroomById(classroomId));
}
```

### 修 F4/F5/F6 —— 结构化指标 + 限流 + 脱敏
```ts
let lastFallbackLog = 0;
function logFallback(fn: string, reason: FallbackReason, err?: unknown) {
  metrics.increment("repo.fallback", { fn, reason });           // ← SLI：降级模式可观测
  const now = clock.now();                                       // 注入时钟（确定性）
  if (now - lastFallbackLog < 5000) return;                     // 限流：5s 一条，防洪泛
  lastFallbackLog = now;
  console.warn(`[repo] ${fn} -> fallback (${reason})`, scrubError(err)); // 脱敏：去掉查询参数/PII
  // no_database_url 至少记一次（misconfig 可发现），后续静默
}
```

## 3. 反真测试（失败优先 · 已落地）
`src/lib/db/repo-fallback.audit.test.ts`（**已验证 2 passed**）—— 用 `vi.mock("@/lib/db/client")` 让 DB「已配置但 query 必炸」+ `vi.stubEnv`/`vi.resetModules` 重载模块：
- 钉死 **F1 生产契约**：`NODE_ENV=production` + 兜底关 → `findUserById` **RE-THROWS**（不静默落回）。
- 钉死**离线兜底**：`NODE_ENV=test` → 落回 store（不抛）。

> 任何「重新放宽静默兜底」的回归都会让该测试失败。后续 F2/F3 的反真测试需真 Postgres（集成层）：F3 用 `set local role authenticated` 证伪跨租户读；F2 用并发 + 注入延迟证伪双写。

## 4. 可落地优化（性能 / 监控 / 日志 / 隐私）
- **性能**：连接层 `statement_timeout` + 可取消查询（F2）；为高频读（`getRunForUser`/榜单）加请求级缓存或 `DataLoader` 合批，降回合推进的 N+1。
- **监控埋点**：`repo.fallback{fn,reason}` 计数器作为「降级模式」SLI；`repo.query.duration` 直方图（p95/p99）；超时计数 → 告警阈值。
- **日志**：兜底日志限流 + 结构化（JSON：fn/reason/duration），接 Vercel/Sentry。
- **隐私增强**：`scrubError` 去除错误中的查询参数/邮箱/token；确保兜底与 DB 路径的租户过滤**逐字段对等**（F3 集成测试交叉校验）。
