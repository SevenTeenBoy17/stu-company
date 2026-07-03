# Brown Zone 全链路打通与本地可用化 — PRD / 实施计划（待 Review）

> **状态**：草案 v1，供你 review。确认无误后再展开为逐任务 TDD 执行计划并开工。
> **日期**：2026-06-17
> **目标库**：`D:\树德实验中学（清波）\C2\brown-zone-web`（当前分支 `feat/ui-premium-upgrade`）
> **配套**：本计划复用 `docs/review-2026-06-12/`（01 问题汇总 / 02 改进计划 / 05 Codex 手册）的既有结论，不重复审计。
> **方法**：本 PRD 由 3 路只读代理（后端链路追踪 / 前端死点击盘点 / 本地 DB 部署设计）实测代码后汇总，每条结论可溯源到 `文件:行号`。

---

## 0. 一句话结论（先看这个）

**你"看不到功能 / 无法注册 / 点了没反应"的根因不是功能没做，而是：①本地数据库当前是停的，且没有可复现的启动方式；②一层"失败被吞掉"的交互 bug 让能用的功能看起来像坏了。** 绝大多数理财功能（财富总览、自动定投、任务、市场温度计等 14 个页面）**代码里都已存在并已接真实数据库**——数据库一旦可靠地跑起来，它们立刻"活"过来。本计划就是把这两件事做实：**让本地库稳、让每一次点击有真实可见的结果**，再补齐少数半成品/未建功能。

---

## 1. 背景与问题诊断（实测，非猜测）

### 1.1 直接证据
- **本地 Postgres 容器 `brownzone-pg` 处于 `Exited (0) 27 hours ago`** —— 数据库根本没在运行（`docker ps -a` 实测）。
- `DATABASE_URL=postgres://postgres:***@localhost:5433/brownzone` —— 已经是**本地**地址（不是云），符合你"部署到本机"的诉求；但容器死了。
- **仓库内没有任何 `docker-compose` 文件** —— 容器是一条临时 `docker run` 命令建的（记录在 `docs/db-region-latency-and-local-dev.md:72-73`），**无 `--restart`、无命名卷、无 healthcheck**：开机即停、`docker rm` 即丢数据、无人一键拉起。这就是反复"数据不可用"的结构性原因。

### 1.2 数据库停摆时，应用到底发生了什么（追踪 `repo.ts` 实证）
- **写操作**（注册、交易、推进回合、记录定投…）属于 `WRITE_FNS`，DB 不可达时**直接抛错、绝不假装成功**（`repo.ts:317-327`）。→ 这就是"点注册没反应/失败"的直接原因。
- **读操作**在本地 dev 默认 `ALLOW_MEMORY_FALLBACK=true`（`repo.ts:163-164`，`NODE_ENV!=="production"`）时**回退到内存种子数据**。→ 这就是"页面有内容、但都是演示数据，且我一改就报错"的来源：看着像能用，实际写不进去。

### 1.3 数据库恢复后，核心链路能否真正工作？——能
3 路追踪确认：注册/登录、沙盘循环（建 run→交易→推进）、理财读页**代码层面都通**，且先前审计的 **P0 `SEC-01` 邀请码注入、`SEC-02` 邮箱匹配、`SEC-03` 限流、`BE-01` 全表扫描在本分支均已修复**。最短验证：`docker start brownzone-pg` → 刷新页面，注册与功能即恢复（schema+seed 已在卷里）。

