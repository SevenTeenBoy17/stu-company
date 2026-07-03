# Brown Zone — Codex 整改与升级执行手册（2026-06）

> 配套：本手册执行的是 `docs/review-2026-06-12/` 全套审查结论（`01-问题汇总` / `02-改进优化升级计划` / `03`+`03b` 功能升级）。在 **Codex CLI** 里按顺序执行。
> 风格沿用根目录既有的 `CODEX-WORKFLOW.md`（目标 / 前置 / `提示词 N.N`(可直接粘贴) / ✅验收命令 / ❌回滚 / stop-gate / "Have <agent> ..." 语法）。
> 本手册由 7 路代理起草、再各经一道对抗加固（核对真实 `文件:行号`、实现者≠评审者、验收命令齐备、依赖顺序对齐 `02`）后合成。生成日期 2026-06-12。

---

## 如何使用本手册

1. **顺序不可乱**：先读"第 0 章 Codex 效能最大化"建立操作纪律，然后严格按 **S0 → S1 → S2 → S3 → S4 → 功能升级** 执行。
2. **S0 安全热修必须最先、独立成 PR、当天上线**；**功能升级（C-1~C-10）必须在 S0+S1 之后**（否则给刷分开新口子）——依赖关系与 `02-改进优化升级计划.md` 一致。
3. **每个 Sprint 一条独立分支、一个 PR**；每条提示词即粘即用，已锚定 `01-问题汇总.md` 的真实 `文件:行号`，并声明 `.codex` subagent 的写入范围+禁区。
4. **每段末尾的 ✅验收 是硬门**：未达标不进下一步；危险步（迁移/安全/schema）有 stop-gate，等你确认再继续。
5. 迁移一律 `npm run db:migrate`（**不要** `drizzle-kit push`，本 DB 会崩）。质量门：`npm run lint && npx tsc --noEmit && npm run test && npm run build && npx playwright test`。

### 各章对抗加固结论

| # | 章节 | 终审判定 | 加固修正数 |
|---|---|---|---|
| 1 | Codex 效能最大化：操作方法与全局纪律 | APPROVE_WITH_FIXES | 9 |
| 2 | Sprint 0 — 安全热修 | APPROVE_WITH_FIXES | 9 |
| 3 | Sprint 1 — 教学诚信重设计（反刷分） | APPROVE_WITH_FIXES | 9 |
| 4 | Sprint 2 — 性能与一致性 | APPROVE_WITH_FIXES | 13 |
| 5 | Sprint 3 — 前端可靠性 | APPROVE_WITH_FIXES | 10 |
| 6 | Sprint 4 — 加固、测试与质量门 | APPROVE_WITH_FIXES | 9 |
| 7 | 功能升级 — 多元理财新界面（C-1~C-10） | APPROVE_WITH_FIXES | 10 |

> 判定均为 `APPROVE_WITH_FIXES`：起草稿经对抗复核后修正了若干真实问题（如 S0 补全第 4 个注入点 `repo.ts:1002`、纠正 schema 归属与限流现状等），修正明细见各章正文/脚注。

### 与审查文档的可追溯映射

| 本手册章节 | 来源问题编号（见 `01-问题汇总.md`） | 计划依据（见 `02`） |
|---|---|---|
| S0 安全热修 | SEC-01(P0)、SEC-02、SEC-03、SEC-04 | Sprint 0 |
| S1 反刷分重设计 | DOM-01/02/03/04/05/09 | Sprint 1 |
| S2 性能与一致性 | BE-01~08 | Sprint 2 |
| S3 前端可靠性 | FE-01/02/03/04/05/07/09/10 | Sprint 3 |
| S4 加固/测试/质量门 | QA-01/02、FE-06/08、SEC-05、BE-09~13、DOM-06/07/10/11、FE-11~20 | Sprint 4 |
| 功能升级 C-1~C-10 | —（新增能力） | `03` Part C/F + `03b` Part 三 |

---

## Codex 效能最大化：操作方法与全局纪律

> 本节是 S0–S4 全程的**操作总则**。它不修任何 Bug，但决定了上面每一条提示词能不能被 Codex 一次跑对、不跑偏、不返工。
> 与 `CODEX-WORKFLOW.md` 配套：那份是阶段化 DB/UI Bootstrap 脚本，本节是 **review-2026-06-12 修复轮** 的 Codex 驾驶手册。两份的红线一致，冲突时以 `AGENTS.md` + 本节为准。
> 原则继承计划文档（`02-改进优化升级计划.md`）：**安全 > 教学诚信 > 性能稳定 > 体验一致 > 边角打磨**；不允许在没有对应测试的情况下关闭 P0/P1。
> 真实定位来源唯一：`docs/review-2026-06-12/01-问题汇总.md`。本节所有 `文件:行号` 均以该文件为准并已对齐源码。

### 目标

让 Codex 在本仓库的吞吐与正确率最大化，具体可度量为：① 每个 Sprint 一次成型、零越界改动（reviewer 审计 0 个禁区文件）；② 每条提示词都钉死在 `01-问题汇总.md` 的真实 `文件:行号`，无幻觉定位；③ 危险步骤（迁移 / 安全头 / JWT / power 权重 / 时区基准）一律 stop-gate 等人确认；④ 实现者与评审者永远来自**不同责任组**（AGENTS.md §3.1），每阶段以 `APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION` 收尾。

### 前置（开工前 5 分钟，必须全绿才进 Sprint）

```powershell
# 0. 进仓库根（路径含中文，务必整段引号）
Set-Location "D:\树德实验中学（清波）\C2\brown-zone-web"

# 1. 工作树必须干净 —— 当前在 feat/leaderboard-power-rank，有大量 M（见 git status）
#    修复轮要从干净基线起步：先把现有改动收口（commit 或 stash），否则 reviewer 审计无法区分"本次改动 vs 历史脏改动"
git status
git stash list

# 2. 每个 Sprint 开一条独立分支（S0 必须独立、当天可上线）
git switch -c fix/s0-security-hotfix        # S1→fix/s1-integrity-redesign，依此类推

# 3. 本地 DB 必须先起来 —— 这是本仓库 No.1 时间黑洞
#    DATABASE_URL = Docker 容器 brownzone-pg @ :5433，每次重启机器就停，端口拒连 → 所有写 503、战力榜 onboarding db_unavailable
docker start brownzone-pg
docker ps --filter "name=brownzone-pg"      # STATUS 必须 Up；Schema+seed 持久化在卷里，无需重新 migrate/seed
#    备选（零基建演示）：注释掉 .env.local 的 DATABASE_URL 再重启 dev → 纯内存 store

# 4. 确认 .env.local 关键键就位（不打印值，只看键名）
Get-Content .env.local | Select-String -Pattern "DATABASE_URL|SESSION_SECRET|CRON_SECRET|AI_BASE_URL"

# 5. 基线质量门必须本来就是绿的（否则别开工，先查清是不是你引入的）
npm run lint; npx tsc --noEmit; npm run test

# 6. （仅 S4 令牌统一会用到）记录硬编码颜色"活基线"，作为 FE-06 收尾对比的真实分母
#    不要相信文档里的静态数字（doc 01 写 ~230 是历史快照），以你开工当下的实测值为准
(git grep -nE "#[0-9a-fA-F]{3,8}" src/components/ | Measure-Object -Line).Lines

# 7. 启动 Codex
codex
```

进入 Codex 后**第一件事**输入 `/agents`，确认 `.codex/agents/*.toml` 全部识别到（本仓库自定义 10 个 + agency 池数十个，如 `engineering-security-engineer`、`engineering-database-optimizer`、`engineering-code-reviewer`、`engineering-minimal-change-engineer`、`testing-*`）。识别不到就退出、回 `Get-ChildItem .codex\agents` 排查后重启。

> **跨区延迟背景知识**（写进你的脑子，不用写进提示词）：生产 DB 在 us-east-2，CN→us-east-2 单程往返可达 5s，正好吃满 `DB_QUERY_TIMEOUT_MS=5000`（`src/lib/db/client.ts`）。所以 S2 的"减少 DB 往返"不是微优化而是稳定性主因；本地 Docker DB 是 ~40–140ms，**本地跑得过不代表生产跑得过**，S2 的性能 DoD 必须在预览环境复测。

---

### 提示词族（10 条全局纪律，逐 Sprint 复用）

下面 10 条是**元提示词模板**：每开一个 Sprint，把对应 Sprint 的真实 `文件:行号`（来自 `01-问题汇总.md` 各条目 + `02-改进优化升级计划.md` 各 Sprint 段）填进去再发。它们是上面各 Sprint 提示词的"公共前缀"，不是独立任务。

#### 提示词 M.1 — 选对实现者 + 钉死写/禁区（每条提示词开头都要有）

```
Have <the right implementer for this scope> implement <task>.

WRITE scope (允许改的路径，严格按 AGENTS.md §3 表):
  - <按本 Sprint 实际填写。示例 S0-1/S0-2（SEC-01/02/03）:
       src/lib/db/repo.ts
       src/lib/auth-validation.ts
       src/app/api/auth/register-by-invite/route.ts
       src/app/api/auth/register/route.ts >
FORBIDDEN scope (碰一个字都算越界):
  - src/components/**, src/lib/ai.ts, src/lib/simulation.ts
  - drizzle/** (除非本任务明确含迁移，如 S1-3 / S2-3 / S2-4)
  - 任何不在本 Sprint 问题编号涉及的 route 或 lib 文件

Agent 选型对照（AGENTS.md §3 / §3.1）:
  - src/lib/db/**、drizzle/**、scripts/db-*            → db_architect
  - src/app/api/**                                     → api_wirer
  - src/components/**、page.tsx、globals.css           → ui_implementer（teen-facing 用 teen_ux_specialist）
  - src/lib/simulation.ts、market-data.ts              → finance_event_simulator / education_narrative_designer
  - src/lib/leaderboard/ 纯算分核心(power-score/run-power/ranking/tiers/periods) → finance_event_simulator（pure-core）
  - src/lib/leaderboard/service.ts、repo.ts 边界 + 迁移 → db_architect
  - src/lib/ai.ts、tutor-radar、src/app/api/ai/**      → behavior_ai_analyst
  - src/app/api/billing/**、src/lib/billing/**         → monetization_wechat_engineer
  - tests/**、*.test.ts                                → qa_engineer
```

#### 提示词 M.2 — 强模型 / 高推理：按 Sprint 切换 effort

```
本任务属于 <S1 教学诚信重设计 | S2 性能与一致性>：逻辑 + 评分模型 + schema 推理密集，
请用最强 Codex 模型 + 高 reasoning effort，先把推理写在 plan 里再动手。

（对照：S0 安全热修虽小但风险高，也用高 effort；S3/S4 多为机械替换/令牌统一，
用普通 effort 即可，省 token 换吞吐。）
```

> 经验法则（已对齐源码行号）：
> - **S1/S2 = 高推理**：power-score 权重重设计在 `src/lib/leaderboard/power-score.ts:53`（`powerComponents`），advance-round 长链路拆解涉及 `src/lib/leaderboard/service.ts:160`（`recomputePowerForUser`）+ `src/lib/db/repo.ts:1113`（`getSimulationStateForUser`），都需要跨文件因果推理。
> - **S0 = 高推理但范围窄**：注入修复一行之差就留洞（`repo.ts:621/887` 的 `ilike` → `eq`）。
> - **S3/S4 = 普通推理（机械改动）**：防双击 hook（参照已正确的 `src/components/billing/wechat-checkout-button.tsx:221` 的 `startTransition(async () => {...})`），以及 `--up-*/--down-*` 令牌替换（令牌定义在 `src/app/globals.css:29/37`：`--up-500:#e8412e`/`--down-500:#16a14e`；真实令牌用法示范在 `src/components/student/student-sandbox.tsx` 的 `text-up`/`text-down`）。

#### 提示词 M.3 — Plan-first：多文件改动一律先出计划再施工

```
这是一次多文件改动。先**只产出计划，不要改任何文件**：
1. 列出你将要读的文件（只读 01-问题汇总.md 里本问题引用的那几个文件 + 直接依赖，别扩散）。
2. 列出你将要改的文件 + 每个文件的改动点一句话。
3. 标出哪些步骤有风险（迁移 / 安全头 / 改 JWT claims / 改 power 权重 / 改时区基准）需要我确认。
4. 列出验证命令（lint / tsc / test / build，迁移类再加 db:migrate）。
输出计划后停下，等我回 "approved" 再施工。
```

#### 提示词 M.4 — 上下文卫生：只读被引用的文件

```
上下文纪律：**只读** 01-问题汇总.md 中本问题条目明确列出的 文件:行号，以及它们的直接调用方/被调用方。
不要 grep 全仓、不要"顺便看看"无关模块、不要把整个 src/ 拉进上下文。
一个 Codex 会话只做一个 Sprint；做完这个 Sprint 我会开新会话，不要跨 Sprint 串场。
```

> 为什么：本仓库 `src/lib/db/repo.ts` 单文件 2700+ 行、`src/app/globals.css` 令牌庞大，无节制读取会爆上下文、稀释注意力。doc 01 已给出精确 `文件:行号`（如 `repo.ts:621/816/840/887`、`power-score.ts:53`、`service.ts:160`、`simulation.ts:120/126/151`），照着读即可。

#### 提示词 M.5 — 小 diff 纪律：禁止顺手重构

```
采用 minimal-change-engineer 心态：只改修复本问题**必需**的最小行数。
- 禁止顺手重命名、重排 import、改无关格式、"清理"邻近代码。
- 禁止升级依赖 / 新增依赖（确需新增先单独问我，给出包名 + 体积 + 理由）。
- 改完先自己 `git diff` 自检：每一处改动都能对应到本问题的修复点；不能解释的改动删掉。
- 不要 `git commit -a`、不要 `git add .`；只 `git add <明确路径>`，且只在我说"提交"时提交。
```

> agency 池里有 `engineering-minimal-change-engineer`，重构冲动强的任务（S4 令牌统一、硬编码清理）可直接点名它当实现者。

#### 提示词 M.6 — Stop-gate：危险步骤等确认（哪些步骤必须插 gate）

```
以下步骤**执行前必须停下等我确认**，不得自行推进：
- 任何 drizzle 迁移生成 / 应用（S1-3 seed 列、S2-3 反规范化列、S2-4 唯一约束）
- 任何安全头 / CSP 改动（S0-3 next.config.ts）—— 先用 Content-Security-Policy-Report-Only 观察
- 任何改 JWT claims / src/lib/auth.ts / 限流键策略中涉及 claims 的部分
- 任何改 power-score 权重或 simulation 经济模型（S1-1 / S1-2，会改变所有历史榜单归属）
- 任何改 period/season 时区基准（S2-5，会改变现有桶归属）
"Stop after step N and wait for my confirmation." 写进每个含上述步骤的提示词。

（反向说明：S0-2 把注册限流键从 body.email 改为 IP 维度，是低风险纯键策略调整，无需 gate，直接做完跑客观门即可。）
```

#### 提示词 M.7 — 客观门（grep 当裁判）：用 `git grep` 做 pass/fail oracle

```
完成后用客观命令自证（不是"我觉得改好了"，而是命令输出为证）：

S0 注入（SEC-01/02，repo.ts:621/816/840/887）:
  git grep -nE "ilike\(" src/lib/db/repo.ts
    → 邮箱/邀请码等精确查找处必须改 eq；剩余 ilike 命中数必须显著下降且每一处都能解释为合法模糊匹配
S0 限流键（SEC-03，只看漏洞文件，不要混入已正确的 register/route.ts）:
  git grep -n "body.email" src/app/api/auth/register-by-invite/route.ts   → 必须为 0
  git grep -n "rateLimitKey(\"register\"" src/app/api/auth/register/route.ts  → 仍应是 undefined（保持不动，作为正例对照）
S0 安全头（SEC-04）:
  git grep -n "Content-Security-Policy" next.config.ts   → 必须 ≥1（基线为 0）
S2 全表扫描（BE-01，repo.ts:692/701/1113）:
  git grep -n "selectAllUsers\|selectAllRuns" src/lib/db/repo.ts
    → getSimulationStateForUser(repo.ts:1113) 调用点应改为按 classroomId 过滤后消失
S4 令牌（FE-06）:
  git grep -nE "#[0-9a-fA-F]{3,8}" src/components/ | wc -l
    → 数值必须显著低于"开工前置第 6 步记录的活基线"（不要拿文档里的 ~230 当分母）

把每条命令的实际输出贴出来作为验收证据。
```

#### 提示词 M.8 — TDD：测试先行（凡 P0/P1 + 计算/安全逻辑）

```
本任务走 TDD（CLAUDE.md 测试分层要求）：
1. 先写**会失败**的测试，证明当前 Bug 存在：
   - SEC-01: registerUserByInvite 提交含 % / _ 的码（如 "MRB-TE%"）必须抛"邀请码不存在"，
            且断言所有 invite 的 usesRemaining 不变。
   - DOM-02: do-nothing 基线 power 必须显著低于"认真操作"样本（property-based 用 fast-check）。
   - DOM-03: replay / 未完赛 / 跨周 seed 的 run 不得污染当周榜；
            参照已正确的种子公平范式 buildSeasonLeaderboard(src/lib/simulation.ts:614)
            与 getSeasonLeaderboard(src/lib/db/repo.ts:1322)，对比 replayRunForUser(repo.ts:1394) 的随机种子。
2. 跑测试，确认它**红**（证明命中真问题）。
3. 再写实现让它变绿。
4. 重跑全套，确认不破坏既有 audit 测试
   （repo-fallback.audit / repo-logging / determinism.guard / simulation.money / leaderboard 全家桶）。
测试代码避免 any（除测试脚手架）。AI 相关测试用 MSW，绝不打真实 provider。
```

#### 提示词 M.9 — Reviewer 审计：实现者 ≠ 评审者（强制不同责任组）

```
实现完成后，换一个**不同责任组**的 agent 做只读审计（AGENTS.md §3.1）：
- db_architect 实现（repo.ts / drizzle 迁移 / service 边界）
      → 用 engineering-database-optimizer 或 engineering-code-reviewer 审
- api_wirer 实现（route.ts）
      → 用 engineering-code-reviewer 或 engineering-security-engineer 审（S0 安全必用后者）
- ui_implementer / teen_ux_specialist 实现（组件）
      → 用 design-ui-designer + testing-accessibility-auditor 审
- finance_event_simulator 实现（power-score / run-power / simulation 经济模型）
      → 用 reviewer 或 testing-reality-checker 审（与 finance 不同组）
- qa_engineer 实现（测试）
      → 用 reviewer 审

审计指令：
"Have <reviewer-agent> confirm zero changes outside <WRITE scope> by running
 `git diff --name-only main...HEAD`, verify the M.7 grep gates pass (paste outputs),
 and report a single verdict: APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION with reasons."

reviewer 是**只读**的，绝不让它写代码。verdict 不是 APPROVE 就不许进下一步。
同一职责组不得自审自己的改动（如 db_architect 不可由 db_architect 审）。
```

#### 提示词 M.10 — 全质量门 + 提交（每 Sprint 收尾）

```
本 Sprint 收尾，按顺序跑全质量门，任一失败就停下修，不许带着红灯进下一 Sprint：

  npm run lint
  npx tsc --noEmit
  npm run test
  npm run build
  npx playwright test          # 会自起 :4173 dev server（PLAYWRIGHT_PORT）

迁移类（S1-3 / S2-3 / S2-4）额外：
  npm run db:migrate           # 唯一正路；drizzle-kit push 在本 DB 上会崩，禁用
  （先在本地 brownzone-pg(:5433) 跑，确认无误再考虑预览环境；apply 前必须经 M.6 stop-gate）

全绿后给我一份 PASS/FAIL 清单。我自己 `git diff` 复核后再决定提交。
```

---

### 分支与提交策略（每 Sprint 一个 PR，S0 先行且独立）

> 与 `02-改进优化升级计划.md §0` 排期表一致：S0 最先、独立成 PR、当天可上线；S1 依赖 S0 合并；S2 依赖 S1；S3 可与 S2 并行（不同责任域，FE-01/FE-02 优先）；S4 最后。

| Sprint | 分支 | PR 边界（问题编号来自 doc 01） | 上线节奏 |
|---|---|---|---|
| **S0** | `fix/s0-security-hotfix` | 仅 SEC-01/02/03/04，**独立 PR、当天可上线**，不夹带任何其它改动 | 最先，单独发 |
| **S1** | `fix/s1-integrity-redesign` | DOM-01/02/03/04/05、DOM-09，含一条 power/seed 迁移 | S0 合并后 |
| **S2** | `fix/s2-perf-consistency` | BE-01~08，含反规范化/唯一约束/时区迁移 | S1 合并后 |
| **S3** | `fix/s3-frontend-reliability` | FE-01/02/03/04/05/07/09、FE-10（FE-02 隐私回归优先） | 可与 S2 并行（不同责任域） |
| **S4** | `fix/s4-hardening-polish` | QA-01/02、FE-06/08、SEC-05、BE-09~13、DOM-06/07/10/11、FE-11~20 | 最后 |

提交纪律（AGENTS.md 红线）：

```powershell
# 每 Sprint 收尾：先审 diff，再按明确路径分阶段 add，绝不 git add . / git commit -a
git status
git diff --stat

# 示例：S0 安全热修（路径必须与本 Sprint 实改文件一致）
git add src/lib/db/repo.ts src/lib/auth-validation.ts
git commit -m "fix(security): close ilike injection on invite/email lookups (SEC-01/02)"

git add src/app/api/auth/register-by-invite/route.ts src/app/api/auth/register/route.ts
git commit -m "fix(security): rate-limit register-by-invite by IP not body email (SEC-03)"

git add next.config.ts
git commit -m "feat(security): add CSP/HSTS/X-Frame/nosniff security headers (SEC-04)"

git push -u origin fix/s0-security-hotfix
# 不提交 .env.local；提交信息引用 SEC-/BE-/DOM-/FE- 编号，便于回溯 doc 01
```

---

### ✅ 验收（本节方法是否被正确执行）

- **门 1**：每个 Sprint 收尾，`npm run lint && npx tsc --noEmit && npm run test && npm run build && npx playwright test` 全绿，且产出 PASS/FAIL 清单。
- **门 2**：M.7 的 `git grep` 客观门对应 Sprint 全部满足（如 S0 后 `git grep -n "body.email" src/app/api/auth/register-by-invite/route.ts` 为 0；`git grep -n "Content-Security-Policy" next.config.ts` ≥1）。
- **门 3**：每阶段 reviewer（**不同责任组**）审计输出 `APPROVE`，且 `git diff --name-only main...HEAD` 比对所有文件都落在该 Sprint 的 WRITE scope 内（零禁区文件改动）。
- **门 4**：迁移类 Sprint 用的是 `npm run db:migrate`；`git grep -rn "drizzle-kit push" .` 不出现在任何被执行的脚本里。

### ❌ 回滚

```powershell
# A. Codex 改了禁区文件（reviewer 报 REQUEST_CHANGES）
git checkout -- <越界文件>          # 单文件还原，重申更窄的 WRITE/FORBIDDEN scope 重发提示词

# B. 整个 Sprint 跑偏，想回到分支起点
git reset --hard <该分支首个 commit 的父提交>   # 或 git checkout main; git branch -D fix/sX-...

# C. 迁移把本地 DB 搞坏（仅本地 brownzone-pg，生产绝不直接 drop）
#    本地容器可重建：schema 在迁移文件里，重跑即可
npm run db:migrate                 # 重新应用到 :5433；必要时 docker 重建容器卷后再 migrate + db:seed
#    禁用 drizzle-kit push（本 DB 会崩）

# D. CSP 误杀线上请求（AllTick/AI 网关/微信 SDK）
#    先回退到 Report-Only 观察，确认 connect-src 含全部上游基址后再切强制
```

---

### Do / Don't 速查（扩展 `CODEX-WORKFLOW.md` 附录 C）

| ✅ Do | ❌ Don't |
|---|---|
| 开工前 `docker start brownzone-pg`，确认 STATUS=Up | 不查 DB 就开工，然后把 5s 超时误判成代码 Bug |
| 多文件改动先 Plan-first，approved 后再施工 | 让 Codex 一上来就改文件、边改边想 |
| 只读 doc 01 引用的 `文件:行号` + 直接依赖 | grep 全仓 / "顺便看看" 无关模块爆上下文 |
| 一个会话只做一个 Sprint | 同一会话里 S1 没收尾就开 S2 |
| 实现者与评审者来自**不同责任组** | 让 db_architect 自审自己的 DB 改动 |
| 危险步骤（迁移/安全头/权重/时区/JWT）插 stop-gate | 让 Codex 自行 apply 迁移或改 CSP 上生产 |
| 用 `git grep` 输出当客观验收证据；FE-06 拿开工实测的活基线当分母 | 接受"我觉得改好了"式结论 / 拿文档静态数 ~230 当 oracle |
| `git add <明确路径>` + 看 `git diff` 再 commit | `git add .` / `git commit -a` / 提交 `.env.local` |
| 迁移走 `npm run db:migrate` | 用 `drizzle-kit push`（本 DB 会崩） |
| AI 调用只经 `src/lib/ai.ts` | 在任何地方直接 fetch AI provider |

### 当出错时（扩展 `CODEX-WORKFLOW.md` 附录 B，本仓库特化）

| 症状 | 第一动作 |
|---|---|
| 本地一切写操作 503 / 战力榜 onboarding `db_unavailable` | `docker ps` 看 brownzone-pg 是否 Up；`docker start brownzone-pg`，dev server 会懒重连，无需重启 |
| 查询全部 ~5s 后失败 | DB 没起或在用远端跨区 URL；先确认 `.env.local` 指向 `:5433` 本地容器 |
| Codex 自动改了禁区文件 | `git checkout -- <file>` + 重申 WRITE/FORBIDDEN scope，必要时 `Esc` 中断 |
| subagent 越权写到别的责任域 | `Esc` 中断，换更窄的提示词；点名 `engineering-minimal-change-engineer` 重做 |
| reviewer 给 `REQUEST_CHANGES` | 不许进下一步；按其理由让**原实现者**改，改完**同一 reviewer**复审 |
| 迁移把本地表搞坏 | 见上方回滚 C：重跑 `npm run db:migrate`（+ 必要时 `db:seed`），绝不 `drizzle-kit push` |
| CSP 上线后页面白屏 / 行情拉不到 | 回退到 `Content-Security-Policy-Report-Only`，补全 `connect-src` 上游基址 |
| 测试本地过、CI 挂 | 多为 lockfile 跨平台问题；删 `.next/`、`node_modules/.cache/` 重试，CI 锁文件按既有 Linux 重生流程处理 |
| AI 总返回本地兜底 | 查 `AI_BASE_URL_PRIMARY`/key；空 URL 即视为禁用远端 AI，不是 Bug |

---

## Sprint 0 — 安全热修（最高优先，独立 PR）

### 目标

闭合本轮审查唯一的 **P0**（SEC-01 邀请码 `ilike` 通配符注入 → 自助注册成教师 + 批量篡改邀请码）以及三条与其同源/同纵深的安全 P1（SEC-02 邮箱 `ilike` 精确匹配、SEC-03 注册限流键被攻击者控制、SEC-04 缺安全响应头）。

本 Sprint 是一条**独立分支 + 独立 PR**，当天可部署，**必须先于 S1–S4 的任何工作合并**（见 `02-改进优化升级计划.md` 一页纸排期：S0「阻塞对外推广？= 是，先做」，且「S0 必须最先、独立成 PR、当天可上线」）。它只动四类极窄的安全面，不夹带任何重构，便于安全审计与紧急 rollback。对应 `02` 的 Sprint 0 DoD：提交含 `%`/`_` 的邀请码返回「邀请码不存在」且不 decrement 任何码；邮箱精确比较；未认证注册按 IP 限流；全路由下发安全响应头（CSP 先用 `Report-Only` 不阻断 AllTick/AI/微信调用）。

> **关键校正（实读代码后）**：SEC-01 的 `ilike` 注入点共 **4 处**，而非 3 处。除 `registerUserByInvite`（`repo.ts:887`）、`findInviteByCode`（`:816`）、`findInviteByCodeWithExecutor`（`:840`）外，还有 **`registerUserByEmail`（`repo.ts:1002`）**——它被 `/api/auth/register` 在携带 `inviteCode` 时命中，是与 `/api/auth/register-by-invite` 平行的第二条提权入口。`01` 的 SEC-01 与 `02` 的 S0-1 均明列 `:887/1002`，**四处必须一起改**，否则漏一条整修就失效。

### 前置

- 已读 `docs/review-2026-06-12/01-问题汇总.md` 第二节（SEC-01）与第三节（SEC-02/03/04），并核对 `02-改进优化升级计划.md` 的 Sprint 0（S0-1/2/3），确认 `文件:行号` 与证据一致。
- 从 `main` 切出独立分支（不要在 `feat/leaderboard-power-rank` 上做）：
  ```powershell
  cd D:\树德实验中学（清波）\C2\brown-zone-web
  git fetch origin
  git switch main
  git switch -c hotfix/s0-security
  git status   # 必须干净
  ```
- 确认本地 DB 可用（否则 503 会被误当成「邀请码不存在」，污染回归判断）：见 MEMORY「Local dev Docker DB」——确保 Docker Desktop 运行后 `docker start brownzone-pg`。S0.1 的注入回归测试需要真实 Postgres（`npm run test:integration`，`DATABASE_URL` 指向测试库），纯单测无法复现 SQL `LIKE` 通配符。
- 不变量提醒（勿在修复中破坏，见 `01` 第六节）：邀请码**原子预订**（条件 `UPDATE ... returning()` 消竞争，杜绝 SELECT-then-UPDATE）、JWT 显式 `HS256`、写不静默回退。SEC-01 的修复只能把 `ilike` 换成精确匹配，**绝不能**退回 SELECT-then-UPDATE。

