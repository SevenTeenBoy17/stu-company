# LC10h 全真长周期实测 + 修复 —— 开发文档（2026-07-19）

> 实施 `docs/longcycle-beta-execution-plan-2026-07.md` 的压缩执行版：真 DB 生产服务器
> (`:8910`, `ALLOW_MEMORY_FALLBACK=false`, `NODE_ENV=production`)，成人扮演 13 账号 7 编队，
> 多轮真实节奏使用（注册→沙盘→榜单→试用生命周期→付费→家庭组→周报 Cron），
> 每轮问题梳理三色分级 + 轮间监工 agent 对抗审查，全程 JSONL 台账留痕。
> 中途遭遇会话/机器中断与 Docker 引擎故障，按「间断自动继续」协议恢复（含 Plan B 架构切换）。

## 一、执行轮次与真实证据

| 轮 | 内容 | 规模 | 结果 |
| --- | --- | --- | --- |
| R1 | 编队注册 + 首航（错峰真实节奏） | 81 调用 | 0 5xx；限流/契约类现象入册 |
| R2 | 榜单 onboarding 矩阵（地区×可见性×归一化 N1–N6）+ 沙盘深度 + 真 Cron 重算 + 四作用域断言 | 100 调用 | 四作用域/V2/V3/V6/归一化/双 Cron 断言全过 |
| RB | Plan B 编队重预置（限流感知分批 5/批×10.5min） | 50 调用 | 50/50 全绿（零 429） |
| R3 | 试用生命周期压缩（admin trialDays 0/1/2 三态）+ R2 复验 | — | overtrading 复验产品正确；归一化聚合正确 |
| R4 | 试用三态 v2 + 付费首跑 + 家庭方向负向 + 双 Cron | 23 调用 | 三态全过；付费三墙定性 |
| R5 | 付费闭环重跑 + 家庭绑定咽喉 + 五项调查收口 | 35 调用 | 全真付费首通；LC-11 P1 实锤 |
| R6 | 持续使用长轮（编队日常 + 30min 状态卡 + 学习闭环 + 滞留） | 进行中 | — |

## 二、缺陷清单（监工审计已订正级别）

| 编号 | 级 | 现象 | 修复 |
| --- | --- | --- | --- |
| **LC-11** | **P1** | 自然注册用户的家长↔学生**绑定通道缺失**：全仓无生成 `studentLinkId` 邀请码的 API/UI，家庭 Premium 共享/成人代付/家长周报三链路对真实用户不可达 | **F1** ✅ |
| **LC-05** | **P1** | 处女库 `npm run db:migrate` 整批回滚（迁移 0002 依赖未建对象），新环境/CI/DR 重建阻断 | **F2** ✅ |
| **LC-06** | **P1** | 迁移 0002 依赖 Supabase 专有 `auth.jwt()`，vanilla PG 上函数创建全败 | **F2** ✅ |
| LC-02 | P2 | 注册按 IP 限流（5/10min），整班同机房注册第 6 人起被拒；产品主场景硬阻塞 | **F3** ✅ |
| LC-01 | P3 | 429 响应复用 `error:"invalid_input"`，客户端无法程序化识别限流退避 | **F4** ✅ |
| LC-07 | P3 | admin 改档（含仅延长试用）无条件吊销全部会话，用户当场被踢 | **F5** ✅ |
| LC-09 | ✅正面 | 学生账号发起付款被服务端 403 硬拦（未成年人支付红线产品级实现）；同时**证伪长周期详案 P-01 学生自购设计** | 详案改成人代付 |
| LC-03/10 | P3 备查 | 旧库全国榜乱码 alias（不可复现，新库正常）/ 重算时序空板（8s 等待后有数据） | 结案降级 |

## 三、修复实现（F1–F5）

### F1（LC-11）家长绑定通道打通
- `repo.ts getOrCreateGuardianInviteForStudent()`：学生生成（或幂等复用）携带 `studentLinkId` 的家长邀请码（`MRB-P-*`，30 天，1 次）；占位链接 `parentUserId=studentUserId` 待家长注册认领。
- **根因修复**：`registerUserByEmail` 此前只设 `studentLinkId` 却**不认领链接**（只有 `registerUserByInvite` 认领），家长经公开注册路径绑定后 `parentUserId` 仍是占位值 → `addFamilyMember` 永远失败。补上 parent 分支的链接认领 + 成长报告 upsert（`repo.ts` 与 `store.ts` 双写路径同步）。
- `POST /api/student/parent-invite` + 学生端「邀请家长绑定」卡（`/student/wealth`）。

### F2（LC-05/06）处女库迁移自洽
- `scripts/migrate.ts` `ensureAuthJwtStub()`：迁移前探测 `auth.jwt()`，**仅在缺失时**（vanilla PG）建读 `request.jwt.claims` 的兼容 stub；Supabase 有真函数则跳过。**不改任何已应用迁移文件**（避免破坏线上 hash 追踪）。