### 1.4 但有 3 类"独立于数据库"的真实缺陷，必须修（否则"链路不通"体感继续）
1. **沙盘连点防抖失效（唯一会造成数据错乱的硬 bug）**：`student-sandbox.tsx:381-387` 用 `startTransition(() => { void mutate(...) })`，`void` 丢弃 Promise → `pending` 立即复位 → 按钮 `disabled` 失效。跨区 5s 写延迟下，连点"推进回合"会**一次跳 2–3 回合 / 重复下单**。（印证审计 `FE-01`，仍未修。）
2. **失败被吞掉 / 错误码外显（"点了没反应"的主力）**：榜单四件套失败渲染成"空榜/永久骨架/打回入榜引导"；家庭"移出/模拟支付"、"复制付款链接"失败**零提示**；多处把英文错误码 `?? data.error` 直接显示给学生（KeyAI、fund-lab、goal-accounts、protection、quest）。用户点击→请求失败→界面无变化="按钮坏了"。
3. **真·假控件（少量）**：桌面顶栏"搜索框"其实是 `<Link>`+`<span>`，没有输入框（`site-header.tsx:64-72`）。

### 1.5 计划中的理财功能：已建 / 半成品 / 未建（直接回答"为什么没看到"）
| 功能 | 状态 | 证据 |
|---|---|---|
| C-1 我的财富总览 `/student/wealth` | ✅ 已建并接 DB | `student-wealth-dashboard.tsx` + `api/student/wealth-summary` |
| C-3 自动定投机器人 | ✅ 已建（真实落库） | `student-auto-invest-dashboard.tsx` + `createAutoInvestPlanForUser` |
| C-6 任务/成就 | ✅ 已建 | `student-quest-dashboard.tsx` + `api/student/quests` |
| C-8 市场温度计 | ✅ 已建 | `lib/market-sentiment.ts` + `market-thermometer.tsx` |
| C-2 资产配置/分散度 | ⚠️ 逻辑已建，独立环形图组件未建 | `lib/allocation.ts` 有；并入 `student-allocation-panel.tsx` |
| C-4 风险测评智能投顾 | ⚠️ 已建但**结果不落库**（刷新即丢） | `api/student/risk-profile` GET 恒返回默认值 |
| C-5 财商学堂 + 课后小测 | ❌ **小测未建**（DOM-04 未闭合，纯点击刷满学习分） | `api/learn/complete/route.ts:30` 无 quiz 校验 |
| C-7 黄金/指数基金 | ❌ **未建** | `lib/market-data.ts` 仅 5 资产，无独立黄金/指数标的 |
| C-9 活动权益/猜涨跌 | ❌ 玩法**未建**（仅 quest 文案标签） | `lib/quests.ts:206-216` 跳转 `/student/market`，无猜测提交/判定 |
| C-10 机构共识度 | ❌ **未建** | 全仓零匹配（`peerHeat` 是另一回事） |

> **结论**：14 个学生页面已上线，多数功能"已建已接库"。看不到=库没起；看着像坏=失败被吞。真正缺的只有 C-5 小测、C-7 新资产、C-9 猜涨跌、C-10 机构共识度，加 C-4 落库这一处半成品。

---

## 2. 目标与成功标准（可验收）

把抽象的"后端可用、功能可用、高可靠、逻辑自洽"翻译成可勾验的 DoD：

| 目标 | 成功标准（验收口径） |
|---|---|
| **后端可用** | 全新克隆机器上 `npm run db:up && npm run dev` 一条龙起库+建表+种子，`http://localhost:3000` 用真实库登录成功 |
| **注册可用** | 在 UI 完整走完"注册新账号→登出→用新账号登录→进入 `/student` 看到自己的数据"，数据**重启容器后仍在** |
| **功能可用** | 沙盘交易/推进、定投、任务、财富总览、风险测评等**每个写操作都能持久化并在刷新后保留**；每个失败都有中文可见反馈 |
| **高可靠** | ①连点推进回合**不再跳多回合**；②任一接口失败时 UI 显示"中文错误 + 重试"而非空白/英文码/打回引导；③开机后数据库**自动恢复**（无需人工 `docker start`） |
| **逻辑自洽** | 学习分必须答对小测才计（C-5）；风险测评结果落库刷新不丢（C-4）；新资产接入真实行情波动（C-7） |
| **质量门** | `npm run lint && npx tsc --noEmit && npm run test && npm run build` 全绿；关键新链路有单测/组件测 |