> **分组约束（AGENTS.md §3.1）**：实现者用 `db_architect`（`repo.ts`）与 `api_wirer`（路由 / `next.config.ts`），审计者用 `reviewer` + `engineering-security-engineer`（已确认存在于 `.codex/agents/engineering-security-engineer.toml`）。实现组（DB / API）与审计组（read-only 审计 / 安全）分属不同责任组，符合「实现与复核不同组」红线。每个阶段以 `APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION` 收尾。

---

### 提示词 S0.1 — SEC-01/SEC-02：repo.ts 把邀请码/邮箱精确匹配从 `ilike` 改 `eq`（先写集成回归测试）

> 本步是 P0 核心，覆盖**全部 4 个邀请码注入点 + 1 个邮箱注入点**。**先红后绿**：先写证明漏洞存在的失败用例，再改代码使其转绿。
> ⚠️ 注意测试层级：`src/lib/db/repo.test.ts` 顶部 `vi.mock("@/lib/db/client", () => ({ getDb: () => null ... }))` 会让 repo 回退到 `store.ts` 的 JS 字符串匹配，**纯单测跑不到 SQL `ilike`，无法复现通配符注入**。因此证明漏洞的回归测试必须放在**集成层**（真实 Postgres）。

```
Have db_architect fix SEC-01 + SEC-02 in the repository layer (all 4 invite ilike sites + the email ilike site).

WRITE scope (allowed, per AGENTS.md §3): src/lib/db/repo.ts, and a new integration test file tests/integration/invite-email-exact-match.test.ts
FORBIDDEN scope: src/app/api/**, src/components/**, drizzle/**, src/lib/db/schema.ts, src/lib/auth.ts, next.config.ts — do NOT touch any of these.

Grounding (real lines, verified — do not invent locations; `and, eq, ilike, sql` are already imported at repo.ts:11):
- SEC-01 (P0) — FOUR ilike invite-code sites, all pass user input straight into `ilike(inviteCodes.code, ...)`:
    repo.ts:887  — registerUserByInvite atomic reservation (the conditional UPDATE ... returning())   [reached by /api/auth/register-by-invite]
    repo.ts:1002 — registerUserByEmail atomic reservation (the conditional UPDATE ... returning())     [reached by /api/auth/register when inviteCode is present]
    repo.ts:816  — findInviteByCode
    repo.ts:840  — findInviteByCodeWithExecutor
  Exploit: "MRB-TE%" matches seeded MRB-TEACHER-2026 (self-register as teacher); "%%%%%%" decrements EVERY invite in one UPDATE.
- SEC-02 (P1) — repo.ts:621 selectUserByEmail uses `.where(ilike(users.email, email)).limit(1)`, so `_` is a single-char wildcard and limit(1) has no ORDER BY (arbitrary matching row), breaking one-email-one-identity.

Step 1 — Write FAILING integration regression tests FIRST (do not touch repo.ts yet):
  Create tests/integration/invite-email-exact-match.test.ts hitting a REAL Postgres (mirror the existing tests/integration/rls.test.ts setup; these need DATABASE_URL pointing at the test schema, run via `npm run test:integration`). Cover:
  a) registerUserByInvite with inviteCode "MRB-TE%" must NOT match MRB-TEACHER-2026 → expect the "邀请码不存在" path, and assert NO invite row's usesRemaining was decremented.
  b) registerUserByEmail (the /api/auth/register path) with inviteCode "MRB-TE%" must likewise NOT resolve to the teacher invite and must decrement nothing.
  c) inviteCode "%%%%%%" via both registerUserByInvite and registerUserByEmail must match zero rows and decrement nothing (assert all seed invites keep usesRemaining).
  d) findInviteByCode("MRB-TE%") returns null.
  e) selectUserByEmail-backed lookup: "j_hn@x.com" must NOT resolve to "john@x.com".
  Run `npm run test:integration` and confirm these FAIL against current code. Paste the failing output.

  Stop after step 1 and wait for my confirmation. (security-critical)

Step 2 — Fix all five queries (exact, case-tolerant match; preserve the atomic reservation EXACTLY):
  For the two reservation UPDATEs (repo.ts:887 and repo.ts:1002) — replace `ilike(inviteCodes.code, input.inviteCode)` with
      eq(sql`lower(${inviteCodes.code})`, input.inviteCode.trim().toLowerCase())
    Keep the `usesRemaining > 0` and `expiresAt > now()` predicates and the `.returning()` reservation pattern UNCHANGED. Do NOT regress to SELECT-then-UPDATE (this atomic reservation is a confirmed good invariant, 01 §六).
  For repo.ts:816 and repo.ts:840 (findInviteByCode / findInviteByCodeWithExecutor) — same
      eq(sql`lower(${inviteCodes.code})`, code.trim().toLowerCase())
  For repo.ts:621 (selectUserByEmail) — replace `ilike(users.email, email)` with
      eq(sql`lower(${users.email})`, email.trim().toLowerCase())
    Email is already lower-cased by callers; normalize here too for safety.

Step 3 — Make the tests pass:
  Run `npm run test:integration` → all green.

VERIFICATION (run all, paste output):
  - npx tsc --noEmit
  - npm run lint
  - npm run test                      # existing unit suite (store.ts path) stays green
  - npm run test:integration          # the new injection regression tests
  - Objective grep gate — ZERO ilike on invite/email exact-lookup paths (catches a missed site):
      git grep -n "ilike(inviteCodes.code" src/lib/db/repo.ts   # MUST be 0
      git grep -n "ilike(users.email"      src/lib/db/repo.ts   # MUST be 0
  - Audit invariants still green: npm run test -- repo-fallback.audit repo-logging

Stop after step 3 and report.
```

✅ 验收：两条 grep 均返回 0 行（4 个邀请码点 + 1 个邮箱点全部清零）；`npm run test:integration` 全绿，含新增 `tests/integration/invite-email-exact-match.test.ts`；含 `%`/`_` 的码经 `registerUserByInvite` 与 `registerUserByEmail` 两条路径均断言「未 decrement 任何码」；`npm run test`（store 路径单测）仍全绿。
❌ 回滚：`git checkout -- src/lib/db/repo.ts && git rm -f tests/integration/invite-email-exact-match.test.ts`。

---

### 提示词 S0.2 — SEC-01（zod 层）：两处 schema 加邀请码白名单正则

> 纵深第二道：即使 query 层失手，zod 也先把含通配符的码挡在边界外。两处 schema 都要改——它们各自喂给一条注入路径：
> - `src/lib/auth-validation.ts:25` 的 `registerSchema.inviteCode` → 被 `/api/auth/register` 使用（`register/route.ts:4` 导入 `registerSchema`），最终走 `registerUserByEmail`（注入点 `repo.ts:1002`）。
> - `src/app/api/auth/register-by-invite/route.ts:10` 的**内联** `inviteCode` → 走 `registerUserByInvite`（注入点 `repo.ts:887`）。**注意：register-by-invite 并未导入 auth-validation 的 schema，必须分别就地改。**

```
Have api_wirer add a character whitelist to BOTH invite-code zod schemas (SEC-01, defense layer 2).

WRITE scope: src/lib/auth-validation.ts, src/app/api/auth/register-by-invite/route.ts
FORBIDDEN scope: src/lib/db/**, src/components/**, drizzle/**, next.config.ts, src/lib/auth.ts

Grounding (verified):
- src/lib/auth-validation.ts:25 — `inviteCode: z.string().min(6, "邀请码至少 6 位。").optional()` validates length only; "%" and "_" pass. This schema is consumed by /api/auth/register (register/route.ts:22), which calls registerUserByEmail → the repo.ts:1002 ilike site.
- src/app/api/auth/register-by-invite/route.ts:10 — a SEPARATE inline schema `inviteCode: z.string().trim().min(6)`. This route does NOT import auth-validation; it defines its own schema (route.ts:9-14) and calls registerUserByInvite → the repo.ts:887 ilike site. Edit it in place — do not try to reuse auth-validation here.

Steps (use the canonical regex from 02 §S0-1):
1. auth-validation.ts:25 — change the inviteCode field to:
     inviteCode: z.string().trim().regex(/^[A-Za-z0-9-]{6,32}$/, "邀请码格式不正确。").optional(),
   (keep .optional(); the {6,32} bound subsumes the old .min(6); match the surrounding Chinese-message style.)
2. register-by-invite/route.ts:10 — change the inline inviteCode field to:
     inviteCode: z.string().trim().regex(/^[A-Za-z0-9-]{6,32}$/, "邀请码格式不正确。"),
   (this one is required, not optional — preserve that.)
3. Keep the error shape `{ error, message }` — a wildcard code must surface as invalid_input (Chinese message), never reach repo.ts.

VERIFICATION:
  - npx tsc --noEmit
  - npm run lint
  - npm run test
  - git grep -nE "inviteCode: z\.string\(\)" src/lib/auth-validation.ts src/app/api/auth/register-by-invite/route.ts  # both lines MUST now contain .regex(/^[A-Za-z0-9-]{6,32}$/

Report.
```

✅ 验收：两处 `inviteCode` schema 均含 `.regex(/^[A-Za-z0-9-]{6,32}$/)`（auth-validation 保留 `.optional()`，register-by-invite 保持必填）；`tsc`/`lint`/`test` 全绿。
❌ 回滚：`git checkout -- src/lib/auth-validation.ts src/app/api/auth/register-by-invite/route.ts`。

---

### 提示词 S0.3 — SEC-03：未认证注册改 per-IP 限流（单文件单行）

> 放大器修复。`register-by-invite/route.ts:22` 的键含攻击者控制的 `body.email` → 换邮箱即绕过，无 IP 预算，正是 SEC-01 的批量放大器。
> 实读校正：`rateLimitKey(scope, undefined, request)` **已自动回退到 per-IP**（`rate-limit.ts:56-60`），且 `/api/auth/register` 早已是 per-IP（`register/route.ts:16` 用 `rateLimitKey("register", undefined, request)`）。所以**无需改 `rate-limit.ts`，也无需动 `/api/auth/register`**；只需把 register-by-invite 的键里的 `body.email` 换成 `undefined`。

```
Have api_wirer fix SEC-03 — make register-by-invite rate-limiting attacker-resistant (per-IP, not per-email).

WRITE scope: src/app/api/auth/register-by-invite/route.ts
FORBIDDEN scope: src/lib/rate-limit.ts (no change needed — the helper already falls back to IP), src/lib/db/**, src/components/**, drizzle/**, next.config.ts, src/lib/auth.ts

Grounding (verified):
- src/app/api/auth/register-by-invite/route.ts:22 — `rateLimit(rateLimitKey("register-invite", body.email.toLowerCase(), request), 5, 60_000 * 10)`. The key embeds attacker-controlled body.email; rotating email resets the bucket → unbounded attempts, amplifying SEC-01.
- rate-limit.ts:56-60 — rateLimitKey(scope, sessionUserId, request): when the 2nd arg is undefined it keys on `x-forwarded-for` IP. So passing undefined is the per-IP fix; NO helper change is required.
- Reference (do not edit) src/app/api/auth/login/route.ts:42-58 for the optional two-layer pattern (per-account rateLimit + per-IP peekRateLimit failure budget at :49-50).

Steps:
1. In register-by-invite/route.ts:22, replace the key argument `body.email.toLowerCase()` with `undefined`, i.e.:
     rateLimit(rateLimitKey("register-invite", undefined, request), 5, 60_000 * 10)
   Keep window/limit sane (5 per IP / 10 min is fine for S0). The bucket must NOT be resettable by rotating email.
2. (Optional, only if trivially clean) layer a secondary per-email rateLimit ON TOP for friendlier messaging, but the per-IP layer must exist and be the binding constraint.
3. Preserve checkOrigin() (already at route.ts:17) and the existing 429 + buildRateLimitMessage error shape.
4. Known limitation (01 BE-13): the limiter is per-process; acceptable for S0 and tracked to S4 — do NOT migrate to Upstash here.

VERIFICATION:
  - npx tsc --noEmit
  - npm run lint
  - npm run test
  - git grep -n "register-invite" src/app/api/auth/register-by-invite/route.ts  # the rateLimitKey call MUST NOT contain body.email as a key component

Report.
```

✅ 验收：限流键不再含 `body.email`，按 IP 计预算（`rateLimitKey("register-invite", undefined, request)`）；`rate-limit.ts` 未被改动；`tsc`/`lint`/`test` 全绿。
❌ 回滚：`git checkout -- src/app/api/auth/register-by-invite/route.ts`。

---

### 提示词 S0.4 — SEC-04：next.config.ts 安全响应头（CSP 先 Report-Only）

> **风险步，含 stop-gate**：CSP 配错会静默打断 AllTick 行情、AI 网关、微信支付的外联调用。S0 内**只能**用 `Content-Security-Policy-Report-Only`（仅上报不阻断），强制 CSP（enforcing）留到后续 Sprint 观察上报后再切（与 `02` §S0-3「可先用 Report-Only 观察一两天」一致）。
> 实读校正：当前 `next.config.ts` 仅有 `allowedDevOrigins: ["127.0.0.1"]`，无 `headers()`，无 `middleware.ts`。新增 `headers()` 时**必须保留 `allowedDevOrigins`**。

```
Have api_wirer add security response headers (SEC-04). CSP MUST be Report-Only in this Sprint.

WRITE scope: next.config.ts (add `async headers()`; KEEP the existing `allowedDevOrigins: ["127.0.0.1"]` key). Do NOT create middleware.ts.
FORBIDDEN scope: src/app/**, src/components/**, src/lib/**, drizzle/**

Grounding (verified):
- next.config.ts currently exports `{ allowedDevOrigins: ["127.0.0.1"] }` only — no headers(); repo has no middleware.ts. A platform serving minors lacks CSP / HSTS / X-Frame-Options / X-Content-Type-Options / Referrer-Policy.

Step 1 — Inventory the external origins the app legitimately calls, so the report-only connect-src/img-src reflect reality (NOT to enforce yet). Grep the base URLs:
  - AllTick: src/lib/alltick.ts (and src/lib/itick.ts)
  - AI gateway: src/lib/ai.ts (AI_BASE_URL_PRIMARY / secondary)
  - WeChat Pay: src/lib/billing/wechat-pay.ts
  - Resend email is server-side only (no browser origin needed).
  List the distinct https origins found.

  Stop after step 1 and show me the origin inventory before writing any CSP. (security-critical — a wrong connect-src silently breaks market/AI/payment)

Step 2 — Add `async headers()` returning, for source `/(.*)` (keep allowedDevOrigins intact):
  - Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - Referrer-Policy: strict-origin-when-cross-origin
  - Content-Security-Policy-Report-Only (NOT enforcing): at minimum
      default-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none';
      connect-src 'self' <the origins from step 1>;
      img-src 'self' data: <any image origins>;
      style-src 'self' 'unsafe-inline'; script-src 'self';
    Adjust script-src/style-src to whatever Next.js 16 + next/font require so the report-only policy is realistic. Read node_modules/next/dist/docs/ for the Next 16 headers() signature before writing (this is NOT the Next.js you know).
  Do NOT add an enforcing Content-Security-Policy header in this Sprint.

VERIFICATION:
  - npx tsc --noEmit
  - npm run build   # headers() must compile under Next 16; allowedDevOrigins must still be present
  - Manual smoke (paste evidence): npm run dev, then load / , /demo , /student , /student/market — confirm AllTick quotes, AI assistant, and page render still work (Report-Only must NOT block anything). DevTools console should show only CSP *report* warnings, never *blocked* resources.
  - git grep -n "Content-Security-Policy-Report-Only" next.config.ts                              # MUST be present
  - git grep -nE "key:\s*\"Content-Security-Policy\"" next.config.ts                              # MUST be 0 (no enforcing CSP)
  - git grep -n "allowedDevOrigins" next.config.ts                                                # MUST still be present

Stop and report.
```

✅ 验收：`npm run build` 通过且 `allowedDevOrigins` 仍在；`/`、`/demo`、`/student`、`/student/market` 手动冒烟下行情/AI/页面全部正常；响应头含 HSTS / `nosniff` / `X-Frame-Options: DENY` / Referrer-Policy 与 **`Content-Security-Policy-Report-Only`**；不存在 enforcing CSP 头。
❌ 回滚：`git checkout -- next.config.ts`（无 schema/数据变更，纯配置回退）。

---

### 提示词 S0.5 — 安全审计（reviewer + engineering-security-engineer，read-only）

> 实现组（`db_architect` / `api_wirer`）与审计组（`reviewer` / `engineering-security-engineer`）分属不同责任组，满足 AGENTS.md §3.1 红线。审计是 read-only，发现问题只报不改。

```
Have reviewer AND engineering-security-engineer audit the S0 hotfix branch (READ-ONLY — no writes).

Confirm each gate and report PASS/FAIL with evidence:
1. Scope: zero changes outside this exact set —
   { src/lib/db/repo.ts, tests/integration/invite-email-exact-match.test.ts, src/lib/auth-validation.ts, src/app/api/auth/register-by-invite/route.ts, next.config.ts }.
   - git diff --name-only main...HEAD  → must equal that set (rate-limit.ts and auth/register/route.ts must NOT appear).
2. SEC-01/02 closed — ALL FOUR invite sites + the email site:
   - git grep -n "ilike(inviteCodes.code" src/lib/db/repo.ts  → 0   (covers :816, :840, :887, :1002)
   - git grep -n "ilike(users.email"      src/lib/db/repo.ts  → 0   (covers :621)
   - Both atomic reservations (repo.ts:887 registerUserByInvite AND repo.ts:1002 registerUserByEmail) are preserved as conditional UPDATE ... returning() — NOT regressed to SELECT-then-UPDATE.
   - Integration regression test exists and passes: "%"/"_" codes via BOTH registerUserByInvite and registerUserByEmail decrement nothing and return "邀请码不存在".
3. SEC-01 layer 2: both inviteCode zod schemas carry /^[A-Za-z0-9-]{6,32}$/ — auth-validation.ts:25 (keeps .optional()) and register-by-invite/route.ts:10 (required).
4. SEC-03: register-by-invite limiter key (route.ts:22) no longer contains body.email; it is per-IP via rateLimitKey(..., undefined, request). rate-limit.ts is unchanged.
5. SEC-04: next.config.ts emits HSTS + nosniff + X-Frame-Options + Referrer-Policy + Content-Security-Policy-Report-Only; NO enforcing CSP; allowedDevOrigins preserved; build passes; market/AI/payment smoke is green.
6. No regressions: npm run lint && npx tsc --noEmit && npm run test && npm run test:integration all green; audit tests (repo-fallback.audit, repo-logging) green.

engineering-security-engineer additionally: adversarially re-derive the SEC-01 exploit ("MRB-TE%", "%%%%%%") against the patched code on BOTH entry points — POST /api/auth/register-by-invite AND POST /api/auth/register (with inviteCode) — and confirm each now fails (no teacher role granted, no invites decremented).

End with a single verdict: APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION.
```

✅ 验收：审计输出 **APPROVE**，第 1–6 项全 PASS，`engineering-security-engineer` 确认 SEC-01 exploit 在 `/register-by-invite` 与 `/register` 两条路径上均已失效。
❌ 回滚：若 `REQUEST_CHANGES`，按对应提示词的回滚行 `git checkout` 该文件并重做对应步骤；整 Sprint 放弃用 `git switch main && git branch -D hotfix/s0-security`。

---

### Sprint 收尾 stop-gate

- **S0.1 step 1**（先红集成测试）与 **S0.4 step 1**（CSP 外联清单）是强制 stop-gate——这两步分别决定「漏洞是否真被证明」与「CSP 是否会误伤行情/AI/支付」，必须等人工确认再继续。
- 本段全程**无 schema / migration 改动**（注入回归测试落在 `tests/integration/`，CSP 落在 `next.config.ts`），故**不涉及 `npm run db:migrate`**；若后续误改了 `drizzle/**` 即超出 S0 范围，应回退。
- 全部 PASS 后**单独成 PR 合入 main**（不要塞进任何功能分支），标题如 `hotfix(security): close SEC-01 invite ilike injection (4 sites) + SEC-02/03/04`，当天部署。S1–S4 的任何工作以本 PR 合并为前置。
- 部署后回看 Vercel 日志的 CSP report-only 上报；零阻断告警积累一段时间后，再开后续 Sprint 把 `Content-Security-Policy-Report-Only` 切为 enforcing `Content-Security-Policy`。

---

## Sprint 1 — 教学诚信重设计（反刷分）

> 这是本轮 **产品风险最高** 的一段：现状下"不参与 / 死押确定性资产 / 无限杠杆 / 纯点击刷课"的学生排名高于真正动脑的同学，**正面违背 `power-score.ts` 文档承诺的 "ranks decision QUALITY, not luck"**（见 `src/lib/leaderboard/power-score.ts:1-13`）。DOM-01/02/03/05/DOM-09 同源，必须 **整体重设计** 而非逐条打补丁。
>
> **依赖关系（对齐 `02-改进优化升级计划.md` §0 排期总览）**：
> - 本 Sprint **必须在 S0 安全热修（SEC-01/02/03/04）合并并上线后** 开始（`02` §Sprint 0 DoD）。一切 feature 在 S0+S1 之后。
> - **S1-3 的种子列迁移与 S2-3 的反规范化列同一张迁移落地**（见 `02` §S2-3）：本 Sprint 只新增 `leaderboard_snapshots.seed`，但迁移文件需为 S2-3 的 `schoolId/cityCode/provinceCode/visibility` **预留列位**（注释占位，本 Sprint 不加），并续编号在远端 schema 当前 `0012` 之后（远端已确认全应用，见 MEMORY「Remote DB schema drift」）。
>
> **TDD 强制**：本 Sprint 核心交付是评分模型，按 `CLAUDE.md` 测试分层（property-based + 纯函数单测）的既有范式，**所有 power-score / run-power 测试必须先写、先红、再改实现**。do-nothing 基线分必须显著低于"认真操作"样本、房产平推/无限杠杆套路不得进 tier5（`财商宗师` min 1600，`tiers.ts:21`）、≤2 快照不得饱和——这三条是不可绕过的 DoD。

### 目标

让 **财商战力** 真正度量决策质量：
- 确定性升值资产 + 无上限杠杆不再能零风险刷到最高段位（DOM-01）。
- 「什么都不做」不再拿到 tier3 基线 1110 分（DOM-02）。
- 战力快照持久化赛季种子、未完赛 run 不污染当周公平榜（DOM-03）。
- 学习分（0.15 权重）有最小完成性证明，不能纯点击刷满（DOM-04）。
- 样本不足时风险调整收益给中性分而非 `/epsilon` 饱和到 1.0（DOM-05）。
- 透明面板对学生公开归一化常量与保底/封顶语义（DOM-09）。

### 前置

- **S0 已合并上线**：邀请码/邮箱注入、限流、安全头四项已修复（`02` §Sprint 0 DoD）。
- 工作树干净：`git status` 无未提交改动；在 `feat/leaderboard-power-rank` 之上新开分支：

  ```powershell
  cd D:\树德实验中学（清波）\C2\brown-zone-web
  git switch -c feat/s1-teaching-integrity
  ```

- 已读 `01-问题汇总.md` 的 DOM-01/02/03/04/05、DOM-09 六条 + `02` §Sprint 1（S1-1~S1-4 改动文件清单）。
- 基线快照（用于回归对照；注意 leaderboard 全家桶已有 11 个测试模块，含 `power-score.test.ts` / `run-power.test.ts` / `service.test.ts`，**本 Sprint 是扩展而非新建**）：

  ```powershell
  npm run test -- src/lib/leaderboard   # 记录当前全绿基线，后续改动以此为对照
  git grep -n "POWER_TUNING" src/lib/leaderboard   # 确认归一化常量当前仅在 power-score.ts 内部，未对外
  ```

> ⚠️ **责任组分工（AGENTS.md §3 + §3.1，实现者与评审者必须来自不同责任组）**：
> - `src/lib/simulation.ts` / `src/lib/market-data.ts` → **`finance_event_simulator`**（其 Owns 范围正含这两文件）。
> - `src/lib/leaderboard/**`（纯逻辑，AGENTS.md §3 无单一 Brown Zone owner）→ 用 Agency 通用工程代理 **`engineering-backend-architect`**（§3.1「API/auth 实现」路由）；本组件不属于 `behavior_ai_analyst`（那是 `ai/tutor` 域，明确不参与本 Sprint）。
> - `drizzle/**` + `src/lib/db/repo.ts` 的迁移与写快照 → **`db_architect`**。
> - `src/app/api/learn/complete/route.ts` 等路由 → **`api_wirer`**。
> - `src/components/student/rank/**`（含透明面板 `power-card.tsx` 与 DTO 类型 `types.ts`）→ **`ui_implementer`**。
> - 测试（`*.test.ts`）→ **`qa_engineer`**。
> - **评审**：纯逻辑/迁移由 **`reviewer`**（read-only 审计组）+ **`education_narrative_designer`**（教学诚信 sanity-check，read-only）双签，二者均与上述实现组不同责任组。

---

### 提示词 1.1 —（TDD 先红）扩展 power-score 反刷分测试，**只写测试不改实现**

> 这是整个 Sprint 的地基，必须最先做，且 **故意先红**。实现组在 1.3/1.4 之前不得修改 `power-score.ts`/`run-power.ts`，以保证测试确实捕获 DOM-02/05。
> ⚠️ `power-score.test.ts`(119 行) 与 `run-power.test.ts`(84 行) **已存在**——这是扩展，不是新建。**新增用例，不得删改或弱化现有的 anti-YOLO 断言。**

```
Have qa_engineer EXTEND the existing anti-cheat regression tests FIRST (red phase),
adding new failing cases. Do NOT touch any implementation file, and do NOT delete
or weaken any existing assertion.

WRITE scope (only — both files ALREADY EXIST, extend them):
  - src/lib/leaderboard/power-score.test.ts (extend; 119 lines today)
  - src/lib/leaderboard/run-power.test.ts   (extend; 84 lines today)
FORBIDDEN scope (must not edit): src/lib/leaderboard/power-score.ts,
  run-power.ts, service.ts, any src/lib/simulation.ts, src/lib/market-data.ts,
  drizzle/**, any route.ts, any component, src/components/student/rank/**.

Ground truth (cite these exact lines in test comments):
  - power-score.ts:54-55  totalReturn / max(volatility, epsilon) → riskAdj
  - power-score.ts:61-69  the 5 component formulas (riskAdjReturn 0 收益白送 0.5; drawdown=1.0 当 maxDrawdownPct==0)
  - run-power.ts:22-27    stddev returns 0 for <2 samples (DOM-05 saturation source)
  - tiers.ts:21           tier5 财商宗师 min = 1600

Add FAILING tests that encode the FIXED behavior we want (they MUST fail today):
  1. DOM-02 do-nothing baseline: an input with netWorth==startCapital,
     returnVolatility==0, disciplineScore~82, maxDrawdownPct==0, learning 0/0
     → computePowerScore(...).power MUST be < 600 (currently 1110, tier3).
     Assert it is strictly LESS than an "engaged but drew-down" sample
     (positive net return, some volatility, real drawdown) — the engaged
     player MUST out-rank the do-nothing player.
  2. DOM-05 small-sample saturation: a run with only 1–2 snapshots and any tiny
     positive return MUST NOT yield riskAdjReturn==1.0; assert its power is well
     below tier5 (1600) and that riskAdjReturn is the neutral value (~0.5).
  3. DOM-01 leverage/property套路 (input-level proxy): a "smooth deterministic
     appreciation" profile (high netWorth, returnVolatility≈0, maxDrawdownPct==0,
     low discipline ~42) MUST NOT reach tier5 (power < 1600).
  4. Property-based (fast-check, follow simulation.money.test.ts style): for any
     valid input, power ∈ [0,2000] and every component ∈ [0,1] (invariant guard).
  5. DOM-09 transparency consistency: assert powerFormula() (service.ts:209)
     exposes EVERY POWER_TUNING constant used in scoring — this MUST fail now
     because riskAdjReturnCap/drawdownCapPct/growthCapReturn/epsilon are hidden.

Run:
  npm run test -- src/lib/leaderboard/power-score.test.ts src/lib/leaderboard/run-power.test.ts
and PASTE the failing output (we WANT red here). Then STOP and wait for my
confirmation — do not proceed to implementation.
```

✅ 验收（pass = 确认红）：上面命令报红，且失败项正是 1–5 条；现有用例仍全部存在（无删减）；`git diff --stat` **只显示这两个测试文件被修改**。
❌ 回滚：`git checkout -- src/lib/leaderboard/power-score.test.ts src/lib/leaderboard/run-power.test.ts`。

> **🛑 STOP-GATE A**：测试红、范围干净后停下等我确认，再进入 1.2。

---

### 提示词 1.2 — 设计冻结：评分模型修正的 **数值规格**（不写代码）

> 改评分会移动每个学生的段位，是教学体感的"经济变量"。在动 `power-score.ts` 之前先把每个 `[PLACEHOLDER]` 数值定下来并由教学组签字，避免实现来回返工。

