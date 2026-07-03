# 投资人格测评修复 + 任务中心翻卡抽卡 — PRD / 实施计划（待 Review）

> **状态**：草案 v1，供你 review。确认无误（并回答 §10 决策）后再展开为逐任务 TDD 执行计划并开工。
> **日期**：2026-06-18
> **目标库**：`D:\树德实验中学（清波）\C2\brown-zone-web`
> **关系**：本 PRD 聚焦你点名的两个功能（Risk Lab 投资人格 + 任务中心抽卡），是 `2026-06-17-full-stack-wiring-local-db.md` 里 C-4 / C-6 的**深化版**；共用同一前置 **Phase 0（本地数据库可靠化）**。
> **方法**：由 2 路只读代理实测代码 + 主控亲自核验关键 bug，每条结论可溯源到 `文件:行号`。

---

## 0. 一句话结论

**"情境选择点不动" 是一个一行级的 React 状态 bug**（`upsertAnswer` 只替换不追加，新用户首次进来 `answers=[]` 永远点不亮）——改一行即可让 6 题真正能做、能生成投资人格。在此之上，你要的两件大事是：**①投资人格从"只有静态问卷"升级为"AI 读真实行为数据复评"**（现在完全没建，但所需的行为信号在 `adaptive-events.ts`/`tutor-radar.ts` 里已算好，接 `ai.ts` 即可）；**②任务中心从"点击领取"升级为"翻卡/抽卡"游戏化**（领取后端已通，缺的是 GSAP 翻转动画 + 一张卡库表 + 卡面美术）。卡面用 AI 生图产出、存 `public/brand/quest-cards/`、用 `next/image` 导入。

> 一处诚实更正：上一版调研曾说"风险测评结果不落库"——**经复核不成立**。`risk_profiles` 表（迁移 0015）已完整落库，POST 正常写、GET 正常读，"GET 返回默认值"只发生在用户从未提交过时（正确空态）。本 PRD 据实修正。

---

## 1. 背景与问题诊断（实测，每条带 file:line）

### 1.1 Feature A — 投资人格测评（Risk Lab，`/student/risk-profile`）

**A-bug（致命、已主控核验）：6 个情境无法勾选**
- 根因：`src/components/student/student-risk-profile-dashboard.tsx:70-72`
  ```ts
  function upsertAnswer(answers, next) {
    return answers.map((a) => (a.questionId === next.questionId ? next : a)); // 只替换，从不追加
  }
  ```
- 触发：新学生首次进入 `answers` 初始化为 `[]`（`:148-150`，`initialAnswersPersisted=false`）。点击选项 → `upsertAnswer([], next)` → `[].map()` → `[]` → `setAnswers([])` → state 不变 → 圈点不亮、`completed` 恒 0（`:178-182`）、"0/6 已选择"不动（`:319`）、"生成我的投资人格"按钮因 `completed===0` 永远禁用（`:386`）。
- 点击元素本身是真 `<button onClick>`（`:344-352`），POST `/api/student/risk-profile`（`:193`）也正常——**纯前端一行 bug，不是架构问题**。只对"还没存过画像的新学生"100% 触发，正好是你截图的场景。

**A-gap：所谓"AI 根据行为数据统计分析的投资人格"目前完全没建**
- 现在的人格分只用 6 道静态题（0.78）+ 聚合 riskScore（0.14）+ 分散分（0.08）（`src/lib/risk-profile.ts:449`），**没有读任何真实行为**（`actionLog`/`snapshots`/事件历史）。
- 但所需"行为证据"项目里**已经算好**：`adaptive-events.ts` 的 8 个检测器（过度交易/复仇式交易/债券规避/从不分散/囤现金/损失锚定/羊群/连涨，各带 `confidence`）、`tutor-radar.ts` 的 6 维 0–100 分、`allocation.ts` 的风险/纪律/分散分。接 AI 只是"组装这些信号 → 经 `ai.ts` → 生成人格文本"。

### 1.2 Feature B — 任务中心（Quest Hub，`/student/quests`）

