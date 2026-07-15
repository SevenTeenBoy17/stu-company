# Brown Zone 运行验证记录（2026-07-06）

## 目标

在合规深修、安全扫描、a11y 与文案修复之后，补充更接近真实使用的运行证据，避免只依赖静态扫描或单元测试。

本轮验证不涉及线上部署、生产数据库、真实支付、密钥修改或破坏性数据操作。

## 运行环境

- 本地 Postgres：`brownzone-pg`，端口 `5433`，Docker health 为 healthy。
- 本地生产服务器：`http://127.0.0.1:4200`
- 服务器环境：
  - `DATABASE_URL=postgres://postgres:postgres@localhost:5433/brownzone`
  - `ALLOW_MEMORY_FALLBACK=false`
  - `APP_URL=http://127.0.0.1:4200`
  - `NODE_ENV=production`
- 临时服务已在验证后停止，`4200` 端口已释放。

## 真 DB API 探针

命令：

```powershell
$env:BASE_URL='http://127.0.0.1:4200'
node scripts/api-probe.mjs
```

结果：

- `33/33` passed，`0` failed。
- 原始 JSON 证据：`.tmp/itest4/r2-api-probe.json`

覆盖重点：

- CSRF：跨域 `Origin` 被拒，非浏览器无 `Origin` 按设计放行。
- Auth：学生登录、错误密码、畸形输入错误形状。
- Guard：未登录访问、学生访问管理员接口均被拒。
- Sim：读取状态、买入、储蓄、负数金额拒绝、推进回合。
- Quests：12 个任务返回、领取与重复领取幂等。
- Pet Rewards：返回 timeline、rewards、nextActions。
- Risk Profile：读取与有效提交。
- Leaderboard：地区、榜单、个人状态。
- Market：board、season、ticker 读接口。
- Admin：superadmin 登录与用户列表读取。
- RateLimit：连续错误登录触发 `429`。
- 隐私/合规回归：pet rewards 不含 rarity 线级词；榜单不透传 `userId`。
- 会话吊销：`/api/market/board` 登出后旧 cookie replay 返回 `401`。
- Error shape：抽样接口保持 `{ error, message }`。

## a11y 面板验证

命令：

```powershell
npm run test -- src/components/student/student-panels-a11y.test.tsx
```

结果：

- `1` 个测试文件通过。
- `5` 个测试通过。

覆盖面板：

- `StudentMarketBoard`
- `StudentAutoInvestDashboard`
- `StudentCreditLabDashboard`
- `StudentQuestDashboard`
- `StudentRiskProfileDashboard`

## 安全回归验证

命令：

```powershell
npm run test -- src/app/api/session-security-regression.test.ts src/security-static-regression.test.ts
```

结果：

- `2` 个测试文件通过。
- `5` 个测试通过。

覆盖重点：

- 直接 `readSession()` 使用仍限制在已审计例外。
- provider-like secret 字面量未进入源码或脚本。
- 应用源码不直连外部 AI provider/gateway 主机。
- 应用源码不使用动态执行或直接 HTML 注入。

## 视觉/交互冒烟验证

命令：

```powershell
$env:PLAYWRIGHT_PORT='4330'
npx playwright test tests/e2e/student-gameflow-regression.spec.ts --grep "quest hub supports|tablet layout" --project=chromium
```

结果：

- `2` 个 Playwright 测试通过。

覆盖重点：

- `/student/quests` 桌面任务地图、任务队列、详情弹窗、成就图标加载。
- 任务地图全屏弹窗可打开/关闭。
- 任务队列可滚动。
- 平板布局中路线卡仍保持可读尺寸。
- 页面无横向溢出。

说明：

- Playwright 配置本身使用离线演示 store，日志出现 `repo.fallback` 属预期；真 DB 行为已由上方 `scripts/api-probe.mjs` 单独覆盖。

## 剩余风险

- 本轮没有执行完整 `npx playwright test` 全套 E2E；仅执行了任务中心相关高价值视觉/交互冒烟。
- 本轮没有执行 Codex Security 全仓库穷尽扫描；已补高信号静态安全回归，完整安全认证仍应作为独立阶段执行。
- 本轮没有上线部署；所有结果均为本地验证证据。