```
Have education_narrative_designer (teaching-integrity owner) draft a one-page
numeric spec for the power-score rework — NO code, design only.

WRITE scope (only): docs/review-2026-06-12/s1-power-rebalance-spec.md (new design doc)
FORBIDDEN scope: any src/**, drizzle/**, any test.

The spec must pin every tuning value (mark unresolved ones [PLACEHOLDER] for
playtest) and give a rationale per AGENTS "no magic numbers" rule:
  - riskAdjReturn floor: zero-return/zero-volatility maps to ~0.2 (NOT 0.5);
    state the exact mapping. (fixes power-score.ts:62-64 白送 0.5, DOM-02)
  - drawdown=1.0 must REQUIRE prior exposure: define "曾承担敞口" predicate
    (e.g. at least one round with risk-asset holdings > 0). (DOM-02)
  - discipline: remove the "囤现金 +6" cashBufferBonus or convert it to an
    active-decision measure; add a leverage-ratio and concentration penalty term.
    (ties to simulation.ts:151 computeDisciplineScore, cashBufferBonus at :155)
  - minimum-eligibility: define minEffectiveRounds (e.g. ≥8) and minEffectiveTrades
    below which a run does NOT enter the board (power computed but not ranked). (DOM-02/05)
  - small-sample neutral: <3 return samples → riskAdjReturn := 0.5 neutral,
    NOT divide-by-epsilon. (DOM-05)
  - transparency: enumerate which POWER_TUNING constants powerFormula() must
    publish to students (riskAdjReturnCap, drawdownCapPct, growthCapReturn,
    minEffectiveRounds, 不操作基线 floor). (DOM-09)

Each value gets a one-line rationale and a "what broken looks like" note (so we
recognize regression in playtest). Output the table, then STOP for my approval.
```

✅ 验收：`docs/review-2026-06-12/s1-power-rebalance-spec.md` 存在且每个数值有 rationale；教学组给出 `APPROVE`。
❌ 回滚：`git checkout -- docs/review-2026-06-12/s1-power-rebalance-spec.md`（或删除新文件）。

> **🛑 STOP-GATE B**：spec 未 `APPROVE` 前不得改任何 `src/**`。评分阈值是后续所有测试的基准，必须先冻结。

---

### 提示词 1.3 —（TDD 转绿）按 spec 修 power-score / run-power（DOM-02 / DOM-05 / DOM-09）

```
Have engineering-backend-architect implement the power-score rework to make the
1.1 tests pass, strictly following docs/review-2026-06-12/s1-power-rebalance-spec.md.

WRITE scope (only):
  - src/lib/leaderboard/power-score.ts
  - src/lib/leaderboard/run-power.ts
  - src/lib/leaderboard/service.ts  (ONLY powerFormula() at :209 — DOM-09 transparency)
FORBIDDEN scope: simulation.ts, market-data.ts, drizzle/**, repo.ts, any route.ts,
  any component, src/components/student/rank/** (the FormulaDTO type lives in
  types.ts — that change happens in 1.8, component scope), and the 1.1 test files
  (do NOT weaken the tests to pass).

Numbered steps:
  1. power-score.ts:62-64 — replace the riskAdjReturn mapping so zero-return /
     zero-volatility yields ~0.2 not 0.5; keep clamp01 and [0,1] range. (DOM-02)
  2. power-score.ts:66 — gate drawdown==1.0 behind a "had exposure" flag added to
     PowerScoreInput (default false ⇒ no-exposure can't claim full drawdown). (DOM-02)
  3. run-power.ts:22-27 + 36-49 — when return-sample count < 3, set the
     risk-adjusted path to neutral (riskAdjReturn 0.5) instead of stddev 0 →
     /epsilon saturation; populate the new hadExposure flag from snapshots. (DOM-05)
  4. Add minEffectiveRounds / minEffectiveTrades eligibility per spec; expose an
     `eligible` boolean on PowerScoreResult (do NOT yet change ranking — service
     consumes it in 1.6). Keep computePowerScore pure (no IO). (DOM-02)
  5. service.ts:209 powerFormula() — add the POWER_TUNING constants the spec lists
     (riskAdjReturnCap, drawdownCapPct, growthCapReturn, minEffectiveRounds, the
     do-nothing floor) to the returned object. The me route (api/leaderboard/me/
     route.ts:25) already spreads the whole formula object via NextResponse.json,
     so no route change is needed here. Do NOT touch recomputePowerForUser. (DOM-09)
  6. Keep POWER_WEIGHTS summing to 1.0 and every component clamped [0,1]
     (preserve the "做得好" invariant in 01-问题汇总 §六).

TDD: do not edit the 1.1 tests except to add cases the spec newly requires.

Verify:
  - npm run test -- src/lib/leaderboard/power-score.test.ts src/lib/leaderboard/run-power.test.ts  (now GREEN)
  - npx tsc --noEmit
  - npm run test -- src/lib/leaderboard   (whole leaderboard suite green; no determinism regressions)
  - git grep -n "riskAdjReturnCap" src/lib/leaderboard/service.ts   (MUST be ≥1 → DOM-09 published)

Then have reviewer audit: confirm zero changes outside the 3 allowed files and
report APPROVE / REQUEST_CHANGES. Also have education_narrative_designer confirm
the do-nothing baseline now scores below an engaged player (teaching-integrity sign-off).
```

✅ 验收：上述四条命令全通过；`git grep -n "riskAdjReturnCap" src/lib/leaderboard/service.ts` ≥1；`reviewer` 与 `education_narrative_designer` 双 `APPROVE`。
❌ 回滚：`git checkout -- src/lib/leaderboard/power-score.ts src/lib/leaderboard/run-power.ts src/lib/leaderboard/service.ts`。

---

### 提示词 1.4 — 资产与杠杆模型重构（DOM-01，**最高产品风险**）

> 这条改的是 12 回合沙盘的核心经济：房产/创业当前 **不读 seed/eventTimeline**（`simulation.ts:120` 每回合线性 +2.4%、`:126` 用写死的 `trajectory` 数组收官 +36%），且 `loan` 无上限（`:366`），债务仅 `×1.018` 复利（`:517`）——2.4% 房产 > 1.8% 债务 = 无风险套利。引入波动会改变所有历史 run 的可复现性，是本 Sprint 最危险的一步，强制分步 + 停点。

```
Have finance_event_simulator rework the deterministic-appreciation exploit, per
docs/review-2026-06-12/s1-power-rebalance-spec.md and 01-问题汇总 DOM-01.

WRITE scope (only): src/lib/simulation.ts, src/lib/market-data.ts
FORBIDDEN scope: src/lib/leaderboard/**, drizzle/**, repo.ts, any route.ts, any
  component, src/lib/ai.ts.

Ground truth:
  - simulation.ts:120  getPropertyValue (linear +2.4%/round, ignores seed)
  - simulation.ts:126  getVentureValue (hard-coded trajectory[], ignores seed)
  - simulation.ts:366  loan() has no cap
  - simulation.ts:517  debt compounds ×1.018 (< 2.4% property → free arbitrage)

Numbered steps (STOP after each of steps 1, 2, 3 for my confirmation — these are
determinism-affecting and money-affecting):

  1. Make getPropertyValue / getVentureValue read the run seed + eventTimeline so
     valuation has market-correlated volatility AND downside (no monotonic curve).
     Reuse the existing seeded PRNG path (mulberry32 / eventMarketEffect in
     src/lib/event-engine.ts) — do NOT introduce Math.random()/new Date()
     (determinism.guard.test.ts will fail). STOP and show me the new valuation
     curve before continuing.

  2. loan(): add a cap maxDebt = round(netWorth * LEVERAGE_CAP) (or a fixed
     multiple of STARTING_CASH); reject over-cap loans with a Simplified-Chinese
     error consistent with the existing throws at :355/:400. Ensure debt interest
     ≥ any asset's deterministic upside ceiling so "borrow → buy guaranteed-
     appreciating asset" is no longer risk-free. STOP and show the cap value +
     rejection message.

  3. market-data.ts — if any round narrative hard-codes a direction that now
     contradicts seeded valuation, do not silently desync. Full narrative/seed
     alignment is DOM-07 (deferred to S4) — here ONLY avoid NEW contradictions you
     introduce. STOP and confirm scope stayed minimal.

Tests (write/adjust alongside, money invariants come first):
  - Update/extend src/lib/simulation.money.test.ts so 12-round money conservation
    still holds with volatile property/venture (no float drift, cash never negative).
  - Add a test: an all-in property-hold run no longer produces a smooth
    zero-drawdown curve; and a max-leverage-into-property run is rejected/penalized.

Verify:
  - npm run test -- src/lib/simulation.money.test.ts src/lib/determinism.guard.test.ts
  - npm run test -- src/lib/simulation.test.ts
  - npx tsc --noEmit
  - git grep -nE "Math\.random|new Date\(" src/lib/simulation.ts src/lib/market-data.ts  (MUST be empty)

Then have reviewer audit (zero changes outside the 2 files) and have
education_narrative_designer confirm the deterministic-appreciation tier5 exploit
is closed. Report APPROVE / REQUEST_CHANGES.
```

✅ 验收：money + determinism guard 全绿；`git grep -nE "Math\.random|new Date\(" src/lib/simulation.ts src/lib/market-data.ts` 输出为空；房产平推不再零回撤、满杠杆被拒/惩罚；`reviewer` + `education_narrative_designer` 双 `APPROVE`。
❌ 回滚：`git checkout -- src/lib/simulation.ts src/lib/market-data.ts`（**注意**：此回滚会恢复刷分漏洞，回滚后必须重做，不可带病合并）。

> **🛑 STOP-GATE C（最高风险）**：步骤 1/2/3 各自停点等我确认。这是确定性核心改动，任何 `determinism.guard.test.ts` 变红都必须当场修，不得 skip 或 commit 绕过。

---

### 提示词 1.5 — 种子校验与完赛要求（DOM-03，**含 DB 迁移，停点**）

> 战力快照当前三 period 都用"当前"periodKey 写入、**从不记录 `run.seed`**（`service.ts:160-189` 实读已确认：循环里只有 userId/period/periodKey/power/netWorth/components/seasonKey，无 seed）；读榜也不按 seed 过滤（`repo.ts:2748` `listRankSnapshots`）。需新增 `seed` 列并在写/读两端贯通。**迁移用 `npm run db:migrate`（= `tsx scripts/migrate.ts`），绝不用 `drizzle-kit push`（本 DB 会崩，见 CLAUDE.md / MEMORY）。**

```
Have db_architect add seed persistence + completion gating to the power leaderboard.

WRITE scope (only): drizzle/** (new migration + schema.ts), src/lib/db/repo.ts,
  and the single seed-passthrough line in src/lib/leaderboard/service.ts (step 6).
FORBIDDEN scope: service.ts logic beyond that one passthrough, ranking.ts,
  power-score.ts (frozen after 1.3), components, route.ts, simulation.ts.

Ground truth (verified):
  - service.ts:160-189  recomputePowerForUser writes 3 buckets, never reads run.seed
  - repo.ts:2621        upsertLeaderboardSnapshot (declaration); the onConflict
                        target/set block is at :2666-2679 — add seed to both
  - repo.ts:2748        listRankSnapshots (no seed filter)
  - repo.ts:1394        replayRunForUser uses Math.random() off-season seed at :1408
  - reference correct pattern: getSeasonLeaderboard (repo.ts:1322; the indexed
    seed-filtered SQL is at :1331 — `where(eq(scenarioRuns.seed, seed))` + LIMIT).
    The in-memory equivalent is buildSeasonLeaderboard (simulation.ts:614). Mirror
    the SQL seed filter.

Numbered steps (STOP after step 1 and after step 2 — schema + migration are risky):

  1. schema.ts — add `seed` (text/varchar, nullable) to leaderboard_snapshots.
     Generate the migration with `npm run db:generate`; OPEN the produced
     drizzle/00XX_*.sql and show me the diff. Add a SQL comment reserving room for
     S2-3 to later add schoolId/cityCode/provinceCode/visibility on the SAME table
     (do NOT add them now). Confirm the new file number is > 0012 (remote schema is
     at 0012). STOP and wait for my confirmation before applying.

  2. Apply with `npm run db:migrate` (NOT drizzle-kit push). Confirm the column
     exists (list_tables / a SELECT). STOP and report.

  3. repo.ts:2621 upsertLeaderboardSnapshot — persist run.seed into the snapshot;
     add seed to both the insert values AND the onConflictDoUpdate set (:2666-2679).
  4. repo.ts:2748 listRankSnapshots — accept an optional seasonSeed filter param
     (SQL WHERE seed = ? for weekly boards), mirroring getSeasonLeaderboard.
  5. repo.ts:1394 replayRunForUser — leave the off-season random seed as-is, but
     ensure that seed is carried onto the snapshot so replays can be excluded from
     the weekly fair board.
  6. Thread run.seed from recomputePowerForUser (service.ts:178-188) into the
     upsertLeaderboardSnapshot call (minimal passthrough only — no other logic).

Verify:
  - npm run db:migrate   (applies cleanly, no crash)
  - npx tsc --noEmit
  - npm run test -- src/lib/db   (repo.test.ts + repo-fallback.audit + repo-logging green)
  - git grep -n "seed" drizzle/00*.sql   (the new migration adds the column)

Then have reviewer audit (changes confined to drizzle/**, schema.ts, repo.ts, and
the single service passthrough) → APPROVE / REQUEST_CHANGES.
```

✅ 验收：`npm run db:migrate` 干净应用、`tsc` 无错、`npm run test -- src/lib/db` 全绿；新迁移含 `seed` 列且编号 > 0012；`reviewer` `APPROVE`。
❌ 回滚：① 代码：`git checkout -- drizzle/ src/lib/db/repo.ts src/lib/db/schema.ts src/lib/leaderboard/service.ts`；② DB：写配套 down 迁移 `ALTER TABLE leaderboard_snapshots DROP COLUMN seed;` 经 `npm run db:migrate` 应用（**不要**手动在 Supabase Dashboard drop schema —— 会毁掉真实快照数据）。

> **🛑 STOP-GATE D**：步骤 1（schema diff）与步骤 2（迁移已应用）各停点。远端 schema 当前在 0012（MEMORY 已确认全应用），新迁移须续编号不冲突、apply 前看 diff。

---

### 提示词 1.6 — 榜单只取"当周种子 + 完赛"快照（DOM-03 收口，service 纯逻辑）

```
Have engineering-backend-architect enforce seed + completion gating in the
leaderboard read/recompute path now that the column exists.

WRITE scope (only): src/lib/leaderboard/service.ts, src/lib/leaderboard/ranking.ts
FORBIDDEN scope: repo.ts, drizzle/**, simulation.ts, components, route.ts,
  power-score.ts (frozen after 1.3), run-power.ts.

Numbered steps:
  1. service.ts:178-188 recomputePowerForUser — pass run.seed into the snapshot
     write (pairs with 1.5 step 6); compute the weekly periodKey's expected season
     seed.
  2. getLeaderboardBoard() (service.ts:69-84) — for the weekly board, filter
     snapshots to `seed === seasonSeed(periodKey)` (use the listRankSnapshots
     seasonSeed param added in 1.5). Monthly/season boards follow the spec
     (S1-2 eligibility).
  3. Apply the `eligible` gate from 1.3: runs below minEffectiveRounds (未完赛) are
     excluded from ranking OR heavily discounted per spec — never silently top-ranked.
  4. getPowerCard() (service.ts:86-144, private; must still work when hidden/
     unconsented) keeps showing the player their own card even if excluded from the
     public board — do NOT regress that privacy guarantee (01-问题汇总 §六
     "排行榜隐私不泄露"; the own-snapshot read at :113-116 is the load-bearing line).

Tests (TDD — write the service tests, watch them fail, then implement):
  - src/lib/leaderboard/service.test.ts (extend the existing 165-line file): a
    replay/off-season seed run does NOT appear on the weekly board; an unfinished
    run (rounds < N) does NOT out-rank a finished run; a cross-week run (this-week
    periodKey + old seed) is excluded from the weekly board.

Verify:
  - npm run test -- src/lib/leaderboard
  - npx tsc --noEmit
  - git grep -n "seasonSeed" src/lib/leaderboard/service.ts   (MUST be ≥1)

Then have reviewer audit scope + education_narrative_designer confirm "见好就收 /
选种 replay / 跨周污染" are all closed. Report APPROVE / REQUEST_CHANGES.
```

✅ 验收：`npm run test -- src/lib/leaderboard` 全绿；新增 service 测试覆盖 replay/未完赛/跨周三场景；`git grep -n "seasonSeed" src/lib/leaderboard/service.ts` ≥1；`getPowerCard` 隐私不变量未回归；双 `APPROVE`。
❌ 回滚：`git checkout -- src/lib/leaderboard/service.ts src/lib/leaderboard/ranking.ts src/lib/leaderboard/service.test.ts`。

---

### 提示词 1.7 — 学习分最小完成性验证（DOM-04，路由 + 仓库）

> 现状：`learn/complete/route.ts:30` 直接 `markModuleComplete`，无测验/时长证明，每 `moduleKey` 一次 POST 即 +约 300 战力（0.15 权重 × 满分映射）。`repo.ts:2688` `markModuleComplete` 仅幂等插入。该路由 **已有** `checkOrigin()`(:18) 与 `requireUser("student")`(:21) —— 不得移除。过渡期可先降纯打卡权重，但本 Sprint 至少接入"最短交互证明"。

```
Have api_wirer add minimal completion proof to the learning score path (DOM-04).

WRITE scope (only): src/app/api/learn/complete/route.ts, src/lib/db/repo.ts
  (markModuleComplete only, repo.ts:2688).
FORBIDDEN scope: leaderboard/**, simulation.ts, components, drizzle schema for
  unrelated tables, src/lib/content.ts (quiz content is education_narrative_designer's
  file per AGENTS §3 — DEFER quiz authoring to that agent; api_wirer only wires the gate).
  Do NOT remove the existing checkOrigin()/requireUser("student") guards.

Ground truth (verified):
  - learn/complete/route.ts:14   schema = z.object({ moduleKey ... }) (no proof)
  - learn/complete/route.ts:24-35 POST marks complete with NO proof, then
                                  recomputePowerForUser (:32)
  - repo.ts:2688                 markModuleComplete is a bare idempotent insert
  - the score weight it feeds: power-score.ts:67 learning component (.15)

Numbered steps:
  1. route.ts:14 schema — extend the request body to require a minimal proof:
     either a passed mini-quiz answer set OR a minimum interaction signal
     (e.g. dwell time / key interaction event), validated with zod. Reject with
     the standard { error:"invalid_input", message:"<中文>" } shape (use apiError,
     already imported) on failure.
  2. repo.ts:2688 markModuleComplete — only record completion when the proof gate
     passes; keep idempotent (re-submitting a passed module is a no-op, not a
     re-grant). Preserve the no-silent-write-fallback invariant (this is a WRITE —
     do not fall back to store on DB error; repo-fallback.audit.test.ts guards this).
  3. Transitional: if quiz content is not yet ready, gate on interaction proof and
     leave a // TODO(DOM-04) linking the quiz follow-up — do NOT ship a raw
     click-through that still grants +300.

Tests (TDD): extend src/app/api/learn route coverage or src/lib/db/repo.test.ts —
a POST with no/invalid proof does NOT mark complete and does NOT raise power; a
valid proof does.

Verify:
  - npm run test
  - npx tsc --noEmit
  - npm run build
  - git grep -n "markModuleComplete" src/app/api/learn/complete/route.ts  (still single call, now gated)

Then have reviewer audit scope → APPROVE / REQUEST_CHANGES. Flag the quiz-content
follow-up to education_narrative_designer (separate sub-task, src/lib/content.ts).
```

✅ 验收：`npm run test` + `npm run build` 全绿；无证明的 POST 不再记完成、不涨战力；幂等保持；`checkOrigin`/`requireUser` 仍在；`reviewer` `APPROVE`。
❌ 回滚：`git checkout -- src/app/api/learn/complete/route.ts src/lib/db/repo.ts`。

---

### 提示词 1.8 — 透明面板公开常量（DOM-09 UI 收口）

> `powerFormula()`（`service.ts:209`）在 1.3 已加入归一化常量，但学生界面还需把它们渲染出来。透明面板在 **`power-card.tsx`**（面板注释 `:214`，权重渲染 `:65-66`），当前只展示权重，隐藏 `riskAdjReturnCap=2`/`drawdownCapPct=50` 等（`POWER_TUNING`，`power-score.ts:42-48`）。**注意**：面板消费的 DTO 类型 `FormulaDTO` 在 `src/components/student/rank/types.ts:38`，要渲染新字段必须先扩展该类型，否则 `tsc` 必失败；`api/leaderboard/me/route.ts:25` 已 spread 整个 `powerFormula()`，无需改路由。

```
Have ui_implementer surface the now-published tuning constants in the student
transparency panel (DOM-09).

WRITE scope (only):
  - src/components/student/rank/power-card.tsx   (the transparency panel, :214)
  - src/components/student/rank/types.ts         (extend FormulaDTO at :38 to carry
                                                  the new constants — required or tsc fails)
FORBIDDEN scope: src/app/api/**, src/lib/leaderboard/**, db, auth, ai.ts,
  simulation.ts.

Numbered steps:
  1. types.ts:38 — extend FormulaDTO to include the new fields returned by
     powerFormula() (riskAdjReturnCap, drawdownCapPct, growthCapReturn,
     minEffectiveRounds, do-nothing floor).
  2. power-card.tsx — render those fields in the transparency panel (:214) with
     plain-Chinese, teen-friendly copy: 保底/封顶语义 + "最少有效回合" requirement.
     No new hard-coded colors — reuse the design tokens already used in this
     component / rank-board.tsx (git grep "var(--up-" src/components/student/rank
     first to pick the existing token, e.g. var(--up-600) at rank-board.tsx:240).
  3. Keep it a Server Component unless it needs interactivity.

Verify:
  - npm run lint
  - npx tsc --noEmit
  - npm run build
  - npm run test   (axe/component tests stay green)
  - git grep -nE "#[0-9a-fA-F]{3,8}" src/components/student/rank/power-card.tsx  (no NEW hex)

Then have reviewer audit scope + education_narrative_designer confirm the copy is
honest and age-appropriate. Report APPROVE / REQUEST_CHANGES.
```

✅ 验收：`npm run lint && npx tsc --noEmit && npm run build && npm run test` 全绿；面板可见 `riskAdjReturnCap`/`drawdownCapPct` 等保底/封顶语义与"最少有效回合"；`FormulaDTO` 已扩展；无新硬编码颜色；双 `APPROVE`。
❌ 回滚：`git checkout -- src/components/student/rank/power-card.tsx src/components/student/rank/types.ts`。

---

### 提示词 1.9 — Sprint 1 整体诚信审计 + 全质量门（收尾）

```
Have reviewer run the Sprint 1 teaching-integrity audit (read-only; reviewer never
writes), cross-checked by education_narrative_designer.

1. Confirm zero changes leaked outside the Sprint-1 scope set:
   power-score.ts, run-power.ts, service.ts, ranking.ts, simulation.ts,
   market-data.ts, drizzle/** (one new migration > 0012), schema.ts,
   repo.ts (snapshot/markModuleComplete), learn/complete/route.ts,
   components/student/rank/{power-card.tsx,types.ts}, the extended tests, and the
   spec doc. Anything else → REQUEST_CHANGES.
2. Re-run the anti-cheat acceptance matrix and assert each is now CLOSED:
   - DOM-01 deterministic property/venture + unlimited loan → tier5 : CLOSED
   - DOM-02 do-nothing baseline 1110 (now < engaged player)       : CLOSED
   - DOM-03 leaderboard ignores seed & completion                 : CLOSED
   - DOM-04 learning score click-to-max                           : CLOSED
   - DOM-05 <2-sample volatility=0 saturation                     : CLOSED
   - DOM-09 transparency panel hides constants                    : CLOSED
3. Full quality gate (run from repo root):
   - npm run lint
   - npx tsc --noEmit
   - npm run test
   - npm run build
   - npx playwright test   (auto-starts its own dev server on :4173 / PLAYWRIGHT_PORT
                            and reuses one if running — see CLAUDE.md; smoke /student/rank)
4. Determinism + money invariants intact:
   - npm run test -- src/lib/simulation.money.test.ts src/lib/determinism.guard.test.ts

Output a PASS/FAIL checklist per DOM item + each gate, and a final verdict:
APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION.
```

✅ 验收（Sprint 1 DoD，对齐 `02` §Sprint 1）：
- power-score 单测：do-nothing 基线分显著低于"认真操作"样本；房产平推/无限杠杆套路不进 tier5（<1600）；≤2 快照不饱和 —— 全绿。
- service 单测：replay / 未完赛 / 跨周 run 不污染当周榜 —— 全绿。
- 透明面板展示常量与实际计算一致（一致性测试通过，DOM-09）。
- 学习分无证明不可刷满（DOM-04）。
- `npm run lint && npx tsc --noEmit && npm run test && npm run build && npx playwright test` 全绿；money/determinism guard 不退化。
- `reviewer` + `education_narrative_designer` 双 `APPROVE`，六条 DOM 全标 CLOSED。

❌ 回滚（整段 Sprint）：本 Sprint 全程在分支 `feat/s1-teaching-integrity`，未达 DoD 不并入 `main`；单提示词回滚见各节 ❌ 行；DB 列回滚用配套 down 迁移经 `npm run db:migrate`，**严禁** Dashboard `DROP SCHEMA`（会毁真实快照数据）。

---

### Sprint 1 停点（stop-gate）一览

| 停点 | 位置 | 为何必须停 |
|---|---|---|
| **STOP-GATE A** | 1.1 后 | 确认反刷分测试确实先红，且只动两个已存在的测试文件、未删现有断言 —— TDD 地基不能跳过 |
| **STOP-GATE B** | 1.2 后 | 评分阈值是后续所有测试的基准，spec 未 `APPROVE` 不得改 `src/**` |
| **STOP-GATE C** | 1.4 步骤 1/2/3 | 确定性核心 + 资金改动，最高产品风险；任一 determinism guard 变红当场修，不得 skip |
| **STOP-GATE D** | 1.5 步骤 1/2 | DB 迁移；远端 schema 在 0012，新迁移须续编号 > 0012、apply 前看 diff |

> 实现者 / 评审者责任组分离已在每条提示词标注（AGENTS.md §3.1）；评审恒为 `reviewer`(read-only) + `education_narrative_designer`，与各实现组（`engineering-backend-architect` / `finance_event_simulator` / `db_architect` / `api_wirer` / `ui_implementer` / `qa_engineer`）不同责任组。每个停点与每条提示词均以 `APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION` 收尾。

---

## 阶段 S2 — 性能与一致性（BE-01 ~ BE-08）

> 对应 `02-改进优化升级计划.md` 的 Sprint 2。**主题**：消除全表扫描、拆解推进回合长链路、把榜单分页下沉到 SQL、堵住写竞争与唯一性缺口、统一时区。
> **背景**：远端 Supabase 库已完整应用到 ledger **0012**；本地 `drizzle/` 已生成到 **`0013_app_settings.sql`**（`drizzle/meta/_journal.json` 末条 = `0013_app_settings`），故本 Sprint 新迁移从 **0014** 起号。CN→us-east-2 单程约 5s 延迟，**这些修复是当前高频 `timed out` / "数据不可用" 的主要解药**。
> **铁律**：迁移一律 `npm run db:migrate`（`drizzle-kit push` 在本 DB 上会崩，**禁用**）；schema/迁移类改动到 stop-gate 必须**停下等我确认**后才能 apply。
> **责任组隔离**（AGENTS.md §3.1）：实现用 `db_architect`（DB 域：`src/lib/db/**`、`drizzle/**`）/ `api_wirer`（路由域：`src/app/api/**`）；评审一律换到**不同责任组**的 `engineering-database-optimizer` 或 `engineering-code-reviewer`。当一个修复有两个实现者（DB 域 + 路由域）时，评审用第三组的 `engineering-code-reviewer`/`engineering-database-optimizer`，仍满足"实现与评审不同组"。每个提示词以 `APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION` 收尾。

### 目标
单次读沙盘状态的数据量从「全库」收敛到「单班」；单次推进回合 DB 往返从 ~25 降到个位数；榜单读取与重算从「全量进内存 + 应用层分页 / 逐行串行」改为「SQL 窗口函数 + LIMIT/OFFSET / 批处理续跑」；补齐写路径行锁与 `scenario_runs.user_id` 唯一约束；`appendAiMessages` 纳入写不静默回退；所有 period/season key 统一 `Asia/Shanghai`。

### 前置
- S0（安全热修）、S1（教学诚信）已合并；当前在干净分支上（`git status` 干净）。
- 已确认本地 `DATABASE_URL` 指向可用 Postgres（本地 Docker `brownzone-pg` 需 `docker start`，否则所有查询 5s 超时——见 MEMORY 的 local-dev-docker-db 条目）。
- 跑通基线：`npm run lint && npx tsc --noEmit && npm run test` 全绿，记录当前 `src/lib/leaderboard` / `src/lib/db` 测试数作为回归基准。

### 执行顺序（依赖，对齐 doc 02 Sprint 2）
**S2.1 → S2.2 → S2.3 → S2.4 → S2.5 → S2.6 → S2.7**，硬依赖：
- S2.2（推进链路）依赖 S2.1（state 读已收敛到单班）。
- S2.4（重算批处理 + 三 period upsert 合并）依赖 S2.3（分页 + scope 反规范化已落库）。
- **迁移号**：S2.3 = **0014**（按 doc 02 第 120 行，与 S1-3 的 `seed` 列**同一迁移文件**）；S2.5 = **0015**。若 S1-3 尚未生成 0014，实现者**先停下与我确认编号归属**，不要擅自占号。

---

### 提示词 S2.1 — 沙盘状态按班级过滤（BE-01）

> **目标**：`getSimulationStateForUser`（`src/lib/db/repo.ts:1113`）当前在 `:1124` 用 `Promise.all([selectAllUsers, selectAllRuns])` 把**全库** users + runs 拉进内存，再在 `:1129-:1130` 用 JS `.filter(classroomId)`。改为 SQL 层按班级过滤。
> **前置**：复用已存在索引 `users_classroom_id_idx` 与 `scenario_runs_classroom_id_idx`（`src/lib/db/schema.ts:176-177` 区域有 `scenario_runs_classroom_id_idx`）——**本提示词不新增任何索引/迁移**。
> **责任组**：实现 `db_architect`（DB 域），评审 `engineering-database-optimizer`（不同组）。

