# 学生端 UI 全面内测报告 — 2026-06-14

> 方法：5 个角色并行**只读**审计 + 客观类型校验。范围：`src/app/(platform)/student/**`、`src/components/student/**` 及其依赖的 `shared/` `lib/`。
> 重点：本次 reference-UI 升级新增、**尚未提交**的板块（home-hub / market-thermometer / fund-lab / goal-accounts / opportunity / protection / pet-studio）。

## 一、内测方法

| 角色 | 视角 | 产出 |
|---|---|---|
| 无障碍审计员 | WCAG 2.2 AA：焦点管理 / 键盘 / 读屏 / 对比度 / 仅色传达 | 12 条 |
| UX 研究员 | 信息架构 / 认知负荷 / 状态完备 / 移动端 / 适龄 | 11 条 |
| UI 视觉设计师 | 设计 token 一致性 / 排版 / 色彩规范落地 | 16 条 |
| 前端代码审查 | React19+Next16 正确性 / 竞态 / 崩溃风险 / 接线 | 8 条 |
| 现实核查员 | 真能用 vs 占位 / 权限门 / 导航可达 / 部署风险 | 功能成色表 + 8 条 |

**客观校验**：`npx tsc --noEmit` → **0 错误**（全量含未提交 WIP 均类型自洽，lib→API→组件三层字段契约一致）。

## 二、总体结论

这批新板块**不是表面功夫，是真接通的全栈实现**——页面 → 组件 → API → repo → store/DB 五层全部打通，DB 缺失时回落内存 store，写失败按不变量抛错而非假写，`tsc` 0 错。代码健康度优秀。

但有 **4 个 P0 必须发布前处理**，且体验/视觉/无障碍三层各有一个系统性硬伤：

- **🔴 工程 P0**：① 整批 WIP 未提交（部署即全丢、CI 不校验）② 写型 POST 绕过订阅门（免费/过期用户可刷写并触发家长报告）③ 首页单点渲染、新建 run 有整页白屏风险 ④ 首登 onboarding 弹窗零焦点管理。
- **🟠 体验硬伤**：信息架构过载 + 双份/三份导航——首页把 15+ 板块塞进一条超长滚动，核心"下单"被埋到第 6 屏以下。
- **🟡 视觉硬伤**：WIP 大量硬编码 Tailwind 原生色（slate/orange/rose/emerald）绕开 `globals.css` 的语义 token，形成"两套视觉词汇"。
- **🔵 无障碍硬伤**：涨跌/利好利空大量**仅靠红绿**传达，且红绿状态色本身对比度不达标。

## 三、功能成色表（现实核查）

| 板块 | 页面 | 入口可达 | API 接通 | 持久化 | 结论 |
|---|---|---|---|---|---|
| market 市场雷达 | ✅ | ✅ 侧栏+hub | ✅ board/peer-heat/watchlist | ✅ | **真能用** |
| opportunity 机会训练 | ✅ | ✅ | ✅ | ✅ createOpportunityNote | **真能用** |
| wealth 我的财富 | ✅ | ✅ | ✅ wealth-summary | ✅ createWealthReview | **真能用** |
| fund-lab 基金实验 | ✅ | ✅ | ✅ GET/POST | ✅ createFundLabAction | **真能用** |
| goal-accounts 目标账户 | ✅ | ✅ | ✅ | ✅ createGoalAccountAction | **真能用** |
| protection 保护伞 | ✅ | ✅ | ✅ | ✅ createProtectionUmbrellaAction | **真能用** |
| auto-invest / risk-profile / life / credit / quests | ✅ | ✅ | ✅ | ✅ | **真能用** |
| history 历史复盘 / rank 战力榜 | ✅ | ✅ | ✅ | ✅(只读/既有) | **真能用** |
| home-hub 首页服务台 | 嵌 sandbox | ✅ /student | ✅ season 领奖 | ✅ | **真能用**（非独立页） |
| market-thermometer 温度计 | 子组件 | ✅ 嵌 hub | 服务端派生 | 只读 | **真能用**（子组件） |
| **pet-rewards 萌宠奖励** | ❌ 无独立页 | ⚠️ **无导航入口** | ⚠️ **仅 GET 无写入** | 派生只读 | **部分**（展示位，非可玩功能） |

