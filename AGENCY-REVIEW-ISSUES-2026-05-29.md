# Agency Agents 三轮审阅问题清单

- 项目：Brown Zone Web
- 工作区：`D:\树德实验中学（清波）\C2\brown-zone-web`
- 审阅日期：2026-05-29
- 审阅目标：调用 Agency Agents 进行代码、功能、用户使用路径三轮检查，重点模拟真实用户在注册、游客体验、学生沙盘、付费、后台管理过程中遇到的问题。

## 审阅方式

### 第 1 轮：代码、安全与后端链路审阅

- 主责代理：`engineering-code-reviewer` / `engineering-backend-architect`
- 结论：`REQUEST_CHANGES`
- 覆盖重点：鉴权、超级管理员、订阅付费、AI 权限、API 防滥用、数据库/RLS 依赖。

### 第 2 轮：用户路径与可见界面审阅

- 主责代理：`design-ui-designer` / `testing-accessibility-auditor`
- 状态：该 UI 代理在本轮等待窗口内未返回结果。
- 补位验证：主线程使用 Browser 插件尝试进入 `/student`，但当前 Browser 后端对该路由导航超时并重置；随后使用 Playwright、截图审查和本地接口复现补充证据。
- 覆盖重点：游客/注册进入学生端、页面白屏、按钮反馈、错误提示、截图溢出、控制台警告。

### 第 3 轮：集成测试与真实用户任务审阅

- 主责代理：`testing-reality-checker` / `testing-api-tester`
- 结论：`REQUEST_CHANGES`
- 覆盖重点：学生操作流、游客充值、微信支付 mock、价格页、后台权限、E2E 覆盖深度。

## 自动化基线

| 检查项 | 结果 | 说明 |
| --- | --- | --- |
| `npm run lint` | PASS | 通过 |
| `npx tsc --noEmit` | PASS | 通过 |
| `npm run test` | PASS | 12 个测试文件、57 个测试通过 |
| `npm run build` | PASS | 生产构建通过 |
| `npx playwright test --reporter=line` | PASS | 15 个 E2E 测试通过 |
| `globalThis.__brownZoneStore__` API 扫描 | PASS | `src/app/api` 中未发现 |
| `from "@/lib/store"` API 扫描 | PASS | `src/app/api` 中未发现 |
| 乱码扫描 | PASS | 未发现 `� / 锛 / 鐧 / 娉 / 璇 / 楼` 等明显异常字符 |

> 注意：自动化通过不代表业务闭环完全可用。本轮手动复现和代理审阅发现多个高优先级问题。

## 已保留的审阅证据

- Playwright 截图目录：`.qa-screens/audit-1780043354993/`
- 关键截图包括：`anon__root.png`、`anon__demo.png`、`student__student.png`、`student__student_market.png`、`student__student_history.png`、`admin__admin.png`
- 接口复现证据：
  - `/demo` HTML 中可检索到 `superadmin` 和 `Super001!!!`
  - 学生端“退出创业”请求返回 400：`{"error":"invalid_input","message":"请求参数格式不正确，请检查后重试。"}`
  - 教师账号可为任意 `targetUserId` 创建 mock 付费订单

## P0 阻塞问题

### SEC-001：超级管理员账号密码被序列化到前端 HTML

- 严重级别：P0
- 类型：安全 / 凭据泄露
- 影响用户：所有访问 `/demo` 的用户
- 证据：
  - `src/app/(site)/demo/page.tsx` 将 `getQuickDemoCredentials()` 的完整结果传给客户端组件。
  - 本地请求 `/demo` 后，HTML 中可直接检索到 `superadmin` 和 `Super001!!!`。
- 用户视角影响：
  - 普通访问者不需要登录即可从页面源码拿到超级管理员入口信息。
  - 一旦线上部署，后台账号管理、订阅管理等能力存在被滥用风险。
- 建议修复：
  - 前端演示账号列表必须过滤掉超级管理员。
  - 超级管理员初始密码不应出现在客户端 bundle、HTML、公开 seed 或演示凭据中。
  - 改为服务端环境变量或一次性初始化脚本管理超级管理员。

