# Brown Zone — 严格多角色审查发现（2026-06-15 re-audit）

> 42 confirmed defects: 2 critical data-loss bugs, a billing double-grant race, a
> 12-round game with no ending, and pervasive scale-mismatch/decoupling that breaks
> the core teaching loop — plus broad a11y, animation-wiring, and empty/loading-state gaps.

**统计**：19/21 区域报告 · 144 原始发现 · 46 高危已对抗式复核（42 确认缺陷）。
未覆盖：`perf`、`animation`（agent 触发 Overloaded，下轮补）。
完整 transcript：`~/.claude/projects/D-------------C2/.../tasks/wckgsvn3r.output`。

分类（供 user 决策）：**纯正确性 bug**（可放心修）vs **教学设计取舍**（建议 user 拍板）。

## 优先修复清单（top 10）

### #1 `critical/functional` 家长邀请注册因重复成长报告而崩溃（阻断主入职）— 纯 bug
- 位置：`src/lib/db/repo.ts:1011-1016`（registerUserByInvite 家长分支）vs `schema.ts:236` 的 uniqueIndex `growth_reports_student_unique`
- 修复：家长分支的 growth_reports insert 改 upsert（`.onConflictDoUpdate({ target: growthReports.studentUserId, set: { parentUserId, payload } })`），镜像 `syncGrowthReportForStudent`。当前 seed 邀请码 `MRB-PARENT-2026` 指向已有报告的 student-1 → 唯一冲突 → 事务回滚 → 家长永远注册不了。

### #2 `critical/functional` 历史复盘用静态行情脚本而非该局种子事件时间线（事件错位、还喂给 AI）— 纯 bug
- 位置：`src/lib/history-review.ts:101-123`（buildTimeline）vs `src/lib/simulation.ts:659-660`
- 修复：buildTimeline 每回合用 `eventIdForRound(state.run.eventTimeline, snapshot.round, round.eventId)` 解析（round.eventId 仅旧局兜底），与 buildSimulationState 一致；连带修好 buildActionGroups + buildHistoryReviewAiContext。补 history-review.test.ts（当前 0 覆盖）。

### #3 `high/functional` 支付履约在并发回调下重复发放（无行锁、无唯一约束）— 需迁移
- 位置：`src/lib/db/repo.ts:2602-2691`（fulfillPaymentOrder）；`schema.ts:77`（order_id 仅普通索引）
- 修复：order SELECT 加 `.for("update")`；`schema.ts:77` 改 `uniqueIndex` + 迁移。

### #4 `high/functional` 12 回合无终点 — 推进按钮超过第 12 回合仍可点、假报进度、无结算页 — 含新 UI
- 位置：`simulation.ts:507-513`；`student-sandbox.tsx:522-530`；`api/sim/advance-round/route.ts:22-32`
- 修复：round 12 时返回 finished；前端用 `currentRound >= totalRounds` 禁用/替换按钮为「查看结算/复盘」并渲染结算面板。

### #5 `high/functional` 三个理财工具在默认新局「永远满级无压力」（金额量级与六位数沙盘资金错配）— 偏设计
- 位置：`life-cashflow.ts:344-352,400-411`；`credit-lab.ts:117-139,160-181,272-279`
- 修复：应急金/负债率分母与沙盘 netWorth 解耦，或合成月收入/本金放大到沙盘量级；补单测断言默认开局非「全安全」。

### #6 `high/functional` 给学生看的事件卡 与 实际驱动行情的因素脱钩（cause ≠ price action）— 偏设计
- 位置：`simulation.ts:77-96,652-677`；`market-data.ts:620-734`（固定 assetMultipliers）
- 修复：统一来源二选一：(a) 每回合 assetMultipliers 由种子时间线事件推导；(b) 保留固定脚本并显示 marketRounds[r].eventId。

### #7 `high/content` 房产每回合 +2.4% 单调升值，无视所有事件（含 R9 衰退暴跌）— 偏设计
- 位置：`simulation.ts:120-124`（getPropertyValue）
- 修复：让房产响应周期/事件（至少衰退回合回撤），或明确改标为固定收益工具。当前教「房产无风险」，与多元化课程矛盾。

### #8 `high/functional` 定投预览起始回合比真实计划早一回合 — DCA-vs-一次性 的核心教学数字系统性算错 — 纯 bug
- 位置：`src/lib/auto-invest.ts:480`（preview start=currentRound）vs 379/425（plan start=currentRound+1）
- 修复：buildAutoInvestPayload 用 currentRound+1（或抽共享 window helper），与计划对齐。

### #9 `high/incomplete` 风险问卷预填中间选项 — 学生没答就显示 6/6 与人格画像 — 纯 bug
- 位置：`risk-profile.ts:237`（defaultAnswers→options[1]）；`student-risk-profile-dashboard.tsx:174,296,319`
- 修复：初始空选；只计真实点击进度；提交前 score/persona 灰显；让死掉的 `completed===0` 守卫生效。

### #10 `high/incomplete` 战力档案创建后不可编辑 — 未成年人无法改隐私/同意/别名（隐私控制缺失）
- 位置：`rank-dashboard.tsx:52-54`；`api/leaderboard/profile/route.ts:36-90`（后端已 upsert）
- 修复：战力页加「编辑档案/隐私设置」入口，用 card.alias/visibility/consent+region 预填重开 RankOnboarding。

> ranks 11–42 及 quick wins 见 transcript；后续迭代继续提取。

## 修复策略（执行分组）

- **A. 纯正确性 bug，可单测/可视验证（建议优先）**：#1（DB upsert，需跑 DB 验证）、#2、#8、#9。
- **B. 涉及迁移**：#3。
- **C. 教学设计取舍，建议 user 拍板**：#4（结算 UI）、#5、#6、#7、#10（新 UI 流）。
