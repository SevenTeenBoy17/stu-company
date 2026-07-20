# itest5 内测问题 → Codex 升级优化交接（问题清单 + 提示词）

> main=`8c06684`（PR #17 已合并上线）。下表「已修」项已随 PR #17 落地，无需 Codex 再动；
> 「待办」项是留给 Codex 的**深层根治 + 系统性扫描**。每条 Codex 提示词均自包含，可直接粘贴。

## 一、itest5 完整问题清单（含状态）

| 编号 | 问题 | 位置 | 状态 |
| --- | --- | --- | --- |
| R1-1 | 任务队列 dock 缺高度上限，桌面无限增高 | `student-quest-dashboard.tsx` | ✅ 已修（xl:max-h） |
| R1-2 | 任务地图高差阈值/详情弹窗文案断言不自洽 | gameflow spec | ✅ 已修 |
| R1-3 | gameflow dev 并发时序 flake | `playwright.config.ts` | ✅ 已修（retries:2） |
| P2-1a | 兜底行情**无「非真实」标识** | `student-market-board.tsx` | ✅ 已修（选中大卡标教学示意） |
| **P2-1b** | 兜底 quote **覆盖真实 K 线末收盘 → headline 与图矛盾**；且**自选卡/迷你图/顶栏未统一标注** | `market-watchlist.ts` / `tsanghi.ts` / market-board 其余渲染点 | ⏳ **待办·深层** |
| P2-2a | `/api/market/board` 用 `readSession` 绕过令牌吊销 | `board/route.ts` | ✅ 已修（requireUser） |
| **P2-2b** | **是否还有别的路由直连 readSession 绕过吊销？**（同类扫描） | 全 `src/app/api/**` | ⏳ **待办·扫描** |
| P2-3 | 信用分深底对比 2.5:1 | `student-credit-lab-dashboard.tsx` | ✅ 已修 |
| **P2-3b** | **多市场重构面板还有多少同类深底/彩底对比/触控/键盘 a11y？**（axe 全面 pass） | 5 个 WIP 面板 | ⏳ **待办·扫描** |
| P3-1 | 嵌套弹窗 Esc 连关两层 | `quest-dashboard/shared.ts` | ✅ 已修（弹窗栈） |
| P3-2 | 板块下拉缺 Esc/焦点归还 | `student-market-board.tsx` | ✅ 已修 |
| P3-3 | 自选移除按钮 36px | `student-market-board.tsx` | ✅ 已修（40px） |
| P3-4 | 投资人格雷达 SVG 缺可访问名 | `student-risk-profile-dashboard.tsx` | ✅ 已修（aria-hidden） |
| **P3-5** | K 线配色文案按 `source` 而非 `category` 门控 | `student-market-board.tsx:~1120` | ⏳ **待办·小修** |
| **P3-6** | 无代理注入 x-real-ip 时 XFF 可伪造（Vercel 已中和，仅自托管暴露） | `rate-limit.ts:~91` | ⏳ **待办·可选硬化** |

**4 维零发现**（沙盘/理财、榜单隐私、数据不变量、防射幸）——itest4 修复完好，无需动。

## 二、Codex 提示词（可直接粘贴，按优先级排序）

> 通用前置（每个任务都适用，Codex 环境）：Windows PowerShell 5.1（避免 `&&`；`2>&1` 会把 native 命令 stderr 包成 NativeCommandError，直接读已捕获的 stderr；写文件用 `-Encoding utf8`；杀进程用 `Stop-Process` 而非 `taskkill`）。DoD：命名验收命令必须真绿并把真实输出贴进 `progress.md`；禁 `git add .` / `git commit -a`，暂存显式路径。真 DB 验证用仓库现成 harness：`scripts/api-probe.mjs`、`scripts/user-journeys.mjs`（Docker `brownzone-pg` :5433，`DATABASE_URL=postgres://postgres:postgres@localhost:5433/brownzone`，先 `npm run db:seed`，再 `ALLOW_MEMORY_FALLBACK=false APP_URL=http://127.0.0.1:4200 NODE_ENV=production npm run start -- --port 4200`）。

---

### 提示词 1（P2-1b · 最高优先 · 青少年财商合规）