- **领取后端已通**：任务全部从真实行为实时派生（`src/lib/quests.ts:280-476`），"已领取"持久化在 `scenario_runs.actionLog` 里（`claimQuestReward` `quests.ts:478-525`，`claimQuestRewardForUser` `repo.ts:1901-1924`），幂等。**但只是 "fetch + 文字态切换"，没有任何翻卡/抽卡动画**（`student-quest-dashboard.tsx:580-603`）。
- **成就/卡片未落库**：`achievements` 是派生 UI，`schema.ts` 无 achievements/cards 表（已核 20 张表）。抽卡要"拥有关系"必须新建表。
- **零战力耦合天然成立**：战力榜由独立 `leaderboard/**` 算，与任务/抽卡无代码耦合——抽卡只要不调 `recomputePowerForUser` 即天然不发战力（符合你"奖励只装饰"的要求）。
- **美术管线**：全站当前 **100% 内联 SVG、零位图**（`public/brand/` 只有 SVG）。动画库只有 **GSAP**（无 framer-motion）；GSAP 已能驱动 3D（`premium-motion-provider.tsx:84-128` 的 `rotateY`+`transformPerspective:900`），翻卡可直接复用；`reduced-motion` 有 CSS 全局兜底（`globals.css:332-341`）+ JS 守卫范式（`student-quest-dashboard.tsx:143-146`）。

### 1.3 共性根因（回答"为什么没看到功能/点了没反应"）
和上一版 PRD 同源：**①本地数据库当前不可靠（停摆+无可复现启动）→ 写操作失败、读回退演示数据**；②少数交互有"能用但被一行 bug 卡死/没动画"的问题。功能多数已建，差的是"链路打通 + 真能跑"。

---

## 2. 目标与成功标准（可验收）

| 目标 | 成功标准 |
|---|---|
| 情境选择可用 | 新学生能逐题勾选，"0/6"实时累加到"6/6"，"生成我的投资人格"解禁、点击后出人格分+雷达图+配置对比，刷新仍在 |
| AI 行为人格 | 打满若干回合后，能基于真实 `actionLog`/信号生成一段人格分析（含证据与下一步）；AI 不可用时有规则兜底、页面不崩 |
| 任务抽卡可玩 | 任务"领取"变成翻卡/抽卡动画：点击→翻转→揭晓奖励卡；抽到的卡入"我的卡库"、刷新仍在；reduced-motion 下直接给终态 |
| 卡面美术 | 卡正/背面有成套美术，导入代码后渲染正常、与品牌色一致、移动端清晰 |
| 后端可用·高可靠 | 上述写操作都持久化、幂等；失败显示中文错误+重试；抽卡零战力耦合；DB 健康/停机两条路径都验过 |
| 逻辑自洽 | 人格分公式纳入行为维度后不自相矛盾；抽卡稀有度/触发规则可复现（种子化） |

---

## 3. 范围与依赖

**In scope**：A-bug 修复、A 两段式人格（问卷版 + AI 行为版）、B 翻卡/抽卡交互 + 卡库后端 + 卡面美术管线。
**前置依赖**：**Phase 0 本地数据库可靠化**（见 `2026-06-17-full-stack-wiring-local-db.md` Phase 0）——A/B 的落库与"真能用"验证都要库在跑。**A-bug 修复不依赖 DB**（纯前端），可最先做、立竿见影。
**Out of scope（本轮不做）**：战力榜/性能长尾、微信支付、其它理财页重构。

---

## 4. Feature A 设计：投资人格测评

### A1 — 修选择 bug（一行，最高优先，不依赖 DB）
- 文件：`src/components/student/student-risk-profile-dashboard.tsx:70-72`
  ```ts
  function upsertAnswer(answers: RiskProfileAnswer[], next: RiskProfileAnswer) {
    const exists = answers.some((a) => a.questionId === next.questionId);
    return exists
      ? answers.map((a) => (a.questionId === next.questionId ? next : a))
      : [...answers, next];           // ← 不存在则追加
  }
  ```
- 其余链路（onClick `:348`、completed `:182`、POST `:193`、API、`normalizeRiskProfileAnswers`）均正常，无须改。
- 验收：组件测——空答案点击某题某项后，`completed` 从 0 变 1、该题该项选中；6 题选满后提交按钮解禁。

### A2 — AI 行为人格复评（两段式产品）
> 产品形态：第一段=6 题问卷给"初始人格"（A1 修好即可用）；第二段=学生玩了若干回合后，点"用我的真实行为复评"→ AI 读行为数据生成更准的人格。两段在 payload 上用 `source: "questionnaire" | "behavior_ai"` 区分。

