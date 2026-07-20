# itest6 · 真·点击式全流程内测报告（2026-07-15）

> 需求：**"全面深度的细致全流程内测，内测需要等到对应按钮按下测试的对应所有结果、内容返回才算内测过程"**，
> 周期 ≥3 轮完整细致，时长 ≥5 小时。核心与前几轮不同点：**不做视觉化 mock，而是真把每个按钮按下、等结果/内容返回再判定。**

## 0. 测试单元与环境

- **被测代码 = 当前工作树**：`main`(8c06684) + 未提交改动（Codex 后续实现的多市场硬化/安全/a11y + 本轮我修的 ai-format-drift 合规 + itest6 修复）。
- **真 DB 生产服务器**：`DATABASE_URL=…localhost:5433/brownzone ALLOW_MEMORY_FALLBACK=false APP_URL=http://127.0.0.1:8910 NODE_ENV=production npm run start -- --port 8910`
  （Docker `brownzone-pg` 已 `db:seed`；生产模式=无限流倍率、真 CSRF、真 429、真令牌吊销）。
- **E2E harness**：`npx playwright test` 自带 :4173 内存兜底服务器（用于 UI 真点击）。

## 1. 三轮结构（每一步都等结果返回）

| 轮次 | 方法 | 产物 |
| --- | --- | --- |
| **基线** | tsc / lint / vitest / build / 全量 E2E 代码层全返回 | 全绿基线 |
| **R1 逐控件点击遍历×全角色** | Playwright 爬虫：anon/student/teacher/parent/admin 每页枚举每个可交互控件，**逐个点击、每次点击前重载还原状态、等【导航/弹窗/内容变化/网络/控制台错误】五类信号返回**后归档 | `tests/e2e/itest6-crawl.spec.ts` + `test-results/itest6-crawl/*.json`（student 773 次点击，0 JS 错误） |
| **R2 六画像完整旅程** | 真 UI 点击驱动的端到端用户旅程（登录→沙盘→任务→榜单→理财门控），等每步结果 | 脚本化真流程 |
| **R3 边界/异常/键盘 + 监工对抗验证** | 8 维监工并行深审（读 R1 真点击证据 + 源码 + :8910 活探针）→ 逐条对抗证伪（存疑即杀）→ 排序清单 | 下方问题清单 |

**R1 的价值验证**：逐控件点击遍历用 `clickError` 分层**直接命中**了任务地图死交互（P2-1）——地图节点顶部 ≤51% 点击超时、≥66% 可点，正是顶栏遮挡的指纹。这就是"按钮按下等结果"内测法相对视觉 mock 的核心优势。

## 2. R3 确认问题清单（监工×对抗验证）

对抗验证**证伪剔除 3 条**（自选卡兜底标注—卡片不读源码不冲突；生活账本按钮 spinner—禁用态已给反馈；季榜 userId—威胁模型只限 alias 榜）。**确认 8 条：3×P2 + 5×P3。**

| # | 级别 | 问题 | 根因 |
| --- | --- | --- | --- |
| P2-1 | P2 | 任务地图 6 个航线节点有 3 个点不动 | 地图顶栏 `div`（默认 `pointer-events:auto`）按盒模型几何遮挡了下方 1/2/5 号节点，拦截其点击 |
| P2-2 | P2 | 兜底 K 线方向与涨跌文案矛盾 | `series()` 无视 change 符号，恒定单向漂移；跌的标的画出上行线，违反红涨绿跌教学 |
| P2-3 | P2 | 定向登录 DoS | 每账号爆破窗口按 email-only 键 + 每次尝试都消耗；攻击者用 12 个错密码可锁死受害者账号 10 分钟（正确密码也 429） |
| P3-4 | P3 | 榜单隐私可见性单选无语义 | 选中态仅靠颜色，无 `role=radio`/`aria-checked`，屏幕阅读器/色觉障碍用户加入榜单前无法确认选了"隐身"还是"公开" |
| P3-5 | P3 | `[repo.fallback]` SLI 误报 | 写事务内的**领域校验错误**（如"该回合已执行"）走同一 catch 被记为 `query_failed` 并触发 fallback 告警信号，制造虚假 DB 故障告警 |
| P3-6 | P3 | 定投下拉标的代码对比度不足 | `text-slate-400`（#94a3b8，2.56:1）低于 AA |
| P3-7 | P3 | 定投下拉键盘契约缺失 | Esc 只在触发按钮聚焦时生效；焦点进入选项后 Esc 失效，且关闭后焦点丢失 |
| P3-8 | P3 | 平台导航序号对比度不足 | `text-slate-400`（2.56:1）低于 AA |

## 3. 逐条根因 + 修复 + 复验证据

