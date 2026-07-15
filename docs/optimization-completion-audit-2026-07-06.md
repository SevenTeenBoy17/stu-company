# Brown Zone 优化目标完成审计（2026-07-06）

## 审计目标

对当前长期目标做逐项证据审计：按用户建议顺序核对 `1 合规深修 -> 2 安全扫描 -> 3 a11y -> 4 文案 -> 5 可选视觉/交互验证`。本文件只记录已经由当前仓库状态、测试或运行结果证明的事项；间接证据不足的事项保留为后续建议。

## 逐项结论

| 项目 | 当前状态 | 证明证据 | 说明 |
| --- | --- | --- | --- |
| 1. 合规深修：真实行情与教学 fallback 不混用 | 已完成并有回归锁 | `src/lib/market-data.ts:809-864`、`src/lib/market-watchlist.ts:387-408`、`src/lib/market-watchlist.test.ts:42-57` | 真实 K 线存在时，头部价格/涨跌从同源 K 线推导；AllTick 缺 OHLC 时不借用其他 provider 蜡烛，避免学生误读“真实价格 + 假图形”。 |
| 1. 合规深修：非真实行情明确教育属性 | 已完成并有 UI 口径 | `src/lib/market-watchlist.ts:376-384`、`docs/runtime-verification-2026-07-06.md` | quote 缺失时 source 标记为 `fallback`，页面和文案走“教学观察/课堂演示”语境。 |
| 2. 安全扫描：API 旧会话绕过 tokenVersion | 已完成并有回归锁 | `src/app/api/session-security-regression.test.ts:11-62`、`docs/session-security-audit-2026-07-06.md` | 只允许经过审计的直接 `readSession()` 例外，并要求补偿控制；市场看板旧 cookie replay 已由真 DB API 探针覆盖为 401。 |
| 2. 安全扫描：密钥、AI 直连、危险运行时代码 | 已完成并有回归锁 | `src/security-static-regression.test.ts:36-53`、`docs/security-static-scan-2026-07-06.md` | 扫描 `src` 和脚本中 provider-like secret、外部 AI host 直连、`eval/new Function/dangerouslySetInnerHTML/innerHTML`。 |
| 2. 安全扫描：速率限制代理信任边界 | 已完成并有配置说明 | `src/lib/env.ts`、`src/lib/rate-limit.ts`、`src/lib/rate-limit.test.ts`、`docs/VERCEL-ENV.md` | 增加 `TRUSTED_PROXY`，默认 Vercel 场景只信任 `x-real-ip`；自托管可显式切换。 |
| 3. a11y：重点学生面板 axe smoke | 已完成并有测试 | `src/components/student/student-panels-a11y.test.tsx:143-185` | 覆盖市场面板、定投、信用实验室等重点区域；信用实验室同时修复 `dl` 语义。 |
| 3. a11y：市场图表文字替代 | 已由前序任务完成 | `.codex-supervisor/ledger.json` 中 `market-chart-text-summaries` 任务为 done/verified | K 线、雷达、行业结构有可读文本摘要，降低只依赖 SVG/视觉的风险。 |
| 3. a11y：页面级 axe + 错误页 smoke | 已完成并有浏览器验证 | `tests/e2e/page-a11y-smoke.spec.ts`、`test-results/page-a11y-smoke/findings.json` | 覆盖 `/`、`/learn`、`/demo`、`/pricing`、`/student`、`/student/market`、`/student/quests` 的桌面和手机视口，断言无白屏、无错误页、无横向溢出、无 serious/critical axe 问题。 |
| 4. 文案：非美股目录避免交易建议口吻 | 已完成并有回归锁 | `src/lib/market-catalog.test.ts:65-88` | 禁止 `买入/卖出/抄底/追涨/稳赚/保证收益/目标价/荐股/交易信号/默认选择` 等词进入非美股教学目录文案。 |
| 4. 文案：K 线颜色说明按市场分类 | 已完成 | `src/components/student/student-market-board.tsx:1136` | 仅非美股显示 A 股红涨绿跌说明，美股不再出现错误的配色提示。 |
| 5. 可选：运行时真 DB 闭环 | 已完成 | `docs/runtime-verification-2026-07-06.md` | 本地 Postgres + `next start` + `scripts/api-probe.mjs` 得到 `33/33 passed`。 |
| 5. 可选：视觉/交互 smoke | 已完成两层验证 | `docs/runtime-verification-2026-07-06.md`、`tests/e2e/page-a11y-smoke.spec.ts` | 已覆盖学生任务中心关键交互/tablet 布局，以及公共核心页+学生核心页桌面/手机的基础可视化健康检查。 |

## 当前强验证命令

- `npm run test`：98 个测试文件、655 个测试通过。
- `npm run build`：Next.js 生产构建通过，生成 61 个页面。
- `npm run lint`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `node scripts/api-probe.mjs`（本地 Postgres + `next start`）：33/33 passed。
- `npx playwright test tests/e2e/student-gameflow-regression.spec.ts --grep "quest hub supports|tablet layout" --project=chromium`：2 passed。
- `npx playwright test tests/e2e/page-a11y-smoke.spec.ts --project=chromium --workers=1`：2 passed，`test-results/page-a11y-smoke/findings.json` 为 `[]`。
- `python -m code_review_graph detect-changes --base HEAD --brief`：risk 0.00。

## 剩余风险与建议

1. 当前工作树仍有大量未提交改动和历史文档。若准备上线，应先做一次精确 `git diff --stat` 与路径分组，不要使用 `git add .`。
2. 页面级 axe smoke 已覆盖最高流量核心页，但还不是“全部路由”级别。若继续投入，可把 `tests/e2e/page-a11y-smoke.spec.ts` 扩展到所有学生工具页。
3. 页面级 smoke 会保存截图，但不是人工逐帧视觉设计评审。若继续目标 5，可做桌面/平板/手机三视口截图矩阵归档并人工标注。
4. 本轮未触碰生产部署、生产 DB、支付、密钥或外部计费行为；上线仍需要单独 T3 审批与部署前环境变量核对。