---

## 四、分级问题清单

> 标注：【现实】【UX】【视觉】【正确性】【无障碍】= 发现来源角色。位置为 `文件:行`。

### 🔴 P0 — 发布前必须处理（阻断 / 安全 / 数据丢失 / 白屏）

- **[P0-1]【现实】整批 WIP 未提交，部署即全丢、CI 不校验**
  位置：`git status` 中 40+ 个 `??` 文件（`src/app/(platform)/student/{fund-lab,goal-accounts,opportunity,protection}/`、`src/app/api/student/{...,pet-rewards,season,watchlist}/`、对应组件与 `src/lib/*`）；而 `platform-layout.tsx`、`student-sandbox.tsx` 等**已提交(M)文件已引用它们**。
  影响：任何 `git stash`/`clean`/切分支都会让导航指向的页面与组件凭空消失 → 整批 404 或构建失败。正是"Codex builds but never commits"模式。
  建议：`git add` 显式路径原子提交到 `feat/multi-investment-toolkit`，随后 `npx tsc --noEmit && npm run build` 验证无悬空引用。

- **[P0-2]【现实】写型 POST 绕过订阅门 `canUserOperate`**
  位置：`api/student/watchlist/route.ts:37`、`fund-lab/route.ts:46`、`opportunity/route.ts:32`、`goal-accounts/route.ts`、`protection/route.ts`、`season/route.ts:29`（仅 `requireUser("student")`，无门）；对照基准 `api/sim/actions/route.ts:46` 有 `canUserOperate` 403。
  影响：试用结束的学生仍能写库（watchlist/记录/领赛季奖励）并触发 `syncGrowthReportForStudent` 家长报告刷新，绕过付费墙；watchlist/season 可被脚本刷写。
  建议：若是有意 freemium（教学动作免费）请显式确认并在 PR 注明；否则对写入型 POST 补 `canUserOperate`，**至少 `season` 领奖必须加门**。

- **[P0-3]【现实+正确性】首页 `/student` 单点渲染无 ErrorBoundary，新建 run 有整页白屏风险**（需运行验证）
  位置：`student-sandbox.tsx:19-26,425-427` 客户端一次性构造 `buildStudentHomeHubPayload`/`buildStudentPetPayload`/`buildPortfolioIntel`/`buildTutorRadarPayload`；`app/(platform)/student/page.tsx:39` 仅渲染 `StudentSandbox`；`student-service-map.ts:184-352` 大量 `run.snapshots.at(-1)`、`run.actionLog.filter(...)`。
  影响：新建 run（空 actionLog / 单 snapshot）或脏数据下，任一纯函数越界/NaN → 学生**整个首页白屏**而非局部降级。
  建议：用新账号跑一次 `npm run dev` 实测首登；关键 build 调用包 try/catch 或 ErrorBoundary 局部兜底。

- **[P0-4]【无障碍】首登 onboarding 全屏弹窗零焦点管理**
  位置：`onboarding-flow.tsx:293-305`（`fixed inset-0 z-50` 仅是 `div`）+ `student-onboarding-gate.tsx:18` 强制挂载。无 `role="dialog"`/`aria-modal`/可访问名称，不移入焦点、不锁 Tab、无 Esc；背景策略台仍可被 Tab 聚焦。
  影响：新生**首登必经**层，键盘用户 Tab 进背后被遮挡页面、读屏用户读到本应遮蔽内容——依赖键盘/读屏的学生开局即被困。
  建议：复用项目已有的 `src/lib/use-focus-trap.ts`（AI 助手 `global-ai-assistant.tsx:146,489` 是最佳范例），加 `role="dialog" aria-modal aria-labelledby`，Esc=跳过引导，背景 `inert`。

### 🟠 P1 — 严重（核心体验 / 正确性 / 可访问性）