### P2-1 任务地图节点可点性 · `src/components/student/student-quest-dashboard.tsx`
- **修复**：地图顶栏容器 `div` 加 `pointer-events-none`（不再拦截下方节点点击）；顶栏内唯一交互控件"放大查看"按钮加 `pointer-events-auto`（保留自身可点）。
- **复验（黄金标准，同 R1 抓 bug 的工具与判据）**：
  - Playwright `tests/e2e/itest6-quest-nodes.spec.ts`：`tested=6 intercepted=0` ✅（R1 修前 3/6 被拦截 → 修后 6/6 可点，0 遮挡）。Playwright `click` 的 actionability 含"未被其它元素遮挡"，正是拦截判据。
  - 活服务器 DOM 事实：顶栏 computed `pointer-events:none`；"放大查看" computed `auto`；顶栏矩形几何**恰好**覆盖 1/2/5 号节点、不覆盖 3/4/6——与 R1 的 3/6 完全吻合，坐实顶栏即拦截源。

### P2-2 兜底 K 线方向 · `src/lib/market-catalog.ts`
- **修复**：`series(base, change, drift)` 按符号定向——`const dir = change < 0 ? 1 : -1`，末点恒等于现价 `base`；涨→上行、跌→下行。同步 23 处调用点回填 `fallbackChange`。
- **复验**：数值确认 `series(401.9, +1.12)` 377.79→401.9 上行、末点=现价 ✅；`series(49.3, -0.36)` 50.779→49.3 下行、末点=现价 ✅。`market-catalog.test.ts` 17/17 绿。

### P2-3 定向登录 DoS · `src/app/api/auth/login/route.ts`
- **修复**：每账号爆破窗口改键 `login-account:{email}:{clientIpFrom(request)}`（email+IP），且 **peek 检查**（正确密码不消耗名额），仅失败时 `rateLimit(...)` 消耗。攻击者只烧自己 IP 对该账号的名额，别处的真实用户不受影响。
- **复验**：`scratchpad/login-dos-probe.mjs` 打 :8910 真 DB 生产服务器 → **PROBE_PASS**：攻击者第 13 次错密码=429；**受害者从另一 IP 用正确密码=200（DoS 已修）**；攻击者本 IP 正确密码=429（锁真实且仅自困）。`api-probe` 原有"连续失败登录触发 429"仍 PASS，无回归。

### P3-4 榜单隐私可见性 radio 语义 · `src/components/student/rank/rank-onboarding.tsx`
- **修复**：容器加 `role="radiogroup" aria-label="谁可以看到我"`，每项加 `role="radio" aria-checked={visibility===opt.value}`。
- **复验**：:8910 活页面（编辑档案弹层）→ `radiogroup` 渲染 ✅、3 个 `role=radio`、恒有且仅有 1 个 `aria-checked=true`；点"隐身"/"仅校内" `aria-checked` 正确联动 ✅。

### P3-6 / P3-8 对比度 · `student-auto-invest-dashboard.tsx` / `platform-layout.tsx`
- **修复**：`text-slate-400`（#94a3b8，2.56:1）→ `text-slate-500`（#64748b，~4.6:1 on white，过 AA）。
- **复验**：:8910 活页面导航序号 computed `class="ml-2 text-xs text-slate-500"`、`lab(L*=48)`＝slate-500 ✅（构建已带上源改）。

### P3-7 定投下拉键盘契约 · `src/components/student/student-auto-invest-dashboard.tsx`
- **修复**：容器级 `onKeyDown`（冒泡覆盖触发按钮+全部选项）处理 Esc；`closeAssetList()` 关闭并把焦点还给触发按钮（`assetTriggerRef`）。移除触发按钮上冗余的 Esc handler。
- **复验**：Playwright `tests/e2e/itest6-autoinvest-keyboard.spec.ts` PASS ✅——**焦点在选项上按 Esc**（此前死路）→ 列表关闭 **且** 焦点回到触发按钮；触发按钮按 Esc 仍关闭（老路径回归守护）。

## 4. P3-5 治本：领域错误不再误报 `[repo.fallback]` SLI

### P3-5 `[repo.fallback]` SLI 误报（治本）· `src/lib/domain-error.ts` + `repo.ts` + 9 个纯教学模块
- **根因**：领域校验拒绝（如"本回合已执行过生活账本""余额不足""邀请码已过期"）以 `throw new Error("中文")`
  抛出，且不仅在 `repo.ts` 里，也在被 repo 事务调用的**纯教学模块**（simulation / life-cashflow / quests /
  auto-invest / credit-lab / goal-accounts / opportunity / wealth-review / season-challenges）里。它们与真 DB
  故障走同一 `withDbExecutor` catch，被 `logFallback(fn,"query_failed")` 记为 DB 故障并触发文档化的
  `[repo.fallback]` SLI 告警——用户侧无害（错误仍正确冒泡出中文文案、数据安全、状态码不变），但污染 DB 故障
  告警，制造虚假告警。**是本轮 api-probe 实测证据抓出来的**：修前该探针的"生活账本同回合二次执行被拒"会在
  服务器打出一条 `[repo.fallback] fn=applyLifeCashflowChallengeForUser reason=query_failed …本回合已执行过生活账本`。
