# 内测全场景测试 — 问题汇总与解决路线（2026-06-05）

> 方法：6 个专项 agent 并行对运行中的应用（`http://localhost:3000` + 本地 Postgres :5433 已 seed）做只读内测：
> **API Tester**（49 条接口功能）· **Evidence Collector**（全角色 E2E + 截图）· **Reality Checker**（质量门禁）·
> **Accessibility Auditor**（WCAG 2.1 AA）· **Security Engineer**（鉴权/越权/CSRF/限流/密钥）· **Code Reviewer**（本次改动 diff）。
> 本文档为 **review 用**，未改任何业务代码。截图在 `C:\Users\nuoya\AppData\Local\Temp\bz-internal-test\`。

## 总体结论

- **核心链路全部跑通**：注册/登录/四角色工作台/12 回合沙盘买入+推进回合/战力榜，端到端可用，移动端（390×844）无横向溢出、无 console 报错。
- **质量门禁**：`lint ✓`、`tsc ✓`、单元测试 **353/353 ✓**。E2E 与集成测试因**环境/测试脚手架**问题未能完整跑（非业务代码缺陷，见 §测试基建）。
- **但有 1 个必须上线前修复的安全泄露**（密码哈希），外加若干安全加固、教学可信度与可访问性问题。

| 等级 | 数量 | 含义 |
|---|---|---|
| **P0 严重** | 1 | 凭据泄露，必须立即修 |
| **P1 高** | 1 | 弹窗键盘不可用（可访问性） |
| **P2 中** | 8 | 上线前应修：CSRF、限流、教学配色、家长图表、对比度、榜单闪烁等 |
| **P3 低/打磨** | 12+ | Toast、guest 报错、动效、SVG 替代文本、代码小瑕疵等 |

---

## P0 — 必须立即修复

### 1. 教师/家长接口明文返回 bcrypt 密码哈希 + 全部邮箱 🔴（我已亲自复现）
- **接口**：`GET /api/teacher/classroom`、`GET|POST /api/teacher/assignments`、`GET /api/parent/report`
- **证据**：以 `teacher@brownzone.ai` 登录后 `curl /api/teacher/classroom` → HTTP 200，响应体含 `"passwordHash":"$2b$10$…"` × 5（教师本人 + 4 名学生），并带 `email`、`tokenVersion`。家长接口同样泄露本人 + 关联学生。
- **根因**：`src/lib/db/repo.ts` 的 `getTeacherOverview()`（约 1368 行）与 `getParentOverview()`（约 1415 行）直接 `return` 原始 `UserRecord`（含 `passwordHash`），路由直接 `NextResponse.json`。`admin` 路径用了安全投影所以干净——说明只是这两处漏了脱敏。
- **风险**：任一教师账号即可拖走全班学生邮箱 + 可离线爆破的 bcrypt 哈希；家长可拿到关联学生的。属跨边界 PII + 凭据材料泄露。
- **解决路线**：
  1. 在 `getTeacherOverview`/`getParentOverview` 返回前，对 `teacher/parent/student/students[]` 统一走安全投影（复用 admin 那条已存在的 `toPublicUser` 风格 mapper），剥离 `passwordHash`（建议连 `tokenVersion` 一并剥离）。
  2. 新增一条 repo 审计测试（仿 `repo-fallback.audit.test.ts`）：断言任何 overview 序列化结果里**不含** `passwordHash`，防回归。
  - 工作量：~1 小时。建议**最优先**。

---

## P1 — 高

### 2. 弹窗（登录/注册 + AI 面板）键盘不可关闭、无焦点陷阱
- **位置**：`src/components/demo/demo-portal.tsx`、`src/components/shared/global-ai-assistant.tsx`
- **WCAG**：2.1.2 / 2.4.3 / 2.1.1（APG Dialog 模式）
- **证据**（手动复现）：打开弹窗按 `Esc` 不关闭（只有点击关闭）；焦点不会移入弹窗（停留在被遮罩挡住的触发按钮上）；在最后一个控件按 Tab 焦点会**跑到背景页面**（落到"首页"链接）。AI 抽屉同样无 Esc、焦点不移入。
- **解决路线**：给两个弹窗加 `onKeyDown` 处理 Esc → 调 `closeModal()`/`setIsOpen(false)`；打开时用 ref + `useEffect` 把焦点移入对话框首个控件；Tab/Shift+Tab 在对话框内循环；关闭时焦点还原到触发器。最省事稳妥的做法是用 Radix `Dialog` 或 `focus-trap-react` 包一层（顺带白送 Esc + 滚动锁）。同时把那个全屏 `<button aria-label="关闭登录窗口" class="inset-0">` 遮罩改成不可聚焦背景。
  - 工作量：~半天（含 AI 面板）。

---

## P2 — 上线前应修

### 3. 多个写接口缺少 `checkOrigin()` CSRF 防护（仅生产暴露）
- **路由**：`POST /api/auth/logout`（已实测跨站 `Sec-Fetch-Site: cross-site` → 200）、`/api/ai/chat`、`/api/ai/onboarding`、`/api/auth/onboarding`、`/api/admin/users*`
- **风险**：`checkOrigin()` 在 dev 下是 no-op，所以本地看不出来，但生产是真缺口（CLAUDE.md 约定"任何新写接口都要加"）。`ai/chat`/`ai/onboarding` 还会写库 + 烧 AI 调用费。
- **解决路线**：每个写 handler 顶部加 `const o = checkOrigin(request); if (o) return o;`，优先 `ai/chat`/`ai/onboarding`/`logout`。更稳的做法：写一个 `withMutationGuards` 包装，或用 middleware 对所有非 GET 方法统一施加，避免以后再漏。

### 4. 登录限流只按 email 维度，无 IP/全局上限 → 撞库（password spraying）不受限
- **位置**：`src/app/api/auth/login/route.ts:28`（`rateLimitKey("login-account", email, …)`，12 次/10 分钟/账号）
- **风险**：用 1 个常见密码打 1000 个不同邮箱，每个邮箱各自计数永不触顶——正是教育租户最常见的盗号手法。
- **解决路线**：再加一条按 IP 的限流（如 `login-ip` ~30 次/10 分钟），任一触顶即拒；长期把桶迁到 Redis/Vercel KV（`rate-limit.ts` 已注明）做跨实例全局上限，并考虑 N 次失败后退避锁定。

### 5. 负数金额配色与"红涨绿跌"约定冲突（教学可信度）
- **页面**：`/student` 仪表盘
- **证据**（DOM 计算色）：「持仓与现金温度」里亏损 `-¥1,800` = **绿** ✅；但「最近操作流」`-¥10,680` 等 = **红** ❌、AI 判语 `-¥1,800` = 红 ❌、KPI 卡 = 浅红 ❌。同屏同号金额三种颜色，学生会把"现金流出"看成"收益"。
- **解决路线**：所有带符号金额统一走一个 `MoneyText`/符号→token 组件（负→`--down-*` 绿，正→`--up-*` 红）。「最近操作流」与 AI 判语面板目前绕过了它。

### 6. 家长「学期成长轨迹」图渲染成一整块实心矩形
- **页面**：`/parent`（也是周报内容）
- **证据**：8 根柱子 height 都在 94.5%–100%，渲染成一整条橙色块，看不出趋势。`/api/family/members` 返回 `{members:[]}`，是真实家长会看到的数据路径。
- **解决路线**：y 轴按数据实际 min–max 缩放（或用非零基线/百分比增量），加网格线 + 数值标签。

### 7. 6 处对比度不达标（WCAG 1.4.3 AA）——含本次新增的红色战力数字
- **证据**：站点头 CTA「立即体验」白字 1.99:1；战力榜激活段（白字 on 琥珀）2.50:1；hero 地区分块 white/75 ~1.81:1；密码清单文字 2.56/3.77:1；**红色战力数字 `text-up`(#e8412e) 3.58–3.80:1**；侧栏序号 01/02 等。
- **解决路线**：
  - 战力数字：把 `text-up` 换成更深的 **`--up-600`(#c52e1c) ≈ 5.1:1**——**依旧是红色加粗**，但过 AA（满足你的"红色"要求 + 可访问性）。
  - CTA：标签强制 `text-slate-950`；激活段用 `--amber-700` 底或深字；hero 分块用实心深底 + 纯白字；`--color-fg-subtle` 从 `ink-400` 调到 `ink-500`。

### 8. hero 地区分块切换榜单时出现"旧数据 + 新标题"短暂错配（本次改动引入）
- **位置**：`src/components/student/rank/rank-board.tsx`（+ `power-card.tsx`、`rank-dashboard.tsx`）
- **证据**：榜单自己的分段控件切换会显示骨架屏，但**点 hero 分块**走 `onScopeChange` 没有把 `loading` 置真，于是 fetch 返回前会用**上一地区的 entries** 配**新地区的标题/名次**（CN→us-east-2 延迟下更明显），自我纠正、无数据损坏，但观感错。
- **解决路线**：把 loading 由 prop 驱动——在 `RankBoard` 加 `useEffect(() => setLoading(true), [scope, period])`，删掉 `selectScope/selectPeriod` 里手动的 `setLoading(true)`。这样任何来源的切换都先显骨架屏。

### 9. `GET /api/market/board` 对"已登录的错误角色"返回 401（应为 403）
- **位置**：`src/app/api/market/board/route.ts:18`（手写校验把"未登录"和"角色错误"都当 401）
- **解决路线**：拆开——`!session`→401，`session.role!=="student"`→403；或直接换成 `requireUser("student")` 与其它接口统一。

---

## P3 — 低 / 打磨（择机）

- **缺成功 Toast**：沙盘买入/推进回合只有 KPI 静默变化，无提示（`/api/sim/actions` 200 但无反馈）；分享战绩仅按钮文案变「已复制」（反馈存在但偏隐蔽，可补 toast）。
- **guest 访问 `/learn` 控制台报 401**：`/api/learn/progress` 在鉴权前就 fetch，每个游客都吐红色 console 错——把该调用放到登录后，或把 401 当"暂无进度"静默吞掉。
- **AI 悬浮球遮挡** `/student/market` 观察池图例最后一行——给滚动容器加等于 FAB 高度的底部留白。
- **全站无 `prefers-reduced-motion`**：framer-motion 动效对前庭敏感用户无降级——加全局 reduced-motion CSS / `useReducedMotion()`。
- **图表 SVG/donut 缺 role + 文本替代**（雷达、走势、配置环）——纯视觉的加 `aria-hidden="true"`（旁边都有文字表），或加 `role="img"` + `aria-label`。
- **无全局 `:focus-visible` 环**：白底激活段焦点环近乎不可见——加 `:focus-visible { outline: 2px solid var(--color-ring); outline-offset: 2px; }`（token 已存在）。
- **`billing/notify` 500 分支回传原始异常 message**（仅在合法微信签名后可达，风险低）——服务端记日志、对外回通用「支付回调处理失败」。
- **JWT 校验未固定 `algorithms`**（`auth.ts:68` 等，当前不可利用，纯对称密钥）——加 `{ algorithms:["HS256"] }` 防未来迁移成非对称密钥时的算法混淆。
- **`env.ts` 被打进客户端 chunk**（只泄露变量**名**不泄露值，`SESSION_SECRET` 等值已被替换为 `undefined`）——拆 `env.server.ts`(+`import "server-only"`)/`env.public.ts`，加 CI grep 防 `NEXT_PUBLIC_*SECRET*`。
- **代码小瑕疵**（Code Reviewer）：`firstRegisterError` 是死导出（路由内联重复了同一逻辑）；register 路由里 `email.toLowerCase()` 与 repo 内部归一重复（no-op）；`gapToClimb` 在分页边界会消失（pageSize=50，今日数据量下无影响）。

---

## 测试基建（非业务缺陷，但挡住"完整验证"）

- **E2E `npx playwright test` 跑不起来**：Next 16 (Turbopack) 有**按项目目录的单实例锁**，:3000 dev server 在跑时，Playwright 自己的 :4173 dev server 起不来（`Another next dev server is already running`）。**解决**：跑 E2E 前停掉 :3000；或 `PLAYWRIGHT_PORT=3000` + `reuseExistingServer` 复用 :3000；或用单独 git worktree；或让 `webServer.command` 用 `next start`（生产服务器无该锁）。
- **集成测试 4 失败 / 7 通过**：根因是**测试脚手架 env 加载顺序 bug**——`DATABASE_URL` 只在 `.env.local`，`@/lib/env` 在 import 期就读 `process.env`（此时还没加载），导致 `getDb()` 返回 null → 写入静默落到内存 store → 原始 SQL 交叉校验查不到行。**非业务代码、非"RLS 迁移装不上 vanilla PG"**（表确实存在）。**解决**：给 `vitest.integration.config.ts` 加 `setupFiles`/`dotenv` 在任何 import 前注入 env；并修 `rls.test.ts` 的 teardown 清理 `rank_profiles` 残留行（duplicate-key flake）。

---

## 已验证「干净/正确」（给信心）

- **安全不变量基本都成立**：无 cookie→401、错角色→403（10/10）、IDOR 越权全部挡住（repo 按调用者 id scope）、JWT 签名/`alg:none`/篡改全拒、登出后 token 版本吊销生效、cron 生产强制 bearer、忘记密码防枚举、admin 接口不泄哈希、榜单只回 alias/学校/地区无 PII。
- **本次改动 diff 经独立 review：0 P0/P1**——注册 safeParse 改造是严格改进（specific 中文报错、无英文泄露、客户端/服务端校验同源）；`aliasInfo` 正则只匿名化全 `?`/空白（`who?` 这类真名不误伤）；`monogram` 按码点取首字（emoji/CJK 正常）；`cn` ring 冲突按预期 selected 环胜出；`scrollIntoView` 无 SSR/null 风险；满段位 `nextTierGap===0` 有除零保护。
- 观察池布局修复、战力榜重设计、移动端、最近 ARIA 加固（`aria-invalid`/`aria-describedby`/`role=alert`/`aria-pressed`）均已正确落地。

---

## 建议修复路线（分波）

- **Wave 1（安全，任何外部暴露前）**：#1 密码哈希泄露 → #3 CSRF → #4 登录限流。
- **Wave 2（上线前质量）**：#5 金额配色 → #6 家长图表 → #7 对比度（含红色战力换 `up-600`）→ #2 弹窗键盘 → #8 榜单闪烁 → #9 401/403。
- **Wave 3（打磨）**：Toast、`/learn` 报错、FAB 遮挡、reduced-motion、SVG 替代文本、focus-visible、代码小瑕疵。
- **测试基建**：修集成测试 env 加载 + E2E runner，让 CI 可信。

---

## 修复进度（2026-06-05 同日落地）

> 验证基线：`tsc ✓` · `eslint ✓` · 单元测试 **354 ✓**（新增 1 条密码哈希防回归用例）· **生产 build ✓** · 关键改动浏览器实测通过。

### ✅ 已修复并验证

| # | 问题 | 修复 | 验证 |
|---|---|---|---|
| 1 | 密码哈希泄露 (P0) | `repo.ts` 新增 `withoutPasswordHash`，包裹 `getTeacherOverview`/`getParentOverview`（DB + store 两条路径都脱敏）+ 防回归测试 | `curl` 实测 passwordHash 由 5 → **0**，学生数据仍在 |
| 3 | CSRF 缺口 (P2) | `checkOrigin()` 加到 8 个写接口：`auth/logout`、`auth/onboarding`、`ai/chat`、`ai/onboarding`、`admin/users`(+`[userId]`/`password`/`email`) | dev 下同源请求仍 200（登录/登出实测通过） |
| 4 | 登录撞库 (P2) | 新增 `peekRateLimit` + 按 IP 的**失败**预算（仅失败计数，成功登录不计 → 不误伤同校 NAT 整班）50 次/10 分钟 | 同源登录 200、错密码 401 实测 |
| 2 | 弹窗键盘 (P1) | 登录/注册弹窗 + AI 面板：Esc 关闭 + 打开时焦点移入；AI 面板 `aside→div role=dialog`（过 axe `aria-allowed-role`） | 浏览器实测 Esc 关闭弹窗；AI 面板 axe 11/11 |
| 6 | 家长图表糊块 (P2) | y 轴改按数据实际 min–max 缩放（min→12%、max→100%）+ 每柱 `title` 数值 | — |
| 7 | 对比度 (P2) | 红色战力→`--up-600`(5.1:1，仍红仍粗)；地区激活段→深字 on 琥珀（同 `bz-primary-action`）；hero 分块→深底+纯白字；密码清单→加深；站点 CTA→`!text-slate-950`；**全局** `:focus-visible` 环 + `prefers-reduced-motion` | 浏览器实测战力数字 = `rgb(197,46,28)` |
| 8 | 榜单切换闪烁 (P2) | 用 DTO 回显的 scope/period 派生 `showSkeleton`（避免 lint 禁止的 effect 内 setState），切换时即显骨架屏 | 浏览器实测 hero 切地区后榜单正常加载、无卡死骨架 |
| 9 | 401/403 (P2) | `market/board` 拆分：无 session→401，错角色→403 | — |
| F3 | JWT 未固定算法 (P3) | 4 处 `jwtVerify` 全部 `{ algorithms: ["HS256"] }` | tsc/测试通过 |
| — | `/learn` guest 401 (P3) | `learn/progress` 改为匿名 200 + 空结果（不再吐 console 错） | — |

### ⏳ 待你定夺 / 后续（未动）

- **#5 金额配色（P2，需你决策）**：`MoneyText` 是「金额恒为红」组件，并非按符号变色；要不要让"亏损/负值"统一走绿（`--down-*`）涉及 5+ 组件且是产品语义决策，未擅自改。建议：新增 `tone="signed"` 让负值转绿，仅在"最近操作流/AI 判语/KPI"这类 P&L 场景启用。
- **完整焦点陷阱**（Tab 循环）：当前已 Esc + 焦点移入；Tab 仍可能跑到背景。建议接入 Radix `Dialog` 或 `focus-trap-react` 一次性解决两个弹窗。
- 侧栏序号 01/02 对比度（`platform-layout` `text-white/35`→`/55`）；成功 Toast（买入/推进回合、分享）；AI 悬浮球遮挡图例（滚动容器底部留白）；图表 SVG/donut `aria-hidden`/`role=img`；分段控件 `radiogroup` 语义；`billing/notify` 500 改通用文案；`env.ts` 拆 server/public（F4）。
- ✅ **测试基建（集成测试，2026-06-05 落地）**：`vitest.integration.config.ts` 加 `setupFiles`（`tests/integration/setup-env.ts`）在 import 前注入 env；删掉两个测试文件里 `loadEnvFile(".env.local", true)` 的内联覆盖（它在 `@/lib/env` 读完后又把 DATABASE_URL 改回 demo 库，导致 repo 写 test 库、cross-check 读 demo 库的脑裂）；加 `fileParallelism:false` + `rls.test` 事务内先 delete 自身 id 以隔离；**新增安全闸**：非 `*_test` 库直接报错拒跑（保护 demo/prod）。建好可复用的 `brownzone_test` 库（schema clone + 数据 + 清空榜单表）。**结果：集成 11/11 通过**，命令：`DATABASE_URL=...brownzone_test npm run test:integration`。
- ⏳ **E2E runner（待）**：`PLAYWRIGHT_PORT=3000` 复用或先停 :3000（Next 16 单实例锁）。

### ✅ 迭代 2 落地（2026-06-05）

- **#5 金额配色（P2）→ 已修复**：`MoneyText` 改为按符号着色——负值恒绿（浅底 `#16a14e` / 深底 `#9aedb8`），正值/中性恒红。负数金额按约定本就是「跌/负→绿」，无场景应为红，故一处改动修好全部误用（最近操作流 / KPI / AI 判语 / 净值），正数零影响。+2 单测；浏览器实测 `-¥10,680`→绿、`¥125,631`→红。
- **侧栏序号对比度（P2）→ 已修复**：`platform-layout` `text-white/35`→`/60`。
- **`billing/notify` 原始异常外泄（P3）→ 已修复**：服务端 `console.error` 记录，对外只回通用「支付回调处理失败」。
- 验证：`tsc ✓ · lint ✓ · 单元 356 ✓`。
- 仍待：完整焦点陷阱、AI 球遮挡、图表 SVG 替代文本、`radiogroup` 语义、`env.ts` 拆分、E2E runner、成功 Toast；之后重跑多 agent 全场景内测。

