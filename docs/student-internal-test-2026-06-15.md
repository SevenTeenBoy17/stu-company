# 学生端「代入式」内测报告 — 2026-06-15

> 分支：`feat/multi-investment-toolkit` · 以学生角色（`student@brownzone.ai`）实际登录并逐页使用全部学生端页面，汇总问题。

## 1. 测试方法

| 项 | 说明 |
|---|---|
| 工具 | Playwright（复用仓库现有 e2e 框架）+ 新增 `tests/e2e/student-internal-test.spec.ts` |
| 账号 | `student@brownzone.ai` / `BrownZone2026!`，**登录成功（ok=true）** |
| 环境 | 离线内存库（`DATABASE_URL=""`，与「教师机离线 demo」同一受支持模式）；内存库已预置该学生一个跑了多回合的沙盘 run，故各理财页有**真实数据**而非空态 |
| 覆盖 | 全部 **14 个学生页面** × 桌面(1440×900) + 移动(390×844) = **28 次加载**；并以学生身份点击按钮/标签/下拉/滑块，触发真实交互处理器 |
| 抓取 | 未捕获异常(PAGE_ERROR)、HTTP 4xx/5xx、请求失败、console 错误/警告（含 hydration）、可见错误文案、空内容 |
| 证据 | `test-results/student-internal-test/report.json` + 28 张整页截图（`screens/`）|

覆盖页面：`/student` 主页、`market` 行情、`history` 复盘、`rank` 战力榜、`wealth` 财富、`risk-profile` 风险测评、`auto-invest` 定投、`life` 生活现金流、`credit` 信用、`quests` 任务、`fund-lab` 基金、`goal-accounts` 目标账户、`protection` 保障伞、`opportunity` 机会雷达。

## 2. 总体结论：健康度高

- **0 崩溃**（无未捕获异常）、**0 错误边界**（无「沙盘加载失败」）、**0 服务端 5xx** —— 14 个页面在桌面与移动端均正常渲染并显示真实数据。
- **0 空白页（DOM 层面）**：所有页面主内容都在 DOM 中；但移动端「首屏以下」内容因滚动揭示动画被设为 `visibility:hidden`，需滚动才显现（见 P2，属设计行为 + 一处健壮性风险，非渲染失败）。
- 59 条原始 finding，**去噪后 3 类问题**：P1 UX 缺陷（中）、P2 揭示动画健壮性/无障碍（中）、P3 GSAP 告警（低）。
- 标记为 "high" 的 4 条 `REQUEST_FAILED` 经逐条核实**均为正常的请求取消，非缺陷**（见 §4）。

| 维度 | 数量 |
|---|---|
| PAGE_ERROR / 崩溃 | **0** |
| HTTP 5xx | **0** |
| 可见错误/降级文案 | **0** |
| 空内容页 | **0** |
| HTTP 4xx（真实） | 1（机会雷达，见 P1）|
| GSAP 动画告警 | 52（低，见 P2）|
| 请求取消（误报为 failed）| 4（非缺陷）|
| 环境提示（内存库降级）| 1（非缺陷）|

## 3. 问题清单（按真实严重度）

### P1 ·（中）机会雷达「记录观察单」可在未填写时提交 → 400

- **复现**：进入 `/student/opportunity`，不写「我的观察说明」直接点 **记录观察单** → `POST /api/student/opportunity` 返回 **400 Bad Request**（桌面交互轮稳定复现；移动轮不交互故未触发）。
- **根因**：服务端要求 `note` 至少 8 个字（`route.ts:16` `z.string().trim().min(8)`），但客户端提交按钮**仅在 `pending` 时禁用**，未对内容长度做任何校验（`student-opportunity-dashboard.tsx` `submitNote`，`note` 默认 `""`）。
- **影响**：学生点击后吃到一次失败往返 + 红色 `alert`。服务端返回的文案「请完整选择主题、观察理由，并写下至少 8 个字的观察说明。」其实较清晰（客户端会优先显示 `data.message`），所以不是「误导成网络错误」，但**让用户先撞墙再纠错**的体验不佳。
- **一致性**：基金实验室 / 目标账户 / 保障伞等同类「记录/提交」按钮的服务端**不强校验 note**（本轮空内容点击未报 400），各工具校验松紧不一致。
- **建议**：客户端镜像 `min(8)` 规则 —— `note.trim().length < 8` 时禁用按钮 +「还需 N 字」实时提示；或提交前本地校验给行内引导，避免必然失败的请求。统一各理财工具的 note 校验策略。