### AUTH-001：页面级鉴权未校验 `tokenVersion`，旧会话可能绕过失效

- 严重级别：P0
- 类型：鉴权 / 会话失效
- 影响用户：管理员、学生、教师、家长所有登录态页面
- 证据：
  - `src/lib/session-user.ts` 读取 session 后只按 `userId` 查询用户，没有对比 session 中的 `tv` 与用户当前 `tokenVersion`。
  - API 层部分 guard 已有 tokenVersion 校验，但页面层仍可能接受旧 cookie。
- 用户视角影响：
  - 超级管理员重置用户密码或邮箱后，旧页面会话可能仍可进入页面。
- 建议修复：
  - 抽出统一 session resolver。
  - 页面和 API 都必须校验 `session.tv === user.tokenVersion`。
  - tokenVersion 不一致时清除 cookie 并跳转登录。

## P1 高优先级问题

### PAY-001：教师/家长可为任意 `targetUserId` 创建付费订单

- 严重级别：P1
- 类型：支付授权 / 账号归属
- 影响用户：教师、家长、学生
- 证据：
  - `src/app/api/billing/prepay/route.ts` 对非学生角色只校验 `targetUserId` 是否存在，没有校验教师班级关系或家长绑定关系。
  - 本轮复现：教师账号传入任意学生 ID 后成功创建 mock 订单。
- 用户视角影响：
  - A 班教师可能给 B 班学生创建订单。
  - 家长可能误给非绑定学生付款。
- 建议修复：
  - 教师只能为自己班级学生创建订单。
  - 家长只能为已绑定学生创建订单。
  - 超级管理员可创建任意订单，但需要后台审计记录。

### PAY-002：价格页支付按钮缺少学生/孩子目标账号，容易付到错误主体

- 严重级别：P1
- 类型：付费闭环 / 用户体验
- 影响用户：家长、教师、游客升级用户
- 证据：
  - `src/components/billing/wechat-checkout-button.tsx` 默认只提交 `{ tier: "standard", channel: "native" }`，未携带 `targetUserId`。
- 用户视角影响：
  - 家长或教师以为在给孩子/学生开通，实际订单可能绑定自己。
- 建议修复：
  - 价格页入口根据角色显示目标账号选择。
  - 家长付款必须选择绑定学生。
  - 教师付款必须选择班级或学生席位。

### PAY-003：微信 mock 支付只创建订单，不会完成订阅开通

- 严重级别：P1
- 类型：支付演示 / 付费体验
- 影响用户：游客、普通用户、演示环境
- 证据：
  - 无微信配置时可以创建 mock 订单，但没有明显的 mock 完成入口或订阅 grant 流程。
- 用户视角影响：
  - 用户点击充值后看到订单，但权益不会生效，容易误认为付费功能坏了。
- 建议修复：
  - 演示模式增加“模拟支付成功”按钮，仅本地/课堂演示环境可见。
  - mock 完成后走同一套 `fulfillPaymentOrder` 幂等开通逻辑。

### SIM-001：学生端“退出创业”按钮必然失败

- 严重级别：P1
- 类型：核心用户操作 / 表单契约不一致
- 影响用户：学生、游客体验用户
- 证据：
  - `src/components/student/student-sandbox.tsx` 中“退出创业”提交 `{ type: "venture", action: "exit" }`。
  - `/api/sim/actions` 的 venture schema 要求 `amount` 为正数。
  - 本轮复现返回 400 `invalid_input`。
- 用户视角影响：
  - 学生点击按钮后只看到失败，无法理解为什么“退出创业”不能用。
- 建议修复：
  - 后端允许 `exit` 不传 `amount`。
  - 或前端为退出动作提供退出金额/退出比例，并显示明确校验提示。

### AI-001：个性化 AI 评定接口缺少订阅/试用后端闸门

- 严重级别：P1
- 类型：商业模式 / 成本控制
- 影响用户：试用到期用户、付费用户、平台运营方
- 证据：
  - `src/app/api/ai/tutor/route.ts` 只校验学生身份和基础限流，未校验订阅状态。
  - 同类风险可能存在于 `/api/ai/*`、`/api/market/portfolio-intel`、`/api/student/history-review`。