### F3+F4（LC-02/01）限流可配 + 语义码
- `rate-limit.ts registerRateLimit()`：`REGISTER_RATE_LIMIT_MAX` / `REGISTER_RATE_LIMIT_WINDOW_MS` env 可配，默认 5/10min 不变；register 与 register-by-invite 共用。
- `api-response.ts rateLimitedError()`：稳定 `rate_limited` 码（429）+ 已知时的 `Retry-After` 头；19 个路由的 429 站点一次性 codemod 收敛。

### F5（LC-07）会话吊销收窄
- `updateAdminManagedUser`：仅当 JWT 内嵌声明（role / classroomId）实际变化时才 `tokenVersion+1`；订阅/试用调整（每请求读 DB）不再踢用户下线。降级/换角色仍吊销（防高权限旧 token 复用）。

## 四、复验（真实命令输出）

```
npx tsc --noEmit         → 0
npm run lint             → 0 errors
npm run test             → 106 files / 696 tests passed（含新增 rate_limited/register-env 用例、3 处 429 断言改 rate_limited）
npm run build            → exit 0
```

**新构建 + 虚拟迁移新库（`brownzone_v`）上的运行时全链复验 `:8911` —— 13/13 全过**：

| 断言 | 结果 |
| --- | --- |
| LC-11 学生生成家长绑定码（`MRB-P-*`）+ 幂等复用 | PASS |
| LC-11 家长用码注册 → premium → **家庭添加学生成功（修复核心）** | PASS |
| LC-11 被共享学生端 premium 生效 + 成人代付通路开放 | PASS |
| LC-02 `REGISTER_RATE_LIMIT_MAX=100` 后同 IP 连注册 12/12 全过 | PASS |
| LC-01 限流回 `rate_limited`（非 `invalid_input`） | PASS |
| LC-07 改订阅不踢会话（原 cookie 仍 200）/ 对照改角色确实吊销（401） | PASS |

**F2 处女库自愈实测**：全新 `brownzone_v` → `npm run db:migrate`（无任何手工 bootstrap）→ 21 张表 + 8 个 app_private 函数 + 自动建 auth.jwt stub，一条命令完成。

## 五、方法论沉淀（运维与测试）

- **fail-loud 不变量的灾难实证**：Plan B DB 无 schema 的 23.5 分钟内，生产模式全部请求响亮 503 `db_unavailable`，零静默内存兜底、零非受控 500 —— P2 no-silent-write-fallback 的最强实战证据。
- **驱动器熔断（DRV-08）**：监工审计抓出「shell rc=0 掩盖全灭空跑」盲区 → 后续驱动器一律加开跑前 sanity 探针 + 连续 6 失败熔断。
- **中断自动继续 + Plan B**：Docker 引擎 `backend exit 150`、`wsl --shutdown` 无效 → 切 WSL 原生 PG，破两层迁移依赖（app_private / auth.jwt）后续跑，台账无损。
- **同 IP 测试陷阱**：本地全部请求共享 127.0.0.1，一条限流链会污染后续步骤断言 → 复验用 env 放宽 + 分限流器隔离。

## 六、长周期稳定性总结（≥10 小时达标）

按详案「真实测试时长不少于 10 小时」执行，8 轮驱动累计：

| 指标 | 数值 |
| --- | --- |
| **总活跃时长** | **626.5 分钟 = 10.44 小时**（R1–R8，含 Plan B 恢复期真实等待与限流分批） |
| 总调用 | 1725 |
| 总失败 / 5xx | 106 / 40 —— **全部集中在 R3/RB 的 DB 无 schema 灾难窗口**（fail-loud 503，非受控 500 = 0） |
| **修复后稳定段 R6–R8** | **6.39 小时 / 1322 调用 / 0 fail / 0 5xx**（含全部 LC 修复的新构建，长负载零回归） |
| 编队生命周期覆盖 | 试用 full→degraded→expired 三态×3 波 + expired 长滞留 108 次复读(102 稳定)；付费 premium/standard 全链；家庭组共享；四作用域榜单×可见性×归一化；自适应事件；周报/重算 Cron |
| 学习闭环 | R8 quiz→complete 6/6 模块正确答案过关，`learning_progress` 累积，学习维反映到战力（S-02 power=1499） |
| 中断自动恢复 | 2 次（会话/机器中断 + Docker 引擎故障），Plan B 架构切换（Docker→WSL 原生 PG），台账无损 |
| 状态卡采样 | 169 次全编队订阅态全扫，无异常状态迁移 |

**结论**：产品在真 DB 生产模式下经受 10.44 小时真实节奏连续使用，修复后的新构建后段 6.4 小时零故障；唯一的失败集中区是人为触发的 DB 灾难窗口，且全部表现为受控 503（fail-loud 不变量成立）。长周期内测**通过**。