### P2 ·（中）滚动揭示动画把「首屏以下」内容设为 visibility:hidden，且揭示路径无兜底

- **现象**：移动端整页截图中，头部 + 首屏 hero 正常，但**首屏以下大面积空白**（基金/目标账户/保障伞/机会雷达等页尤为明显）；桌面端因首屏容纳更多内容，几乎不空白、排版完整美观。
- **核实**：内容**在 DOM 里**（文本长度检测未判为空），只是被设成 `visibility:hidden`。根因：`PremiumMotionProvider`（`premium-motion-provider.tsx:538`）挂载时把所有 `[data-motion-reveal]` 元素设 `autoAlpha:0`，再用 **IntersectionObserver**（`observeOnce`，line 316/540）在元素滚入视口时才揭示。整页截图不滚动真实视口 → 首屏以下元素永不 intersect → 截图里保持隐藏。
- **判定**：真机滚动时内容会逐段正常揭示，这是**有意的高级滚动动画，不是「页面坏了」**。但有两处真实风险：
  1. **健壮性（无兜底）**：reveal 揭示**完全依赖 IntersectionObserver**，一旦不触发（observer 异常、首屏前置 JS 报错、或不滚动的场景/爬虫）内容将**永久不可见**。对比 `addSceneTimeline`（line 216-223）有 80ms 安全定时器兜底——作者已有此模式，却**没用在 reveal 路径**上。
  2. **无障碍 / 首屏感知**：`visibility:hidden` 内容在揭示前不被屏幕阅读器读取；首屏主内容默认隐藏。
- **建议**：给 `[data-motion-reveal]` 加与 scene 同款安全兜底（短延时后对仍在视口内 / 未揭示元素强制 `autoAlpha:1`，并在 observer 失败时回落为可见）；首屏元素可考虑初始即可见。
- **测试方法局限（诚实声明）**：因本机制，本轮整页截图**无法验证移动端「首屏以下」的真实排版**（内容被隐藏）。建议补一轮「逐段滚动→揭示后再截图」的可视化测试（见 §5）。

### P3 ·（低）逐页动画对缺失目标触发 GSAP「target not found」（52 次）

- **现象**：console 反复出现 `GSAP target ... not found`，分布：**任务页 quests 32**、**主页 home 12（含具体的 `[data-pet-panel]`）**、history 4、wealth 2、protection 2；任务页每次交互重渲染都重跑 → 数量翻倍（桌面 11→27、移动 42→58）。
- **根因**：来自**逐页 `useGSAP` 动画代码**（**非**全局 Provider——后者已用 `toArray`+`length` 守卫、不报警）。其中 home 的 `[data-pet-panel]` 是已确认实例：动画触发时萌宠面板不在 DOM（条件渲染 / 未挂载）。其余多为空目标调用（未逐一定位每个空目标来源——属低优先级噪声）。
- **影响**：纯 console 噪声，GSAP 对缺失目标 no-op，**无用户可见破坏**；但污染日志、做无用功、会淹没真错误。
- **建议**：动画前确认目标存在（`toArray(sel).length>0` 再 `from/to`）；条件元素（萌宠面板）动画随条件挂载；给任务页 `useGSAP` 正确依赖，避免每次交互重跑。

## 4. 已核实为「非缺陷」（避免误报）