- 用户视角影响：
  - 试用结束后前端可能禁用，但用户仍可直接请求 API 获取高成本 AI 能力。
- 建议修复：
  - 所有个性化 AI 与高成本分析接口统一调用 `resolveSubscriptionState`。
  - 后端根据 `canUsePersonalAiAssessment` 做最终裁决，前端只做提示。

### AUTH-002：登录、邀请码注册、游客升级防滥用不一致

- 严重级别：P1
- 类型：安全 / 滥用防护
- 影响用户：登录与注册系统
- 证据：
  - 登录接口缺少明确 rate limit。
  - `register-by-invite` 缺少 `checkOrigin` 和 rate limit。
  - `guest-upgrade` 缺少稳定的防滥用策略。
- 用户视角影响：
  - 容易被撞库、刷邀请、刷游客升级。
- 建议修复：
  - 登录、注册、游客升级统一接入 IP + 账号维度限流。
  - 写操作统一检查 Origin。
  - 密码复杂度和错误反馈保持一致。

### OPS-001：Vercel 环境变量文档缺少微信支付配置项

- 严重级别：P1
- 类型：部署 / 运营
- 影响用户：线上付费用户、部署维护者
- 证据：
  - `.env.example` 已包含 `WECHAT_*` 变量。
  - `docs/VERCEL-ENV.md` 只列出 AI、AllTick 等关键变量，没有列完整微信支付变量。
- 用户视角影响：
  - 线上部署后支付接口可能返回 503，用户无法完成充值。
- 建议修复：
  - `docs/VERCEL-ENV.md` 补充微信商户号、APPID、APIv3 Key、私钥、证书序列号、回调地址等变量。
  - 标明 mock 模式与正式模式差异。

## P2 中优先级问题

### UX-001：学生端错误提示优先展示错误码而不是中文说明

- 严重级别：P2
- 类型：用户体验 / 错误反馈
- 影响用户：学生、游客体验用户
- 证据：
  - `src/components/student/student-sandbox.tsx` 对失败请求使用 `payload.error ?? "提交失败。"`。
  - 后端已经返回中文 `message`，但前端没有优先显示。
- 用户视角影响：
  - 学生看到 `invalid_input`、`forbidden` 这类代码，不知道如何修正。
- 建议修复：
  - 前端错误展示统一优先 `payload.message`，其次才是 `payload.error`。

### TEST-001：现有 E2E 主要是页面可打开，缺少真实操作覆盖

- 严重级别：P2
- 类型：测试覆盖
- 影响用户：所有角色
- 证据：
  - `npx playwright test` 通过，但未覆盖沙盘具体动作、KeyAI 对话、教师发任务、后台写操作、支付 mock 完成、订阅到期限制等。
- 用户视角影响：
  - 页面能打开不代表“能用”，关键按钮仍可能在真实流程中失败。
- 建议修复：
  - 增加场景式 E2E：注册 -> onboarding -> 学生沙盘操作 -> AI -> 游客升级 -> mock 支付 -> 权益生效。

### ADMIN-001：普通 admin 只读权限未被测试覆盖

- 严重级别：P2
- 类型：权限 / 后台管理
- 影响用户：管理员、超级管理员
- 证据：
  - 当前测试没有验证普通 admin 无法修改邮箱、密码、角色和订阅。
- 用户视角影响：
  - 后台权限边界可能被误改。
- 建议修复：
  - 增加普通 admin 对 `/api/admin/users/*` 写操作的 403 测试。

### REG-001：新注册完整体验链路缺少端到端验证

- 严重级别：P2
- 类型：注册 / 新手体验
- 影响用户：新学生、游客升级用户
- 证据：
  - 当前没有覆盖“新邮箱注册 -> onboarding -> 完成教学 -> 推进回合 -> 试用到期”的完整链路。
- 用户视角影响：
  - 可能再次出现注册后进不去学生端、白屏或沙盘状态缺失。
- 建议修复：
  - 新增专门的 E2E 用户旅程测试，并在每次部署前运行。

### HYD-001：多个平台页存在 React hydration mismatch 警告