```
Have db_architect fix the full-table scan on every sandbox-state read (finding BE-01).

WRITE scope (only these): src/lib/db/repo.ts, src/lib/db/repo.test.ts.
FORBIDDEN scope: src/app/api/**, src/components/**, drizzle/**, src/lib/db/schema.ts, src/lib/db/client.ts. Do NOT add or change any index or migration — the classroom indexes already exist (users_classroom_id_idx and scenario_runs_classroom_id_idx in schema.ts).

Context (verified line refs):
- selectAllUsers = repo.ts:692 (no WHERE), selectAllRuns = repo.ts:701 (no WHERE).
- getSimulationStateForUser = repo.ts:1113; the offending load is repo.ts:1124 `const [allUsers, allRuns] = await Promise.all([selectAllUsers(db), selectAllRuns(db)])`, followed by `.filter(item => item.classroomId === ready.user.classroomId)` at repo.ts:1129-1130.

Steps:
1. Read repo.ts:692-704 and repo.ts:1113-1135. Confirm the current code pulls ALL users + ALL runs into memory then filters by classroomId in JS.
2. Add classroom-scoped variants WITHOUT deleting the unscoped ones (grep first — other callers may rely on them): `selectUsersByClassroom(executor, classroomId)` with `.where(eq(users.classroomId, classroomId))` and `selectRunsByClassroom(executor, classroomId)` with `.where(eq(scenarioRuns.classroomId, classroomId))`, joining/mapping exactly like the originals (toUserRecord / toRun).
3. In getSimulationStateForUser, replace the Promise.all + JS filter (repo.ts:1124-1130) with the two scoped calls using `ready.user.classroomId`. The arrays passed to buildSimulationState must be byte-for-byte equivalent to the current single-classroom result.
4. Run `git grep -n "selectAllUsers\|selectAllRuns" src/` and report every remaining caller. Do NOT retire the unscoped versions in this step.
5. Write the test FIRST (TDD per CLAUDE.md) in src/lib/db/repo.test.ts: seed two classrooms; assert getSimulationStateForUser for a student in class A returns only class-A peers/runs and never class-B rows. Then make it pass.

Verify (run all, paste output):
  npx tsc --noEmit
  npm run test -- src/lib/db
  git grep -n "selectAllUsers\|selectAllRuns" src/

STOP after step 4 and wait for my confirmation before retiring any unscoped function.
End with APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION.
```

```
Have engineering-database-optimizer audit the BE-01 change (different responsibility group from db_architect, per AGENTS.md §3.1):
- `git diff --stat`: confirm zero changes outside src/lib/db/repo.ts + src/lib/db/repo.test.ts.
- Confirm the new queries filter at SQL level on classroomId and the WHERE can use users_classroom_id_idx / scenario_runs_classroom_id_idx (no new index introduced).
- Confirm buildSimulationState output is unchanged for the single-classroom case.
Report APPROVE / REQUEST_CHANGES with file:line.
```

✅ 验收：`npm run test -- src/lib/db` 全绿；`git grep -n "selectAllUsers\|selectAllRuns" src/app/api` 为 **0**（API 不再直接拉全表）；新单测断言跨班零泄漏通过。
❌ 回滚：`git checkout -- src/lib/db/repo.ts src/lib/db/repo.test.ts`。

---

### 提示词 S2.2 — 推进回合长链路拆解（BE-02）

> **目标**：`src/app/api/sim/advance-round/route.ts` 内三段串行 await——`advanceRunForUser`（`route.ts:22`）→ `getSimulationStateForUser`（`route.ts:23`）→ `recomputePowerForUser`（`route.ts:28`，**已**包在 swallow `try/catch`，`route.ts:27-31`）。CN→us-east-2 5s 延迟下约 ~25 往返、是超时主因。
> **前置**：必须在 **S2.1 合并后**做（state 读已收敛）。三 period upsert 合并放在 **S2.4**，本提示词只做「异步化 + repo 层合并 state 复用」。
> **责任组**：实现 `api_wirer`（路由）+ `db_architect`（repo 层 follow-up），评审 `engineering-code-reviewer`（第三组）。

```
Have api_wirer shorten the advance-round serial chain (finding BE-02).

WRITE scope (only this): src/app/api/sim/advance-round/route.ts.
FORBIDDEN scope: src/lib/db/**, src/lib/leaderboard/**, src/components/**, schema, migrations. Do NOT change repo.ts or service.ts here — only the route's orchestration.

Context (verified): advance-round/route.ts:22 awaits advanceRunForUser, :23 awaits getSimulationStateForUser, then :27-31 wraps recomputePowerForUser in a try/catch that already swallows errors. The route returns NextResponse.json({ state, adaptiveEvents, message: "已推进到下一回合。" }) at :32. checkOrigin() at :11 and requireUser("student") at :14 MUST stay.

Steps:
1. Read node_modules/next/dist/docs (search for "after") to confirm the Next 16 `after()` API and its exact import path for THIS version. THIS IS NOT THE NEXT.JS YOU KNOW — verify before using; do NOT assume `import { after } from "next/server"`.
2. Move recomputePowerForUser OFF the response critical path: wrap the existing call in `after(async () => { try { await recomputePowerForUser(auth.user.id); } catch {} })` so the leaderboard refresh runs after the response is sent. PRESERVE the existing swallow-on-error behavior (route.ts:27-31). The response must NOT await it.
3. Keep advanceRunForUser (:22) → getSimulationStateForUser (:23) as the only awaited DB work before responding, and keep the response shape { state, adaptiveEvents, message } and handleRouteError fallback unchanged.
4. Leave a `// BE-02 follow-up:` comment noting advance+state could share one tx and reuse the already-read run (db_architect work item below), so it is tracked, not silently dropped.

Verify:
  npx tsc --noEmit
  npm run build
  git grep -n "recomputePowerForUser" src/app/api/sim/advance-round/route.ts   # must be inside after()

STOP after step 1 and show me which `after` import + signature the local Next 16 docs specify before writing step 2.
End with APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION.
```

```
Have db_architect implement the BE-02 repo-layer follow-up flagged by the route change:

WRITE scope (only these): src/lib/db/repo.ts, src/lib/db/repo.test.ts.
FORBIDDEN scope: src/app/api/**, src/components/**, schema, migrations.

Steps:
1. In repo.ts, expose a path so advance-round can get the updated run + built state from ONE transaction (e.g. advanceRunForUser returns the updated run, and getSimulationStateForUser accepts a preloaded run to skip a re-SELECT), eliminating the redundant round trips between advance (advanceRunForUser = repo.ts:1419) and state (getSimulationStateForUser = repo.ts:1113).
2. Preserve the in-memory store fallback contract and the WRITE_FNS no-silent-write-fallback invariant (src/lib/db/repo-fallback.audit.test.ts must stay green).
3. Add/extend src/lib/db/repo.test.ts asserting advance+state for a user issues the run SELECT at most once.

Verify:
  npx tsc --noEmit
  npm run test -- src/lib/db
  npm run test -- repo-fallback.audit

End with APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION.
```

```
Have engineering-code-reviewer audit BE-02 (different group from both implementers, per AGENTS.md §3.1):
- `git diff --stat`: changes only in src/app/api/sim/advance-round/route.ts + src/lib/db/repo.ts (+ repo.test.ts).
- Confirm recomputePowerForUser no longer blocks the response (inside after()), and the prior swallow-on-error semantics are preserved.
- Confirm the route still returns { state, adaptiveEvents, message } and error handling via handleRouteError is intact; checkOrigin() and requireUser("student") untouched.
Report APPROVE / REQUEST_CHANGES with file:line.
```

✅ 验收：`npm run build` 通过；`recomputePowerForUser` 仅出现在 `after()` 内；本地连点「推进下一回合」时响应不再等待战力重算（dev 控制台观察 advance 响应时间下降）。
❌ 回滚：`git checkout -- src/app/api/sim/advance-round/route.ts src/lib/db/repo.ts src/lib/db/repo.test.ts`。

> ⚠️ **Stop-gate**：`after()` 是 Next 16 API，导入路径与旧版不同——**必须先读 `node_modules/next/dist/docs/` 验证再用**，不要凭记忆写 `import { after } from "next/server"`。

---

### 提示词 S2.3 — 榜单 SQL 分页 + scope 反规范化迁移（BE-03，迁移 0014，与 S1-3 seed 列同迁移）

> **目标**：`listRankSnapshots`（`src/lib/db/repo.ts:2748`）无 ORDER BY/LIMIT，返回该周期全部已同意快照；`getLeaderboardBoard`（`src/lib/leaderboard/service.ts:69` 起，`:78` 调 `listRankSnapshots`）全量加载后由 `rankLeaderboard`（`src/lib/leaderboard/ranking.ts:73`）在内存里 `.sort + slice` 分页。把排名 + 分页下沉到 SQL。
> **根因**：scope 维度（`schoolId/cityCode/provinceCode/visibility`）只在 `rank_profiles`，`leaderboard_snapshots`（`src/lib/db/schema.ts:293`）上没有，无法走 SQL 窗口函数 + LIMIT/OFFSET。
> **正确范式参照**：`getSeasonLeaderboard`（`src/lib/db/repo.ts:1322`）在 SQL 内 `where(eq(seed)) + ORDER BY net_worth DESC LIMIT 20`，命中 `scenario_runs` 上的复合索引 `scenario_runs_seed_net_worth_idx`（`schema.ts:180`）。本迁移要在 `leaderboard_snapshots` 上建等价的 scope 复合索引。
> **现有索引**：`leaderboard_snapshots_rank_idx`（period, periodKey, power）在 `schema.ts:314`；唯一索引 `leaderboard_snapshots_user_period_unique`（user_id, period, period_key）在 `schema.ts:308`。
> **责任组**：实现 `db_architect`（schema/迁移/repo）+ `api_wirer`（service/ranking/route），评审 `engineering-database-optimizer`（第三组）。

```
Have db_architect implement BE-03: denormalize scope columns into leaderboard_snapshots and add SQL pagination. This is a MIGRATION — go slow and STOP at the gate.

WRITE scope (only these): src/lib/db/schema.ts, drizzle/** (the migration file), src/lib/db/repo.ts (listRankSnapshots only), src/lib/db/repo.test.ts, src/lib/leaderboard/leaderboard.test.ts (or the nearest existing leaderboard test).
FORBIDDEN scope: src/app/api/**, src/components/**, src/lib/leaderboard/service.ts, src/lib/leaderboard/ranking.ts (those move in the api_wirer follow-up below).

Context: remote DB ledger = 0012; local drizzle/ journal ends at 0013_app_settings, so THIS migration is 0014. doc 02 line 120 requires this scope denormalization to land in the SAME migration as the S1-3 `seed` column. If S1-3 already created 0014 adding `seed`, ADD the scope columns to that same file — do NOT create a separate number. If S1-3 has NOT landed yet, STOP and ask me who owns 0014 before generating.

Steps:
1. In schema.ts leaderboardSnapshots (table at line 293), add columns: schoolId, cityCode, provinceCode (varchar, nullable to match rank_profiles), and visibility (matching rank_profiles' visibility type). These are denormalized copies written at snapshot time.
2. Add a scope-aware composite index next to leaderboard_snapshots_rank_idx (schema.ts:314) so a `RANK() OVER (PARTITION BY <scope> ORDER BY power DESC) ... LIMIT/OFFSET` for a given (period, period_key, scope) is index-supported. Model the intent on getSeasonLeaderboard (repo.ts:1322) which rides scenario_runs_seed_net_worth_idx.
3. Generate the migration: `npm run db:generate`. Open the produced SQL in drizzle/ and confirm it ONLY adds columns + index (no destructive ALTER, no table rewrite). Paste the SQL.

STOP after step 3 and wait for my explicit confirmation. Do NOT run db:migrate yet.

4. (after I confirm) Apply locally: `npm run db:migrate` (NEVER drizzle-kit push — it crashes this DB). Confirm the columns exist.
5. Rewrite listRankSnapshots (repo.ts:2748) to push ranking + pagination into SQL: accept (period, periodKey, scope, page, pageSize), filter `consent=1` AND the scope predicate at SQL level, compute `RANK() OVER (PARTITION BY scope ORDER BY power DESC)`, and `LIMIT pageSize OFFSET page*pageSize`. Mirror the privacy rule currently in ranking.ts (visibility public/school_only/hidden, ranking.ts:61-65) so ranks are computed over the displayed set and hiding leaks no gaps. Add a single-query viewer rank: `COUNT(*) WHERE power > viewer.power` within the same scope/period.
6. Backfill: new scope/visibility columns are NULL on existing rows. Make the recompute write-path (S2.4 / service layer) populate them on next write, and provide a one-shot backfill via a db_architect-owned scripts/db-*.ts for already-stored rows (note it in the migration comment).
7. Write tests FIRST (TDD): (a) page/pageSize slices correctly at SQL level; (b) hidden users don't create rank gaps; (c) viewerRank equals position in the displayed set.

Verify:
  npx tsc --noEmit
  npm run test -- src/lib/leaderboard
  npm run test -- src/lib/db
  npm run db:migrate   # idempotent re-run must be a no-op

End with APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION.
```

```
Have api_wirer wire the new paginated service signature through (after db_architect's repo + migration are merged):

WRITE scope (only these): src/lib/leaderboard/service.ts, src/lib/leaderboard/ranking.ts, src/app/api/leaderboard/board/route.ts, src/app/api/leaderboard/me/route.ts (and profile/route.ts only if it shares the loader).
FORBIDDEN scope: src/lib/db/schema.ts, drizzle/**, repo.ts internals beyond calling listRankSnapshots, src/components/**.

Steps:
1. getLeaderboardBoard (service.ts:69-84) must pass scope + page + pageSize DOWN to listRankSnapshots instead of loading all snapshots then paginating in ranking.ts. rankLeaderboard (ranking.ts:73) becomes a thin shaper over the already-ranked, already-sliced SQL rows; keep its pure privacy assertions (visibleIn/inScope) as a defense-in-depth unit test, but pagination must NO LONGER happen there.
2. getPowerCard's private viewer rank uses the single COUNT(*) query (no second full load).
3. Keep the API response shape and the consent/visibility guarantees identical.

Verify:
  npx tsc --noEmit
  npm run test -- src/lib/leaderboard
  npm run build

End with APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION.
```

```
Have engineering-database-optimizer audit BE-03 end-to-end (different group from db_architect + api_wirer, per AGENTS.md §3.1):
- `git diff --stat`: changes confined to schema.ts, drizzle/0014*, repo.ts (+repo.test.ts), leaderboard/service.ts, leaderboard/ranking.ts (+leaderboard test), leaderboard board/me routes.
- Confirm the board query now returns O(pageSize) rows out of SQL, not O(all consented users), and the WHERE/PARTITION can use the new index (read the generated SQL; EXPLAIN if a local DB is available).
- Confirm privacy invariant preserved: hidden users produce no rank gaps; ranks computed over the displayed set; consent=1 enforced in SQL.
Report APPROVE / REQUEST_CHANGES with file:line.
```

✅ 验收：迁移文件仅含 `ADD COLUMN` + 索引（无重写/破坏性 ALTER）；`npm run db:migrate` 二次运行为 no-op；`npm run test -- src/lib/leaderboard` 全绿，新增「SQL 分页 / 隐身无名次空洞 / viewerRank」用例通过；board 路由不再把全国快照拉进内存。
❌ 回滚：①代码 `git checkout -- src/lib/db/schema.ts src/lib/db/repo.ts src/lib/leaderboard/ src/app/api/leaderboard/`；②若迁移已 apply 且需撤销，**经 stop-gate 确认后**写并执行降级 SQL `ALTER TABLE leaderboard_snapshots DROP COLUMN IF EXISTS school_id, DROP COLUMN IF EXISTS city_code, DROP COLUMN IF EXISTS province_code, DROP COLUMN IF EXISTS visibility; DROP INDEX IF EXISTS <new_scope_idx>;`（仍走 `npm run db:migrate` 路径或 psql，**禁用** `drizzle-kit push`），并回退 `drizzle/meta/_journal.json` 中该条目。

> ⚠️ **Stop-gate（迁移）**：step 3 生成 SQL 后**必须停下给我看**，确认无破坏性 ALTER / 无表重写，我确认后才 `npm run db:migrate`。本迁移与 S1-3 的 `seed` 列**同号 0014**；编号归属不明先停下问我。

---

### 提示词 S2.4 — 重算 cron 批处理 + 三 period upsert 合并（BE-04 + BE-02 收尾）

> **目标**：`recomputeAllRankedUsers`（`src/lib/leaderboard/service.ts:196`）的 `for (const userId of userIds) await recomputePowerForUser(userId)`（`:201-204`）逐行串行，每人 ~12 往返；`recomputePowerForUser`（`service.ts:160`）内 `for (const period of STANDING_PERIODS) await upsertLeaderboardSnapshot(...)`（`:178-188`，`STANDING_PERIODS` 定义在 `service.ts:149`）三次串行 upsert；`src/app/api/cron/recompute-leaderboard/route.ts:26` 调 `recomputeAllRankedUsers()` 无耗时上限 / 无续跑。
> **前置**：依赖 S2.3 已合并（分页 + scope 列已落库，批量重算需回填 scope 列）。同源 N+1 还有 `listPremiumFamilyDigests`（`repo.ts:1354`）——本提示词只修 leaderboard 路径，family digest 留作记录项。
> **责任组**：实现 `db_architect`（service/repo）+ `api_wirer`（cron 路由），评审 `engineering-code-reviewer`（第三组）。

```
Have db_architect batch the leaderboard recompute (finding BE-04) and merge the 3-period upsert (BE-02 tail).

WRITE scope (only these): src/lib/leaderboard/service.ts, src/lib/db/repo.ts (a new batched upsert helper), src/lib/leaderboard/leaderboard.test.ts (or nearest existing leaderboard test), src/lib/db/repo.test.ts.
FORBIDDEN scope: src/app/api/** (the cron route's time-budget change is api_wirer's follow-up below), src/components/**, schema (the unique index leaderboard_snapshots_user_period_unique at schema.ts:308 already supports ON CONFLICT — no schema change needed).

Steps:
1. In recomputePowerForUser (service.ts:178-188), replace the 3 serial upsertLeaderboardSnapshot calls (one per STANDING_PERIODS, service.ts:149) with ONE batched upsert: build the 3 rows in memory, then a single `INSERT ... VALUES (3 rows) ON CONFLICT (user_id, period, period_key) DO UPDATE` (conflict target = leaderboard_snapshots_user_period_unique). Add `upsertLeaderboardSnapshotsBatch` in repo.ts AND add its name to the WRITE_FNS set (repo.ts:242-251) so the no-silent-write-fallback invariant covers it.
2. In recomputeAllRankedUsers (service.ts:196-206), replace the serial `for...await` with cursor-batched processing: page userIds (LIMIT/OFFSET batches of ~50), and within each batch use `Promise.all` with bounded concurrency. Respect the pool max:3 in src/lib/db/client.ts:26 — cap concurrency ~3, do NOT fire hundreds of parallel queries.
3. Make it resumable: accept an optional cursor/offset and a soft time budget (ms); when the budget is exceeded, return `{ processed, nextCursor }` instead of finishing, so the cron can continue next invocation.
4. Write tests FIRST (TDD): (a) one user -> exactly one batched upsert issues 3 period rows; (b) recomputeAllRankedUsers over N users honors the time budget and returns nextCursor; (c) re-running with nextCursor processes the remainder with no double-count.

Verify:
  npx tsc --noEmit
  npm run test -- src/lib/leaderboard
  npm run test -- repo-fallback.audit   # WRITE_FNS invariant intact
  git grep -n "upsertLeaderboardSnapshotsBatch" src/lib/db/repo.ts   # must also appear in WRITE_FNS

End with APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION.
```

```
Have api_wirer add the cron resumption loop (after the service change merges):

WRITE scope (only this): src/app/api/cron/recompute-leaderboard/route.ts.
FORBIDDEN scope: service.ts internals, repo, schema, components.

Context: route.ts:26 currently calls `recomputeAllRankedUsers()` with no budget. CRON_SECRET Bearer auth at route.ts:16-24 (production rejects when unset; otherwise validates `Authorization: Bearer $CRON_SECRET`).

Steps:
1. Call the new budgeted recomputeAllRankedUsers, honoring a per-invocation time budget under the Vercel function limit, and return nextCursor so a follow-up invocation resumes (or self-reschedule per the existing cron design).
2. Keep the CRON_SECRET Bearer auth (route.ts:16-24) EXACTLY as-is — do not weaken it.
3. Return a JSON summary { processed, nextCursor, done }.

Verify:
  npx tsc --noEmit
  npm run build

End with APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION.
```

```
Have engineering-code-reviewer audit BE-04 (different group from db_architect + api_wirer, per AGENTS.md §3.1):
- `git diff --stat` confined to service.ts, repo.ts, recompute-leaderboard route, tests.
- Confirm per-user upsert dropped from 3 serial round trips to 1 batched statement, and upsertLeaderboardSnapshotsBatch is in WRITE_FNS.
- Confirm cron is resumable (nextCursor) and concurrency is bounded (<= pool max:3).
- Confirm CRON_SECRET auth (route.ts:16-24) untouched.
Report APPROVE / REQUEST_CHANGES with file:line.
```

✅ 验收：`npm run test -- src/lib/leaderboard` 全绿；新增「续跑 / 无重复计数 / 单批 3 行 upsert」用例通过；`upsertLeaderboardSnapshotsBatch` 在 `WRITE_FNS` 内（`repo-fallback.audit.test.ts` 绿）。
❌ 回滚：`git checkout -- src/lib/leaderboard/service.ts src/lib/db/repo.ts src/app/api/cron/recompute-leaderboard/route.ts` 及相关测试。

---

### 提示词 S2.5 — 写竞争行锁 + scenario_runs 唯一约束（BE-05 + BE-06，迁移 0015）

> **目标**：
> - BE-05：写路径事务内 `selectRunForUser`（定义 `repo.ts:627`）是普通 SELECT、无 `.for("update")`——`applyActionForUser`（in-tx SELECT `repo.ts:1145`）、`applyEventChoiceForUser`（def `repo.ts:1157`，in-tx SELECT `repo.ts:1162`）、`replayRunForUser`（def `repo.ts:1394`，in-tx SELECT `repo.ts:1399`）、`advanceRunForUser`（def `repo.ts:1419`）同构。READ COMMITTED 下并发双击写覆盖丢一笔。
> - BE-06：`src/lib/db/schema.ts:152` 的 `scenarioRuns.userId` 仅 `.notNull().references()`，**无** `.unique()`（对照 `family_members.studentUserId`，`schema.ts:144` 有 `.unique()`）；`ensureStudentSandbox`（`repo.ts:682`）首建用 `.onConflictDoNothing()`（`repo.ts:685`），冲突目标是主键 `id`（每次不同），挡不住「同一 userId 两条 run」。
> **前置**：迁移号 = **0015**（本地 journal 末条 0013_app_settings；S2.3 已占 0014）。
> **责任组**：实现 `db_architect`，评审 `engineering-database-optimizer`（不同组）。

```
Have db_architect fix the lost-update race (BE-05) and the missing scenario_runs.user_id unique constraint (BE-06). MIGRATION inside — STOP at the gate.

WRITE scope (only these): src/lib/db/repo.ts, src/lib/db/schema.ts, drizzle/** (new migration 0015), src/lib/db/repo.test.ts.
FORBIDDEN scope: src/app/api/**, src/components/**, src/lib/leaderboard/**, src/lib/simulation.ts (pure core).

PART A — BE-05 row lock (no migration):
1. In every WRITE-path transaction that reads-then-writes a run, change the in-transaction selectRunForUser (repo.ts:627) to take a row lock by adding `.for("update")` (introduce a write-path-only variant `selectRunForUpdate`). Apply to: applyActionForUser (SELECT at repo.ts:1145), applyEventChoiceForUser (SELECT at repo.ts:1162), replayRunForUser (SELECT at repo.ts:1399), advanceRunForUser (repo.ts:1419). Do NOT lock the read-only getSimulationStateForUser path (repo.ts:1113).
2. Add a concurrency test (TDD, in repo.test.ts): two overlapping applyActionForUser transactions on the same run must serialize — the second sees the first's write, no trade is lost.

PART B — BE-06 unique constraint (migration 0015):
3. In schema.ts:152 add `.unique()` to scenarioRuns.userId (product invariant: one live run per student — mirrors family_members.studentUserId at schema.ts:144). CONFIRM with me this is the intended invariant before generating.
4. Change ensureStudentSandbox (onConflictDoNothing at repo.ts:685) to target the new user_id unique constraint, so a concurrent first-create can't insert a duplicate run.
5. `npm run db:generate` -> migration 0015. The SQL adds a UNIQUE constraint on scenario_runs.user_id. Paste the SQL AND first check the data: `SELECT user_id, count(*) FROM scenario_runs GROUP BY user_id HAVING count(*) > 1` — if duplicates exist the constraint will FAIL; produce a dedup plan before applying.

STOP after step 5 and wait for my confirmation. Do NOT run db:migrate until I approve (duplicates must be resolved first).

6. (after approval) `npm run db:migrate`. Re-run must be idempotent.

Verify:
  npx tsc --noEmit
  npm run test -- src/lib/db
  npm run db:migrate

End with APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION.
```

```
Have engineering-database-optimizer audit BE-05/BE-06 (different group from db_architect, per AGENTS.md §3.1):
- `git diff --stat` confined to repo.ts, schema.ts, drizzle/0015*, repo.test.ts.
- Confirm `.for("update")` is added ONLY on write paths (repo.ts:1145/1162/1399 + advanceRunForUser), not the read path (repo.ts:1113).
- Confirm the migration adds a UNIQUE on scenario_runs.user_id and ensureStudentSandbox's ON CONFLICT now targets it (repo.ts:685).
- Confirm a pre-migration duplicate-check was run (or a dedup plan exists).
Report APPROVE / REQUEST_CHANGES with file:line.
```

✅ 验收：并发双击单测证明无丢更新；`scenario_runs.user_id` 唯一约束已建（apply 前先做重复检测，无重复后再 apply）；`ensureStudentSandbox` 冲突目标改为 `user_id`。
❌ 回滚：①代码 `git checkout -- src/lib/db/repo.ts src/lib/db/schema.ts src/lib/db/repo.test.ts`；②约束撤销 **经 stop-gate 确认后** `ALTER TABLE scenario_runs DROP CONSTRAINT IF EXISTS <unique_name>;`（走 `npm run db:migrate` 或 psql，**禁用** `drizzle-kit push`），回退 journal 该条目。

> ⚠️ **Stop-gate（迁移 + 数据）**：加唯一约束前**必须先跑重复检测 SQL**；若线上存在同一 `user_id` 多条 run，先出去重方案，**禁止**直接 apply（会失败/锁表）。

---

### 提示词 S2.6 — appendAiMessages 纳入写不静默回退（BE-07）

> **目标**：`WRITE_FNS` 集合（`src/lib/db/repo.ts:242-251`）含单数 `"appendAiMessage"`（`repo.ts:245`），但实际批量持久化函数是复数 `appendAiMessages`（`repo.ts:1797`），后者**不在** `WRITE_FNS`，违反「写不静默回退」不变量——配了 DB 时该写失败会被静默落内存，审计测试未覆盖。
> **⚠️ 重要事实更正**：`appendAiMessage`（单数）**不是死项**——它是真实导出函数（`repo.ts:1842`），单消息调用者用它、内部委托给复数 `appendAiMessages`，且 `repo.test.ts` / `store.ts` 在用。**绝不能删除单数项**；正确修复是**保留单数、追加复数**。
> **责任组**：实现 `db_architect`，评审 `engineering-code-reviewer`（不同组）。

```
Have db_architect fix BE-07: appendAiMessages is missing from WRITE_FNS.

WRITE scope (only these): src/lib/db/repo.ts, src/lib/db/repo-fallback.audit.test.ts.
FORBIDDEN scope: everything else.

Context (verified — read carefully, the draft was wrong here):
- WRITE_FNS is repo.ts:242-251 and currently contains the SINGULAR "appendAiMessage" at repo.ts:245.
- BOTH functions are LIVE: appendAiMessages (plural, the batch persister) = repo.ts:1797; appendAiMessage (singular, a single-message convenience wrapper that delegates to the plural) = repo.ts:1842, and it is used by repo.test.ts and store.ts. The singular is NOT dead — DO NOT remove it.

Steps:
1. ADD "appendAiMessages" (plural) to the WRITE_FNS set (repo.ts:242-251). KEEP the existing "appendAiMessage" (singular) entry — it is a real function (repo.ts:1842), not dead.
2. Confirm appendAiMessages (repo.ts:1797), when DB is configured and the write throws, now SURFACES the error instead of silently falling back to store (the WRITE_FNS gate).
3. Extend src/lib/db/repo-fallback.audit.test.ts to cover appendAiMessages: assert it is in WRITE_FNS and that a forced DB write failure surfaces (does not silently write to memory).

Verify:
  npx tsc --noEmit
  npm run test -- repo-fallback.audit
  npm run test -- repo-logging
  git grep -n "appendAiMessage" src/lib/db/repo.ts   # confirm BOTH "appendAiMessage" and "appendAiMessages" appear in WRITE_FNS

End with APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION.
```

```
Have engineering-code-reviewer audit BE-07 (different group from db_architect, per AGENTS.md §3.1):
- `git diff --stat` confined to repo.ts + repo-fallback.audit.test.ts.
- Confirm WRITE_FNS now contains BOTH "appendAiMessage" and "appendAiMessages", and the live singular function (repo.ts:1842) was NOT removed.
- Confirm the audit test would FAIL if appendAiMessages were removed from WRITE_FNS again (regression guard is real).
Report APPROVE / REQUEST_CHANGES.
```

✅ 验收：`npm run test -- repo-fallback.audit` 绿且新增用例覆盖 `appendAiMessages`；`git grep` 确认 `appendAiMessage` 与 `appendAiMessages` 均在 `WRITE_FNS`。
❌ 回滚：`git checkout -- src/lib/db/repo.ts src/lib/db/repo-fallback.audit.test.ts`。

---

### 提示词 S2.7 — 周期/赛季 key 统一 Asia/Shanghai（BE-08，⚠️ 桶归属变更需公告）

> **目标**：`src/lib/leaderboard/periods.ts` 的 `monthlyKey`（`:23-27`，用 `getUTCFullYear`/`getUTCMonth`）、`semesterKey`（`:30-36`，同样用 UTC）+ `src/lib/season.ts:7`（`SEASON_EPOCH_MS = Date.UTC(2026,0,5)`，`currentSeasonKey` `:10-13` 按 UTC 周切）。UTC 零点 = 北京 08:00，月榜/学期/周种子边界在北京时间上午 8 点切换；2/1、9/1 当天早 8 点前归属上一季。
> **⚠️ 风险**：改时区会**改变现有桶归属**——doc 02 第 130 行明确要求「在版本发布说明里告知并选低峰时段切换」。
> **责任组**：实现 `db_architect`，评审 `engineering-database-optimizer`（不同组）。

```
Have db_architect unify all period/season keys to Asia/Shanghai (finding BE-08).

WRITE scope (only these): src/lib/leaderboard/periods.ts, src/lib/season.ts, src/lib/leaderboard/periods.test.ts, src/lib/season.test.ts.
FORBIDDEN scope: src/lib/db/**, src/app/api/**, src/components/**, drizzle/** (this is pure key-derivation logic, NO schema change).

Context (verified): periods.ts:24/31/32 use getUTCFullYear/getUTCMonth; season.ts:7 uses Date.UTC(2026,0,5) and currentSeasonKey (season.ts:10-13) floors weeks off that UTC epoch. At UTC midnight = Beijing 08:00, so month/semester/week boundaries flip at 8am Beijing, and 2/1 & 9/1 before 8am belong to the prior season. This is a USER-VISIBLE bucket-boundary change.

Steps:
1. Introduce ONE shared Asia/Shanghai offset helper (UTC+8 fixed offset — no DST in CN, so a simple `+8h` shift is correct and SSR/CSR-stable; do NOT depend on the server's local TZ). Use it as the single basis for monthlyKey + semesterKey (periods.ts) AND currentSeasonKey/SEASON_EPOCH (season.ts) so the two files share one time basis.
2. Write tests FIRST (TDD) capturing the boundary cases: 2026-02-01 00:30 Beijing must be the SPRING season (key `2026-S`), NOT the prior autumn; 2026-09-01 07:00 Beijing must be AUTUMN (`2026-A`); a Monday 00:00 Beijing must start a new weekly season. Assert periods.ts and season.ts agree on the same boundary instant.
3. Keep key STRING FORMATS identical (`<year>-S` / `<year>-A` for semesterKey, `<year>-MM` for monthlyKey, `S<weeks>` for currentSeasonKey) so existing stored periodKeys still parse — only the boundary instant moves by 8h.
4. Produce a short MIGRATION NOTE (markdown in your report, for the release notes): which buckets shift, and the recommendation to deploy at a low-traffic window (late night Beijing, well away from any boundary).

Verify:
  npx tsc --noEmit
  npm run test -- periods
  npm run test -- season
  npm run test -- src/lib/leaderboard

STOP after step 1 and show me the shared offset helper before changing both files.
End with APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION.
```

```
Have engineering-database-optimizer audit BE-08 (different group from db_architect, per AGENTS.md §3.1):
- `git diff --stat` confined to periods.ts, season.ts, periods.test.ts, season.test.ts.
- Confirm periods.ts and season.ts now share ONE Asia/Shanghai basis (no lingering getUTC* on a boundary path; grep `getUTC` in both files).
- Confirm key string formats are unchanged (stored keys still parse).
- Confirm the release/migration note documents the bucket shift + low-peak deploy window (per doc 02 line 130).
Report APPROVE / REQUEST_CHANGES with file:line.
```

✅ 验收：`npm run test -- periods season` 全绿，边界用例（2/1、9/1、周一 00:00 北京）落在正确季；两文件共用同一时区基准；`git grep -n "getUTC" src/lib/season.ts src/lib/leaderboard/periods.ts` 边界路径无残留；发布说明含桶归属变更与低峰切换建议。
❌ 回滚：`git checkout -- src/lib/leaderboard/periods.ts src/lib/season.ts` 及对应测试（**注意**：若已上线运行过，回滚会再次移动桶边界，需二次公告——优先修正而非回滚）。

> ⚠️ **Stop-gate（用户可见变更）**：BE-08 改变现有榜单桶归属，**不要在赛季/周/月边界附近上线**；先在报告里产出发布说明，选北京低峰时段切换。

---

### 阶段 S2 总验收（DoD，对齐 doc 02 第 132 行）

```powershell
npm run lint
npx tsc --noEmit
npm run test
npm run build
npm run db:migrate   # 0014 / 0015 已 apply 且二次运行 no-op
```

- 新增/更新的 `src/lib/leaderboard` 与 `src/lib/db` 测试全绿；`repo-fallback.audit.test.ts` 守护的写不静默回退不变量仍绿。
- 客观门（`git grep`）：
  - `git grep -n "selectAllUsers\|selectAllRuns" src/app/api` → **0**（BE-01）
  - `git grep -n "recomputePowerForUser" src/app/api/sim/advance-round/route.ts` → 仅在 `after()` 内（BE-02）
  - `git grep -n "appendAiMessage" src/lib/db/repo.ts` → 单数与复数**均**在 `WRITE_FNS`（BE-07）
  - `git grep -n "getUTC" src/lib/season.ts src/lib/leaderboard/periods.ts` → 边界路径无残留（BE-08）
- 本地 + 预览压测确认「推进回合」P95 延迟下降；榜单 board 查询输出 O(pageSize) 行；recompute cron 可续跑。
- 时区切换前后桶归属变化已记录在发布说明，并约定低峰时段上线。
- 每个提示词均以 `APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION` 收尾；所有迁移经 `npm run db:migrate`（**从不** `drizzle-kit push`）。

### 阶段 S2 总回滚

- 代码：`git checkout -- src/lib/db/repo.ts src/lib/db/schema.ts src/lib/leaderboard/ src/lib/season.ts src/app/api/sim/advance-round/route.ts src/app/api/cron/recompute-leaderboard/route.ts src/app/api/leaderboard/` 及对应测试。
- 迁移（0014/0015）：**经迁移 stop-gate 确认后**写并执行对应降级 SQL（`DROP COLUMN ... / DROP INDEX ... / DROP CONSTRAINT ...`），同步回退 `drizzle/meta/_journal.json` 对应条目——仍走 `npm run db:migrate` 或 psql，**禁用** `drizzle-kit push`。
- 整 Sprint 撤回：若 S2 已成独立 commit，`git revert <commit>` 后重跑总验收门。

---

## Sprint 3 — 前端可靠性（S3）

> 对应计划文档 `docs/review-2026-06-12/02-改进优化升级计划.md` 的 **S3** 行（FE-01/02/03/04/05/07/09、FE-10，估时 3–4 天）。问题证据见 `docs/review-2026-06-12/01-问题汇总.md`。
> **本 Sprint 的统一主线 = 三态模式**：每一个数据获取/写入交互都必须显式区分 `loading` / `error(可重试)` / `empty`，绝不把"请求失败"误当成"无数据/无 profile"。
> **依赖**：S0（安全热修）必须先行并已合并；S1（教学诚信）建议先于本 Sprint 上线。S3 与 S2 可并行（S3 只动 `src/components/**` 与 `src/lib/utils.ts`，不碰 API/DB/auth）。但 **FE-01 / FE-02 是 P1，必须本轮最先做、合一个可独立上线的小 PR**；其余 P2 项随后跟进。
> **实现者（唯一）**：`ui_implementer`（组件结构/状态/无障碍）。
> **评审（异组，AGENTS.md §3.1）**：`reviewer`（只读范围合规）+ `design-ui-designer`（UI/文案，含 FE-02 隐私交互）+ `testing-accessibility-auditor`（无障碍）。三者均不属于组件实现责任组，与 `ui_implementer` 异组。每个评审以 `APPROVE` / `REQUEST_CHANGES` / `NEEDS_DISCUSSION` 收尾。
> **写范围（允许）**：`src/components/**`、`src/lib/utils.ts`、`src/lib/use-async-action.ts`（新建 hook）、对应的 `*.test.ts(x)`。
> **禁区（绝不触碰）**：`src/app/api/**`、`src/lib/db/**`、`src/lib/auth*.ts`、`src/lib/ai.ts`、`drizzle/**`。前端只改"如何展示/提交"，不得改任何接口契约或返回结构。
> **DB 纪律**：S3 不含任何 migration，**不需要** `npm run db:migrate`，**严禁** `drizzle-kit push`（本 DB 会崩）。
>
> **TDD 要求**（参照 `CLAUDE.md` 测试层 + 现有 `src/components/student/student-tutor-radar.test.tsx`、`src/components/shared/global-ai-assistant.test.tsx`）：本 Sprint 每个修复 **先写组件测试再改实现**，DB-down/请求失败用全局 `fetch` mock 模拟，断言"显示错误+重试"而非空态/onboarding。

---

### 目标

1. 沙盘所有写操作（推进回合 / 交易 / 银行 / 事件决策）**真正防双击**，CN→us-east-2 5s 写延迟下连点不会跳多回合或重复提交（FE-01）。
2. 榜单/赛季三处数据组件统一三态；**已入榜学生在 API 失败时绝不被打回 onboarding、绝不覆盖隐私设置**（FE-02 / FE-07 / FE-10）。
3. 学生界面不再出现 `db_unavailable` / `rate_limited` 等英文稳定码，一律中文（FE-03）。
4. 市场板块快速切换无响应乱序竞态（FE-04）。
5. 时间显示为北京时间，不再慢 8 小时（FE-05）。
6. 交易结果反馈可被读屏播报、成功/失败分色（FE-09）。

### 前置

- S0 已合并；本分支基于已含 S0（理想情况下也含 S1）的 `main` 起。
- 工作树干净：`git status` 无未提交改动；新开分支 `git switch -c fix/s3-frontend-reliability`。
- 确认参照样板存在（这些是仓库内"做对了"的范式，Codex 必须照抄）：
  ```powershell
  git grep -n "startTransition(async" src/components/billing/wechat-checkout-button.tsx   # FE-01 范式（:221）
  git grep -n 'role="status" aria-live' src/components/student/student-tutor-radar.tsx     # FE-09 范式（:141）
  ```

---

### 提示词 S3.1 — 全局防双击 `useAsyncAction`（FE-01，P1，先做）

> 计划文档 S3-1。**这是本项目最核心的回合一致性问题**（FE-01）：`student-sandbox.tsx:303-309` 的 `submitAction` 用 `startTransition(() => { void mutate(...) })`，`void` 丢弃 Promise，React 19 的 `isPending`（此处变量名 `pending`，`:97`）在同步段结束即变回 `false`，按钮 `disabled={pending}` 形同虚设。注意 `mutate` 是组件内部的 `async function`（`:125`，内部直接调用 `fetch` `:126`），不是 prop——组件仅接收 `{ initialState }`（`:77`）。

```
Have ui_implementer fix the double-submit guard in the sandbox (finding FE-01, P1).

WRITE scope (only): src/lib/use-async-action.ts (new), src/components/student/student-sandbox.tsx,
                    src/components/student/student-sandbox.test.tsx (new).
FORBIDDEN scope: src/app/api/**, src/lib/db/**, src/lib/auth*.ts, src/lib/ai.ts, drizzle/**.
Do NOT change any request URL, body shape, or error contract — display/submission logic only.

Root cause (already verified) — src/components/student/student-sandbox.tsx:303-309:
  const submitAction = (body?, url = "/api/sim/actions") => {
    startTransition(() => { void mutate(url, body).catch(...) });   // void drops the promise
  };
The transition flag is `const [pending, startTransition] = useTransition()` at :97.
React 19 `pending` only spans the whole request when the scope callback RETURNS / awaits the promise.
`mutate` is an INTERNAL async function (src/components/student/student-sandbox.tsx:125) that calls
`fetch` directly (:126) — it is NOT a prop. The only prop is `initialState` (:77).
The canonical correct pattern already lives at src/components/billing/wechat-checkout-button.tsx:221:
  startTransition(async () => { ... await fetch(...) ... }).

Step 1 (TEST FIRST): write src/components/student/student-sandbox.test.tsx that mocks GLOBAL `fetch`
  (vi.stubGlobal("fetch", ...) resolving { ok:true, json: async () => ({ state, message }) } only after a
  tick), renders <StudentSandbox initialState={...} />, fires two rapid clicks on the "推进下一回合" button,
  and asserts the fetch mock is called EXACTLY ONCE while the request is in flight, and the button is
  `disabled` during the await. Mirror the vitest + @testing-library/react + userEvent style of
  src/components/student/student-tutor-radar.test.tsx.
  Run `npx vitest run src/components/student/student-sandbox.test.tsx` and confirm it FAILS (red).

Step 2: create src/lib/use-async-action.ts exporting `useAsyncAction()` returning `{ run, pending }` where
  `run(fn)` does `startTransition(async () => { try { await fn() } catch(e){ ... } })` so `pending` covers
  the full async lifecycle (or self-manage a `submitting` flag reset in `finally`).

Step 3: refactor student-sandbox.tsx `submitAction` to use useAsyncAction so the awaited promise is tracked;
  keep the existing setMessage error handling. The button `disabled` props that must now bind to the new
  pending value are at lines 411, 428, 438, 632, 652, 682; line 593 is the compound guard
  `disabled={pending || !selectedAsset}` — preserve the `!selectedAsset` half, only re-wire the pending half.

Step 4: `git grep -n "void mutate\|void fetch\|startTransition(() =>" src/components/student/`
  — report every other fire-and-forget write so we can decide whether to migrate it too. Do NOT mass-edit
  beyond the sandbox in this step; just list them.

Run the test (must go green), then `npm run lint` and `npx tsc --noEmit`.
Stop after step 1 and wait for my confirmation that the failing test correctly reproduces the bug.
```

✅ 验收：`npx vitest run src/components/student/student-sandbox.test.tsx` 绿（双击只发一次 `fetch`，按钮 await 期间 disabled）；`npm run lint` + `npx tsc --noEmit` 无新错；`git grep -n "void mutate" src/components/student/student-sandbox.tsx` → **0**。
❌ 回滚：`git checkout -- src/components/student/student-sandbox.tsx; git clean -f src/lib/use-async-action.ts src/components/student/student-sandbox.test.tsx`。

---

### 提示词 S3.2 — 失败态 vs 空态/onboarding（FE-02 P1 + FE-07 + FE-10）

> 计划文档 S3-2。**FE-02 是隐私回归，最高优先**：`rank-dashboard.tsx:52` 用 `if (!data || !data.card.hasProfile) return <RankOnboarding/>`，而 `:29` 的 `.then(r => r.ok ? (r.json() as Promise<MeResponse>) : null)` 在 `/api/leaderboard/me` 返回 503（本地 Docker 停 / 远端超时，高频）时令 `data===null` → 已设昵称/地区/隐身的学生被打回入榜表单，重新提交可能覆盖原昵称与"隐身"可见性。FE-07（`rank-board.tsx:56-57` 失败 `setBoard(null)` → `:175` 渲染真实空态文案）与 FE-10（`season-leaderboard.tsx:25-27` 静默 `.catch` → `data` 永远 null → `:51` 永久骨架屏）是同一类病。

```
Have ui_implementer enforce the three-state (loading / error-retry / empty) pattern across the rank UI,
fixing FE-02 (P1, privacy regression), FE-07, and FE-10.

WRITE scope (only): src/components/student/rank/rank-dashboard.tsx,
                    src/components/student/rank/rank-board.tsx,
                    src/components/student/season-leaderboard.tsx,
                    the matching *.test.tsx for each.
FORBIDDEN scope: src/app/api/**, src/lib/db/**, src/lib/auth*.ts, drizzle/**, and the RankOnboarding
                 component's submit logic (you may RENDER <RankOnboarding/>, never change what it submits).
Do NOT change the API response shape or the onboarding submit payload.

Verified failure sites:
- rank-dashboard.tsx:28-29 — fetch then `.then(r => r.ok ? (r.json() as Promise<MeResponse>) : null)`
  collapses HTTP failure into null; :52 `if (!data || !data.card.hasProfile) return <RankOnboarding/>`
  then mistakes failure for "no profile".
- rank-board.tsx:56-57 — `.catch(() => setBoard(null))` → :175 renders the empty-state copy on failure.
  The real empty copy is: "本范围本期还没有上榜的同学，完成一局沙盘抢占头名 🏁" (:176-178).
- season-leaderboard.tsx:25-27 — silent `.catch(() => { /* hide on failure */ })` leaves data null →
  :51 `!data` shows a forever skeleton (:51-56).

Step 1 (TEST FIRST): for each component add a test where global `fetch` is mocked to reject / resolve 503,
  asserting:
  (a) rank-dashboard renders an ERROR card with a retry control and does NOT render RankOnboarding;
  (b) rank-board renders an error + "点此重试" affordance and does NOT render the real empty copy
      "本范围本期还没有上榜的同学…";
  (c) season-leaderboard renders an error+retry block (not the skeleton).
  Also add success-but-empty tests: rank-dashboard with `{ ok:200, card:{ hasProfile:false } }` SHOULD render
  onboarding; rank-board / season with 200 + empty list SHOULD render the existing empty-state copy.
  Run them and confirm RED.

Step 2: introduce an explicit `status: "loading" | "error" | "ready"` plus the data in each component:
  - rank-dashboard: only render <RankOnboarding/> when `status==="ready" && data.card.hasProfile===false`;
    on `status==="error"` render a retry card that re-bumps the existing `refreshKey` (:21,:41). Never
    overwrite privacy on failure.
  - rank-board: on catch set an `error` state and render the retry copy; treat `board===null && !error`
    distinctly from `board.entries.length===0`.
  - season-leaderboard: drop the silent catch; add an error state with retry; skeleton only while truly loading.
  Reuse the existing `Loader2` spinner and token classes (`text-fg-muted` / `bg-bg-muted`) already in these files.

Step 3: keep retry copy in friendly Simplified Chinese (teen-facing, non-blaming), e.g. "榜单加载失败，点此重试".

Run all three test files (green), then `npm run lint` + `npx tsc --noEmit`.
Stop after step 1 and wait for my confirmation on the failing tests, since FE-02 touches privacy.
```