### ✅ 迭代 3 落地（2026-06-05）

- **完整焦点陷阱（P1 收尾）→ 已修复**：新增可复用 `src/lib/use-focus-trap.ts`（focus-in + Tab 循环 + Esc + 关闭时焦点还原），登录/注册弹窗与 AI 面板都接入。浏览器实测：Tab 10 次**零泄漏**、Esc 关闭、焦点还原到触发按钮。
- **AI 悬浮球遮挡图例（P3）→ 已修复**：平台主区 `<main>` 加 `pb-24`，最后一个模块可滚出 FAB 之上。
- **图表 SVG 缺替代文本（P3）→ 已修复**：5 个图表 SVG（市场走势 / 6 维雷达 / 历史复盘 ×2 / AI 雷达）加 `aria-hidden="true"`（旁边都有数据文本表）；conic-gradient 圆环 div 本就被 SR 忽略，无需处理。
- 验证：`tsc ✓ · lint ✓ · 单元 356 ✓`。
- 仍待（低优/可选）：`env.ts` server/public 拆分（F4，仅泄露变量名非值）、E2E runner 配置、`radiogroup` 语义（AA 下可接受）、成功 Toast；→ **下一轮重跑多 agent 全场景内测复验**。

### ✅ 迭代 4 — 重跑全场景内测复验 + 收尾（2026-06-05）

