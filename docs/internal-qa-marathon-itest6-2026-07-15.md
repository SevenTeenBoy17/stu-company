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

## 4. 一条推迟项（有意为之，附实现设计）

### P3-5 `[repo.fallback]` SLI 误报 · `src/lib/db/repo.ts:363-373`
- **现状**：写事务里 40+ 处 `throw new Error("中文校验提示")`（领域拒绝，如"本回合已经提交过预测"）与真 DB 故障走同一 catch，被 `logFallback(fn,"query_failed",err)` 记为 DB 故障并触发 `[repo.fallback]` 告警——用户侧无害（错误仍正确冒泡出正确文案、数据安全），但污染 DB 故障 SLI，造成虚假告警。
- **为何推迟**：治本方案是引入 `DomainError` 类 + catch 前置守卫（`if (err instanceof DomainError) throw err`）并改写 40+ 处 throw 点——这是横扫式改动，触碰**核心写兜底不变量**（P2 安全不变量），且由 `repo-fallback.audit`/`repo-logging` 契约测试守护，又叠在用户未提交的 Codex WIP 之上。按 systematic-debugging 的"单一有界改动、审慎横扫重构"纪律，**它应作为独立的 `db_architect` 域改动单独提交**，不宜塞进本轮复验尾巴。
- **精确实现设计（就绪待做）**：
  1. 新增 `class DomainError extends Error`（或 `errors.ts`），领域拒绝改抛 `DomainError`；保留 JSONB malformed / 连接失败为普通 `Error`（它们**应当**告警）。
  2. `withDbExecutor` catch 起始：`if (err instanceof DomainError) throw err;`（不 logFallback、不发 SLI）。
  3. 更新 `repo-logging.test.ts` 契约：领域错误不产生 `[repo.fallback]` 行。

## 5. 全套复验命令输出（真结果）

```
npx tsc --noEmit                    → 0 errors
npm run lint                        → 0 errors, 0 warnings
npx vitest run                      → Test Files 98 passed / Tests 656 passed
npm run build                       → ✓ Compiled successfully
BASE_URL=http://127.0.0.1:8910 node scripts/api-probe.mjs
                                    → 33/33 passed, 0 failed（真 DB 生产服务器）
node scratchpad/login-dos-probe.mjs → PROBE_PASS（攻击者第13次=429 / 受害者跨IP=200 / 攻击者本IP=429）
npx playwright test itest6-quest-nodes.spec.ts       → 1 passed（tested=6 intercepted=0）
npx playwright test itest6-autoinvest-keyboard.spec.ts → 1 passed（Esc-from-option 关闭+焦点归还）
```

## 6. 交付说明

- **本轮修复**：3×P2 全部修复并**用抓 bug 的同法复验**（Playwright/真 HTTP 探针/数值），5×P3 修复 4 项、推迟 1 项（P3-5，附就绪设计）。
- **回归守护新增**：`itest6-quest-nodes.spec.ts`、`itest6-autoinvest-keyboard.spec.ts` 两个针对性 E2E，永久守护本轮两处交互修复。
- **工作树捆绑**：当前工作树同时包含用户未提交的 Codex WIP 与本轮 itest6 修复（共 68 个变更条目），二者作为一个整体通过全部验证。**如何提交/合并（整体一起，还是拆分）请你定夺**（同 PR #17 的处理方式）——我不会擅自提交你的 Codex WIP。