> **二次审查（异组，AGENTS.md §3.1）**：实现者为 `ui_implementer`（组件实现责任组）；FE-02 的文案与"绝不覆盖隐身设置"的交互正确性由 `design-ui-designer` 复核（§3.1 routing：UI 实现 review with `design-ui-designer` + `testing-accessibility-auditor`）。`design-ui-designer` 与 `ui_implementer` 异组，满足"实现与评审异组"。

✅ 验收：三个 `*.test.tsx` 全绿；`git grep -n "r.ok ? r.json() : null\|setBoard(null)\|catch(() => {})" src/components/student/rank/ src/components/student/season-leaderboard.tsx` → 不再用于"失败=空/onboarding"分支；手动 DB-down 复测（见下方"手动 DB-down 验证"）。
❌ 回滚：`git checkout -- src/components/student/rank/rank-dashboard.tsx src/components/student/rank/rank-board.tsx src/components/student/season-leaderboard.tsx`。

---

### 提示词 S3.3 — 错误码中文化 + 市场板块竞态（FE-03 + FE-04）

> 计划文档 S3-3。FE-03：`student-market-board.tsx:148`、`student-history-review-dashboard.tsx:343`、`global-ai-assistant.tsx:205` 与 `:302` 都 `throw new Error(payload.error ?? 中文兜底)` —— 把英文稳定码（`db_unavailable` 等）灌进 `error.message` 直出学生界面。应优先用 `payload.message`。（注意：`student-sandbox.tsx:138` 的 `mutate` 已是 `payload.message ?? payload.error`，本就正确，不在本提示词范围。）FE-04：`student-market-board.tsx:142` 的 `loadBoard` 无 AbortController、不校验返回 symbol 仍是当前选中，effect 在 `:159-161` 按 `selectedSymbol` 触发，快点 A→B 时 A 的迟到响应覆盖 B。

```
Have ui_implementer fix English error-code leakage (FE-03) and the market-board response race (FE-04).

WRITE scope (only): src/components/student/student-market-board.tsx,
                    src/components/student/student-history-review-dashboard.tsx,
                    src/components/shared/global-ai-assistant.tsx,
                    the matching *.test.tsx.
FORBIDDEN scope: src/app/api/**, src/lib/db/**, src/lib/ai.ts, src/lib/auth*.ts.
Do NOT change the { error, message } API contract — only which field the UI shows.

FE-03 verified sites (each throws the stable code into the message shown to students):
- student-market-board.tsx:148            throw new Error(nextPayload.error ?? "市场信息刷新失败。")
- student-history-review-dashboard.tsx:343 throw new Error(nextPayload.error ?? "历史复盘刷新失败。")
- global-ai-assistant.tsx:205              throw new Error(payload.error ?? "无法读取历史会话。")
- global-ai-assistant.tsx:302              throw new Error(payload.error ?? "KeyAI 暂时不可用。")
Fix: prefer `payload.message` then the existing Chinese fallback; `payload.error` is for logging/branching
  only — i.e. `throw new Error(payload.message ?? "<existing Chinese fallback>")`. Keep the typed payload
  shape and add `message?: string` to the inline response types where missing (the AI-chat payload type at
  global-ai-assistant.tsx:296-299 currently lacks `message?`).

FE-04 verified at student-market-board.tsx:142 `loadBoard(symbol)` — no AbortController, no symbol guard,
  driven by the effect at :159-161 keyed on `selectedSymbol` (and the interval effect at :163-166).
Fix: thread an AbortController/signal into the fetch and abort the previous request on effect cleanup, OR
  before `setPayload` verify the resolved symbol still equals the current `selectedSymbol`; ignore stale
  responses.

Step 1 (TEST FIRST):
  - FE-03: mock global `fetch` returning `{ ok:false, status:503, json: async () => ({ error:"db_unavailable",
    message:"系统繁忙，请稍后再试" }) }`; assert the rendered error text is the Chinese message and does NOT
    contain "db_unavailable".
  - FE-04: render the market board, switch symbol A→B with A's fetch resolving AFTER B's; assert the displayed
    payload is B's, not A's. Confirm RED first.
Step 2: implement both fixes.

Run the tests (green), then `npm run lint` + `npx tsc --noEmit`.
```

✅ 验收：`git grep -nE "Error\(.*\.error \?\?" src/components/student/student-market-board.tsx src/components/student/student-history-review-dashboard.tsx src/components/shared/global-ai-assistant.tsx` → **0**（不再把 `.error` 当展示文案）；竞态测试绿。
❌ 回滚：`git checkout -- src/components/student/student-market-board.tsx src/components/student/student-history-review-dashboard.tsx src/components/shared/global-ai-assistant.tsx`。

---

### 提示词 S3.4 — 北京时区显示 + 操作反馈无障碍（FE-05 + FE-09）

> 计划文档 S3-4。FE-05：`src/lib/utils.ts:86-92` 的 `formatDateLabel` 用 `getUTCMonth/getUTCDate/getUTCHours`（`:87-89`），北京 14:30 显示 06:30，行情/流水时间全慢 8 小时。FE-09：`student-sandbox.tsx:694-697` 的反馈容器（"操作已更新"与"提交失败"共用橙色 `bg-orange-50 text-orange-700` `:695`）不被读屏播报、成功失败同色；范式见 `student-tutor-radar.tsx:141` 的 `role="status" aria-live="polite"`。

```
Have ui_implementer fix UTC time display (FE-05) and add accessible action feedback (FE-09).

WRITE scope (only): src/lib/utils.ts, src/components/student/student-sandbox.tsx,
                    src/lib/utils.test.ts (create — it does not exist yet),
                    src/components/student/student-sandbox.test.tsx (extend the file from S3.1).
FORBIDDEN scope: src/app/api/**, src/lib/db/**, and any color TOKEN definition in globals.css
                 (use existing semantic tokens only; do NOT add new hex — that's S4/FE-06's job).

FE-05 verified at src/lib/utils.ts:86 `formatDateLabel`, which uses
  date.getUTCMonth() (:87) / getUTCDate() (:88) / getUTCHours() (:89).
Fix: format with `new Intl.DateTimeFormat("zh-CN", { timeZone:"Asia/Shanghai", month:"numeric", day:"numeric",
  hour:"2-digit", minute:"2-digit", hour12:false })` so SSR and CSR agree (no hydration drift). Preserve the
  existing "M月D日 HH:MM" output shape.

FE-09 verified at student-sandbox.tsx:694-697 — the feedback div has no aria-live and uses one orange style
  (`bg-orange-50 ... text-orange-700`, :695) for both success and failure.
Fix: give the container `role="status" aria-live="polite"`, and drive success vs failure styling off existing
  semantic tokens (success → up/positive token, failure → error token) so screen readers announce it and the
  two states are visually distinct. Track a success/error flag alongside the existing `message` state. Copy
  the pattern from student-tutor-radar.tsx:141.

Step 1 (TEST FIRST):
  - FE-05: a src/lib/utils.test.ts asserting formatDateLabel of a known UTC instant renders the Beijing-local
    time (e.g. new Date("2026-06-12T06:30:00Z") → "6月12日 14:30"). Confirm RED.
  - FE-09: extend student-sandbox.test.tsx asserting the feedback region has role="status"/aria-live and that
    a failure path uses the error-token class while a success path uses the positive-token class.
Step 2: implement.

Run the tests (green), then `npm run lint` + `npx tsc --noEmit`.
```

✅ 验收：`npx vitest run src/lib/utils.test.ts src/components/student/student-sandbox.test.tsx` 绿；`git grep -n "getUTCHours\|getUTCMonth\|getUTCDate" src/lib/utils.ts` → **0**；`git grep -n 'role="status"' src/components/student/student-sandbox.tsx` → ≥1。
❌ 回滚：`git checkout -- src/lib/utils.ts src/components/student/student-sandbox.tsx; git clean -f src/lib/utils.test.ts`。

---

### 提示词 S3.5 — Reviewer 异组审计（收尾，强制）

```
Have reviewer audit the entire S3 changeset (read-only; reviewer must NOT write any file).

1. Scope compliance — confirm ZERO changes outside the S3 write scope:
   `git diff --name-only main...HEAD` MUST be a subset of:
     src/lib/use-async-action.ts, src/lib/utils.ts, src/lib/utils.test.ts,
     src/components/student/student-sandbox.tsx,
     src/components/student/rank/rank-dashboard.tsx,
     src/components/student/rank/rank-board.tsx,
     src/components/student/season-leaderboard.tsx,
     src/components/student/student-market-board.tsx,
     src/components/student/student-history-review-dashboard.tsx,
     src/components/shared/global-ai-assistant.tsx,
     and the matching *.test.* files.
   Any hit under src/app/api/**, src/lib/db/**, src/lib/auth*.ts, src/lib/ai.ts, drizzle/** ⇒ REQUEST_CHANGES.
2. No-regression on shape: `git grep -n "payload.error\|nextPayload.error" src/components/student src/components/shared`
   — every remaining `.error` reference must be logging/branching, never rendered as the thrown message.
3. Three-state present: each of rank-dashboard / rank-board / season-leaderboard must have a visible
   error-retry branch DISTINCT from its empty branch (manually trace).
4. FE-01 guard: `git grep -n "void mutate" src/components/student/student-sandbox.tsx` → 0.

Then have testing-accessibility-auditor verify FE-09 (role="status"/aria-live, success/failure 色分) and
confirm the three-state error cards are keyboard-reachable.

Each reviewer ends with an explicit verdict: APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION.
```

> 实现者为 `ui_implementer`（组件实现责任组），评审为 `reviewer` + `design-ui-designer` + `testing-accessibility-auditor`（均与实现者异组），满足 AGENTS.md §3.1。

---

### Sprint 收口验收（全量）

```powershell
npm run lint
npx tsc --noEmit
npm run test            # 含本 Sprint 新增的全部组件/utils 测试
npm run build
# 客观门（全部应为 0 或符合预期）：
git grep -n "void mutate" src/components/student/student-sandbox.tsx          # = 0
git grep -n "getUTCHours" src/lib/utils.ts                                    # = 0
git grep -nE "Error\(.*\.error \?\?" src/components/student src/components/shared  # = 0
```

> 注：`git grep -nE "Error\(.*\.error \?\?"` 只命中"把 `.error` 当抛出文案"的写法，不会误伤 `student-sandbox.tsx:138` 的 `payload.message ?? payload.error`（那是 `.message ??`，合规）。

**手动 DB-down 验证（不可省略 — 这是 FE-02/07/10 的真因场景）**：
```powershell
# 制造"数据不可用"：停掉本地 Docker Postgres（参照 MEMORY: local-dev-docker-db，容器名 brownzone-pg）
docker stop brownzone-pg
npm run dev
```
逐页确认（应"显示错误+重试"，**绝不**回退到入榜表单 / 空态 / 永久骨架）：
- `/student/rank` → 战力卡显示加载失败可重试，**未**回到 onboarding（FE-02）；榜单显示"加载失败，点此重试"而非真实空态文案"本范围本期还没有上榜的同学…"（FE-07）。
- `/student`（沙盘）→ 赛季榜显示错误而非永久转圈（FE-10）；连点"推进下一回合"只发一次请求（FE-01）；操作反馈被读屏播报（FE-09）。
- `/student/market` → 错误文案为中文、无 `db_unavailable`（FE-03）；A→B 快切无错配（FE-04）。
- 行情/流水时间为北京时间（FE-05）。
验证完恢复：`docker start brownzone-pg`。