**3 个 agent（API / E2E / 安全）复验全部修复：12 项全部确认、0 功能回归。** 唯一新发现已修：

- **新发现并已修复（LOW，CSRF 防御纵深）**：复验扫出**另外 4 个写接口缺 `checkOrigin`**——`sim/replay`、`teacher/assignments`、`ai/tutor`、`ai/radar-chart`（其中 `sim/replay` 属 `/api/sim/*`，与 CLAUDE.md「已覆盖」声明矛盾）。已按统一模式补齐（`sim/replay` 同时补 `request` 形参）。现 25/26 写接口已守，余 1 个 `billing/notify` 是微信服务端回调（签名鉴权，正确豁免）。`tsc ✓ · lint ✓ · 单元 356 ✓`，同源 smoke 200。

**全套质量门禁现已全绿**：`lint ✓ · tsc ✓ · 单元 356 ✓ · 集成 11 ✓（brownzone_test）· 生产 build ✓ · E2E 30 ✓`。
- E2E 运行法（runbook）：dev server 在 :3000 跑着时，用 `PLAYWRIGHT_PORT=3000 npx playwright test` 复用它（Next 16 单实例锁导致无法另起 :4173）。互动审计：`dead:0 / noName:0 / consoleErr:0 / pageErr:0`。

**刻意不做的剩余项（非缺陷，已权衡）**：
- `env.ts` server/public 拆分（F4）：agent 确认**无任何密钥值外泄**（客户端 chunk 只含变量名，`process.env.SECRET` 被替换为 `undefined`）。纯卫生项，拆分有破坏构建风险而零安全收益 → **不做**，仅保留 CI grep 建议（防未来 `NEXT_PUBLIC_*SECRET*`）。
- 成功 Toast（买入/推进回合/分享）：属 UX 增强而非缺陷（KPI/状态已实时更新；分享按钮已变「已复制」）→ 留作可选增强。
- 分段控件 `radiogroup` 语义：a11y agent 判定 `aria-pressed` 切换按钮在 **AA 下已合规** → 不做。

**结论：内测发现的全部缺陷（P0 凭据泄露 / P1 弹窗键盘 / 8+4 CSRF / 限流 / 8 项 P2 / 多项 P3 + 测试基建）已修复并复验，质量门禁全绿，无回归。剩余仅为已权衡的可选增强。**