- **数据组装（路由内，纯数据）**：`PersonaSignalInput = { adaptiveEvents: detectAdaptiveEvents(run), radar: buildTutorRadarPayload(state).metrics, wealth: buildWealthSummary(run), actionCounts: countActions(run), netWorthTrend: run.snapshots.map(s=>s.netWorth), questionnaire?: savedAnswers }`。全部复用现有纯函数，无新算法。
- **AI 集成（强制走 `src/lib/ai.ts`）**：新增 `requestBehaviorPersona(input)`，**完全照搬** `requestTutorRadarPayload`（`ai.ts:530-558`）+ `normalizeRadarPayload`（`ai.ts:307-345`）范式：`buildBehaviorPersonaPrompt` 组 system/messages → `requestRemoteText({system,messages,fallbackText})` → `normalizeBehaviorPersona(text, ruleFallback)` 用 `extractJsonObject` 容错解析 + 逐字段夹取。
- **输出契约（固定 JSON）**：`{ band ∈ defensive|steady|balanced|growth, label, archetype, summary, evidence[], nextSteps[], confidence }`，`band` 对齐现有 `bandFromScore`（`risk-profile.ts:259-297`）。
- **规则兜底（AI 不可用必备）**：`ruleFallback` 由现有纯函数合成——`band/label` ← `bandFromScore`、`evidence` ← 命中的 `adaptive-events` 的 teachingPoint、`nextSteps` ← `coachNextSteps`（`risk-profile.ts:403-438`）；前端按 `provider` 标"本地教学兜底"（与雷达图/历史复盘一致）。
- **落库**：见 §6 数据模型——推荐 **A1 方案**（人格塞进 `risk_profiles.answers` JSONB，零迁移）或 **A2 方案**（加列 `behavior_persona/persona_provider/analyzed_at/input_digest`，迁移）。`input_digest` 用于"行为没变就不重复打 AI"。

---

## 5. Feature B 设计：任务中心翻卡 / 抽卡

### B1 — 翻卡/抽卡交互（GSAP，纯前端）
- 落点：**本周任务栏的 quest 卡**（`student-quest-dashboard.tsx:547-605`，已有 `claimQuest`+`claimable/claimed` 门控）。活动权益卡（`:357-405`）保持 `<Link>` 跳转语义不动。
- 动画：卡容器 `transform-style:preserve-3d`，正/背面 `backface-visibility:hidden`，点击"抽卡"→ `gsap.to(card,{rotateY:180, ease: premiumMotion.ease.reward})`（复用 `motion-system.ts` 的 `reward` 回弹 `:7`）→ 揭晓背面奖励。作为**独立 timeline**，不与入场 `data-motion-card` reveal 冲突。
- 卡正面 = 任务标题/类别/进度；卡背面 = `reward`（装饰奖励）+ `coachNote`（导师点评）——**字段都现成**（`StudentQuestItem` `quests.ts:11-22`），无需新 API 字段即可先把"翻卡看奖励"做出来。
- **reduced-motion 守卫（必须）**：照抄 `student-quest-dashboard.tsx:143-146` —— `matchMedia("(prefers-reduced-motion: reduce)")` 命中时 `gsap.set` 直接到背面终态、不旋转。
- 验收：点击翻卡有 3D 翻转→揭晓；reduced-motion 下瞬间显示背面；键盘可操作、`aria` 正确。

### B2 — 抽卡后端（卡库 + 幂等领取，装饰奖励、零战力）
- **新表 `card_collection`**（仿最新的零战力先例 `round_predictions` `schema.ts:196-210`）：`{ id PK, userId FK→users cascade, cardId, source('quest_claim'|'streak'|'achievement'), drawnAt, meta jsonb, UNIQUE(userId,cardId), index(userId) }`。迁移见 §6。
- **端点**：改造 `POST /api/student/quests`（或新增 `/api/student/quests/draw`）：`checkOrigin` + `requireUser("student")` + 事务内查重幂等（仿 `createRoundPredictionForUser` `repo.ts:1387-1427`）+ **只 INSERT card_collection，绝不调 `recomputePowerForUser`、不改财务字段**。继续沿用 actionLog 写一条溯源日志（与现有领取一致）。
- **仓储**：新增 `drawCardForUser(userId,{trigger})` / `listCardCollectionForUser(userId)`，走 `withDb`+事务+内存兜底，**登记进 fallback 白名单**（`repo.ts:303-312`，否则 `repo-fallback.audit.test.ts` 会红）。
- **牌库定义**：卡名/稀有度/卡面素材 key/教学寄语 → `content.ts`（与 `learningModules` 同级）；抽卡选卡逻辑（按触发源 + 已拥有集做加权随机，用 `mulberry32` 可复现）→ **新 `src/lib/cards.ts` + `cards.test.ts`**（纯函数、无 IO）。
- 验收：同卡只拥有一次（幂等）；抽卡不改净值/战力（断言）；DB 停机时显示中文错误+重试。

