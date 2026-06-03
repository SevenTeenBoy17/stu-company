# 测试提升与持续维护计划

> 基于当前状态：**45 测试文件 / 315 测试全绿**，Vitest + Playwright + @testing-library/react + MSW + vitest-axe + fast-check 已就位，v8 覆盖率与 `.github/workflows/ci.yml` 已配置。
> 反真说明：本仓库**无 Python**，第 2 项里的 `pytest` 不适用 —— Vitest 即 runner，下文已映射。

## 1. 覆盖率提升计划（目标 80%+ 关键路径 · 反真优先）

**策略**：不追全局虚高百分比，按「路径价值 × 反真风险」分层定阈值。先用 `npm run test:coverage` 取基线，再按下表补缺。

| 层 | 目标阈值 | 反真重点（优先补） | 现状 |
|---|---|---|---|
| `src/lib/**` 纯逻辑 | **85%+** | sim/event-engine 确定性(R3)、power-score 反 YOLO(R7)、money 取整(R4)、限流(R5)、zod(R8)、ai 兜底(R2) | 多数已覆盖 ✅ |
| `src/lib/db/repo.ts` | 70%（关键路径） | **withDb 兜底契约(R1，见 audit-repo)**、租户过滤对等、错误码映射 | R1 契约已钉 ✅；写兜底分离待补 |
| `src/app/api/**` route | **70%+** | 鉴权(401/403)、订阅门、zod 校验→invalid_input、错误契约 | `sim/actions` 已建模板 ✅；其余 ~47 端点待铺 |
| `src/components/**` | 不设硬阈值 | 语义/交互/合规分支、a11y | 5 组件已覆盖 ✅ |

**落地顺序（按 ROI）**：① 用 `route.test.ts` 模板铺其余高危端点（`auth/login`、`leaderboard/board`、`billing/*`、`cron/*` 的 CRON_SECRET）；② repo 写兜底分离 + 测试（audit F1 修复）；③ 集成层 R1/R6（需真库，CI 跑）。
**门控建议**：`vitest.config.ts` 的 `coverage.thresholds` 先设 `lines: 70, functions: 70`（全局保底），对 `src/lib/**` 用 per-directory 阈值 85；阈值只升不降（防回退）。

## 2. CI 工作流（已增强 `.github/workflows/ci.yml`）

**已落地**（本次提交）：6 个并行 job —— `lint` / `typecheck` / `unit(+coverage)` / `build` / `e2e` / `integration`。
- **并行**：GitHub Actions 中独立 job 默认并行；`unit`(Vitest) 与 `e2e`(Playwright) 同时跑。
- **覆盖报告**：`unit` job 跑 `npm run test:coverage` 并 `upload-artifact: coverage-report`（`always()`）。
- **Playwright trace/report**：`e2e` job 上传 `playwright-report/`（HTML，`always()`）+ `test-results/`（trace，`failure()`）。
- **pytest 映射**：FastAPI brief 的「并行 Vitest + Playwright + pytest」中 **pytest = N/A**（无 Python）；`unit`(Vitest jsdom) + `integration`(Vitest + Postgres) + `e2e`(Playwright) 即三路并行。

**下一步增强**（建议）：
```yaml
# 在 unit job 加覆盖率门（@vitest/coverage-v8 已装）：
- run: npm run test:coverage -- --coverage.thresholds.lines=70 --coverage.thresholds.functions=70
# PR 评论覆盖率 diff：davelosert/vitest-coverage-report-action
# integration job 转阻塞：先在 CI 用 supabase/postgres 镜像 provision authenticated/anon 角色（见 ci.yml 注释）
```

## 3. 专项测试增强

### 3a. 性能 —— Lighthouse CI + k6
**Lighthouse CI**（前端关键页 Web Vitals，门控 LCP/CLS/TBT）：
```js
// lighthouserc.cjs
module.exports = {
  ci: {
    collect: { url: ["http://127.0.0.1:4173/", "http://127.0.0.1:4173/student", "http://127.0.0.1:4173/student/market"],
               startServerCommand: "npm run dev -- -p 4173", numberOfRuns: 3 },
    assert: { assertions: { "categories:performance": ["warn", { minScore: 0.8 }],
                            "largest-contentful-paint": ["error", { maxNumericValue: 3000 }] } },
  },
};
// CI: npx @lhci/cli autorun
```
**k6**（端点负载 —— 模拟一个班并发推进回合，验证 audit F2 的连接池/双写）：
```js
// tests/perf/sim-actions.k6.js
import http from "k6/http"; import { check } from "k6";
export const options = { vus: 30, duration: "30s", thresholds: { http_req_duration: ["p(95)<800"], http_req_failed: ["rate<0.01"] } };
export default function () {
  const res = http.post(`${__ENV.BASE_URL}/api/sim/actions`,
    JSON.stringify({ type: "bank", action: "deposit", amount: 1000 }),
    { headers: { "content-type": "application/json", cookie: __ENV.SESSION_COOKIE } });
  check(res, { "no 5xx": (r) => r.status < 500 });  // 反真：高并发下不得静默双写/雪崩
}
// 运行：k6 run -e BASE_URL=... -e SESSION_COOKIE=... tests/perf/sim-actions.k6.js
```