---

## 3. 范围

**In scope**：本地优先数据库可靠化、注册/认证/沙盘/理财全链路打通、失败反馈统一、连点防抖、错误码中文化、补全 C-4/C-5 半成品、新建 C-7/C-9/C-10。

**Out of scope（本轮不做）**：云端 Supabase 生产部署调优、微信真实商户支付对接、AI 网关换供应商、`docs/review-2026-06-12` 里的 P2/P3 长尾（性能 BE-02/03/04、令牌统一 FE-06 等）——这些列入后续迭代，不阻塞"本地可用"。

---

## 4. 架构决策：本地优先数据库（local-first）

**决策**：用一个**受版本控制的 `docker-compose.local.yml`** 替换临时 `docker run`，解决"开机即停 / 不可复现 / 易丢数据"。要点：命名卷持久化 + `restart: unless-stopped`（随 Docker Desktop 自动恢复）+ `pg_isready` healthcheck，用户名/密码/库名/端口与现有 `DATABASE_URL` 完全一致。

**硬性顺序约束（必须固化进脚本，否则迁移失败）**：vanilla `postgres:16` 没有 Supabase 的 `authenticated`/`anon` 角色与 `auth.jwt()`，迁移 `0002_rls_policies.sql` 在建函数时即校验 → 必须先灌 `scripts/ci-supabase-shims.sql`。正确链路：
```
起容器 → 等 healthy → 灌 ci-supabase-shims.sql → db:migrate → db:apply-policies → db:seed
```
**本地最小环境变量**只有两项强制：`DATABASE_URL` + `SESSION_SECRET(≥32)`；Supabase/AI/行情/邮件全部可选，缺省优雅降级（`env.ts` 实证）。RLS 用 owner 连接可跳过，但建议照常 `apply-policies` 贴近生产。

---

## 5. 分阶段实施计划

> 每阶段：**交付物 → 涉及文件 → 验收**。阶段间有依赖，**Phase 0 必须最先**（它一做完，多数"看不到的功能"立即可见）。下列代码为最终实现规格的关键片段；批准后会展开为逐步 TDD 任务（先写失败测试→实现→跑绿→提交）。

### Phase 0 — 本地数据库可靠化（解锁一切）⏱️ 0.5–1 天
**交付物**
1. **新建 `docker-compose.local.yml`**（根目录）：
```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: brownzone-pg
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: brownzone
      POSTGRES_INITDB_ARGS: "--encoding=UTF8"
    ports: ["5433:5432"]
    volumes: ["brownzone_pgdata:/var/lib/postgresql/data"]
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d brownzone"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 10s
volumes:
  brownzone_pgdata:
    name: brownzone_pgdata
```
2. **新建 `scripts/db-up.ts`**（跨平台编排，幂等）：`compose up -d` → 轮询 `docker inspect` 直到 `healthy` → 用 `child_process` 把 `scripts/ci-supabase-shims.sql` 写进 `docker exec -i ... psql` 的 stdin（避免 PowerShell/Bash 语法分叉）→ `db:migrate` → `db:apply-policies` → `db:seed` → 打印就绪。
3. **改 `package.json` scripts**（不动现有 5 个 db 脚本）：新增 `db:up` / `db:down`（`compose down`，保留卷）/ `db:down:hard`（`down -v`，彻底重置）。
4. **文档**：用上述 runbook 替换 `docs/db-region-latency-and-local-dev.md` 的手动 `docker run` 段落。

**涉及文件**：新建 `docker-compose.local.yml`、`scripts/db-up.ts`；改 `package.json`、`docs/db-region-latency-and-local-dev.md`。复用 `scripts/{ci-supabase-shims.sql,migrate.ts,seed.ts,apply-policies.ts}`（已自带 `.env.local` 读取）。