### B3 — 卡面美术管线（AI 生图 → 导入代码）
> 你的诉求：用 GPT 生图做卡正/背面，再导入前后端。项目当前零位图、纯 SVG——卡面位图是**新资产类**，可接受（游戏卡适合插画）。

**推荐做法（混合，兼顾美观与可维护）**：
1. **卡背（共享、少量、纯装饰）→ AI 生图位图**：按稀有度生成 1–3 张卡背（如 普通/稀有/史诗），统一画风（暖琥珀 + 金融教育调性），导出 `webp`（带 `png` 兜底）存 `public/brand/quest-cards/back-{rarity}.webp`，用 `next/image`（参考 `hero-stage-art.tsx:15-23`）引用。
2. **卡正面（数据驱动、需可读/可改文案）→ 模板化**：用 SVG/HTML 框 + 动态渲染任务标题/奖励/点评文本（保持文字清晰、可 i18n、改文案不用重出图），插画槽位放一张 AI 生图或仿 `module-illustration.tsx` 的内联 SVG primitive。
3. （备选）**全位图**：每张卡正面都出一张完整位图——美观但文案写死、改一次要重出图、体积大。一般不推荐用于会变的任务卡。

**生图工具与流程**（实现阶段执行，PRD 阶段不生成）：
- 用可用的 AI 生图能力（如 `ce-gemini-imagegen` / GPT-image）成套生成卡背与插画槽，**固定风格提示词**保证整套一致；
- 人工/脚本压成 `webp`（≤ 一定 KB），放 `public/brand/quest-cards/`；
- 组件 `QuestCard` 用 `next/image` 引卡背、模板渲染卡正；色板对齐 `module-illustration.tsx:21-22`（红涨绿跌、amber/ink）。
- 验收：卡面在桌面/移动端清晰不糊、加载有 `sizes`/`priority` 合理设置、暗色面板下对比达标。

---

## 6. 数据模型与迁移清单
> 用 `npm run db:migrate`（**不要** `drizzle-kit push`）。当前迁移已到 `0017`（round_predictions）等；新迁移用下一个可用编号（`db:generate` 自动分配，或手写续号）。schema.ts 与 SQL 同改。

- **A 人格落位（二选一）**：
  - **A1（推荐，零迁移）**：把 AI 人格塞进 `risk_profiles.answers` JSONB（`answers.behaviorPersona = {...}`），仅改 `upsertRiskProfile` 入参与类型。
  - **A2（结构化，加迁移）**：`risk_profiles` 加列 `behavior_persona jsonb / persona_provider varchar(16) / analyzed_at timestamptz / input_digest varchar(64)`；同步改 `schema.ts:102-107`、`RiskProfileRecord`（`repo.ts:165-170`）、`toRiskProfileRecord`（`repo.ts:502-509`）、`upsertRiskProfile`。
- **B 卡库（必做迁移）**：新建 `card_collection`（§5 B2 结构），SQL 仿 `0017_round_predictions.sql`；`repo.ts` 新增 drawCard/listCards + fallback 白名单。
- **C 成就持久化（可选，默认不做）**：成就继续实时派生即可闭环；仅当需要"解锁时间戳/跨局留存/推送"才建 `achievements{userId,achievementId,unlockedAt}`。

---

## 7. 分阶段实施计划（含依赖）