### Stop-and-confirm gates（务必遵守）

- **S3.1 / S3.2 均要求"先写失败测试、Stop 等确认"** —— 尤其 S3.1（核心回合一致性）与 S3.2（隐私回归）必须在我确认红测正确复现 bug 后才继续实现。
- **S3.2 涉及隐私**：实现完成后、合并前，必须由 `design-ui-designer` 复核"失败绝不覆盖隐身/昵称"并由 `testing-accessibility-auditor` 复核三态卡键盘可达，给出 `APPROVE` 才进 S3.5。
- 任一 reviewer 给 `REQUEST_CHANGES`：`Esc` 中断 → 按反馈重发更窄指令 → 重跑收口验收。

### 整 Sprint 回滚

```powershell
# 本 Sprint 全部改动在单分支，未合并前：
git checkout main
git branch -D fix/s3-frontend-reliability
# 若已合并需撤回：git revert <merge_commit>。S3 不含 migration，无需 db 回滚（不涉及 npm run db:migrate）。
```

---

## Sprint 4 — 加固、测试与质量门

### 目标

把"工程可信度"补到生产线水准：三个高危模块（支付/会话/鉴权）从零单测补到有专测、CI `integration` job 从非阻塞转为真正的质量门、涨跌红绿色值从约 230 处硬编码统一到 `--up-*/--down-*` 令牌、新手引导补成无障碍对话框、`error.message` 泄露收口，再把 doc 01 第五节的 P3 批次（SEC-06、BE-09~13、DOM-06/07/10/11、FE-11~20）分组清扫。本 Sprint **不阻塞对外推广**（doc 02 §0），但 DoD 是"覆盖率不低于现状 + 三高危模块有专测 + CI integration 转 blocking 后全绿 + axe 关键页零严重违规"（doc 02 §S4 DoD）。

> **责任组纪律（AGENTS.md §3 / §3.1）**：本 Sprint 主实现者为 `qa_engineer`（测试）、`ui_implementer`（令牌/无障碍组件）、`api_wirer`（路由级 P3）、`db_architect`（client/repo 级 P3 与 KV 迁移）、`monetization_wechat_engineer`（微信支付单测）、`finance_event_simulator`（`market-data.ts`/`simulation.ts` 逻辑）、`behavior_ai_analyst`（`history-review.ts`/`adaptive-events.ts` 逻辑——注意这两个文件**不**属于 `finance_event_simulator` 的所有权范围）。**实现者与评审者必须来自不同责任组**，每个提示词以 `reviewer` / `engineering-code-reviewer` / `testing-accessibility-auditor` / `engineering-database-optimizer` 之一审计收尾，并以 `APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION` 显式收场。本 Sprint 涉及 CI 开关与 KV 迁移属高风险，提示词内置 🚦stop-gate。

### 前置

- **S0–S3 已合并**：本 Sprint 的令牌统一（FE-06）依赖 S3 前端态收口未撤销；P3 的 BE-11 改用 `requireUser` 依赖 S0 鉴权语义已稳定。若 S1–S3 尚未落地，先按各自 Sprint 执行，不要在本 Sprint 抢跑（doc 02 §0：S0 先于一切，feature 在 S0+S1 之后）。
- **测试 Postgres 角色就位**：`scripts/ci-supabase-shims.sql` 已随 commit 268d2ac 入库（doc 01 QA-01 已注明），但 `.github/workflows/ci.yml:113` 仍是 `continue-on-error: true`、`:111` job 名仍带 `[non-blocking until DB roles provisioned]`、`:6-8` 头注释仍声称该 job 非阻塞。S4-1 的开关只能在本地用同一镜像验证 shims 链路通过后再拨。
- **`vitest-axe` / `axe-core` 已安装**（doc 02 §S4-3、CLAUDE.md 测试分层"Accessibility"）——无障碍断言直接复用，不要新增依赖。
- **工作树干净**：`git status` 无未提交改动；回归基线 `npm run lint && npx tsc --noEmit && npm run test` 当前全绿（作为本 Sprint 的回归基线，先跑一遍记录覆盖率，对应 DoD "覆盖率不低于现状"）。

---

### 提示词 4.1 — QA-02：三高危模块补单测（TDD，api-guard 先做）

> **目标**：给 doc 01 QA-02 列出的三高危零单测文件补专测——`api-guard.ts`(26 行 全路由鉴权入口)、`auth.ts`(JWT/cookie/tokenVersion)、`wechat-pay.ts`(212 行 RSA 验签/AES-GCM)。按"文件越小成本越低"排序，`api-guard` 先做。**微信支付单测必须交给 `monetization_wechat_engineer`**（AGENTS.md §3：该 agent 拥有 `src/lib/billing/**`；`qa_engineer` 不拥有 billing 源码）。doc 02 §S4-1。
>
> **前置**：本地 `npm run test` 基线全绿；先读源码再写断言（这是按现状特征化测试，不改源码）。

```
Have qa_engineer add direct unit tests for the two auth-layer modules (api-guard first — it is the cheapest and highest-leverage, doc 01 QA-02):

WRITE scope (allowed): src/lib/api-guard.test.ts, src/lib/auth.test.ts ONLY (two new test files).
FORBIDDEN scope: do NOT modify src/lib/api-guard.ts, src/lib/auth.ts, or any feature code. These are characterization tests over CURRENT behavior — if a test reveals a real bug, STOP and report it as NEEDS_DISCUSSION; do not "fix" the source in this prompt.

This is TDD-by-characterization: read the source FIRST, then assert its real contract.

Step 1 — src/lib/api-guard.test.ts (requireUser, src/lib/api-guard.ts is 32 lines):
  a. Read src/lib/api-guard.ts and src/lib/session-user.ts to learn how readSession()/findUserById() are reached, and mock them.
  b. Cover, asserting BOTH the HTTP status AND the stable error code (the role-mismatch path is the privilege-escalation guard for all 52 routes):
     - no session → 401 { error:"unauthorized", message:<中文> }  (api-guard.ts:8-10)
     - session user not found → 401 unauthorized  (api-guard.ts:13-15)
     - tokenVersion mismatch (loaded.tokenVersion !== session.tv) → 401 "会话已失效"  (api-guard.ts:19-21) — this is the server-side revocation guard
     - wrong role (student calling requireUser("teacher")) → 403 forbidden  (api-guard.ts:23-25)
     - correct role → returns { user }

Step 2 — src/lib/auth.test.ts (JWT/cookie/tokenVersion, src/lib/auth.ts):
  a. Assert: createSessionToken signs with alg HS256 (auth.ts:32) and readSession verifies with algorithms:["HS256"] only (auth.ts:68) — no alg=none / alg confusion (a confirmed "做得好" invariant per doc 01 §六; lock it down). Claims round-trip { userId, role, email, classroomId, tv }. An expired exp (7d, auth.ts:35) is rejected. A token whose `tv` differs from the user's tokenVersion is rejected (server-side revoke).
  b. Cookie helper persistSession (auth.ts:43-49): httpOnly + sameSite:"lax" + path:"/" are set; secure flips to true only when NODE_ENV=production (auth.ts:46) — use vi.stubEnv to assert both branches.

Step 3 — run `npx vitest run src/lib/api-guard.test.ts src/lib/auth.test.ts` and `npx tsc --noEmit`. No `any` outside test scaffolding (AGENTS.md §4).

Stop after Step 3 and wait for my confirmation before the wechat-pay handoff.

Then have reviewer confirm zero changes outside the two new *.test.ts files and report APPROVE / REQUEST_CHANGES.
```

🚦 **stop-gate**：步骤 3 后停下，待我确认两个 auth 测试通过且未触碰源码，再启动下面的微信支付单测。

```
Have monetization_wechat_engineer add unit tests for the payment crypto module (doc 01 QA-02, the highest-severity untested file — src/lib/billing/wechat-pay.ts, 212 lines):

WRITE scope (allowed): src/lib/billing/wechat-pay.test.ts ONLY.
FORBIDDEN scope: do NOT touch src/lib/billing/wechat-pay.ts or any other billing/* source; do NOT hit a real WeChat endpoint; do NOT change educational routes or components (AGENTS.md §3 — monetization_wechat_engineer must-not-touch list).

1. Read src/lib/billing/wechat-pay.ts to enumerate the exported surface (RSA-SHA256 signature verify, AES-GCM decrypt, callback amount/order validation).
2. Deterministic round-trip: generate an ephemeral RSA keypair + AES-GCM key IN THE TEST, sign+encrypt a synthetic callback, then assert verify+decrypt recovers it. Use Node's `crypto` only — no network, no real merchant keys.
3. Negative cases (these encode the doc 01 §六 "微信支付链路扎实" invariants — protect them): tampered signature → rejected; missing platform public key under NODE_ENV=production → hard reject (not silent pass); callback amount ≠ order amount → rejected; tier is taken from the order, not the callback body.
4. Run `npx vitest run src/lib/billing/wechat-pay.test.ts` and `npx tsc --noEmit`.

Then have engineering-code-reviewer (different responsibility group from monetization) confirm zero changes outside wechat-pay.test.ts and report APPROVE / REQUEST_CHANGES.
```

✅ **验收**：`npx vitest run src/lib/api-guard.test.ts src/lib/auth.test.ts src/lib/billing/wechat-pay.test.ts` 全绿；`npx tsc --noEmit` 无新错；三个新测试文件均存在（对应 doc 02 §S4 DoD "三高危模块有专测"）：

```powershell
Get-ChildItem src/lib/api-guard.test.ts, src/lib/auth.test.ts, src/lib/billing/wechat-pay.test.ts
```

❌ **回滚**：`git checkout -- src/lib/api-guard.test.ts src/lib/auth.test.ts src/lib/billing/wechat-pay.test.ts`（仅新增测试文件，零源码改动，回滚无副作用）。

---

### 提示词 4.2 — QA-01：CI `integration` job 转阻塞（🚦高风险 stop-gate）

> **目标**：把 `.github/workflows/ci.yml:113` 的 `continue-on-error: true` 摘掉，让 RLS 隔离测试 + leaderboard 真实 DB 写路径测试真正成为门。shims 已自带（commit 268d2ac），只差拨开关。
>
> **前置**：**先在本地用与 CI 等价的命令链跑通整条 shims→migrate→policies→seed→integration，确认会真红/真绿，再拨。** 注意：CI 的 migrate 步骤跑的是 `npx drizzle-kit migrate`（ci.yml:145，迁移命令，≠ 已知崩库的 `drizzle-kit push`）；本地复现必须镜像 CI 的同一命令，不要换成别名。

```
Have qa_engineer flip the CI integration job to blocking — but VERIFY the gate actually works locally FIRST by mirroring the CI job command-for-command (doc 01 QA-01, doc 02 §S4-1):

WRITE scope (allowed): .github/workflows/ci.yml ONLY.
FORBIDDEN scope: do NOT touch tests/integration/**, scripts/ci-supabase-shims.sql, drizzle/**, or any source. The point is to make the EXISTING tests gate, not to change them.

Step 1 — Reproduce the CI integration job locally against a vanilla Postgres, mirroring ci.yml:114-151 EXACTLY:
  a. Start `postgres:16` (POSTGRES_USER=postgres / POSTGRES_PASSWORD=postgres / POSTGRES_DB=brownzone_test) on :5432.
  b. With DATABASE_URL=postgres://postgres:postgres@localhost:5432/brownzone_test, run IN ORDER, capturing each exit code — use the SAME commands ci.yml uses:
     - psql -f scripts/ci-supabase-shims.sql      (provisions authenticated/anon + auth.jwt() — ci.yml:142-143)
     - npx drizzle-kit migrate                     (the EXACT command ci.yml:145 runs; this is the migrate command, NOT `drizzle-kit push` which crashes this DB per CLAUDE.md)
     - npm run db:apply-policies                   (ci.yml:147)
     - npm run db:seed                             (ci.yml:149)
     - npm run test:integration                    (ci.yml:151)
  c. Report each exit code. The whole chain MUST pass (all 0) before flipping the switch.

Stop after Step 1 and show me the exit codes. Do NOT edit ci.yml until I confirm the chain is green.

Step 2 — Only after my confirmation, edit .github/workflows/ci.yml:
  - Remove `continue-on-error: true` (ci.yml:113).
  - Rename the job (ci.yml:111) from "Integration (Postgres) [non-blocking until DB roles provisioned]" to "Integration (Postgres)".
  - Update the file header comment (ci.yml:6-8) so it no longer claims the job is non-blocking.

Step 3 — Validate the workflow YAML parses (e.g. a YAML lint), and run the Step 1 chain once more as the new blocking contract.

Then have reviewer confirm the diff touches ONLY ci.yml (no test/source/migration changes) and report APPROVE / REQUEST_CHANGES.
```

🚦 **stop-gate**：**禁止在本地 Step 1 链路未全部退出码 0 前拨开关**——否则把 CI 从"假绿"直接变成"必红"，阻塞全队所有 PR。

✅ **验收**：

```powershell
git grep -n "continue-on-error" .github/workflows/ci.yml   # → 0 命中
git grep -n "non-blocking" .github/workflows/ci.yml         # → 0 命中
```

本地 shims→`npx drizzle-kit migrate`→`npm run db:apply-policies`→`npm run db:seed`→`npm run test:integration` 全链路退出码 0。

❌ **回滚**：`git checkout -- .github/workflows/ci.yml`（恢复非阻塞，不影响已合并的测试）。

---

### 提示词 4.3 — FE-06：涨跌红绿令牌统一（TDD，先改测试断言）

> **目标**：消除同屏两套红/绿。`src/lib/utils.ts` 的 `MARKET_MOVE_CLASSES`（声明在 utils.ts:39，色值字面量 utils.ts:51-64：up `#d43c33`/`#ffb7af`、down `#0f9d58`/`#94e3b5`）与 `src/components/shared/money-text.tsx`（money-text.tsx:23-30：down `#16a14e`/`#9aedb8`、up `#d43c33`/`#ffb7af`）各用一套硬编码 hex，而 `src/app/globals.css` 已有令牌 `--up-500`/`--down-500`。`src/components` 内市场色硬编码约 230 处（重灾区 history-review ~55 / module-illustration ~35 / global-ai-assistant ~26，doc 01 FE-06）。`src/components/student/rank/power-card.tsx:240` 已示范正确的令牌用法。
>
> **前置**：S3 已合并；先更新 `money-text.test.tsx` 断言到令牌类名（红先失败），再改源码使其变绿（TDD）。

```
Have ui_implementer migrate the up/down market colors from hardcoded hex to design tokens (doc 01 FE-06, doc 02 §S4-2). Tests change FIRST.

WRITE scope (allowed): src/lib/utils.ts, src/components/shared/money-text.tsx, src/components/shared/money-text.test.tsx, src/app/globals.css (only if a token alias is genuinely missing), and the ~230 hardcoded market-color sites under src/components/**.
FORBIDDEN scope: do NOT touch src/app/api/**, src/lib/db/**, auth, or AI gateway (AGENTS.md §3 ui_implementer must-not-touch). Do NOT invent new color values — every replacement maps to an EXISTING token in src/app/globals.css.

Step 1 (TDD) — update src/components/shared/money-text.test.tsx FIRST so it asserts the token-based class (e.g. `text-up` / `text-down` or `text-[var(--up-200)]` / `text-[var(--down-200)]`) instead of any literal hex, AND add the doc 01 FE-17 gaps it was missing: zero value, a negative sign AFTER the ¥ (e.g. "¥-3"), full-width ￥, and non-string children. Run `npx vitest run src/components/shared/money-text.test.tsx` and confirm it now FAILS (red) against the current hardcoded source.

Step 2 — src/lib/utils.ts MARKET_MOVE_CLASSES (utils.ts:50-65): replace the literals
   up:   text `#d43c33`, darkText `#ffb7af`, badge `#fff1f0`/`#d43c33`, darkBadge `#d43c33`, bar/dot `#d43c33`
   down: text `#0f9d58`, darkText `#94e3b5`, badge `#eefbf3`/`#0f9d58`, darkBadge `#0f9d58`, bar/dot `#0f9d58`
   with token utilities (`text-up`/`text-down`/`bg-up` … or `text-[var(--up-500)]` etc.), matching the canonical example in src/components/student/rank/power-card.tsx:240. (Note: utils.ts down-dark is `#94e3b5`, NOT `#9aedb8`.)

Step 3 — src/components/shared/money-text.tsx (money-text.tsx:23-30): same migration — down→`--down-*` (light `#16a14e`, dark `#9aedb8`), up→`--up-*` (light `#d43c33`, dark `#ffb7af`); also extend moneyPattern (money-text.tsx:38) to match full-width ￥ (FE-17). Make Step 1's tests pass (green).

Step 4 — sweep the rest. `git grep -nE "#[0-9a-fA-F]{3,8}" src/components/` and migrate each MARKET-MOVE hex to its token (prioritize history-review ~55, module-illustration ~35, global-ai-assistant ~26 per doc 01). For any hex that is NOT a market-up/down color and has no token, leave a `// UI-DEBT: no token for <hex>` comment rather than guessing.

Step 5 — `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run build` (Tailwind v4 must compile the token utilities).

Then have testing-accessibility-auditor (different group from ui_implementer) confirm: no semantic color regressions, the two red/green sets are now ONE, and report APPROVE / REQUEST_CHANGES.
```

✅ **验收**：

```powershell
git grep -nE "#d43c33|#0f9d58|#ffb7af|#94e3b5" src/lib/utils.ts                 # → 0 命中
git grep -nE "#16a14e|#9aedb8|#ffb7af|#d43c33" src/components/shared/money-text.tsx  # → 0 命中
npx vitest run src/components/shared/money-text.test.tsx                         # 全绿
npm run build                                                                   # 成功
```

目视 `/student/market` 涨跌色与 `power-card` 一致（不再同屏双色）。

❌ **回滚**：`git checkout -- src/lib/utils.ts src/components/shared/money-text.tsx src/components/shared/money-text.test.tsx src/app/globals.css`；组件 sweep 用 `git checkout -- src/components/`（逐文件回滚）。

---

### 提示词 4.4 — FE-08：新手引导 + 站点抽屉补无障碍对话框（vitest-axe）

> **目标**：`src/components/student/onboarding-flow.tsx:190` 的全屏遮罩（`<div className="fixed inset-0 z-50 …">`）无 `role="dialog"`/`aria-modal`/焦点圈套/Esc——键盘/读屏学生可 Tab 进背景交易按钮。项目已有 `useFocusTrap`（`src/lib/use-focus-trap.ts`，在 `src/components/shared/global-ai-assistant.tsx:147` 正确接入、doc 01 §六 列为范本）未用上；站点移动抽屉（`src/components/site/site-header.tsx` 约 :205，容器 className 以 `safe-drawer-offset fixed inset-y-0 right-0` 开头）同缺，一并处理。
>
> **前置**：`vitest-axe`/`axe-core` 已装；不要新写 focus trap，复用现有 hook。

```
Have ui_implementer make the onboarding overlay and the site mobile drawer real accessible dialogs (doc 01 FE-08). Use the project's existing useFocusTrap from src/lib/use-focus-trap.ts — do NOT write a new trap.

WRITE scope (allowed): src/components/student/onboarding-flow.tsx, src/components/site/site-header.tsx, and a new src/components/student/onboarding-flow.test.tsx (vitest-axe).
FORBIDDEN scope: API routes, db, auth, AI gateway (AGENTS.md §3 ui_implementer).

1. Read src/components/shared/global-ai-assistant.tsx around line 147 (and its role="dialog"/aria-modal at lines 497-498) to see how useFocusTrap + role="dialog" + aria-modal + Esc-to-close + focus restore are wired (the doc 01 §六 reference implementation).
2. onboarding-flow.tsx:190 — wrap the fixed overlay div: add `role="dialog" aria-modal="true" aria-label="新手引导"`, attach useFocusTrap so Tab cannot reach the background trade buttons, wire Esc to advance/close consistent with existing UX, and restore focus to the trigger on unmount.
3. site-header.tsx — the mobile drawer (the element whose className starts with `safe-drawer-offset fixed inset-y-0 right-0`, around line 205): apply the same dialog semantics + focus trap, and make it keyboard-closable (FE-12 notes the same drawer is keyboard-unclosable — close that gap here).
4. Add src/components/student/onboarding-flow.test.tsx using vitest-axe (already installed): render the open overlay and assert `expect(await axe(container)).toHaveNoViolations()`, plus an assertion that focus is trapped (Tab does not escape to a background button).
5. `npm run lint`, `npx tsc --noEmit`, `npx vitest run src/components/student/onboarding-flow.test.tsx`.

Then have testing-accessibility-auditor confirm the dialogs are conformant and report APPROVE / REQUEST_CHANGES.
```

✅ **验收**：

```powershell
git grep -n 'role="dialog"' src/components/student/onboarding-flow.tsx src/components/site/site-header.tsx  # 各命中
npx vitest run src/components/student/onboarding-flow.test.tsx                                              # 全绿（axe 零严重违规）
```

对应 doc 02 §S4 DoD "axe 关键页零严重违规"。

❌ **回滚**：`git checkout -- src/components/student/onboarding-flow.tsx src/components/site/site-header.tsx src/components/student/onboarding-flow.test.tsx`。

---

### 提示词 4.5 — SEC-05 + SEC-06：错误信息泄露收口 + 时间安全 Cron 比较

> **目标**：SEC-05 —— `src/lib/api-response.ts:38` 默认分支 `return apiError("invalid_input", message || fallbackMessage, 400)` 把原始 `error.message` 以 400 回传，泄露内部实现/约束名。SEC-06 —— 两个 cron 路由用 `authorization !==` 比 Bearer（`src/app/api/cron/weekly-report/route.ts` 约 :23、`src/app/api/cron/recompute-leaderboard/route.ts` 约 :21），非时间安全。两者都是响应/路由层小改，合并一个提示词。
>
> **前置**：保留 api-response.ts:31 的 `db_unavailable` 分支与 :34-35 的 `conflict` 分支不变。

```
Have api_wirer close two information-leak / timing issues (doc 01 SEC-05, SEC-06):

WRITE scope (allowed): src/lib/api-response.ts, src/app/api/cron/weekly-report/route.ts, src/app/api/cron/recompute-leaderboard/route.ts, and a new/extended src/lib/api-response.test.ts.
FORBIDDEN scope: schema, components, db client, AI gateway.

1. SEC-05 — src/lib/api-response.ts:38: the default branch currently returns `apiError("invalid_input", message || fallbackMessage, 400)`, i.e. it can echo the raw internal error.message to the client. Change it to return ONLY the stable Chinese fallbackMessage; the raw message must still reach server logs (console.error or the existing log helper). Keep the upstream db_unavailable branch (api-response.ts:30-32) and conflict branch (api-response.ts:34-36) unchanged.
2. SEC-06 — both cron routes compare with `authorization !== \`Bearer ${env.CRON_SECRET}\``. Replace each with a constant-time compare: decode both sides to Buffers and use `crypto.timingSafeEqual`, guarding the length-mismatch case (timingSafeEqual throws on unequal length — return 401 in that case rather than throwing). Behavior (401 on mismatch, the existing 中文 message) must be identical. Touch the comparison only; leave the NODE_ENV=production && !CRON_SECRET → 503 guard untouched.
3. Tests: in src/lib/api-response.test.ts assert handleRouteError's default branch does NOT include a sample raw message like "violates constraint foo_pkey" in the JSON body, and still returns 400 + a 中文 message. Run `npx vitest run src/lib/api-response.test.ts` and `npx tsc --noEmit`.