**验收**：① `npm run db:down:hard && npm run db:up` 从零重建成功；② `docker compose -f docker-compose.local.yml ps` 显示 `healthy`；③ 重启 Docker Desktop 后容器自动 Up；④ `npm run dev` 后用 `student@brownzone.ai / BrownZone2026!` 登录看到真实数据。

**数据迁移取舍（需你拍板，见 §9 决策 1）**：现有旧容器数据在匿名卷里。推荐**方案 ii**：直接 `db:up` 用命名卷重建（本地数据本就是可复现的 `db:seed` 产物，重建零损失）；若旧容器里有手测想保留的数据，提供 `pg_dump`→`pg_restore` 一次性搬迁脚本。

---

### Phase 1 — 交互链路打通与可靠性 ⏱️ 1.5–2.5 天
> 让"每一次点击都有真实、可见、中文的结果"。这是消除"功能只停留于简单交互/点了没反应"体感的核心。

**1.1 沙盘连点防抖（最高优先，唯一数据错乱 bug）**
- 文件：`src/components/student/student-sandbox.tsx:381-387`
- 修复（最小改动）：
```tsx
// before: startTransition(() => { void mutate(url, body).catch(...) })
const submitAction = (body?: object, url = "/api/sim/actions") => {
  startTransition(async () => {
    try { await mutate(url, body); }
    catch (error) { setMessage(error instanceof Error ? error.message : "操作失败，请重试。"); }
  });
};
```
- 验收：组件测断言连续两次 `submitAction` 在第一次 settle 前第二次被 `pending` 拦截；手测连点推进回合只前进一回合。