```
任务：根治「教学兜底行情被当真实数据展示」的一致性问题（Brown Zone / brown-zone-web，Next.js16）。

背景与证据：市场雷达多市场看板里，当沧海(tsanghi)日线在线但个股实时报价被免费套餐并发丢弃时，
resolveQuote 会把 source 置为 "fallback" 并用硬编码 fallbackPrice/fallbackChange 覆盖，而 K 线用的是
真实日线序列 → 同一张卡 headline（如 ORCL 164.535 +5.73%）与真实图（-37.87% 下行）自相矛盾。
PR #17 已给「选中大卡」加了「教学示意·非真实行情」徽章，但深层矛盾与其余渲染点未根治。

要做：
1. 当某标的 quote 为兜底(fallback)而 kline 为真实(tsanghi)时，headline 的 currentPrice/changePercent
   不得用兜底值覆盖真实末根收盘——改为取真实日线序列末点（及由其算的涨跌），消除 headline↔图矛盾；
   若整只都无真实数据，则整卡统一降级为「示意」，不给精确假 %。
2. 把「非真实/示意」标注做全站一致：自选顶栏卡片、迷你走势图、watchlist 列表项，凡展示 source!=="tsanghi"
   的价格/涨跌，都要有可见的「教学示意」标识，且不得显示「更新时间:今天」这类新鲜度错觉。
3. 补单测：market-watchlist / market-catalog 层断言「kline 真实 + quote 兜底」时 headline 取真实末收盘；
   补 student-market-board.test 断言 fallback 源渲染出示意标识。

允许改：src/lib/market-watchlist.ts、src/lib/tsanghi.ts、src/lib/market-data.ts、
        src/components/student/student-market-board.tsx 及上述 *.test.ts。
禁止改：其它 API 路由、db/repo、auth、其它面板组件。**美股既有行为必须字节级不变**（US_ROUTING 路径），
        单测 market-*.test 全绿即证。
验收：npx tsc --noEmit；npm run lint；npm run test；npm run build；
      并起真 DB 生产服务器后用 curl 对 ?category=us&symbol=ORCL / ?category=hk&symbol=0700 复现，
      确认 fallback 源有示意标识且 headline 不与 kline 矛盾，把 curl 真实输出贴 progress.md。
```

---

### 提示词 2（P2-2b · 安全 · 全站扫描）

```
任务：审计 Brown Zone 全部需要登录的 API 路由，确保没有一个像 board 路由那样用 readSession() 直连、
绕过 H2 令牌版本吊销（登出/改密后旧 JWT 仍可用）。

背景：itest5 R3 实证 /api/market/board 曾用 `const session = await readSession()` 只验签名/过期，
未比对 tokenVersion，导致登出后旧 cookie replay=200（已在 PR #17 改为 requireUser 修复）。
tokenVersion 吊销校验只在 api-guard.ts 的 requireUser 内。

要做：
1. `git grep -n "readSession(" src/app/api` 逐一核查：凡代表「已登录用户」语义的路由，都应走
   requireUser(role?) 而非裸 readSession；readSession 仅可用于「可选登录/纯读公开信息」且明确无需吊销的场景。
2. 对每个需改的路由改为 requireUser，保持错误形状 {error,message} 与状态码一致（401/403）。
3. 用真 DB 生产服务器活探针复验每个改动路由：登录→捕获 cookie→logout→replay 旧 cookie 应 401
   （参照 scripts/api-probe.mjs 里「board 登出后旧 cookie 被吊销」那段，扩成对每条路由的表驱动断言）。

允许改：src/app/api/**、scripts/api-probe.mjs。
禁止改：组件、db schema、auth.ts 本身（除非发现 requireUser 有 bug 再单列）。
验收：npx tsc --noEmit；npm run lint；npm run test；起真 DB 服务器跑 node scripts/api-probe.mjs 全绿，
      新增的每条「路由吊销」断言真实输出贴 progress.md。
```

---

### 提示词 3（P2-3b/P3 · 无障碍 · 多市场面板全面 pass）