### 3b. 安全 / 对抗（OWASP 基础 + 教育数据注入）
映射到已有 route-handler 测试体系（`vi.mock` + fast-check）：
| OWASP | 本仓对抗测试 | 状态 |
|---|---|---|
| A01 越权 (BOLA/BFLA) | route 测：401/403、跨租户读（repo F3 集成）、`requireUser` 角色门 | 模板已建 |
| A03 注入 | zod 边界(R8) + fast-check 任意 body→invalid_input（非 500）；**教育数据注入**：prompt 注入 AI（R2 已测「兜底不回显注入数字」）；SQL 注入由 Drizzle 参数化兜底，补一条「`assetId: "1; DROP"` → invalid_input」对抗用例 | 部分 |
| A04 不安全设计 | 限流(R5)、订阅门 403 | 已测 |
| A09 日志/监控失效 | audit F4/F6：兜底无指标 + PII 入日志 | 审计已列，待修 |
**教育数据注入专项**：对 `learn/progress`、`sim/actions`、`leaderboard/profile` 喂 XSS/超长/Unicode 控制符/负数进度，断言 → `invalid_input` 且不落库、不回显。

### 3c. 可访问性全覆盖
- 已有：`vitest-axe` + `global-ai-assistant` axe 检查。
- 扩展：给**每个**交互组件加 axe 用例（封装 `expectNoA11yViolations(container)` helper）；E2E 层用 `@axe-core/playwright` 对冒烟九页跑全页 axe（捕获 jsdom 测不到的 color-contrast/landmark/焦点序）。
```ts
// tests/e2e/a11y.spec.ts（建议）
import AxeBuilder from "@axe-core/playwright";
for (const path of ["/", "/student", "/student/market", "/teacher", "/parent"]) {
  test(`a11y: ${path}`, async ({ page }) => {
    await page.goto(path);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(r.violations).toEqual([]);
  });
}
```

## 4. 在 Claude 中持续维护测试（新功能测试生成流程）

本 session 已实证有效的 5 步「反真」流程 —— 每个新功能/PR 照走：

1. **先读真实源码**（绝不照假设写）：读组件/路由/lib 的真实 API、类型、依赖、错误分支。
2. **对齐 ground truth**：把外部/模板术语映射到真实栈（如 SSE→fetch state、pytest→Vitest），不存在的明确标注。
3. **选层 + 选 mock 边界**：纯函数→无 mock 真实计算；route→`vi.mock(api-guard/repo)` + MSW(ai)；组件→`@testing-library/react` + user-event；边界 mock 只打在 `ai.ts`/`alltick.ts`/`getDb` 三个真实出口。
4. **失败优先 + 验证全绿**：先写能暴露问题/钉死契约的断言；`npm run test`(目标文件) → 全量 → `tsc` → `lint` 全绿才提交。
5. **对抗校验 + 诚实留痕**：高风险断言独立复核（见 TEST-STRATEGY §6 反真附录）；行号漂移/未验证项透明记录，绝不硬凑。

**给 Claude 的提示模板**（贴进新会话即可复用）：
> 「为 `<真实文件路径>` 生成 Vitest 测试。先读该文件 + 其依赖的真实类型/契约；用 `vi.mock` 覆盖 `<依赖>`，MSW 拦 `<网络边界>`；覆盖 happy/unhappy/边界/对抗 + 错误契约；失败优先；最后 `npm run test`+`tsc`+`lint` 全绿。不存在的依赖/SSE/Python 明确标注，不要捏造。」

**护栏**：新增测试 PR 必须 (a) 全绿；(b) 覆盖率阈值只升不降；(c) 实现者与审查者分属不同责任组（`AGENTS.md §3.1`）；(d) 不静默截断覆盖面（漏测项要 `log`/在 PR 描述列出）。