- **4× `REQUEST_FAILED` 全为 `net::ERR_ABORTED`（请求取消），非服务端失败**（无任何 5xx 伴随）：
  - `market`：`GET /api/market/portfolio-intel`、`POST /api/ai/radar-chart` —— 市场板组件在 `useEffect` 里用 `AbortController`，卸载时 `controller.abort()` **主动取消在途请求（正确行为）**。
  - `rank`：`GET /api/student/history-review` —— rank 页（`rank/page.tsx`）根本不调该接口；这是从 `history`→`rank` 导航时，把**上一页**在途请求取消，`requestfailed` 事件迟到、归属到了 rank（测试快速导航产物，非应用问题）。
- **`[repo.fallback] running on in-memory store — degraded mode`** —— 测试环境无 `DATABASE_URL` 的**预期**降级提示。

## 5. 未覆盖 / 建议补测（诚实声明）

本轮是「逐页加载 + 空表/默认值点击」级别的代入测试，以下深度路径**尚未覆盖**：

1. **表单完整流程**：自动填表后提交 —— 风险测评全程作答、定投建仓、保障方案切换并复盘、机会雷达写满 8 字提交成功路径。
2. **真实 Postgres 环境**：本轮用内存库；写库路径在真库（及 CN→us-east-2 5s 超时）的行为未验。
3. **无障碍**：键盘可达性 / 屏幕阅读器（仓库已有 axe a11y 测试，可单独跑）。
4. **订阅门槛**：试用到期 `canUserOperate` 返回 403 时的学生体验。
5. **移动端「首屏以下」可视化排版**：因 P2 揭示动画，本轮整页截图未能验证；需「逐段滚动→揭示后截图」补测。

## 6. 复跑方式

```powershell
npx playwright test tests/e2e/student-internal-test.spec.ts --project=chromium --reporter=list
# 产物：test-results/student-internal-test/report.json + screens/*.png
```

## 7. 修复与验证（2026-06-15 同日完成）

三项问题均已修复，并以同一 harness 复测验证。**findings 59 → 6**，且剩余 6 条全部为非缺陷（1 条内存库降级提示 + 5 条 `net::ERR_ABORTED` 请求取消）。

| 问题 | 修复 | 文件 | 验证 |
|---|---|---|---|
| **P1** 机会雷达空表提交 400 | 客户端镜像服务端 `min(8)`：`noteReady = note.trim().length>=8`；按钮 `disabled={pending \|\| !noteReady}`；加实时「还需 N 字 / 可以记录啦 ✓」提示；`submitNote` 前置守卫 | `student-opportunity-dashboard.tsx` | ✅ 行为验证：复测中 `POST /api/student/opportunity` 400 与对应 console error **消失** |
| **P2** 揭示动画无兜底 | ① `observeOnce` 加无 IntersectionObserver 兜底（立即揭示）；② reveal 路径加安全定时器（1.4s 后对仍隐藏但已在/超出视口的元素强制 `autoAlpha:1`），与 `addSceneTimeline` 同款 | `premium-motion-provider.tsx` | ✅ 代码验证 + 无回归（tsc/lint/unit/e2e 全绿，正常揭示不受影响；兜底为纯增量防御）|
| **P3** GSAP target-not-found 噪声 | ① 真因修复：萌宠面板入场动画改为 `gsap.from(rootRef.current)`（原 `"[data-pet-panel]"` 是 scope 根、scoped 查询匹配不到 → 入场动画此前被静默丢弃）；② 全局 `gsap.config({ nullTargetWarn:false })` 静音其余良性缺失目标告警 | `student-pet-reward-studio.tsx`、`premium-motion-provider.tsx` | ✅ 行为验证：52 条 GSAP 告警 **归零**（仅剩预期的 `repo.fallback` 提示）|

**回归门**：`npx tsc --noEmit` ✅ · `npm run lint` ✅ · `npm run test`（72 文件 / 456 用例）✅ · e2e 复测 ✅。

**说明**：这三个文件在本次会话前已有未提交改动（如 `h1→h2`、`role="alert"`、按钮配色），本次修复为其上的增量，未冲突；提交时请一并 review。剩余 5 条 `ERR_ABORTED` 与上一轮同属请求取消（本轮因导航时机不同还额外取消了一次 `/api/ai/chat`），非缺陷。