- **[P1-1]【UX】首页超长滚动，核心"下单"被埋到第 6 屏以下**
  位置：`student-sandbox.tsx:388-441`（页头→5 净值卡→**整个 HomeHub**→**整个萌宠工作室**→配置→交易面板 `:441`/`:687`）。
  建议：首页二选一——"沙盘工作台"(净值+事件+交易+持仓) 或 "服务台 hub"，不要二合一；交易面板上移首屏，hub/萌宠降级为入口卡。

- **[P1-2]【UX】首页 Hub 入口与侧边栏完全重复，形成双份/三份导航**
  位置：`student-home-hub.tsx:149-171,353-462`（domains+serviceMap+9 宫格）对照侧栏 `platform-layout.tsx:19-36`（13 项）。同一目的地（如"市场雷达"）在一个页面出现约 4 处。
  建议：确立单一信息架构——hub 只保留首页独有内容（今日必看/赛季/温度计），删除纯导航重复；或侧栏精简为 4 主域。

- **[P1-3]【UX】11+ 板块平铺无主次分层；移动端 12 项横向滚动条可发现性差**
  位置：`platform-layout.tsx:18-36`（16 项常驻展开）、`:176-185`（移动端 `overflow-x-auto` 横滚 12 项，无滚动指示/分组）。
  建议：次级组默认折叠为手风琴；移动端改可展开分组列表或"全部功能"抽屉；屏外项加渐隐提示。

- **[P1-4]【UX】4 个 WIP 子页无"返回首页"入口/面包屑，迷路风险**
  位置：`student/{fund-lab,opportunity,goal-accounts,protection}/page.tsx`（直渲 dashboard，无面包屑），仅靠侧栏返回。
  建议：每个子页 hero 区加统一"← 返回首页服务台"链接。

- **[P1-5]【视觉】暗色英雄区 + 品牌橙全部硬编码原生色，绕开 token 体系**（WIP 重灾区）
  位置：`student-home-hub.tsx:127,134,163,167`、`market-thermometer.tsx:88,97,166`、`student-fund-lab-dashboard.tsx:144,149,164`、`student-opportunity-dashboard.tsx:79,84,100`、`student-protection-umbrella-dashboard.tsx:138,143,158`（一律 `bg-slate-950`/`text-orange-300`/内联阴影）。`--brand`#f08a38 ≠ `orange-500`#f97316，`slate-950`#020617 ≠ `--ink-900`#101726。
  建议：暗底改 `.bz-ink-panel`/`bg-bg-inverse`；橙色改 `text-brand`/`bg-brand`；阴影改 `shadow-xl`/`shadow-glow`。

- **[P1-6]【视觉+无障碍】同一语义（涨跌 / 成功失败）相邻位置出现两套红绿，且涨跌仅靠颜色**
  位置（token 混用）：`student-sandbox.tsx:460-462`（`bg-rose-100`/`bg-emerald-100`）对比同文件 `:485-487`（正确的 `bg-up-soft text-up`）；`fund-lab` 用 `emerald/rose` 对比 `goal-accounts/protection` 用 `down/error` token。
  位置（仅色传达）：K 线 `student-market-board.tsx:721-734`、温度因子 `market-thermometer.tsx:47-51`、事件信号 `student-sandbox.tsx:458-467` 仅靠红绿，无方向图标/文字。
  建议：统一为 `up/down`/`error` token；并在涨跌徽章/因子/信号叠加 ▲▼ 或"涨/跌""利好/利空"文字，K 线补图例（WCAG 1.4.1）。

- **[P1-7]【无障碍】状态色文本对比度不达标**
  位置：`globals.css:29,37`（`--up-500`#e8412e ≈ 3.6:1、`--down-500`#16a14e ≈ 3.0:1，均 < 4.5:1）；橙底白字 `student-pet-reward-studio.tsx:499-512`（≈ 2.4:1）。
  建议：白底涨跌小字下沉到 `--up-600`/`--down-600`；橙底按钮改 `text-slate-950`（与全站其它橙色 CTA 一致）。