```
前置：Phase 0 本地数据库可靠化（见 2026-06-17 PRD）—— A 落库/B 抽卡/验证都需库 Up
  └─ A1 修选择 bug      ← 纯前端，不依赖 DB，最先做、当天见效
Phase A（投资人格）
  A1 一行修复 + 组件测                         ⏱️ 0.5 天
  A2 AI 行为人格：数据组装 + requestBehaviorPersona + 规则兜底 + 落库 + 前端"复评"入口  ⏱️ 2–3 天
Phase B（任务抽卡）
  B1 GSAP 翻卡交互（先用现成字段做"翻卡看奖励"）+ reduced-motion + a11y  ⏱️ 1–1.5 天
  B2 card_collection 表 + drawCardForUser 幂等端点 + cards.ts 选卡逻辑     ⏱️ 1.5–2 天
  B3 卡面美术：AI 生图卡背 + 模板卡正 + next/image 导入                    ⏱️ 1–2 天
Phase V 验证：质量门 + DB 停机故障演练 + e2e（做题→人格 / 抽卡→入库刷新仍在）  ⏱️ 0.5–1 天
```
合计约 **7–10 个工作日**（A1 当天就能让"情境选择"复活）。

---

## 8. 测试与验收策略
- **TDD**：A1（组件测：空答案可勾选）、A2（`requestBehaviorPersona` normalize 容错 + 规则兜底纯函数测，MSW mock AI）、cards.ts（选卡确定性/幂等测）、drawCardForUser（幂等 + 零战力断言）先写失败测试。
- **复用现有分层**：vitest + `vitest-axe`（翻卡 a11y）+ Playwright e2e + MSW（AI 不真连）。
- **故障演练**：停库点一遍，确认中文错误+重试。
- **每 Phase 独立 commit/PR**；迁移 `db:migrate`；AI 只走 `ai.ts`；不 `git add .`。

---

## 9. 风险与回滚
| 风险 | 缓解 |
|---|---|
| A1 改 upsert 影响"已存画像"用户切换选项 | 组件测覆盖 both（空 + 预填）路径；逻辑对两者都正确 |
| AI 人格输出格式漂移 | 照搬雷达图 `normalize`+`extractJsonObject` 逐字段夹取兜底；规则结果兜任一缺失 |
| 每次 GET 都打 AI（成本/延迟） | `input_digest`：行为未变不重算；复评为显式按钮触发，不在 GET 自动跑 |
| 抽卡误发战力 | 端点禁止调 `recompute*`；单测断言净值/战力不变 |
| 位图拖慢首屏 | 卡背少量 webp + `next/image` lazy + `sizes`；卡正模板化不出图 |
| reduced-motion 下翻卡卡死 | JS 守卫直接 `gsap.set` 终态（照抄现有范式） |
| 回滚 | 每 Phase 独立分支/PR；A1 一行 `git checkout`；新表 `db:down:hard && db:up` 重建 |

---

## 10. 待你拍板的决策点（review 时一并回我）

1. **AI 人格落库方式**：(a) A1 塞 JSONB（零迁移、最快，推荐）还是 (b) A2 加结构化列（查询/审计更清晰，多一次迁移）？
2. **AI 复评触发时机**：(a) 学生显式点"用真实行为复评"按钮（省 AI 成本、推荐）还是 (b) 打满 N 回合后自动复评？
3. **卡面美术方案**：(a) 混合——AI 生图卡背 + 模板化卡正（推荐，文案可改、清晰）；(b) 全 AI 位图卡（最炫但文案写死、改字要重出图）；(c) 全内联 SVG（零位图、与现有美术统一，但画风偏几何不够"卡牌感"）。
4. **生图工具**：用 `ce-gemini-imagegen`（Gemini Nano Banana Pro）还是你指定的 GPT 生图？（我两者都能驱动；定了我按它出整套同风格卡面。）
5. **抽卡范围**：本轮先做"翻卡看奖励"（B1，用现成字段，最快）+ 卡库落库（B2），还是连"加权随机抽稀有卡"（cards.ts 完整玩法）一起做？
6. **执行方式**：Subagent 驱动（本会话，推荐）/ 转 Codex 即粘即用提示词 / 本会话分批+检查点。

---

## 11. 批准后的下一步
你 review 通过（并回答 §10）后，我会：
1. 把本 PRD 展开为**逐任务 TDD 执行计划**（每任务：写失败测试→跑红→最小实现→跑绿→提交），存 `docs/superpowers/plans/`；
2. 按你选的执行方式开工：**A1 一行修复先行**（当天让情境选择复活），再按 A2 → B1 → B2 → B3 顺序推进，每阶段交付检查点；
3. 卡面美术按 §10 决策用生图工具产出整套，导入后截图给你确认。
```