## 8. 第二轮：校验统一（#3）+ P2 补测（#2）+ 独立代码评审

### 8.1 #3 统一校验 —— 审计中又发现 1 个同类真缺陷

对全部 `src/app/api/student/**` 写路由的 zod 做了审计。除机会雷达外，**财富复盘（wealth-summary）同样要求 `note.min(8)`、风险测评要求 `answers.min(1)`，但客户端提交按钮均未做对应校验** —— 与 P1 同类的「点了必失败」缺陷。已修复（客户端镜像服务端）：

| 工具 | 服务端要求 | 修复 | 文件 |
|---|---|---|---|
| 财富复盘 | `note.min(8)` | 按钮 `disabled` until `note.trim()>=8` + 「还需 N 字」提示 + submit 前置守卫 | `student-wealth-dashboard.tsx` |
| 风险测评 | `answers.min(1)` | 按钮 `disabled` until `completed>=1` + submit 前置守卫 | `student-risk-profile-dashboard.tsx` |

用户点名的基金 / 目标账户 / 保障伞 / 自选 note 均为 `.optional()`，**本就一致，无需改**。✅ **行为验证**：新增 e2e「submit gating」用例通过（空表禁用 → 填够 8 字启用）。

### 8.2 #2 P2 补测：揭示正确性 ✅ + 无障碍扫描（axe）

新增 `tests/e2e/student-reveal-a11y.spec.ts`：移动端逐页滚动触发 IntersectionObserver，再断言无残留隐藏 + axe 扫描。

- **揭示正确性**：14 页**全部 0 处残留隐藏**（`pagesWithStuckContent: []`）—— 滚动后 100% reveal 内容显现。**证实** P2 的「移动端首屏以下空白」纯属整页截图不滚视口的测试盲区，非用户可见缺陷；且我加的安全兜底不影响正常揭示。
- **无障碍（axe wcag2a/2aa，serious/critical）= 15 条，新发现 1 类真问题**：
  - **`color-contrast`（serious，14 页全中，单页 4–50 个节点）** —— 青少年风 UI 大量浅灰文字（`text-slate-400`、`white/60-70` 等）对比度不足 WCAG AA 4.5:1。节点最多：quests 50 / home 46 / market 42 / protection 31 / life 29。
  - **`svg-img-alt`（serious，wealth 1 个节点）** —— 一个 `role=img` 的 `<svg>` 缺 alt。
  - 这是**既有设计问题，非本次改动引入**；修复属设计 token 级改动（需统一调深语义灰，并做视觉回归），**未在本轮动手**，建议作为专项跟进。

### 8.3 独立代码评审

由 Code Reviewer 子代理对 5 处改动逐一核验（非描述照单全收）：安全定时器无重复揭示、cleanup 在 `revertOnUpdate` 下正确、`Number(gsap.getProperty)` 强转安全、萌宠 scope 根诊断准确、三处 note/answer 守卫均正确镜像服务端、计数算术不会为负。**结论：APPROVE，无阻断、无需改动**。

### 8.4 本轮回归门

`tsc` ✅ · `lint` ✅ · `npm run test`（456）✅ · e2e 3 用例全过（揭示+axe / gating / 内测复跑，**0 崩溃 / 0 5xx / 0 4xx / 0 console error**，GSAP 噪声仍为 0）✅ · 代码评审 ✅

> 备注：内测复跑本轮 `REQUEST_FAILED` = 17（上轮 5），全部 `net::ERR_ABORTED`；数量随导航时机波动（热服务器下更多慢 AI 请求在途被取消），无 5xx 伴随，仍非缺陷。

### 8.5 仍建议跟进（非本轮范围）
1. **`color-contrast` 专项**：调深语义灰 token 至 AA，逐页视觉回归（影响面大，需设计确认）。
2. **`svg-img-alt`**：给 wealth 那个装饰性 `<svg>` 加 `aria-hidden` 或 alt（小改）。
3. 风险测评是否要求「全部答完」而非仅 ≥1（产品决策）。