**1.2 失败反馈统一为三态（loading / error+重试 / empty）**
- 榜单四件套：`rank-board.tsx:48-64/168-177`、`rank-dashboard.tsx:68-95`、`power-rank-teaser.tsx:16-57`、`season-leaderboard.tsx:18-60` —— 失败置独立 `error` 态渲染"加载失败，点此重试"，**仅 `200 且空** 才渲染空态；`rank-dashboard`/`power-rank-teaser` 失败**不得打回 `RankOnboarding`**（防覆盖隐私设置）。
- 家庭：`family-manager.tsx:84-127` 移出/模拟支付失败补 `setMessage(data.message ?? "操作失败")`。
- 复制链接：`student-parent-link-cta.tsx:37-45` catch 提示"复制失败，请手动选中复制"。
- 萌宠：`student-pet-reward-studio.tsx:267-283` 失败独立 `error` 态 + `role="alert"`。
- 样板：直接抄 `wechat-checkout-button.tsx`（异步范式）与 `student-opportunity-dashboard.tsx:234-243`（status/alert 分流）。
- 验收：DB 关闭状态下逐页点击，每页显示"中文错误+重试"，无空白/无英文码/无打回引导。

**1.3 错误码中文化（不外显英文码）**
- 全局把 `?? data.error` / `?? payload.error` 改为只用中文 `message`：`global-ai-assistant.tsx:204/300-301/360-362`、`student-fund-lab-dashboard.tsx:120-128`、`student-goal-accounts-dashboard.tsx:73`、`student-protection-umbrella-dashboard.tsx:91/117`、`student-quest-dashboard.tsx:221`、`student-market-board.tsx`。
- 验收：构造 503，UI 永不出现 `db_unavailable`/`rate_limited` 等英文码。

**1.4 真·假控件**
- `site-header.tsx:64-72` 桌面"搜索框"改为真实受控 `<input>` 提交 `router.push('/learn?q=...')`，或退而改文案为"浏览全部课程"避免误导（建议前者）。
- 顶栏装饰性主题/语言图标（`:111-113`）：接真实切换或移除。
- 验收：点击有明确响应，无"看着能点其实不能"的元素。

**涉及文件**：上述 student/shared/site/parent 组件（均 `src/components/**`，不碰 api/db/auth）。

---

### Phase 2 — 补全半成品功能（让逻辑自洽） ⏱️ 1.5–2 天
**2.1 C-4 风险测评结果落库**
- 现状：`api/student/risk-profile` GET 恒返回默认值，profile 不持久化（刷新即丢）。
- 交付：新增 `risk_profiles` 表（迁移）+ `repo.ts` upsert/get + 路由 POST 落库、GET 读回；前端读回已答结果。
- 验收：答完风险测评→刷新→结果仍在；换设备登录同账号一致。

**2.2 C-5 财商学堂课后小测（闭合 DOM-04，杜绝纯点击刷分）**
- 现状：`api/learn/complete/route.ts:30` 仅 `markModuleComplete` 无任何校验，纯点击即拿满 15% 学习分。
- 交付：题库（`content.ts` 或新 `learning_quizzes`，**答案只在服务端**）+ `POST /api/learn/quiz`（判分）+ `markModuleComplete` 改为"通过小测才计完成"；前端小测弹窗。
- 验收：未通过小测不计完成；答案不下发客户端；学习分只在通过后增长。

**2.3 已建功能可发现性（导航补链）**
- 核对 14 个 student 页面是否都在平台导航/仪表盘有入口；缺失的补上（避免"功能在但找不到入口"）。
- 验收：从 `/student` 能导航到全部已上线理财页。

**涉及文件**：`drizzle/`（新迁移，`db:migrate`）、`src/lib/db/{schema.ts,repo.ts}`、`src/app/api/student/risk-profile/**`、`src/app/api/learn/**`、`src/lib/{risk-profile.ts,content.ts}`、相关学生组件、平台导航组件。

---

### Phase 3 — 新建缺失功能 ⏱️ 2–3 天（可按 §9 决策 2 裁剪）
> 全部游戏化奖励**只发装饰性**（皮肤/称号），绝不发战力，守住榜单公平（沿用 `03b` 红线）。

**3.1 C-7 黄金（避险）+ 指数基金（分散）新资产**
- `lib/market-data.ts` 增 2 个标的，接入 `seed`/`eventTimeline` 真实波动（黄金在避险事件逆势）；市场页观察池纳入；圆环数量改 `payload.watchlist.length`（顺修 FE-20）。
- 验收：黄金与股票在避险事件下走势相反，可被分散度评分捕捉；不破坏金额守恒与确定性测试。

**3.2 C-9 猜涨跌（活动权益核心玩法）**
- `POST /api/sim/predict`（提交本回合猜测，`checkOrigin`+限流+防双击）+ `round_predictions` 表 + 回合推进时结算（幂等，只结算一次）+ 装饰奖励；前端猜测卡。
- 验收：结算一次且不影响净值/战力；体验金 run 不进公平榜。

**3.3 C-10 机构共识度 / 同学热度卡**
- `GET /api/market/peer-heat` 班级聚合**脱敏**（仅 count，绝不含个人持仓）+ "热门≠适合你"反思文案。
- 验收：零个人信息泄露；冷启动有空态。

**涉及文件**：`lib/market-data.ts`、`drizzle/`（新表）、`src/app/api/sim/predict/**`、`src/app/api/market/peer-heat/**`、对应学生组件、`lib/simulation.ts`（predict 结算）。

---

### Phase 4 — 端到端验证与质量门 ⏱️ 0.5–1 天
- 跑全质量门：`npm run lint && npx tsc --noEmit && npm run test && npm run build`。
- Playwright 端到端冒烟：注册→登录→沙盘一回合→定投→风险测评落库→小测→刷新数据仍在。
- 关闭 DB 跑一遍"故障演练"：每页显示中文错误+重试，无白屏/英文码。
- 验收：质量门全绿 + 冒烟用例通过 + 故障演练通过。

---

## 6. 测试与验收策略
- **TDD**：每个修复/功能先写失败测试再实现（沙盘防抖→组件测；C-4 落库→repo 单测；C-5 判分→纯函数单测；C-7→`simulation`/`market-data` 确定性测试；猜涨跌结算→幂等测试）。
- **复用现有分层**：vitest 单测 + `vitest-axe` 无障碍 + Playwright e2e（`tests/e2e/`）。
- **迁移**一律 `npm run db:migrate`（**不要** `drizzle-kit push`，会崩）。
- **每阶段独立 commit/PR**，`git diff` 自检后再提交（AGENTS.md 红线：不 `git add .`、不 `commit -a`）。

---

## 7. 风险与回滚
| 风险 | 缓解 |
|---|---|
| compose 命名卷与旧容器匿名卷不是同一份，直接 `db:up` 是空库 | §9 决策 1 明确取舍；提供 `pg_dump→pg_restore` 搬迁脚本；旧容器先 `rename` 避免撞名 |
| 灌 shim 漏步导致迁移失败 | 固化进 `db:up` 编排，杜绝人工漏步 |
| 沙盘防抖改动影响现有交互 | 组件测覆盖 + 手测；改动仅 `submitAction` 一处 |
| 新迁移影响现有数据 | 迁移幂等、本地可 `db:down:hard` 重建；先在本地验证再谈生产 |
| 回滚 | 每阶段独立分支/PR，`git revert` 即可；Phase 0 纯新增文件，删除即回滚 |

---

## 8. 时间估算（单人全栈口径）
| 阶段 | 估时 |
|---|---|
| Phase 0 本地 DB 可靠化 | 0.5–1 天 |
| Phase 1 链路打通/可靠性 | 1.5–2.5 天 |
| Phase 2 补全半成品 | 1.5–2 天 |
| Phase 3 新建缺失功能 | 2–3 天（可裁剪） |
| Phase 4 验证质量门 | 0.5–1 天 |
| **合计** | **约 6–9.5 个工作日** |

> Phase 0 当天即可让"看不到的功能"复活——**如果你只想先"能用起来"，做完 Phase 0 + Phase 1.1/1.2 就有立竿见影的效果。**

---

## 9. 待你拍板的决策点（review 时一并回我）

1. **本地数据库切换策略**：(a) 推荐——直接用 compose 命名卷重建（本地数据本就是 seed 可复现，零损失）；(b) 先把旧容器手测数据 `pg_dump` 搬进新卷再切。**你旧容器里有想保留的手动数据吗？**
2. **Phase 3 新功能范围**：C-7/C-9/C-10 三个未建功能，本轮**全做**，还是先做 C-7（新资产，教学价值最高）、C-9/C-10 留到下一轮？
3. **C-5 小测题库**：愿意投入内容生产（每模块 2–3 题，教学价值高），还是先用"最短停留+关键交互"的轻量校验过渡？
4. **执行方式**：批准后用 (a) Subagent 驱动（每任务一个新代理 + 两段评审，推荐）还是 (b) 本会话内分批执行 + 检查点？也可继续沿用你的 **Codex 流程**（本计划可直接转成 `docs/review-2026-06-12/05-CODEX执行手册.md` 同款即粘即用提示词）。

---

## 10. 批准后的下一步
你 review 通过（并回答 §9 四个决策）后，我会：
1. 把本 PRD 展开为**逐任务 TDD 执行计划**（每任务：写失败测试→跑红→最小实现→跑绿→提交），保存到 `docs/superpowers/plans/`；
2. 按你选的执行方式（Subagent / 本会话 / Codex 手册）开工，**Phase 0 先行**，每阶段交付后给你检查点。

> **配套 Codex 手册已就绪**：`docs/superpowers/plans/2026-06-17-CODEX执行手册-全链路打通.md` —— 把本 PRD 的 Phase 0–4 转成在 Codex CLI 里即粘即用的提示词（含写入/禁区范围、真实 `文件:行号`、验收命令、回滚、stop-gate），可直接交给 Codex 执行。
