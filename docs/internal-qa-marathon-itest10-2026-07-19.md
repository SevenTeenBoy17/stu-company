# itest10 全流程内测 + 修复 —— 开发文档（2026-07-19）

> 在含 LC10h 修复 + 参赛 4 人超管 + 预合并家庭绑定修复的当前分支（PR #18）上再跑一轮全真内测：
> 确定性基线 → 真 DB 生产服务器活探针 → 10 维并行对抗审查（逐条证伪）→ 根因修复 → 复验推送。
> 方法：`Workflow` 多 agent 扇出（10 维 finder → 每条 finding 对抗证伪，存疑即杀），23 agent / 0 error。

## 一、基线与真流程证据（修复前）

| 项 | 结果 |
| --- | --- |
| tsc / lint / vitest / build | 0 / 0 / **703** / 0 |
| 真 DB 生产服 `:8920`（全新 `brownzone_it10`，迁移+种子 12 用户） | Ready |
| api-probe | **34/34 PASS**（CSRF/守卫/沙盘/任务/理财/榜单/真429/AI会话IDOR隔离/错误形状） |
| 新面探针 | **12/12 PASS**（4 超管团队+口令反例 / 家庭 1↔1 强制 / 未成年支付红线） |
| 服务器日志 | 0 非受控 5xx / 0 未捕获错误 |

## 二、对抗审查结论（10 维 × 证伪）

raw=13 → **CONFIRMED/PLAUSIBLE=12，REFUTED=1**。证伪的 1 条：`syncGrowthReportForStudent` 无锁读链接与家长认领并发回退占位——读代码确认认领走 `selectRunForUserForUpdate` 行锁 + 认领只改未认领占位，不可达，判 REFUTED。

## 三、确认缺陷与修复（12 条全修）

| # | 级 | 缺陷 | 修复 |
| --- | --- | --- | --- |
| 9 | **P2** | 事件「gamble」决策：stake 按**净值**算，却只对**现金**结算并 `max(0,…)` 封底。把现金全存进 savings 后，亏损被静默清零、盈利照发 → **零成本裸赌=无风险正期望，凭空造钱刷净值/榜单** | `applyEventChoice` 亏损按 现金→储蓄→债务 级联真实结算；log 记真实净值变动（simulation.ts） |
| 4 | **P2** | `withDb` 外层 `direct_supabase` 重试：客户端超时只 reject 等待方、**不取消 pooler 上仍在跑的事务**，对非幂等写函数会二次执行 → 推进回合/领奖/理财写被双记，run 状态损坏 | 写函数（`WRITE_FNS`）**一律不做 direct 重试**，失败冒泡（P2 fail-loud）；仅读走跨区兜底（repo.ts） |
| 6 | **P2** | 预合并家长绑定防劫持修复只活在 DB 分支，单测全走 store 兜底 → 守卫**未被真实覆盖（假绿）** | 见 #11：为 store 补同款守卫 + 新增 store 路径劫持/解绑用例（3 条），守卫真正被断言 |
| 11 | P3 | 内存兜底 `store.registerUserByInvite`/`registerUserByEmail` 认领链接**缺占位守卫**：公开 demo 家长码 `MRB-PARENT-2026`（studentLinkId=bond-1，已绑 parent-1）可被陌生人劫持已绑学生的唯一成长报告 | 两条 store 认领路径加 `parentUserId===studentUserId` 占位守卫，与 DB 路径对齐（store.ts） |
| 12 | P3 | 误绑后**永久锁死**：1↔1 守卫拒绝再铸，但错误账号认领后无换绑/解绑通道（错误提示「请联系管理员」却无此接口） | 新增 `resetGuardianBindingForStudent`（repo+store）：置回占位、撤销误绑家长家庭席位+成长报告；超管专用 `POST /api/admin/family/reset-binding`（CSRF+isSuperAdmin） |
| 7 | P3 | 家庭继承 Premium 未在 Server Component 生效：`getCurrentUser`（SSR）不套 `applyFamilyEntitlement`（仅 api-guard 套），付费家庭学生 SSR 仪表盘显示红色「试用已结束」 | `getCurrentUser` 补 `applyFamilyEntitlement`（对非学生 no-op），与 api-guard 对齐（session-user.ts） |
| 8 | P3 | `applyFamilyEntitlement` 无条件用家长到期日覆盖学生**自购 Premium 的更晚到期日** | 家庭共享只延不缩：`laterExpiry(自购, 家长)` 取更晚（subscription.ts + repo + store） |
| 10 | P3 | 战力 `computePowerScore`：纯挂机局（零波动/零回撤/净值不变）白拿满分回撤+中位风险调整+纪律基线 ≈1110 分 → tier3 精明投资者，反 YOLO 形同虚设 | `isInactiveRun` 严格闸门 + `inactivityFactor=0.35` 衰减，挂机掉回 tier1 理财新手（<400）；任何真实交易/学习都破闸不受罚（power-score.ts） |
| 1 | P3 | 机会训练场主题卡是单选切换却无 `aria-pressed`，选中态仅靠颜色（WCAG 4.1.2/1.3.1）；且不在 axe 覆盖清单 | 卡片 `aria-pressed={active}` + 专属组件用例断言恰一枚 pressed（opportunity-dashboard） |
| 2 | P3 | 目标账户「节奏正常」徽标 `text-brand` on `bg-brand-soft` ≈2.2:1，正文对比不达标 | `text-brand` → `text-brand-ink`（amber-800，≈5.8:1）（goal-accounts） |
| 3 | P3 | 卡库空态「Card Library」眉标 `text-brand` on 近白底 ≈2.5:1 | `text-brand` → `text-brand-ink`（collection.tsx） |
| 5 | P3 | CI integration job 的 **job 级** `continue-on-error` 吞掉迁移/种子回归（不只 RLS 角色缺失） | 移到步骤级：迁移+种子**变阻塞**（真回归红叉可见），仅 apply-policies/集成测试（需 authenticated 角色）保留 soft（ci.yml） |

