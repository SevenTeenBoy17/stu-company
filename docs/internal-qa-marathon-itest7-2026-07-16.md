# itest7 · 深度严格全流程内测报告（2026-07-16）

> 需求：**"深度严格的全流程的前端、运维、后端、测试等全面内测并梳理问题"** → 随后 **"全修"**。
> 本轮在 itest6 交付（PR #18）基础上，对 前端/运维/后端/测试 四大面做穷尽审查，梳理问题清单后逐条根因修复。

## 0. 方法

1. **基线确定性**：tsc 0 / lint 0 / vitest 662 / build ✓（当前分支 `feat/itest6-clickthrough-qa`）。
2. **真流程证据**：真 DB 生产服务器 :8910（`ALLOW_MEMORY_FALLBACK=false` + 真 Postgres + `APP_URL` + 生产限流/CSRF/令牌吊销）→ api-probe 33/33、user-journeys 六画像 6/6。
3. **8 维监工深审 + 逐条对抗证伪**（Workflow，25 agents）：前端a11y / 前端正确性 / 后端API认证 / 后端数据仓储 / 运维CICD / 测试覆盖 / 计费安全 / 沙盘理财榜单。
4. **独立交叉核查**（我）：CSRF 覆盖、限流覆盖、P3-5 SLI 全程 0 误报、服务器无 500/未捕获异常。

**监工结论**：14 条确认 / 3 条证伪剔除（去重后 **13 个独立问题**：1 P1 + 3 P2 + 9 P3）。

## 1. 问题清单与修复（全 13 条已修 + 复验）

### 🔴 P1
**[1] 赛季榜全局泄露未成年人真名 + 内部 userId/classroomId** · `api/market/season-leaderboard`
- 证据：活探针（学生登录）返回 `{"userId":"student-2","classroomId":"class-1","name":"周明远",…}`——跨班/跨校真名 + 内部 id，无别名/同意/隐身。是财商战力榜（已用别名+consent+hidden+剥离 userId 硬化）的**未治理孪生体**。
- 修复：① `getSeasonLeaderboard(classroomId)` 用 `innerJoin(users)` 按 viewer **班级作用域**收窄（`repo.ts` + `store.ts` + `buildSeasonLeaderboard` 一致）；② 新增 `PublicSeasonLeaderboardEntry`，route 层**剥离 userId/classroomId**、服务端算 `isViewer`；③ 前端 React key 改 `rank`、自我高亮改 `isViewer`。
- 复验（活服务器 clean build）：条目 keys=`[rank,name,netWorth,disciplineScore,isViewer]`，**leaks userId=False / classroomId=False**。

### 🟠 P2
**[2] `/api/invites/validate` 无限流 + 回传完整邀请对象** · `api/invites/validate`
- 证据：活探针连打 35 次全 200、0 个 429；响应泄露 `createdBy:"admin-1"`/`usesRemaining`/`expiresAt`。匿名枚举预言机 + 内部 id 泄露。
- 修复：加 IP 维度限流（`invite-validate` 30 次/10 分钟，每次消耗）→ 429；回传收窄到 `{valid, role}`。
- 复验：活探针 35 次 → **5×429**；body 仅 `{valid, role}`。

**[3] 登录 DoS 缓解零测试覆盖** · `rate-limit`
- 修复：新增 `login-dos.test.ts`——peek 原语（count<limit true / ==limit false / 不消耗）+ 登录路由行为（攻击者打满 email+IP1→13 次 429；受害者正确密码从 IP2→200；正确密码有历史失败永不 429）。

**[4] ✅ P3-5 守卫漏 `withDb` 外层 direct_supabase 重试路径** · `repo.ts:399`（本会话回归，已修）
- 生产（Supabase pooler）下领域拒绝仍打 `[repo.fallback] retry=direct_supabase` 且整事务跨洋二次执行。外层 catch 补 `if (error instanceof DomainError) throw error;`，+2 pooler 拓扑测试。commit `0d7dbda`。

### 🟡 P3（9）
| # | 修复 | 位置 |
|---|---|---|
| 5 | 主导航补 `role=navigation` 地标 + `aria-current` | platform-layout.tsx |
| 6 | 隐私 radiogroup 补方向键导航 + roving tabindex | rank-onboarding.tsx |
| 7 | 锁定态徽标 `slate-500`(4.36:1)→`slate-600`(≥5.5:1) 过 AA | student-quest-dashboard.tsx |
| 8 | market-board `loadBoard` 请求时序令牌（latest-wins，防慢响应覆盖+卡加载态） | student-market-board.tsx |
| 9 | Cron Bearer 改 `crypto.timingSafeEqual`（新 `cron-auth.ts` 共用）+ `CRON_SECRET` 生产 `.min(32)` | cron/*, env.ts |
| 10 | CSRF `checkOrigin` 四分支单测 + **结构审计**（每个变更路由必调，webhook 白名单） | csrf-checkorigin.test.ts |
| 11 | WRITE_FNS 完整性**结构审计**（写库函数全登记，漏登记 CI 失败；现扫描 0 遗漏） | write-fns-completeness.test.ts |
| 12 | 令牌吊销**行为**测（bump 后旧 tv cookie → 401） | token-revocation.test.ts |
| 13 | 兜底行情 `source="fallback"` 标注链路测（护「教学示意·非真实」徽标） | market-fallback-labeling.test.ts |

### 证伪剔除（3，非缺陷）
auto-invest listbox「竞态」（受控 state）· CI Integration `continue-on-error`（有意非阻塞）· Vercel Cron `maxDuration`（误判）。

## 2. 全套复验（真结果）

```
npx tsc --noEmit          → 0 errors
npm run lint              → 0 errors, 0 warnings
npx vitest run            → Test Files 104 / Tests 679 passed（+17 新用例，5 个新测试文件）
rm -rf .next && npm run build → ✓ Compiled successfully
BASE_URL=:8910 api-probe  → 33/33 passed（真 DB 生产，reseed 后）
活探针 P1：season-leaderboard → keys 无 userId/classroomId，有 isViewer
活探针 P2：invites/validate 35 次 → 5×429，body={valid,role}
```

## 3. 运维踩坑（记录）
- **僵尸服务器占端口**：itest7 期间 :8910 被一个早启的旧构建进程（PID 18812，监听 `0.0.0.0`/`[::]`）长期占用；重启脚本用 `grep "127.0.0.1:8910"` 找 PID **匹配不到** `0.0.0.0:8910` → 每次 restart 撞 EADDRINUSE 静默失败、curl 一直打到旧构建，导致「改了没生效」假象。教训：杀端口用 `grep ":8910"`，重启后必查日志有无 EADDRINUSE。
- **真 DB 状态污染**：同一持久 DB 上反复跑 api-probe，生活账本回合幂等标志累积 → `first=400`；`npm run db:seed` reseed 后 `first=200 second=400` 恢复。非代码回归。

## 4. 交付
- 全 13 条问题**零遗留全修**（含 1 条本会话自身回归 [4]），沿用抓 bug 同法复验（活探针/单测/结构审计）。
- 追加到 `feat/itest6-clickthrough-qa` → [PR #18](https://github.com/SevenTeenBoy17/stu-company/pull/18)。**未擅自合并到 main**（生产部署需用户 go-ahead）。