- **[P1-8]【无障碍】4 个 WIP dashboard 提交结果无 `aria-live`，读屏听不到成功/失败**
  位置：`student-fund-lab-dashboard.tsx:285-294`、`goal-accounts:215-224`、`opportunity:219-228`、`protection:305-314`。对照正确范例 `life-cashflow:490,496`、`quest:311,322`、`risk-profile:366,372`（已用 `role="status"/"alert"`）。
  建议：成功加 `role="status"`、失败加 `role="alert"`，与既有 dashboard 对齐。

- **[P1-9]【无障碍】侧边导航未包 `<nav>` 地标；移动/桌面两套导航 DOM 重复；主标题非 `<h1>`**
  位置：`platform-layout.tsx:135-200`+`203-291`（`<Link>` 直堆 `div`，无 nav 地标，~16 链接出现两遍）；`:147,212` 把页面主标题渲染成 `<p className="text-h1">` → 部分页缺 h1、部分页多 h1。
  建议：导航包 `<nav aria-label="学生功能导航">`，隐藏的一套加 `aria-hidden`，当前页加 `aria-current="page"`；外壳标题改 `<h1>`，dashboard 内统一降 `<h2>` 起，每页恰一个 h1。

- **[P1-10]【正确性】市场看板异步 fetch 无竞态防护，快速切标的旧响应覆盖新数据**
  位置：`student-market-board.tsx:164-193,240-246`（`loadBoard`/`loadStudentWatchlist` 无 AbortController/版本号）。对照 `student-fund-lab-dashboard.tsx:73-104` 的 `previewRequestRef` 方案。
  建议：加 version guard 或 `AbortController`，effect cleanup 取消。

- **[P1-11]【正确性】`loadStudentWatchlist` 后台刷新失败写入 `watchlistMessage`，与用户操作反馈复用同一状态**
  位置：`student-market-board.tsx:181-193`（读取 `:579-581`，操作成功也用 `:230-231`）。
  影响：后台刷新失败会在用户未操作时弹"刷新失败"，或覆盖刚才"已加入自选"的成功提示。
  建议：后台刷新失败用独立低打扰错误态（参照 `peerHeatError`）。

- **[P1-12]【UX/视觉】萌宠工作室作为首页常驻巨型三栏板块，与理财主线割裂、抢黄金版面**
  位置：`student-sandbox.tsx:427` → `student-pet-reward-studio.tsx:286-517`（xl 三栏 + 560px 滚动图鉴）。
  建议：收纳为首页入口卡或独立 `/student/pet` 页，奖励变化用轻量 toast。

### 🟡 P2 — 次要