```
任务：对 itest5 大改动的 5 个学生面板做一轮系统性无障碍(a11y)升级，消除同类对比度/键盘/触控/语义缺口。

范围面板：student-market-board.tsx、student-risk-profile-dashboard.tsx、student-auto-invest-dashboard.tsx、
student-credit-lab-dashboard.tsx、student-quest-dashboard.tsx（及 quest-dashboard/*）。

已知同类问题模式（逐一排查并修）：
- 深色 Hero 上误用「白底语义色 token」(text-warning=#854d0e / text-down=#107a3e) → 深底对比<3:1；
  应改深底亮色(emerald-300/amber-300/rose-300/brand-warm)或加 dark 变体，body 文本达 AA 4.5:1、大字 3:1。
- 交互控件触控目标 <40px；纯装饰 SVG 缺 aria-hidden 或缺 role=img+aria-label；
  下拉/弹窗缺 Esc 关闭 + 焦点归还 + 点外关闭；表单 label 未关联；焦点不可见。

要做：
1. 用 vitest-axe 给这 5 个面板各补一条 axe 冒烟断言（无 critical/serious violations），先让它红、再逐条修绿。
2. 修复所有 axe + 上述模式命中的问题；对比度用真实 token 值算，别只凭肉眼。
3. 移动端(375)/平板(768)/桌面(1280) 三档确认无横向溢出、触控目标≥40px。

允许改：上述 5 个面板组件、其 *.test.tsx、src/app/globals.css（仅在需要新增 dark 语义变体时）。
禁止改：API 路由、db、auth、业务逻辑（纯 a11y/视觉，不改数据流）。
验收：npx tsc --noEmit；npm run lint；npm run test（含新 axe 用例全绿）；npm run build；
      把每个面板 axe 结果贴 progress.md。
```

---

### 提示词 4（P3-5 + 合规 · 多市场教学文案）

```
任务：修 K 线配色说明的门控口径，并复核多市场教学文案的未成年人合规。

要做：
1. student-market-board.tsx 里「（沿用 A 股红涨绿跌配色，与美股相反）」这句现按 selected.source==="tsanghi"
   门控（proxy 不准）——改为按 payload.category 门控：category!=="us"（cn/hk/fund，用 A 股红涨绿跌）才显示，
   并确认 K 线实际着色逻辑与该说明一致（红涨绿跌 vs 绿涨红跌不能与文案对反）。
2. 通读 market-catalog.ts 里 23 只标的的 teachingNote/observationAngle/summary，删除任何「保证收益/稳赚/
   必涨/建议买入」式诱导投机或承诺回报的措辞，保持「观察-理解-复盘、不作交易信号」的教学中性语气
   （对照现有美股文案基线）。

允许改：src/components/student/student-market-board.tsx、src/lib/market-catalog.ts 及其 *.test.ts。
禁止改：数据/路由/auth。
验收：npx tsc --noEmit；npm run lint；npm run test；npm run build；
      起服务器目检 A 股/港股/基金卡的 K 线配色说明只在非美股显示且与实际着色一致。
```

---

### 提示词 5（P3-6 · 可选 · 自托管限流硬化）

```
任务：为「无 Vercel 边缘代理的自托管部署」硬化匿名限流的 IP 取值（防御纵深）。

背景：clientIpFrom(rate-limit.ts) 优先 x-real-ip，缺失时回退 XFF 最右段。Vercel 生产 always 注入
x-real-ip 故已中和；但裸 next start / 无可信代理自托管时，攻击者轮换单值 XFF 即可绕过 IP-only 限流
（forgot/reset/register/login-ip-fail）。cloudflared 路径因追加真实 IP 到 XFF 最右段仍安全。

要做：
1. 引入环境开关 TRUSTED_PROXY（如 "vercel" | "xff-rightmost" | "none"），在 env.ts 用 zod 校验、给安全默认。
2. clientIpFrom 按开关取 IP：vercel→x-real-ip；xff-rightmost→现有最右段；none→忽略所有 IP 头、
   匿名限流退化为单一 "anon" 桶（宁可粗粒度也不给攻击者轮换开桶）。
3. rate-limit.test 补三种模式的用例，尤其 none 模式下轮换 XFF 不产生新桶。

允许改：src/lib/rate-limit.ts、src/lib/env.ts、rate-limit.test.ts、.env.example / docs/VERCEL-ENV.md（文档）。
禁止改：路由业务逻辑。
验收：npx tsc --noEmit；npm run lint；npm run test；起真服务器（不注入 x-real-ip）在 none 模式下
      用 curl 轮换 XFF 打 /api/auth/forgot 应仍被限流(429)，真实输出贴 progress.md。
```

## 三、运行建议

- **顺序**：1（合规深修）→ 2（安全扫描）→ 3（a11y 面向）→ 4（文案）→ 5（可选）。1/2 优先级最高。
- **给 dev-supervisor**：可把上面 5 条作为 5 个 stage 交给你的 Codex `dev-supervisor`，每 stage 用不同责任组
  实现+评审（如 stage2 backend-architect 实现 → code-reviewer 评审；stage3 frontend + accessibility-auditor），
  每 stage 收尾出 `APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION` 明确判词。
- **合并**：每条独立开分支 + PR，六项 CI（tsc/lint/test/build/e2e/integration）全绿再合并；
  勿 `--delete-branch` 删 stacked 基座分支。
```