Then have engineering-code-reviewer (different group from api_wirer) confirm no leak path remains and the cron compare is timing-safe; report APPROVE / REQUEST_CHANGES.
```

✅ **验收**：

```powershell
git grep -n "message || fallbackMessage" src/lib/api-response.ts                                              # → 0 命中
git grep -n "timingSafeEqual" src/app/api/cron/weekly-report/route.ts src/app/api/cron/recompute-leaderboard/route.ts  # → 各命中
npx vitest run src/lib/api-response.test.ts                                                                    # 全绿
```

❌ **回滚**：`git checkout -- src/lib/api-response.ts src/app/api/cron/weekly-report/route.ts src/app/api/cron/recompute-leaderboard/route.ts src/lib/api-response.test.ts`。

---

### 提示词 4.6 — P3 后端批 A：BE-09/BE-10/BE-11/BE-12（正确性 + 鉴权）

> **目标**：4 条小而独立的后端正确性修复。按 AGENTS.md §3 拆给两个 agent——BE-11 属 `src/app/api/**` → `api_wirer`；BE-09/BE-10/BE-12 属 `src/lib/db/**` → `db_architect`。
>
> **前置**：保持 `repo-fallback.audit.test.ts` / `repo-logging.test.ts` 绿（守护"写不静默回退 + 日志"不变量，CLAUDE.md 测试分层）。

```
Have db_architect fix three backend correctness issues in the db layer (doc 01 §五 BE-09, BE-10, BE-12):

WRITE scope (allowed): src/lib/db/client.ts, src/lib/db/repo.ts, and src/lib/db/repo.test.ts (or the relevant existing repo test).
FORBIDDEN scope: src/app/api/**, components, drizzle/** (no schema/migration changes — none of these need one).

1. BE-09 — src/lib/db/client.ts:104 `withRls` is dead code AND lacks `set local role authenticated`, creating a false "RLS is on" impression (the real path is rls-context.ts's withUserRls). Confirm via `git grep -n "withRls(" src/` that nothing calls it, then DELETE the dead export. If anything DOES call it, STOP and report NEEDS_DISCUSSION instead of deleting.
2. BE-10 — src/lib/db/repo.ts:1658 `getAdminOverview` has an extra try/catch (the fallback block around repo.ts:1722-1726, `logFallback("getAdminOverview",…)` + `return store.getAdminOverview()`) that bypasses the ALLOW_MEMORY_FALLBACK gate, so a prod DB outage silently shows seed/demo data. Make it follow the same fallback contract as its peers: read fallback only when ALLOW_MEMORY_FALLBACK=true; otherwise surface the error.
3. BE-12 — src/lib/db/repo.ts:218 `withQueryTimeout`: when the timeout wins the Promise.race (repo.ts:222), the original query promise becomes a hanging rejection (unhandledRejection). Attach `.catch(() => {})` to the losing promise (or wire an AbortController) so it cannot crash the process.
4. Run `npx tsc --noEmit` and `npm run test -- src/lib/db` (keep repo-fallback.audit.test.ts / repo-logging.test.ts green — CLAUDE.md testing layers).

Stop after Step 1 (the dead-code deletion) and confirm the grep showed zero callers before deleting.

Then have reviewer confirm zero changes outside src/lib/db/** and report APPROVE / REQUEST_CHANGES.
```

🚦 **stop-gate**：删除 `withRls` 前必须先 `git grep -n "withRls(" src/` 证明零调用方；有调用方则改报 NEEDS_DISCUSSION，不删。

```
Have api_wirer fix the market board auth bypass (doc 01 §五 BE-11):

WRITE scope (allowed): src/app/api/market/board/route.ts ONLY.
FORBIDDEN scope: schema, components, db client, lib/auth.

1. src/app/api/market/board/route.ts:17 currently calls `readSession()` then a manual `session.role !== "student"` check (route.ts:21) — readSession reads the JWT WITHOUT checking tokenVersion, so a revoked (logged-out / password-changed) student still passes. Replace the readSession + manual role check with `requireUser("student")` from src/lib/api-guard.ts, which enforces tokenVersion revocation. Preserve the existing 401/403 Chinese messages and the marketBoardQuerySchema validation (route.ts:11-13, 25-27).
2. `npx tsc --noEmit`; if a board route test exists, run it; else add a minimal one asserting a revoked-token request is rejected.

Then have engineering-code-reviewer confirm the diff is confined to market/board/route.ts and report APPROVE / REQUEST_CHANGES.
```

✅ **验收**：

```powershell
git grep -n "export async function withRls" src/lib/db/client.ts   # → 0 命中
git grep -n "readSession" src/app/api/market/board/route.ts        # → 0 命中（已改 requireUser）
npm run test -- src/lib/db                                          # 全绿（审计测试未破）
npx tsc --noEmit                                                    # 无错
```

❌ **回滚**：`git checkout -- src/lib/db/client.ts src/lib/db/repo.ts src/app/api/market/board/route.ts`（及对应测试文件）。

---

### 提示词 4.7 — P3 后端批 B：BE-13 限流/行情缓存迁 Upstash/KV（🚦高风险 stop-gate）

> **目标**：`src/lib/rate-limit.ts:13` 限流桶、`src/lib/alltick.ts:76`/`src/lib/itick.ts:51` 行情缓存是模块级可变状态，多实例下限流实际上限 = 20×实例数、行情上游放大 N 倍（doc 01 §五 BE-13）。S0-2 已注明分布式限流留到 S4（doc 02 §S4-3）。
>
> **前置**：**新增依赖 + 外部 KV 属高风险——先 stop-and-confirm 设计与依赖再写代码。** 必须保留 in-process 兜底（离线 teacher-laptop demo 依赖它）。

```
Have db_architect migrate the module-level mutable state to a shared store (Upstash Redis / Vercel KV) so it survives across serverless instances (doc 01 §五 BE-13, doc 02 §S4-3):

WRITE scope (allowed): src/lib/rate-limit.ts, src/lib/alltick.ts, src/lib/itick.ts, src/lib/env.ts (to add KV env vars), .env.example, docs/VERCEL-ENV.md, docs/ENV-CHECKLIST.md.
FORBIDDEN scope: API routes (keep rateLimit()/rateLimitKey() call sites unchanged), components, auth, AI gateway.

Step 1 (DESIGN — stop here, write NO code yet) — Propose the approach:
  - Which KV (Upstash Redis vs Vercel KV) and the exact new env vars (validated in src/lib/env.ts via zod, optional in dev per CLAUDE.md env conventions).
  - How rate-limit.ts keeps the SAME exported signature (rateLimit()/rateLimitKey()) — sliding window now backed by KV — AND degrades gracefully to the in-process Map when the KV env is absent (so local dev / offline teacher-laptop demo still works).
  - How alltick.ts:76 / itick.ts:51 caches move to KV with the 10-minute refresh cadence (market-refresh.ts) intact.
  - Whether any new npm dependency is needed (name + why).

Stop after Step 1 and wait for my approval of the design AND any new dependency BEFORE writing code.

Step 2 (after my approval) — implement; keep the in-process fallback; update env.ts + .env.example + docs/VERCEL-ENV.md + docs/ENV-CHECKLIST.md with the new keys.
Step 3 — `npm run lint`, `npx tsc --noEmit`, `npm run test` (rate-limit tests must still pass via the in-process fallback path when KV env is unset), `npm run build`.

Then have engineering-database-optimizer (different group) review the KV access pattern, and have reviewer confirm the call sites under src/app/api/** are unchanged; report APPROVE / REQUEST_CHANGES.
```

🚦 **stop-gate**：**禁止在 Step 1 设计 + 依赖未获批准前安装依赖或写 KV 代码**——避免误删"单进程兜底"导致离线 demo 崩。

✅ **验收**：

```powershell
git grep -nE "rateLimit\(|rateLimitKey\(" src/app/api/   # 调用点与改动前一致（签名未变）
git grep -nE "UPSTASH|KV_" .env.example docs/VERCEL-ENV.md docs/ENV-CHECKLIST.md  # 含新 KV 变量
npm run test                                             # KV 环境缺失时仍全绿（in-process 兜底）
```

❌ **回滚**：`git checkout -- src/lib/rate-limit.ts src/lib/alltick.ts src/lib/itick.ts src/lib/env.ts .env.example docs/VERCEL-ENV.md docs/ENV-CHECKLIST.md`；若已加依赖，`npm uninstall <pkg>` 后 `git checkout -- package.json package-lock.json`。

---

### 提示词 4.8 — P3 逻辑批：DOM-06/07/10/11（复盘一致性 + 比较器 + 边界）

> **目标**：4 条教学逻辑正确性修复。**按 AGENTS.md §3 所有权拆给两个不同责任组**——`history-review.ts` 与 `adaptive-events.ts` 属 `behavior_ai_analyst` 的拥有范围（`finance_event_simulator` **不**拥有这两个文件）；`market-data.ts` 与 `simulation.ts` 属 `finance_event_simulator`。每条都先写/补测试再改（确定性核心用 property-based 守护，CLAUDE.md 测试分层）。
>
> **前置**：保持 `determinism.guard.test.ts` + `simulation.money.test.ts` 绿（守护种子引擎可复现性）。

```
Have behavior_ai_analyst fix two behavior/replay-logic bugs (doc 01 §五 DOM-06, DOM-10, plus DOM-11 part a). Write/extend a test FIRST for each, then fix.

WRITE scope (allowed): src/lib/history-review.ts, src/lib/adaptive-events.ts, and their *.test.ts.
FORBIDDEN scope: src/app/api/**, components, db schema, auth, AI gateway, AND src/lib/simulation.ts / src/lib/market-data.ts (those belong to finance_event_simulator's prompt below — do not touch them).

1. DOM-06 — src/lib/history-review.ts:65 buildTimeline builds the replay from the STATIC `round.eventId` (`getEventCard(round.eventId)`), but gameplay used `eventIdForRound(eventTimeline,…)` (simulation.ts:660, exported). Make buildTimeline call the exported eventIdForRound (passing state.run.eventTimeline + the snapshot round + round.eventId as fallback) so the replayed event matches what actually moved prices. Add a test asserting replay event == gameplay event for a fixed seed.
2. DOM-10 — src/lib/adaptive-events.ts:217 the warning sort comparator (`a.confidence === "high" ? -1 : b.confidence === "high" ? 1 : 0`) is non-transitive, so a `high` warning is not guaranteed to win. Replace BOTH the warning sort (adaptive-events.ts:217-219) and the topOther sort (adaptive-events.ts:220-222) with a numeric map compare `{high:2,medium:1,low:0}` (descending). Do NOT change the "max 1 warning + 1 info per round" CLT cap (adaptive-events.ts:213-224) — that is correct. Add a test that with multiple warnings the `high` one is always selected.
3. DOM-11(a) — src/lib/adaptive-events.ts:58 bond-avoidance uses `a.label.includes("债券")` string matching — make it robust to a rename by matching on a stable asset id/type (the code already checks holdings via `assetId === "asset-bond"` at line 60; align the trade filter to the same stable id rather than the display label). Add a test.

Run `npm run test -- src/lib/history-review src/lib/adaptive-events` and `npx tsc --noEmit`.

Then have reviewer confirm zero changes outside src/lib/{history-review,adaptive-events}.ts (+tests) and report APPROVE / REQUEST_CHANGES.
```

```
Have finance_event_simulator fix two market/simulation-logic bugs (doc 01 §五 DOM-07, DOM-11 parts b & c). Write/extend a test FIRST for each, then fix.

WRITE scope (allowed): src/lib/market-data.ts, src/lib/simulation.ts, and their *.test.ts.
FORBIDDEN scope: src/app/api/**, components, db schema, auth, AI gateway, AND src/lib/history-review.ts / src/lib/adaptive-events.ts (those belong to behavior_ai_analyst's prompt above — do not touch them).

1. DOM-07 — src/lib/market-data.ts:697 hardcodes an R9 "恐慌抛售" narrative that can contradict a 利好 card drawn from the late-game pool (event-engine.ts:81), so price rises while copy says panic. Drive the round title/narrative from the timeline event (or constrain the late pool to same-direction cards). Add a test asserting narrative direction matches the timeline event's 利好/利空 sign.
2. DOM-11(b) — src/lib/simulation.ts:299 applySimulationAction has no "run already finished" guard — reject actions after round 12 (throw the same shape as the existing guards). Add a test that an action on a finished run is rejected.
3. DOM-11(c) — src/lib/simulation.ts:435 the venture partial-exit branch (simulation.ts:434-438) under-counts appreciation — correct the math so a partial exit credits the proportional appreciation. Add/extend a simulation test.

Run `npm run test` (keep determinism.guard.test.ts + simulation.money.test.ts green) and `npx tsc --noEmit`.

Then have engineering-code-reviewer (different group from finance_event_simulator) confirm zero changes outside src/lib/{market-data,simulation}.ts (+tests) and report APPROVE / REQUEST_CHANGES.
```

✅ **验收**：

```powershell
git grep -n 'label.includes("债券")' src/lib/adaptive-events.ts   # → 0 命中
git grep -n "getEventCard(round.eventId)" src/lib/history-review.ts  # → 0 命中（已改 eventIdForRound）
npm run test                                                       # 全绿（含 determinism/money property 测试）
```

❌ **回滚**：`git checkout -- src/lib/history-review.ts src/lib/adaptive-events.ts src/lib/market-data.ts src/lib/simulation.ts`（及对应测试）。

---

### 提示词 4.9 — P3 前端批：FE-11/12/13/14/15/16/18/19/20（无障碍 + 体验细节）

> **目标**：清扫剩余 9 条组件/页面级无障碍与体验细节（FE-10 已在 S3 处理；FE-17 已并入 4.3 的 money-text 测试）。统一交 `ui_implementer`，**禁改 API/db/auth/AI**。axe 断言用 `vitest-axe`。
>
> **前置**：4.4 已为站点移动抽屉加了 focus trap——本提示词的 FE-12 不要重复造抽屉的 trap，只处理巨型菜单的键盘关闭与假搜索框。

```
Have ui_implementer clean up the remaining P3 frontend a11y / UX gaps (doc 01 §五 FE-11, FE-12, FE-13, FE-14, FE-15, FE-16, FE-18, FE-19, FE-20). Batch them; add vitest-axe assertions where a component is touched.

WRITE scope (allowed): src/components/student/student-sandbox.tsx, src/components/site/site-header.tsx, src/components/site/stock-ticker-tape.tsx, src/components/student/student-market-board.tsx, src/components/platform/platform-layout.tsx, src/components/student/rank/rank-onboarding.tsx, src/app/layout.tsx, the per-page metadata exports in src/app/**/page.tsx, src/components/site/learn-catalog.tsx, src/components/billing/guest-upgrade-checkout.tsx, and their *.test.tsx.
FORBIDDEN scope: src/app/api/**, src/lib/db/**, auth, AI gateway.

Fix each at its cited location (verify the exact line by reading the file first — some line numbers in doc 01 may have drifted):
1. FE-11 — student-sandbox.tsx (quantity/amount inputs, around the trade/bank forms): inputs accept 0 / negative / NaN (only HTML `min`). Add client-side validation + disable submit on invalid, with a Chinese inline message.
2. FE-12 — site-header.tsx: the mega-menu (desktop) is keyboard-unclosable and the mobile drawer has a fake non-functional search box (the input with placeholder "搜索场景、课程或报告"). Make Esc/blur close the mega-menu; either wire or remove the fake search input. Do NOT touch the drawer focus trap (4.4 owns it).
3. FE-13 — stock-ticker-tape.tsx: duplicated marquee items must be `aria-hidden` (screen reader reads them twice); student-market-board.tsx: stop replaying the entrance animation on every 10-min refresh (loadBoard interval at student-market-board.tsx:164).
4. FE-14 — platform-layout.tsx: add `aria-current="page"` to the active nav item; rank-onboarding.tsx: the visibility chooser (public/school_only/hidden — a minors' privacy control) needs radio semantics + `aria-checked`.
5. FE-15 — app/layout.tsx:9: the whole site shares one `<title>`. Add page-level metadata exports to the key page.tsx files (Next 16 metadata API — read node_modules/next/dist/docs/ first per CLAUDE.md).
6. FE-16 — learn-catalog.tsx: check-in failure is silent. Add a visible result + an empty state for search/filter.
7. FE-18 — student-market-board.tsx: the K-line uses red/green only (colorblind-unfriendly). Add a non-color channel (pattern/label); the +/− text prefix already exists, keep it.
8. FE-19 — guest-upgrade-checkout.tsx: submitProof/onboarding completion has no double-submit guard; rank-onboarding.tsx: the province/city/school cascade has no stale-response guard. Add a submitting guard + AbortController/stale-response check (reuse the FE-04 pattern from S3).
9. FE-20 — student-market-board.tsx:581: the watchlist ring center hardcodes "10" (`<span …>10</span>`) — bind it to `payload.watchlist.length`.

Run `npm run lint`, `npx tsc --noEmit`, `npm run test`, and `npx vitest run` on any new *.test.tsx with axe assertions, then `npm run build`.

Then have testing-accessibility-auditor confirm axe has zero serious violations on the touched components and report APPROVE / REQUEST_CHANGES.
```

✅ **验收**：

```powershell
git grep -n ">10<" src/components/student/student-market-board.tsx   # → 0 命中（已改 payload.watchlist.length）
npm run build                                                        # 成功
```

新增/触及组件的 `npx vitest run`（axe）零严重违规。

❌ **回滚**：`git checkout -- src/components/ src/app/layout.tsx`（逐文件回滚 sweep 改动）。

---

### Sprint 4 收尾 — 质量门总验 + 影响面审计

> **目标**：跑 Sprint 退出门，确认所有 P2/P3 项落地、无越界改动、整条质量门 + 阻塞后的 integration 链路全绿。
>
> **前置**：4.1–4.9 全部 `APPROVE`；CI 开关（4.2）已拨且本地链路验证过。

```
Have reviewer run the Sprint 4 exit gate and produce a PASS/FAIL checklist (read-only, no writes):

1. `git grep -nE "#d43c33|#0f9d58" src/lib/utils.ts src/components/shared/money-text.tsx` → expect 0 (FE-06 done).
2. `git grep -n "continue-on-error" .github/workflows/ci.yml` → expect 0 (QA-01 blocking).
3. `git grep -n "message || fallbackMessage" src/lib/api-response.ts` → expect 0 (SEC-05).
4. `git grep -rn "timingSafeEqual" src/app/api/cron/` → expect 2 (SEC-06).
5. `git grep -n 'role="dialog"' src/components/student/onboarding-flow.tsx` → expect ≥1 (FE-08).
6. Three high-risk modules have dedicated tests: src/lib/api-guard.test.ts, src/lib/auth.test.ts, src/lib/billing/wechat-pay.test.ts all exist (QA-02).
7. No changes leaked into FORBIDDEN scopes across the Sprint (api_wirer didn't touch schema; ui_implementer didn't touch API/db; finance_event_simulator didn't touch history-review/adaptive-events; behavior_ai_analyst didn't touch simulation/market-data; etc.).

Then have qa_engineer run the full quality bar (AGENTS.md §5 / doc 02 §S4 DoD):
- npm run lint
- npx tsc --noEmit
- npm run test
- npm run build
- npx playwright test
- and the now-blocking integration chain (mirror ci.yml): shims → npx drizzle-kit migrate → npm run db:apply-policies → npm run db:seed → npm run test:integration

Output a markdown checklist with PASS/FAIL per gate and any blocker. End with APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION.
```

✅ **验收（Sprint DoD，doc 02 §S4）**：`npm run lint && npx tsc --noEmit && npm run test && npm run build && npx playwright test` 全绿；CI `integration` 转 blocking 后真实 Postgres 链路（shims → `npx drizzle-kit migrate` → `npm run db:apply-policies` → `npm run db:seed` → `npm run test:integration`，本地用 `npm run db:migrate` 别名亦可）全绿；三高危模块各有专测；覆盖率不低于本 Sprint 开工基线；axe 关键页（学生引导、市场看板、战力榜入榜）零严重违规。

❌ **回滚（整 Sprint）**：本 Sprint 拆为多个独立提示词，按需逐个 `git checkout -- <该提示词 WRITE scope 文件>` 回滚；CI 开关单独可控（4.2），KV 迁移单独可控（4.7），互不耦合，无需整批回退。

---

## 阶段 F — 功能升级：多元理财新界面（C-1 ~ C-10）

> 本阶段把 Brown Zone 从"12 回合炒股沙盘"升级为"多元理财教学平台"，落地 `03` Part C 的 C-1~C-7 与 `03b` 三的 C-8~C-10。
> 每个功能拆成 **数据/迁移（db_architect）→ 后端 API（api_wirer）→ 纯逻辑/前端（ui_implementer / teen_ux_specialist / finance_event_simulator）→ 测试（qa_engineer）** 多条独立、各自带 stop-gate 的提示词；**实现者与评审者强制来自不同责任组**（AGENTS.md §3.1），每阶段以 `APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION` 收尾。
>
> ⚠️ 责任组红线提醒：`finance_event_simulator` 与 `education_narrative_designer` **同属"金融/模拟引擎"责任组**（两者都 OWN `src/lib/simulation.ts` + `src/lib/market-data.ts`），互相评审视为同组自审、违反 §3.1。引擎/数值类实现一律由 `engineering-code-reviewer`、`reviewer`（只读组）或 `testing-*` 跨组评审。

### 🚫 硬前置（不满足则不许进本阶段）

> 这是 `03` Part E（line 170）与 `03b` 三（line 71）的红线，**必须照搬**：

1. **S0 安全热修必须先合并**（doc 02 line 12：SEC-01/02/03/04）——否则功能建在可提权的地基上。
2. **S1 教学诚信重设计必须先合并**（doc 02 line 13/76-96：DOM-01/02/03/04/05）——否则定投/稳健产品/黄金只会**新增更多无风险刷分面**（`01-问题汇总.md` DOM-01：`simulation.ts:120`/`:126`/`:366`）。
3. **所有游戏化奖励一律装饰性**（头像框 / 称号 / 皮肤），**绝不发战力**（doc 03 line 163、doc 03b line 71）。这是 stop-gate 1 的硬验收项。
4. **FE-01 防双击 hook（`useAsyncAction`）必须已由 S3-1 落地**——Phase 2/3 的所有写操作前端复用它（doc 02 S3-1 / FE-01）。该 hook 当前仓库**尚不存在**，是 S3 的交付物；未落地则 Phase 2 不开工。

```
执行顺序（不可乱序，对齐 doc 03 Part E line 169-188 + doc 03b line 123）：
Phase 1（读多写少，低风险）：C-1 我的财富总览 · C-2 配置环形图+分散度 · C-8 市场温度计
Phase 2（核心新机制，依赖 S1 资产模型 + FE-01 防双击 + 新迁移）：C-3 自动定投机器人 · C-7 黄金/指数基金
Phase 3（教学闭环 + 留存层）：C-5 学堂小测(闭合 DOM-04) · C-4 风险测评投顾(接 AI 网关) · C-6 任务/成就/日历 · C-9 活动权益中心(猜涨跌) · C-10 机构共识度
```

### 提示词 F.0 — 前置闸门自检（reviewer，只读）

**目标**：在任何 C-feature 动工前，机器化确认 S0/S1/FE-01 已合并。
**前置**：当前分支为待施工功能分支；工作树干净。基线参考：未修复时 `git grep -c "ilike(inviteCodes.code\|ilike(users.email" src/lib/db/repo.ts` 命中 **5**。

```
Have reviewer verify the hard prerequisites before ANY feature work (read-only; reviewer is its own responsibility group):

1. Confirm S0 (SEC-01/02) is merged:
   - `git grep -n "ilike(inviteCodes.code" src/lib/db/repo.ts` → MUST be 0 (SEC-01 fixed).
   - `git grep -n "ilike(users.email" src/lib/db/repo.ts` → MUST be 0 (SEC-02 fixed).
   (Baseline before S0: these grep to 5 total. Any non-zero hit = S0 NOT merged.)
2. Confirm S1 anti-cheat is merged:
   - Read src/lib/simulation.ts:120 (getPropertyValue) and :126 (getVentureValue) — they MUST now read seed/eventTimeline volatility, NOT the deterministic linear curve `1 + (roundNumber-1)*0.024` (DOM-01).
   - Read src/lib/leaderboard/power-score.ts — it MUST now have a leverage/concentration penalty term (DOM-01/02). (Confirmed absent in the current tree — its presence proves S1 landed.)
   - Read src/app/api/learn/complete/route.ts:30 — completion MUST require a quiz pass, NOT a bare markModuleComplete on POST (DOM-04).
3. Confirm FE-01 is fixed for Phase 2:
   - Read src/components/student/student-sandbox.tsx:303 — submitAction MUST await the mutate inside `startTransition(async () => { await mutate(...) })`, NOT `startTransition(() => { void mutate(...) })`.
   - Confirm the shared hook exists: `git grep -n "useAsyncAction" src/lib/` → MUST be ≥1 (S3-1 deliverable). If absent, FE-01 is not done.

Output a PASS/FAIL table per prerequisite. If any FAIL: report REQUEST_CHANGES and STOP — do not start any C-feature.
```

✅ 验收：4 项全 PASS（两条 ilike grep=0、simulation/power-score/complete 已改、`useAsyncAction` grep≥1）。
❌ 回滚：任一 FAIL → 退回 S0/S1/S3 对应 Sprint，本阶段不开工（不在本阶段内补 S0/S1/FE-01）。

---

## Phase 1 — C-1 / C-2 / C-8（读多写少，低风险）

### 提示词 F.1.1 — C-2 纯逻辑：分散度评分（TDD，先写测试）

**目标**：实现 C-1/C-2 的数据底座 `lib/allocation.ts`，分散度指标作为**单一真相源**供 `power-score.ts` 集中度惩罚复用（doc 03 line 93）。
**前置**：F.0 全 PASS。`src/lib/allocation.ts` 当前不存在（新增）。

```
Have finance_event_simulator create the pure allocation core, test-FIRST.

WRITE scope (ONLY): src/lib/allocation.ts, src/lib/allocation.test.ts
FORBIDDEN scope: src/app/api/**, src/components/**, src/lib/db/**, drizzle/**, src/lib/leaderboard/power-score.ts (you may READ it to align signatures, NOT edit), src/lib/simulation.ts, src/lib/market-data.ts

Steps:
1. FIRST write src/lib/allocation.test.ts (vitest, no `any`) asserting:
   - computeAllocation(run) returns shares for {cash, savings, bond, stock, property, venture, gold} that SUM TO 100% (doc 03 line 95 验收).
   - computeDiversificationScore(run) → 0..100; single-asset all-in trends to 0 ("全押一注 ⚠️"); balanced trends high ("攻守均衡 🛡️").
   - Boundary: empty/zero-networth run does not divide-by-zero.
2. THEN implement src/lib/allocation.ts as PURE functions (no IO, no Date/Math.random — keep determinism.guard.test.ts green). Derive inputs from ScenarioRun fields (cash/savings/debt/propertyUnits/ventureStake/holdings[]) already present per doc 03 line 61.
3. Confirm the diversification metric is the SAME quantity power-score.ts's concentration penalty consumes (READ power-score.ts; do NOT edit it — flag the integration point for a later S1 follow-up if signatures differ).

*** Stop after step 1 and wait for my confirmation that the tests encode the right invariants. ***

Verify:
- npx vitest run src/lib/allocation.test.ts
- npx tsc --noEmit
- npm run test -- src/lib/determinism
Then have reviewer (different responsibility group, read-only) confirm zero changes outside src/lib/allocation.* and report APPROVE/REQUEST_CHANGES.
```

✅ 验收：`npx vitest run src/lib/allocation.test.ts` 全绿；占比求和=100%；`determinism.guard.test.ts` 仍绿。
❌ 回滚：`git checkout -- src/lib/allocation.ts src/lib/allocation.test.ts`。

### 提示词 F.1.2 — C-1 后端：财富总览 API

**目标**：新增 `GET /api/student/wealth-summary`，复用 `getSimulationStateForUser`（`repo.ts:1113`）。
**前置**：F.0 全 PASS；F.1.1 已 APPROVE（依赖 `computeAllocation`）；**BE-01 全表扫描已修**（`repo.ts:1124` 已改班级过滤、不再调 `selectAllUsers`/`selectAllRuns`，见 doc 01 BE-01 / `repo.ts:692`）。

```
Have api_wirer add the wealth-summary endpoint.

WRITE scope (ONLY): src/app/api/student/wealth-summary/route.ts
FORBIDDEN scope: src/lib/db/**, src/components/**, src/lib/simulation.ts, src/lib/ai.ts, drizzle/**

Steps:
1. FIRST read src/lib/db/repo.ts:1113 (getSimulationStateForUser) and confirm BE-01 is fixed: it must filter by classroomId in SQL, NOT call selectAllUsers/selectAllRuns (defined at repo.ts:692/:701) as it does at repo.ts:1124 today. If it still does a full-table scan, STOP and report — wealth-summary must not amplify BE-01.
2. Implement GET /api/student/wealth-summary returning { netWorth, roundReturn, cumulativeReturn, allocation, snapshots } (doc 03 line 82). netWorth/snapshots come from the run (materialized on the run state, doc 03 line 83); allocation comes from src/lib/allocation.ts computeAllocation().
3. Guard exactly like every route: requireUser("student") + zod (no untyped body) + Chinese error shape { error, message } + classroom-scoped read. No checkOrigin needed (GET, read-only).
4. On DB failure return 503 db_unavailable with a Chinese message (the UI must show "数据暂不可用·重试", never blank — avoid the FE-02/FE-07 class).

*** Stop after step 1 and wait for my confirmation that BE-01 is clear. ***

Verify:
- npx tsc --noEmit
- npm run build
- `git grep -n "selectAllUsers\|selectAllRuns" src/app/api/student/wealth-summary/route.ts` → MUST be 0
Then have engineering-code-reviewer (different responsibility group) confirm zero changes outside src/app/api/student/wealth-summary/** + guard set present, and report APPROVE/REQUEST_CHANGES.
```

✅ 验收：`npm run build` 通过；接口返回五字段；grep 无全表扫描调用。
❌ 回滚：`git checkout -- src/app/api/student/wealth-summary/route.ts`。

### 提示词 F.1.3 — C-1 + C-2 前端：财富总览页 + 环形图

**目标**：实现 `/student/wealth` 页与配置环形图（doc 03 line 76-84 / 91-92，施工细则 doc 03 Part F line 196-202）。
**前置**：F.1.2 已 APPROVE；FE-05/06/17 已修（`Asia/Shanghai` 格式化、令牌化、全角￥），否则金额/时间显示步骤会 STOP。

```
Have ui_implementer build the wealth overview page and donut.

WRITE scope (ONLY): "src/app/(platform)/student/wealth/page.tsx", src/components/student/wealth-summary-card.tsx, src/components/student/asset-allocation-donut.tsx
FORBIDDEN scope: src/app/api/**, src/lib/**, src/lib/auth*, drizzle/**

Steps:
1. Page = Server Component fetching wealth-summary for first paint (netWorth/snapshots/allocation); only the 隐藏金额 toggle + curve-range switch (近3/6/12回合) are "use client" subtrees (doc 03 line 78). Export page-level `metadata` (fixes FE-15 per Part F line 197).
2. Top card: 总资产 + 本回合收益 + 累计收益 + 👁 hide toggle persisted to localStorage (doc 03 line 84). ALL money via <MoneyText> (src/components/shared/money-text.tsx) — depends on FE-06/FE-17 being fixed; if you still see hardcoded hex like the "#16a14e" at money-text.tsx:26, STOP and flag. Time via the Asia/Shanghai formatter (FE-05).
3. asset-allocation-donut.tsx = pure SVG, NO third-party chart dep. Sectors {现金/存款/债券/股票/房产/创业/黄金}, legend %, "你的配置 vs 风险标签建议配置" 对比条 + 一句话再平衡建议. Colorblind redundancy: each sector gets a texture/label (FE-18 lesson, doc 03 line 92).
4. Three-state rule on EVERY data card: loading / error(可重试) / empty — never "失败=空" (Part F line 199). Reuse token classes only (power-card.tsx:240 已示范 bg-brand/bg-bg-muted 语义令牌).

*** Stop after step 1 and wait for my confirmation on the page-shell layout before building cards. ***

Verify:
- npm run lint
- npx tsc --noEmit
- `git grep -nE "#[0-9a-fA-F]{3,8}" src/components/student/wealth-summary-card.tsx src/components/student/asset-allocation-donut.tsx` → MUST be 0
Then have design-ui-designer (different responsibility group) review tokens + a11y and report APPROVE/REQUEST_CHANGES.
```

✅ 验收：`npm run lint` 通过；隐藏金额刷新后仍持久；环形占比与持仓明细勾稽一致；grep 无硬编码 hex。
❌ 回滚：`git checkout -- "src/app/(platform)/student/wealth/page.tsx" src/components/student/wealth-summary-card.tsx src/components/student/asset-allocation-donut.tsx`。

### 提示词 F.1.4 — C-8 市场温度计（纯函数，TDD 先行）

**目标**：实现确定性 `computeMarketTemperature` + 温度计组件（doc 03b line 72-79，随 sim-state 返回，无新 API）。
**前置**：F.0 全 PASS。`src/lib/market-sentiment.ts` 当前不存在（新增）。

```
Have finance_event_simulator add the deterministic market thermometer, test-FIRST.

WRITE scope (ONLY): src/lib/market-sentiment.ts, src/lib/market-sentiment.test.ts, src/components/student/market-thermometer.tsx
FORBIDDEN scope: src/app/api/**, src/lib/db/**, drizzle/**, src/lib/ai.ts, src/lib/simulation.ts, src/lib/market-data.ts

Steps:
1. FIRST write src/lib/market-sentiment.test.ts asserting: same seed + same round ⇒ identical temperature (doc 03b line 79); boundary cases 全涨/全跌/无波动; extreme hot/cold flips a contrarian hint ("别人贪婪我恐惧").
2. THEN implement computeMarketTemperature(run, round, eventTimeline) → 0..100°C as a PURE function driven by seed/eventTimeline only (no Date/Math.random — must pass determinism.guard.test.ts).
3. market-thermometer.tsx: pure SVG, "use client" ONLY for the needle animation (doc 03b line 76); colorblind redundancy = numeric °C + text label (FE-18); restrained motion (FE-13).
4. Do NOT add a new API — the value rides on the existing sim-state payload; consume it client-side on /student/market.

*** Stop after step 1 and wait for my confirmation that determinism is the encoded invariant. ***

Verify:
- npx vitest run src/lib/market-sentiment.test.ts
- npm run test -- src/lib/determinism
- npx tsc --noEmit
Then have reviewer (different responsibility group, read-only) confirm zero changes outside the three files and report APPROVE/REQUEST_CHANGES.
```

✅ 验收：同 seed 同回合温度恒定；`determinism.guard.test.ts` 绿；极值触发逆向提示。
❌ 回滚：`git checkout -- src/lib/market-sentiment.ts src/lib/market-sentiment.test.ts src/components/student/market-thermometer.tsx`。

> **Phase 1 收尾闸门**：`Have engineering-code-reviewer (different responsibility group from all Phase-1 implementers) audit the Phase 1 diff: confirm allocation/sentiment cores are pure & deterministic, wealth-summary doesn't reintroduce BE-01 (no selectAllUsers/selectAllRuns), no decorative reward grants 战力, three-state present on every card. Report APPROVE/REQUEST_CHANGES.` 未 APPROVE 不进 Phase 2。

---

## Phase 2 — C-3 / C-7（核心新机制，依赖 S1 + FE-01 + 新迁移）

### 提示词 F.2.1 — C-7 新资产：黄金 + 指数基金（纯数据/逻辑，TDD）

**目标**：把黄金（避险）+ 指数基金（分散）作为**接 seed/eventTimeline 的真实资产**加入（doc 03 line 141-149），trade 动作天然支持新 holdings，无需新动作类型。
**前置**：F.0 全 PASS（S1 已修 DOM-01）。`finance_event_simulator` 与 `education_narrative_designer` 同组 → 评审必须跨到 `engineering-code-reviewer`。

```
Have education_narrative_designer add gold (避险) and an index fund (分散) as real, seed-driven assets, test-FIRST.

WRITE scope (ONLY): src/lib/market-data.ts, src/lib/market-data.assets.test.ts
FORBIDDEN scope: src/app/api/**, src/components/**, src/lib/db/**, drizzle/**, src/lib/leaderboard/**, src/lib/simulation.ts

Steps:
1. FIRST write src/lib/market-data.assets.test.ts asserting: gold moves opposite to stocks under a 利空/避险 event (low/negative correlation, doc 03 line 149); the new assets read seed/eventTimeline volatility (NOT a constant); 金额守恒 + determinism unchanged.
2. THEN add the two asset definitions to src/lib/market-data.ts with event-impact direction consistent with the round narrative (avoid the DOM-07 contradiction). Confirm simulation.ts trade already supports new holdings keys — do NOT add a new action type and do NOT edit simulation.ts (doc 03 line 147).

*** Stop after step 1 and wait for my confirmation on the correlation/volatility invariants before adding asset data. ***

Verify:
- npx vitest run src/lib/market-data.assets.test.ts
- npm run test -- src/lib/simulation.money
- npm run test -- src/lib/determinism
- npx tsc --noEmit
Then have engineering-code-reviewer (DIFFERENT responsibility group — finance_event_simulator and education_narrative_designer share the simulation/finance group, so they may NOT review each other) confirm 金额守恒 + determinism + no new action type, and report APPROVE/REQUEST_CHANGES.
```

✅ 验收：避险事件下黄金逆势、被分散度评分捕捉；`simulation.money.test.ts` + `determinism.guard.test.ts` 全绿。
❌ 回滚：`git checkout -- src/lib/market-data.ts src/lib/market-data.assets.test.ts`。

### 提示词 F.2.2 — C-3 数据迁移：autoInvestPlan 列（高风险，强制 stop-gate）

**目标**：为 `scenario_runs` 增 `autoInvestPlan jsonb`（doc 03 line 105）。
**前置**：F.0 全 PASS。迁移用 `npm run db:migrate`（**绝不用 drizzle-kit push，会让本 DB 崩溃**——CLAUDE.md / 附录 B）。

```
Have db_architect add the auto-invest plan column.

WRITE scope (ONLY): src/lib/db/schema.ts, drizzle/** (generated migration), src/lib/db/repo.ts (ONLY the read/write of the new column)
FORBIDDEN scope: src/app/api/**, src/components/**, src/lib/simulation.ts, src/lib/ai.ts

Steps:
1. Add `autoInvestPlan jsonb` (nullable) to scenario_runs in src/lib/db/schema.ts — shape: { symbol, amountPerRound, startRound, endRound, executedRounds }.
2. Run `npm run db:generate` and SHOW me the generated drizzle/00XX_*.sql diff. Confirm it is ADD COLUMN only (no destructive change).
   *** Stop after step 2 and wait for my explicit confirmation before applying. ***
3. After I confirm: apply with `npm run db:migrate` (NEVER drizzle-kit push — it crashes this DB). Confirm the column exists.
4. In repo.ts, thread the column through read/write of the run (near getSimulationStateForUser at repo.ts:1113 and the run writers). Per the no-silent-write-fallback invariant (CLAUDE.md / BE-07 lesson): writes of the plan MUST surface DB errors, not fall back to memory. If a dedicated writer fn is introduced, add its name to WRITE_FNS (repo.ts:242) and keep repo-fallback.audit.test.ts green.

Verify:
- npm run db:migrate
- npx tsc --noEmit
- npm run test -- src/lib/db
Then have engineering-database-optimizer (different responsibility group) review the migration + index/constraint sanity and report APPROVE/REQUEST_CHANGES.
```

✅ 验收：迁移仅 ADD COLUMN；`npm run db:migrate` 成功；`repo-fallback.audit.test.ts` 绿。
❌ 回滚：在迁移目录旁写配套 down SQL，或 Supabase 上执行 `ALTER TABLE scenario_runs DROP COLUMN auto_invest_plan;`，并回退 schema：`git checkout -- src/lib/db/schema.ts drizzle/`。**不得用 drizzle-kit push 回滚。**

### 提示词 F.2.3 — C-3 引擎逻辑：定投自动执行（TDD 先行）

**目标**：在 `advanceSimulationRun`（`simulation.ts:507`）推进时自动执行定投买单，受现金约束，不足跳过（doc 03 line 102/106）；守金额守恒、不产生负现金。
**前置**：F.2.2 已 APPROVE（列已落地）。

```
Have finance_event_simulator implement auto-invest execution inside the sim engine, test-FIRST.

WRITE scope (ONLY): src/lib/simulation.ts, src/lib/simulation.autoinvest.test.ts
FORBIDDEN scope: src/app/api/**, src/components/**, src/lib/db/**, drizzle/**, src/lib/ai.ts, src/lib/market-data.ts

Steps:
1. FIRST write src/lib/simulation.autoinvest.test.ts asserting (doc 03 line 106 验收):
   - On advanceSimulationRun (simulation.ts:507), an active plan auto-buys amountPerRound of the symbol, cash-constrained.
   - Insufficient cash ⇒ SAFE SKIP: no error, no negative cash, 金额守恒 holds (property-based via fast-check, mirroring simulation.money.test.ts).
   - The 定投 vs 一次性梭哈 comparison numbers are correct.
   - Determinism preserved (no Date/Math.random).
2. THEN implement execution in advanceSimulationRun: apply the plan's buy as a normal trade, increment executedRounds, skip when cash < amount. Keep it a pure function.

*** Stop after step 1 and wait for my confirmation that the safe-skip + 金额守恒 invariants are encoded. ***

Verify:
- npx vitest run src/lib/simulation.autoinvest.test.ts
- npm run test -- src/lib/simulation.money
- npm run test -- src/lib/determinism
- npx tsc --noEmit
Then have engineering-code-reviewer (different responsibility group) confirm 金额守恒 + no negative cash + determinism, and report APPROVE/REQUEST_CHANGES.
```

✅ 验收：现金不足安全跳过、不报错、不产生负现金；`simulation.money.test.ts` 全绿。
❌ 回滚：`git checkout -- src/lib/simulation.ts src/lib/simulation.autoinvest.test.ts`。

### 提示词 F.2.4 — C-3 后端 API：定投计划 CRUD

**目标**：`POST /api/sim/auto-invest`（创建/修改/取消，doc 03 line 104）。
**前置**：F.2.2 已 APPROVE（repo 写函数就位）；本 DB `/api/sim/*` 既有路由已统一 `checkOrigin`（CLAUDE.md CSRF 约定）。

```
Have api_wirer add the auto-invest plan endpoint.

WRITE scope (ONLY): src/app/api/sim/auto-invest/route.ts
FORBIDDEN scope: src/lib/db/schema.ts, src/lib/simulation.ts, src/components/**, drizzle/**, src/lib/ai.ts

Steps:
1. POST /api/sim/auto-invest creates/updates/cancels the plan on the user's run via repo.ts (the writer added in F.2.2).
2. Full guard set for a mutating sim route: requireUser("student") + zod body + checkOrigin() (CSRF — CLAUDE.md convention, mirrors existing src/app/api/sim/actions/route.ts) + rate-limit via rateLimit()/rateLimitKey() from src/lib/rate-limit.ts. Chinese error shape { error, message }.
3. Idempotency / double-submit safety so the FE 防双击 (FE-01) can't create duplicate plans (doc 03 line 106).

Verify:
- npx tsc --noEmit
- npm run build
- `git grep -n "checkOrigin" src/app/api/sim/auto-invest/route.ts` → MUST be ≥1
- `git grep -n "rateLimit" src/app/api/sim/auto-invest/route.ts` → MUST be ≥1
Then have engineering-code-reviewer (different responsibility group) confirm CSRF + rate-limit + zod present and report APPROVE/REQUEST_CHANGES.
```

✅ 验收：`npm run build` 通过；grep 命中 `checkOrigin` 与 `rateLimit`。
❌ 回滚：`git checkout -- src/app/api/sim/auto-invest/route.ts`。

### 提示词 F.2.5 — C-3/C-7 前端：定投卡 + 新标的入观察池

**目标**：定投卡（doc 03 line 103）+ 观察池圆环中心改真实 `payload.watchlist.length`（**闭合 FE-20**：`student-market-board.tsx:581` 当前硬编码 "10"）+ 新标的入池（doc 03 line 146）。
**前置**：F.2.4 已 APPROVE；**FE-01 `useAsyncAction` 已存在**（F.0 第 4 项已校验，grep≥1）。

```
Have teen_ux_specialist build the auto-invest UI and wire the new assets into market.

WRITE scope (ONLY): src/components/student/auto-invest-plan.tsx, src/components/student/student-market-board.tsx (ONLY the watchlist-count fix + new-symbol display)
FORBIDDEN scope: src/app/api/**, src/lib/**, src/lib/auth*, drizzle/**

Steps:
1. FIRST confirm the shared hook exists: `git grep -n "useAsyncAction" src/lib/` → if 0, STOP and report (FE-01/S3-1 not landed; do NOT roll your own double-click guard).
2. auto-invest-plan.tsx: form (选标的 + 每期金额 + 起止回合); execution receipt shown in the round-advance settlement (doc 03 line 103); restrained motion (FE-13). ALL writes go through the shared useAsyncAction so double-click is truly blocked (FE-01, doc 03 Part F line 200).
3. In student-market-board.tsx line 581, replace the hardcoded "10" in the watchlist ring center with `payload.watchlist.length` (闭合 FE-20). Add the two new assets (gold / index fund) to the observation pool. Touch NOTHING else in this file beyond these two spots.
4. Three-state on the plan card (loading / error可重试 / empty).

*** Stop after step 1+2 and wait for my confirmation on the plan-card form before touching student-market-board.tsx. ***

Verify:
- npm run lint
- npx tsc --noEmit
- `git grep -n ">10<" src/components/student/student-market-board.tsx` → expect the hardcoded 10 GONE
Then have design-ui-designer + testing-accessibility-auditor (different responsibility group) review and report APPROVE/REQUEST_CHANGES.
```

✅ 验收：观察池圆环中心显示真实 `watchlist.length`；连点不重复建计划；`npm run lint` 通过。
❌ 回滚：`git checkout -- src/components/student/auto-invest-plan.tsx src/components/student/student-market-board.tsx`。

### 提示词 F.2.6 — C-3/C-7 端到端测试（qa_engineer）

**目标**：补定投 e2e + 资产覆盖（doc 03 line 209-212）。
**前置**：F.2.3 + F.2.5 已 APPROVE。

```
Have qa_engineer add the auto-invest e2e + asset coverage.

WRITE scope (ONLY): tests/**, *.test.ts(x) for the new feature
FORBIDDEN scope: feature code (src/lib/**, src/app/api/**, src/components/** — read-only unless I approve a fix)

Steps:
1. e2e (Playwright): create 定投计划 → advance round → assert execution receipt appears exactly once (doc 03 line 212).
2. Component a11y assertion (vitest-axe) on auto-invest-plan.tsx (doc 03 line 211).
3. 联测: auto-invest + 金额守恒 (depends on F.2.3 core) — assert no negative cash across 12 rounds.

Verify:
- npm run test
- npx playwright test
Then have reviewer (different responsibility group, read-only) confirm tests-only diff and report APPROVE/REQUEST_CHANGES.
```

✅ 验收：`npm run test` + `npx playwright test` 全绿；定投回执只出现一次。
❌ 回滚：`git checkout -- tests/`（及新增 test 文件）。

---

## Phase 3 — C-5 / C-4 / C-6 / C-9 / C-10（教学闭环 + 留存层）

### 提示词 F.3.1 — C-5 学堂小测：闭合 DOM-04（数据 + 后端，强制 stop-gate）

**目标**：`/api/learn/complete` 改为"通过小测才记完成"（**DOM-04 修复点**：`learn/complete/route.ts:30` 当前直接 `markModuleComplete`；`repo.ts:2688` `markModuleComplete` 仅幂等插入无验证）；**正确答案服务端持有，绝不下发客户端**（doc 03 line 119-128）。
**前置**：F.0 全 PASS。db_architect 与 api_wirer 是不同责任组，可在同一提示词内分块协作。

```
Have db_architect + api_wirer close DOM-04 (split by group: db_architect does migration, api_wirer does routes).

--- db_architect (WRITE: src/lib/db/schema.ts, drizzle/**, src/lib/db/repo.ts) ; FORBIDDEN: src/components/**, src/lib/ai.ts, src/app/api/** ---
1. Add quiz_passed (bool) + quiz_score (int) to learning_progress; questions+answers live server-side only (a learning_quizzes table OR src/lib/content.ts, doc 03 line 127).
2. Run `npm run db:generate`, SHOW the diff (ADD COLUMN / CREATE TABLE only).
   *** Stop after generating and wait for my confirmation before `npm run db:migrate` (NEVER drizzle-kit push). ***
3. After confirm: `npm run db:migrate`; update markModuleComplete (repo.ts:2688) to require quiz_passed before recording completion.

--- api_wirer (WRITE: src/app/api/learn/complete/route.ts, src/app/api/learn/quiz/route.ts) ; FORBIDDEN: schema, components, db client ---
4. /api/learn/quiz: serve questions WITHOUT answers; grade server-side (doc 03 line 126).
5. /api/learn/complete (route.ts:30): only records done when quiz passed (closes DOM-04 — bare markModuleComplete no longer scores). Full guard set + Chinese errors + checkOrigin on the POST.

Verify:
- npm run db:migrate
- npx tsc --noEmit
- npm run test -- src/lib/db
- `git grep -n "answer" src/app/api/learn/quiz/route.ts` (confirm answers are graded server-side, NOT returned to client)
Then have engineering-code-reviewer (different responsibility group) confirm answers never leave the server + bare POST no longer completes, and report APPROVE/REQUEST_CHANGES.
```

✅ 验收：纯点击不再记完成（DOM-04 闭合）；小测答案不下发客户端；迁移成功。
❌ 回滚：Supabase 上 `ALTER TABLE learning_progress DROP COLUMN quiz_passed, DROP COLUMN quiz_score;`（如建了 learning_quizzes 表则一并 DROP）+ `git checkout -- src/lib/db/schema.ts drizzle/ src/app/api/learn/`。**不得 drizzle-kit push。**

### 提示词 F.3.2 — C-5 学堂前端 + 判分纯逻辑（TDD）

**目标**：复用 `learn-catalog`、新增小测组件，并**修 FE-16**（`learn-catalog.tsx:61` `markLearned` 失败当前静默无反馈）；doc 03 line 124-125。
**前置**：F.3.1 已 APPROVE。

```
Have ui_implementer build the 学堂 quiz UI + pure grader, grader test-FIRST.

WRITE scope (ONLY): src/lib/learn-quiz.ts, src/lib/learn-quiz.test.ts, src/components/site/learn-catalog.tsx (ONLY the FE-16 failure-feedback + empty-state fix), src/components/student/learn-quiz-modal.tsx
FORBIDDEN scope: src/app/api/**, src/lib/db/**, src/lib/ai.ts, drizzle/**

Steps:
1. FIRST write src/lib/learn-quiz.test.ts for the pure pass/fail grader (threshold, partial credit) — pure, no IO.
2. THEN implement src/lib/learn-quiz.ts.
3. learn-quiz-modal.tsx as an accessible dialog: useFocusTrap (from src/lib/use-focus-trap.ts) + role="dialog" aria-modal (FE-08 范式, doc 03 Part F line 201).
4. In learn-catalog.tsx around line 61 (markLearned) add explicit failure feedback + search/filter empty-state (闭合 FE-16). Touch nothing else there.

*** Stop after step 1 and wait for my confirmation on the grading rules. ***

Verify:
- npx vitest run src/lib/learn-quiz.test.ts
- npm run lint
- npx tsc --noEmit
Then have testing-accessibility-auditor (different responsibility group) assert the modal a11y and report APPROVE/REQUEST_CHANGES.
```

✅ 验收：打卡失败有反馈；小测弹窗焦点圈套 + Esc 关闭；grader 单测绿。
❌ 回滚：`git checkout -- src/lib/learn-quiz.ts src/lib/learn-quiz.test.ts src/components/site/learn-catalog.tsx src/components/student/learn-quiz-modal.tsx`。

### 提示词 F.3.3 — C-4 风险测评智能投顾（接 AI 网关，红线）

**目标**：`POST /api/ai/risk-advice` **只走 `src/lib/ai.ts` 网关**（AGENTS.md 红线），AI 不可用时返回规则化兜底、不抛错（doc 03 line 108-117）。
**前置**：F.0 全 PASS。三块由 db_architect / behavior_ai_analyst / api_wirer 三个不同责任组协作。

```
Have db_architect + behavior_ai_analyst + api_wirer build risk-advice (split by group).

--- db_architect (WRITE: src/lib/db/schema.ts, drizzle/**, src/lib/db/repo.ts) ; FORBIDDEN: components, ai ---
1. risk_profiles(user_id PK, risk_label, answers jsonb, updated_at), default-private (doc 03 line 116). Run `npm run db:generate`, SHOW diff, *** stop for confirm ***, then `npm run db:migrate` (NEVER drizzle-kit push).

--- behavior_ai_analyst (WRITE: src/lib/ai.ts ONLY if a new prompt helper is needed — READ it first) ; FORBIDDEN: components, db schema, payment, routes ---
2. Add the risk-advice prompt shaping. MUST route through the existing ai.ts gateway with its fallback narrative; NEVER add a direct provider fetch (AGENTS.md red line). Rule-based fallback must produce a valid 配置建议 when AI is down (doc 03 line 117).

--- api_wirer (WRITE: src/app/api/ai/risk-advice/route.ts) ; FORBIDDEN: schema, components, ai.ts ---
3. POST /api/ai/risk-advice: requireUser("student") + zod + rate-limit (AI route, rate-limit.ts) + checkOrigin + Chinese errors; persist label to risk_profiles. The risk_label must drive C-2's "建议配置" 对比 (doc 03 line 117).

Verify:
- npm run db:migrate
- npx tsc --noEmit
- npm run build
- npm run test -- src/lib/ai
- `git grep -nE "fetch\(.*(anthropic|openai|generativelanguage|api\.)" src/app/api/ai/risk-advice/route.ts` → MUST be 0 (no direct provider fetch)
Then have compliance-auditor (different responsibility group) confirm AI-gateway-only + fallback-does-not-throw, and report APPROVE/REQUEST_CHANGES.
```

✅ 验收：AI 不可用时有规则兜底不抛错；`ai-gateway.msw.test.ts` 风格的 mock 测试绿；无直连 provider fetch。
❌ 回滚：`git checkout -- src/app/api/ai/risk-advice/route.ts src/lib/ai.ts`；Supabase 上 `DROP TABLE risk_profiles;` + `git checkout -- src/lib/db/schema.ts drizzle/`。

### 提示词 F.3.4 — C-6 任务/成就/收益日历（装饰奖励，零战力）

**目标**：任务进度从既有行为**派生（读多写少）**；奖励**仅装饰**（头像框/称号），**绝不直接给战力**（守 S1 诚信，doc 03 line 134/163）；签到 streak 按 `Asia/Shanghai`（doc 03 line 139，BE-08）。
**前置**：F.0 全 PASS；FE-05 时区已修。三块由三个不同责任组协作。

```
Have db_architect + api_wirer + teen_ux_specialist build the quests 三件套 (split by group).

--- db_architect (WRITE: src/lib/db/schema.ts, drizzle/**, src/lib/db/repo.ts) ---
1. quest_progress(user_id, quest_key, claimed_at) + achievements(user_id, badge_key, earned_at) (doc 03 line 138). `npm run db:generate` → SHOW diff → *** stop for confirm *** → `npm run db:migrate` (NEVER drizzle-kit push).

--- api_wirer (WRITE: src/app/api/student/quests/route.ts, src/app/api/student/quests/claim/route.ts) ---
2. GET /api/student/quests: aggregate progress DERIVED from existing behavior (learning/trade/diversification) — prefer reads (doc 03 line 136). POST .../claim: grants ONLY decorative rewards, idempotent + checkOrigin (doc 03 line 137). HARD RULE: claim MUST NOT write any 战力/power snapshot (doc 03 line 134) — do not call recomputePowerForUser (service.ts:160) or any upsert into leaderboard_snapshots.

--- teen_ux_specialist (WRITE: "src/app/(platform)/student/quests/page.tsx", src/components/student/quest-board.tsx, src/components/student/earnings-calendar.tsx) ---
3. Task list + achievement wall + calendar streak. Streak uses Asia/Shanghai (FE-05 / BE-08). Page-level metadata exported (FE-15).

Verify:
- npm run db:migrate
- npm run lint
- npx tsc --noEmit
- npm run build
- `git grep -niE "power|战力|recomputePower" src/app/api/student/quests/` → MUST be 0
Then have engineering-code-reviewer (different responsibility group) confirm rewards never touch 战力 + idempotent claim, and report APPROVE/REQUEST_CHANGES.
```

✅ 验收：任务进度与真实行为一致；`git grep -niE "power" src/app/api/student/quests/` 为 0；签到跨时区按北京时间。
❌ 回滚：Supabase 上 `DROP TABLE quest_progress; DROP TABLE achievements;` + `git checkout -- src/lib/db/schema.ts drizzle/ src/app/api/student/quests/ "src/app/(platform)/student/quests/page.tsx" src/components/student/quest-board.tsx src/components/student/earnings-calendar.tsx`。

### 提示词 F.3.5 — C-9 活动权益中心：猜涨跌（装饰积分，不动净值/战力）

**目标**：`POST /api/sim/predict`（`checkOrigin`+限流+防双击 FE-01，结算在回合推进时**且只结算一次**）；猜测**不影响净值与战力**；体验金 run 不进公平榜（doc 03b line 81-92）。
**前置**：F.3.4 已 APPROVE（与 achievements 共表）；**FE-01 `useAsyncAction` 已存在**。四块由四个不同责任组协作。

```
Have db_architect + finance_event_simulator + api_wirer + teen_ux_specialist build 猜涨跌 (split by group).

--- db_architect (WRITE: src/lib/db/schema.ts, drizzle/**, src/lib/db/repo.ts) ---
1. round_predictions(user_id, run_id, round, guess, resolved, correct) (doc 03b line 91). Add a UNIQUE constraint on (user_id, run_id, round) to prevent double-settlement. `npm run db:generate` → SHOW diff → *** stop for confirm *** → `npm run db:migrate` (NEVER drizzle-kit push).

--- finance_event_simulator (WRITE: src/lib/simulation.ts settlement hook + src/lib/simulation.predict.test.ts) ; test-FIRST ---
2. FIRST write the test: a prediction settles EXACTLY ONCE on advanceSimulationRun (simulation.ts:507), marks correct/incorrect, and does NOT alter netWorth or 战力 (doc 03b line 92). THEN implement the resolve in the round-advance path. Pure where possible; determinism preserved.

--- api_wirer (WRITE: src/app/api/sim/predict/route.ts) ---
3. POST /api/sim/predict: requireUser("student") + zod + checkOrigin + rate-limit + double-submit-safe (FE-01). Settlement happens on advance, idempotent.

--- teen_ux_specialist (WRITE: "src/app/(platform)/student/quests/page.tsx" 升级为"活动权益中心" + src/components/student/predict-card.tsx) ---
4. 三类收纳：练习/赛事/福利 (doc 03b line 88). 赛事 = reuse the existing 战力榜/赛季榜 as entries, do NOT build a new board. Reward = decorative 积分/称号 only. Writes via the shared useAsyncAction (confirm it exists first; if grep is 0, STOP).

Verify:
- npm run db:migrate
- npm run test -- src/lib/simulation
- npx tsc --noEmit
- npm run build
- `git grep -niE "netWorth|power|战力" src/app/api/sim/predict/route.ts` → confirm prediction never mutates them
Then have testing-api-tester + engineering-code-reviewer (different responsibility group) confirm settle-once + zero net-worth/战力 impact, and report APPROVE/REQUEST_CHANGES.
```

✅ 验收：猜测在回合推进时只结算一次；预测不改净值与战力；体验金 run 不进公平榜。
❌ 回滚：Supabase 上 `DROP TABLE round_predictions;` + `git checkout -- src/lib/db/schema.ts drizzle/ src/lib/simulation.ts src/lib/simulation.predict.test.ts src/app/api/sim/predict/route.ts src/components/student/predict-card.tsx "src/app/(platform)/student/quests/page.tsx"`。

### 提示词 F.3.6 — C-10 机构共识度 / 同学热度（脱敏聚合，隐私红线）

**目标**：`GET /api/market/peer-heat` **按班级聚合**（复用 BE-01 修复后的班级过滤），**只返回计数，绝不返回个人持仓/userId**——隐私红线（呼应 `01` 第六节"排行榜隐私不泄露"不变量，doc 03b line 94-101）。
**前置**：F.0 全 PASS；BE-01 已修。两块由不同责任组协作，后端先行。

```
Have api_wirer + ui_implementer build peer-heat (split by group; backend first).

--- api_wirer (WRITE: src/app/api/market/peer-heat/route.ts) ; FORBIDDEN: db schema, components, ai ---
1. GET /api/market/peer-heat: requireUser("student") + classroom-scoped aggregation over scenario_runs.holdings (doc 03b line 99-100). Confirm the query is classroom-filtered in SQL (BE-01 lesson — do NOT call selectAllUsers/selectAllRuns at repo.ts:692), not a full scan. Return ONLY {symbol, count} Top3 — NEVER userId/alias/displayName/个人持仓 (privacy red line, doc 03b line 101).
2. Cold-start empty state supported; Chinese error shape { error, message }.

--- ui_implementer (WRITE: src/components/student/peer-heat-card.tsx) ; FORBIDDEN: src/app/api/**, src/lib/** ---
3. Read-only card on /student/market showing 班级"本回合最热标的 Top3" + a reflection line "热门不等于适合你" (doc 03b line 95). Empty state when no data.

Verify:
- npx tsc --noEmit
- npm run build
- `git grep -niE "userId|user_id|alias|displayName" src/app/api/market/peer-heat/route.ts` → MUST be 0 in the response payload
- `git grep -n "selectAllRuns\|selectAllUsers" src/app/api/market/peer-heat/route.ts` → MUST be 0
Then have engineering-security-engineer (different responsibility group) confirm ZERO personal-data leakage + classroom-scoped query, and report APPROVE/REQUEST_CHANGES.
```

✅ 验收：响应仅含聚合 `{symbol,count}`、零个人信息；冷启动有空态；查询按班级过滤无全表扫描。
❌ 回滚：`git checkout -- src/app/api/market/peer-heat/route.ts src/components/student/peer-heat-card.tsx`。

---

### 提示词 F.4 — 全阶段终审闸门（reviewer + qa_engineer，多组联审）

**目标**：C-feature 发布终审，按 AGENTS.md §5 质量门跑全套并逐红线判定。
**前置**：Phase 1/2/3 全部 APPROVE。评审团全部来自实现者之外的责任组。

```
Have reviewer + qa_engineer + engineering-code-reviewer + testing-reality-checker run the C-feature release audit (all from responsibility groups distinct from the implementers):

1. 装饰奖励诚信红线（最关键）: `git grep -rniE "recomputePower|upsertLeaderboardSnapshot|战力" src/app/api/student/quests/ src/app/api/sim/predict/` → MUST be 0. No quest/猜涨跌/红包 path writes 战力 (doc 03 line 163, doc 03b line 71).
2. AI 红线: `git grep -rnE "fetch\(.*(anthropic|openai|api\.openai|generativelanguage)" src/app/api/` → MUST be 0 outside src/lib/ai.ts.
3. CSRF/限流: every new mutating route (sim/auto-invest, sim/predict, learn/complete, learn/quiz, student/quests/claim, ai/risk-advice) has checkOrigin + rate-limit + zod.
4. 隐私: peer-heat returns no userId/alias/个人持仓.
5. Determinism: allocation / market-sentiment / market-data / auto-invest / predict cores keep determinism.guard.test.ts + simulation.money.test.ts green.
6. Three-state + a11y: every new data card has loading/error/empty; new dialogs use useFocusTrap (FE-08); axe 零严重违规.

Full pipeline (AGENTS.md §5):
- npm run lint
- npx tsc --noEmit
- npm run test
- npm run build
- npx playwright test

Output a PASS/FAIL checklist per gate. End with the stage verdict APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION.
```

✅ 验收：6 项红线全 PASS；`lint / tsc / test / build / playwright` 五件套全绿；终审 `APPROVE`。
❌ 回滚：按失败功能逐项 `git checkout -- "<该功能 WRITE scope>"`（含括号路径加引号）；迁移失败按各 stop-gate 的 `DROP COLUMN/TABLE` 回退 + `git checkout -- src/lib/db/schema.ts drizzle/`，**全程禁用 drizzle-kit push**。

> **提交建议**（每个 Phase 一组 commit，照 CODEX-WORKFLOW.md 阶段 7 范式；分支非 main 时先开 feature 分支，先 `git status` / `git diff` 审一遍，不用 `git add .`）：
> ```powershell
> git add src/lib/allocation.ts src/lib/allocation.test.ts `
>   src/lib/market-sentiment.ts src/lib/market-sentiment.test.ts `
>   "src/app/(platform)/student/wealth/page.tsx" `
>   src/components/student/wealth-summary-card.tsx `
>   src/components/student/asset-allocation-donut.tsx `
>   src/components/student/market-thermometer.tsx `
>   src/app/api/student/wealth-summary/route.ts
> git commit -m "feat(wealth): C-1/C-2/C-8 财富总览 + 配置环形图 + 市场温度计（纯函数确定性、零战力）"
> ```