- **[P2-1]【视觉】状态提示色 rose vs error / emerald vs down 不统一** — `fund-lab:289`、`opportunity:223`、`home-hub:253,258`（`--error-500`#d12d50 ≠ `rose-700`）。统一 `bg-down-soft text-down` / `bg-error-soft text-error`。
- **[P2-2]【视觉】进度条 / sparkline / 雷达描边颜色硬编码且各画各的** — `home-hub:193,390`、`goal-accounts:162`、`fund-lab:198,313`、`protection:194`、`market-thermometer:16-44`（`from-orange-400...`、内联 `stroke="rgb(249 115 22)"`）。统一 `var(--brand)`/`--up-500` 或抽 `.bz-progress-fill`。
- **[P2-3]【视觉】历史复盘高亮用裸 hex `#d43c33`（第三种红）** — `student-history-review-dashboard.tsx:297-298,304-305,317,320`。方向正确但应用 `var(--up-*)`/`--warning-*`。
- **[P2-4]【视觉】`statusTone` 徽章用原生 slate/orange，与既有徽章体系不一致** — `home-hub:45-49`。改 `bg-brand-soft text-brand-ink` / `bg-bg-inverse` / `bg-bg-muted`。
- **[P2-5]【无障碍/视觉】暗色次级文字透明度 10+ 档位零散** — `home-hub:138,164,166`、`market-thermometer:99,138,160`、`pet-studio:304,339,393` 等（`text-white/72…/38`）。收敛 3 档（/80 正文、/60 次要、/45 最弱）。
- **[P2-6]【UX/无障碍】关键操作缺二次确认/撤销** — 下单 `student-sandbox.tsx:687`、推进回合 `:522`（不可逆）、目标转入 `goal-accounts:205`（减现金）均一键执行，仅"新赛季"有 `window.confirm`。对推进回合/目标转入加轻确认或 5s 撤销。
- **[P2-7]【UX/正确性】萌宠装备仅存 localStorage，跨设备/清缓存丢失且无说明** — `pet-reward-studio.tsx:183,190-204`。持久化到后端或注明"仅本机预览"。
- **[P2-8]【UX】目的地命名不统一** — "市场雷达/行情"、`student-service-map.ts` domains vs 9 宫格 vs 侧栏三套叫法。每目的地锁定一个规范中文名。
- **[P2-9]【UX】部分子页 hero `summary` 复制粘贴** — `fund-lab/page.tsx:28`、`wealth/page.tsx:28` 仍是沙盘通用语（`opportunity` 已定制，可作模板）。
- **[P2-10]【视觉】圆角任意 rem 字面量未走 radius token** — 几乎所有 WIP（`rounded-[2rem]…[1.15rem]`）。收敛到 `--radius-xl/2xl/3xl` 三档。
- **[P2-11]【视觉】字重几乎全 `font-black`，标题层级被压平、中文正文偏糊** — `home-hub`/`market-thermometer`/WIP 全量。正文用 `font-medium/semibold`，仅标题/关键数字用 `font-black`。
- **[P2-12]【视觉】暗色玻璃面 `bg-white/[0.03–0.08]` 无规律** — `market-thermometer:108,130,147,158`、`pet-studio` 多处。统一 1–2 档或抽 `.bz-inverse-tile`。
- **[P2-13]【视觉】金额/指标数字未全部 `tabular-nums`** — `fund-lab:166-169` metric、`opportunity` 分数、`home-hub:167` metricValue。容器加 `tabular-nums`。
- **[P2-14]【正确性】`Math.min(...arr)` 对潜在空数组** — `fund-lab:17-18` `sparkline`、`history-review:40-41` 等。当前数据非空安全，但 series 一旦空即 NaN/崩；加 `length===0` 提前返回（`wealth-dashboard.tsx:45` 已有写法）。
- **[P2-15]【正确性】pet-studio `useEffect` 依赖每次重建的 `payload.rewards`，刷新后选择可能被重置** — `pet-reward-studio.tsx:190-204`。把"从 localStorage 恢复"改为仅挂载执行一次。
- **[P2-16]【现实】`season` 领奖写库无幂等/防重保护**（需验证 lib 内部）— `repo.ts:1601-1615`、`store.ts:1599-1611`。确认 `claimSeasonChallengeReward` 对已领 challengeId 抛错或幂等。
- **[P2-17]【现实】pet-rewards 半板块** — 有 API+组件但仅 GET、无写入路由、无导航入口。明确定位为展示组件，文案勿宣称独立"板块"。

### 🔵 P3 — 打磨

- **[P3-1]【UX】缺路由级 `loading.tsx` 骨架** — `(platform)/student` 无 loading；CN→远端 DB ~5s 超时下切板块像"卡住"。配合既有 `error.tsx` 补骨架。
- **[P3-2]【UX】首页多组件各自 GSAP stagger 并发，可能逐块跳动**（已正确处理 reduced-motion）。首页统一一个入场时间线。
- **[P3-3]【UX】金额输入无即时合法性反馈** — `fund-lab:241-251`、`goal-accounts:185-192`（blur 静默钳制）。字段下常驻"可填 1,000–120,000"。
- **[P3-4]【无障碍】range 滑块缺 `aria-valuetext` / sandbox 决策卡缺 `role="group"`** — `opportunity:183-194`、`student-sandbox.tsx:500-517`。
- **[P3-5]【无障碍】装饰 SVG 缺统一 `aria-hidden`** — 基金 sparkline `fund-lab:193-202`、保护伞雷达 `protection:184-205`（K 线/市场雷达已正确 `aria-hidden`）。
- **[P3-6]【无障碍】雷达轴标签 10px `fill-white/70` 过小** — `protection:200-202`。维度名移到 SVG 外文字卡片。
- **[P3-7]【视觉】焦点环局部覆盖 `outline-orange-200`，与全局 `--color-ring` 不一致** — `market-thermometer:166`。删除局部覆盖。
- **[P3-8]【视觉】section 图标统一 `text-orange-500` 非 `text-brand`** — `fund-lab:178,216,299` 等。
- **[P3-9]【视觉】空状态 dashed 边框样式略有出入** — 统一 `border-dashed border-border bg-bg-muted text-fg-muted`。
- **[P3-10]【现实】9 宫格 `status:"new"/"premium"` 为静态文案，与真实订阅态无关** — `student-service-map.ts:73-182`。权限门（P0-2）修复后让徽章与实际门控对齐。