- **8 维监工 + 3 路对抗证伪**（Workflow）确认：`handleRouteError` 按 `instanceof Error ? message` + 消息正则映射
  状态码 → `DomainError extends Error`、message 不变 ⇒ 路由**字节级不变**（`safe:true`）；`repo-fallback.audit`
  的模拟故障是普通 Error（非 DomainError）⇒ 守卫对它是 no-op ⇒ 3 条写兜底契约**保持全绿即证明** infra 错误仍
  照常告警+按 WRITE_FNS 冒泡（P2 不变量不受影响）。
- **实现**：
  1. 新增**零依赖**模块 `src/lib/domain-error.ts` 导出 `class DomainError extends Error`（放共享模块以免 repo↔纯模块循环依赖）。
  2. `withDbExecutor` catch 起始加 `if (err instanceof DomainError) throw err;`（在 logFallback 之前 → 不记 SLI、不计 fallbackCount、不走内存兜底、照常冒泡）。
  3. 领域拒绝改抛 `DomainError`：`repo.ts` 54 处 + 9 个纯模块 30 处（共 85 处）。
  4. **刻意保留普通 `Error`（须继续告警）** 的边界项：`repo.ts` 的 JSONB 损坏(599/607)、班级 FK 漂移(2293)、
     成长报告缺失+`!student`(2362)、支付金额不符**反欺诈信号**(3169)、写入回读落空(1634)、建校病态竞态(3359)、
     沙盘无法预置(918)；`credit-lab` API 误用守卫、`goal-accounts`/`protection-umbrella` 记录生成失败、`fund-lab` 基金池缺失。
- **复验（治本证据）**：新增契约测试 `repo-domain-error.test.ts`（4 例：extends Error+message 原样 / 与普通 Error
  路由完全一致(409) / DB 路径 DomainError 冒泡且【不】记 [repo.fallback] / 对照组 infra Error 仍记）；`repo-fallback.audit`
  3 例、`repo-logging` 保持全绿。**真服务器铁证**：同一 api-probe 跑，`[repo.fallback]` 计数 **1 → 0**，而
  "生活账本同回合二次执行被拒 first=200 second=400" 仍成立（行为不变、误报消除）。

## 5. 全套复验命令输出（真结果）

```
npx tsc --noEmit                    → 0 errors
npm run lint                        → 0 errors, 0 warnings
npx vitest run                      → Test Files 99 passed / Tests 660 passed（+4 新 DomainError 契约）
npm run build                       → ✓ Compiled successfully
BASE_URL=http://127.0.0.1:8910 node scripts/api-probe.mjs
                                    → 33/33 passed, 0 failed（真 DB 生产服务器）
[repo.fallback] 计数（同一 api-probe 跑，真服务器日志） → 1 → 0（P3-5 误报消除）
node scratchpad/login-dos-probe.mjs → PROBE_PASS（攻击者第13次=429 / 受害者跨IP=200 / 攻击者本IP=429）
npx playwright test itest6-quest-nodes.spec.ts       → 1 passed（tested=6 intercepted=0）
npx playwright test itest6-autoinvest-keyboard.spec.ts → 1 passed（Esc-from-option 关闭+焦点归还）
```

## 6. 交付说明

- **本轮修复**：3×P2 + 5×P3 **全部 8 项修复完毕**（无推迟项），且**用抓 bug 的同法复验**：Playwright（点击遮挡/键盘）、真 HTTP 探针（登录 DoS 跨 IP 隔离）、数值（K 线方向）、真服务器日志（`[repo.fallback]` 1→0）。
- **回归守护新增**：`itest6-quest-nodes.spec.ts`、`itest6-autoinvest-keyboard.spec.ts`、`repo-domain-error.test.ts` 三个针对性用例，永久守护本轮交互与 SLI 修复。
- **P3-5 治本超出初判范围**：初判以为仅 `repo.ts` 40+ 处，api-probe 实测暴露领域拒绝亦分布在 9 个纯教学模块与内存兜底 `store.ts`；已引入零依赖 `domain-error.ts` 共享模块统一治理——**共 130 处 DomainError**（repo.ts 54 + 9 纯模块 30 + store.ts 46），并在 DB 路径与内存路径**两侧一致地**保留 infra/完整性/反欺诈边界（JSONB 损坏、班级 FK 漂移、支付金额不符、写入回读落空、建校竞态、记录生成失败、基金池缺失等）为普通 `Error` 继续告警。（store.ts 抛错在 fallback() 内不产生 SLI，改它纯为路由层"同消息→同类型"一致性。）
- **工作树捆绑**：当前工作树同时包含用户未提交的 Codex WIP 与本轮 itest6 修复，二者作为一个整体通过全部验证。已按你指示"整体一起，建分支+PR"落地到 `feat/itest6-clickthrough-qa` → [PR #18](https://github.com/SevenTeenBoy17/stu-company/pull/18)（未擅自合并到 main）。