## 四、复验（真实命令输出，修复后）

```
npx tsc --noEmit    → 0
npm run lint        → 0 errors
npm run test        → 109 files / 713 tests passed（+10：反挂机×2 / laterExpiry×2 / store 劫持+解绑×3 / gamble 亏损真结算×1 / 不降级×1 / aria-pressed×1）
npm run build       → exit 0
```

**新构建真 DB 生产服 `:8921` 运行时活探针 —— 52/52 全过（0 回归）**：

| 探针 | 结果 |
| --- | --- |
| api-probe（全 34 项）| 34/34 |
| 新面（4 超管+口令反例 / 家庭 1↔1 / 未成年支付红线）| 12/12 |
| reset-binding #12（铸码→误绑锁死→学生调用被拒403→超管解绑200→再铸成功→未绑定解绑领域拒绝）| 6/6 |

## 五、方法论沉淀

- **对抗审查的高确认率来自「找自己刚改的高风险面」**：12 条里 5 条直接落在近几轮新代码（家庭绑定 store 镜像、预合并守卫的测试假绿、家庭继承 SSR/到期日、我自己 1↔1 修复引入的锁死）。CI 全绿 ≠ 逻辑/并发/授权/兜底一致性无回归。
- **假绿的典型形态**：修复只落在 DB 分支，而单测只走内存 store 兜底 → 守卫从未被真实执行（#6）。修法是给兜底路径补同款守卫 + 针对兜底路径写断言。
- **fail-loud 优先于韧性**：客户端超时不取消底层事务，对非幂等写做「韧性重试」反而制造双写（#4）——写路径宁可响亮失败让用户重试，也不赌重试幂等。
- **一个修复可能引入下一个缺陷**：预合并的 1↔1「拒绝再铸」堵住了劫持，却制造了误绑锁死（#12）——每加一道拒绝，都要配一条运营解药。