---

## 五、后续改进建议（整改路线图）

### 批次 1 — 发布前 / 本周（P0：安全 + 数据 + 阻断）
1. **原子提交整批 WIP** → `npx tsc --noEmit && npm run build` 验证无悬空引用。（P0-1）
2. **写型 POST 补 `canUserOperate`**（或确认 freemium 并在 PR 注明）；`season` 领奖必加门 + 幂等。（P0-2 / P2-16）
3. **首页 ErrorBoundary + 新账号 `npm run dev` 实测**，排除新建 run 首登白屏。（P0-3）
4. **onboarding 接 `useFocusTrap`**，补 dialog 语义与 Esc。（P0-4）

### 批次 2 — 体验与可访问性重构（下个迭代）
5. **首页信息架构重构**：工作台 vs 服务台二选一，交易区上移，hub/萌宠降级为入口卡。（P1-1/2/12）
6. **单一导航 IA**：移动端分组抽屉、子页加返回/面包屑、命名统一。（P1-3/4 / P2-8）
7. **无障碍批量整改**：`<nav>` 地标 + 单 `<h1>` + 4 dashboard `aria-live` + 涨跌图标/文字冗余 + 对比度下沉。（P1-6/7/8/9）
8. **正确性补强**：market-board 竞态防护 + 反馈状态分离。（P1-10/11）

### 批次 3 — 视觉收敛（设计债，可与批次 2 并行）
9. **token 化扫荡**：硬编码 `slate/orange/rose/emerald` + 裸 hex → `up/down/error/brand/ink` 语义 token；圆角/字重/透明度/进度条/玻璃面统一档位。（P1-5/6 + P2-1~5,10~13）
10. **细节打磨**：`loading.tsx` 骨架、确认/撤销、输入即时校验、装饰 SVG 语义、焦点环统一等。（P3 全部）

---

## 六、值得保留的优秀实践（整改时勿误伤）

- **AI 助手对话框** `global-ai-assistant.tsx:489` 是全仓库最佳无障碍范例（完整 `role=dialog`+`useFocusTrap`+Esc+焦点返回）——作为 onboarding/确认弹窗的整改模板。
- **prefers-reduced-motion 全覆盖**：`premium-motion-provider.tsx` + 每个 dashboard `useGSAP` 开头都检测并落地，符合 WCAG 2.3.3。
- **空状态 + 错误边界完整**：各 WIP dashboard 有 dashed 空态文案；`student/error.tsx` 明确防英文白屏。
- **onboarding 教学设计优秀**：predict→reveal 闭环，刻意用下跌结果反"市场永远涨"锚定（`onboarding-flow.tsx:99-102`）。
- **三层类型契约一致 + `tsc` 0 错**：lib 类型 → API 返回 → 组件 props 字段逐一吻合，新链路无占位假数据。
- **写失败抛错不假写**：`repo.ts:320` 守住 P2 "no silent write-fallback" 不变量。

## 附：需运行验证项（`npm run dev` + 新账号实测）

- 新建 run 首登 `/student` 是否 500 / 白屏（P0-3）。
- `season` 领奖并发是否重复领取 / 重复 push 家长报告（P2-16）。
- `/student/market` 同学热度区块在空班级 / 满班级两态渲染（peer-heat）。
- 对比度数值均按 token 十六进制估算，建议用 axe DevTools / Lighthouse 在真实渲染像素（含半透明叠加）复核。
- onboarding 与 sandbox 决策弹层的实际键盘 Tab 顺序、NVDA/VoiceOver 播报手动走查。