- 严重级别：P2
- 类型：前端稳定性 / 可维护性
- 影响页面：`/student`、`/student/market`、`/teacher`、`/admin`
- 证据：
  - Playwright 审查期间控制台出现 hydration mismatch 警告。
- 用户视角影响：
  - 目前不一定直接阻塞使用，但可能导致 UI 状态不稳定、未来升级 React/Next 后变成更明显问题。
- 建议修复：
  - 检查首屏依赖时间、随机数、浏览器状态、客户端专属属性。
  - 将不稳定渲染移动到 client-only effect 或统一 SSR 初值。

### RLS-001：RLS 辅助能力存在，但 repo 主流程仍依赖应用层过滤

- 严重级别：P2
- 类型：数据隔离 / 架构一致性
- 影响用户：多角色数据隔离
- 证据：
  - 代码中有 RLS helper，但常规 repo 调用仍使用 owner 连接和应用层过滤。
- 用户视角影响：
  - 如果某个 repo 方法漏掉 where 条件，数据库不会自动兜底拦截。
- 建议修复：
  - 明确当前阶段是否接受应用层隔离。
  - 若目标是真 RLS，关键读写路径应通过带用户 JWT claims 的连接执行。

## P3 低优先级 / 一致性问题

### ROUTE-001：未登录访问 `/student/market` 行为与其他学生页不一致

- 严重级别：P3
- 类型：路由体验一致性
- 影响用户：未登录访问者
- 证据：
  - `/student`、`/student/history` 更偏向跳转或阻断登录。
  - `/student/market` 可返回 AccessGate 200。
- 用户视角影响：
  - 用户可能困惑为什么不同学生页的未登录提示形式不一致。
- 建议修复：
  - 统一学生端未登录策略：要么全部跳转 `/demo?auth=login`，要么全部显示同一 AccessGate。

## 真实用户旅程风险汇总

### 游客体验用户

- 风险 1：游客点击充值后，如果走 mock 支付，只创建订单但权益不一定生效。
- 风险 2：游客升级为个人账号后的完整链路缺少 E2E，仍需防止“注册成功但进不去学生端”复发。
- 风险 3：浏览器当前对 `/student` 的人工导航曾出现超时，虽然 Playwright 可打开页面，但需要继续观察线上环境。

### 新注册学生

- 风险 1：沙盘关键操作“退出创业”失败。
- 风险 2：后端返回中文说明，但前端可能显示错误码。
- 风险 3：个性化 AI 权限依赖前端提示不够，试用到期后仍可能绕过。

### 家长或教师付费用户

- 风险 1：付款目标账号不清晰，价格页可能付到自己而不是孩子/学生。
- 风险 2：教师/家长 targetUserId 授权边界不够严。
- 风险 3：线上微信支付环境变量文档不完整，容易部署后无法收款。

### 超级管理员

- 风险 1：超级管理员账号密码泄露到前端 HTML，是当前最高优先级问题。
- 风险 2：tokenVersion 页面级校验缺失，重置密码/邮箱后旧会话可能仍能访问页面。
- 风险 3：普通 admin 只读权限缺少自动化证明。

## 建议修复顺序

1. 立即修复 `SEC-001`：移除前端 HTML 中的超级管理员凭据。
2. 立即修复 `AUTH-001`：页面层统一 tokenVersion 校验。
3. 修复支付授权：`PAY-001`、`PAY-002`、`PAY-003`。
4. 修复学生核心操作：`SIM-001`、`UX-001`。
5. 给 AI 成本接口增加后端订阅闸门：`AI-001`。
6. 补齐登录/注册/游客升级限流与 Origin 检查：`AUTH-002`。
7. 补齐 Vercel 微信环境变量文档：`OPS-001`。
8. 增加真实用户旅程 E2E：注册、游客、支付、后台权限、沙盘操作。
9. 处理 hydration mismatch 与未登录路由一致性。

## 本轮没有改动的内容

- 本轮仅新增此问题清单文档，没有修改业务代码。
- 未提交 git commit。
- 未触碰 `.env.local`。
- 未绕过 `src/lib/ai.ts` 直接调用外部 AI。
- 未运行破坏性 git 或文件系统命令。

