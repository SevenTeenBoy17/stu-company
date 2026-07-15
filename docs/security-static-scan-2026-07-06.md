# Brown Zone 安全静态扫描记录（2026-07-06）

## 目标

在已完成 `P2-2b` API 会话吊销审计的基础上，补一层更宽的静态安全回归护栏，覆盖以下高风险模式：

- provider-like 密钥字面量误提交。
- 应用源码绕过 `src/lib/ai.ts`，直接写死外部 AI 网关主机。
- 应用源码引入动态执行或直接 HTML 注入。

本记录是本轮高信号静态扫描与回归测试结果，不等同于完整的人工渗透测试或 Codex Security 全仓库穷尽扫描。

## 扫描结论

本轮未发现需要修改的生产应用代码问题：

- 未发现真实 provider-like secret 字面量。
- `src` 应用源码未发现 `api.anthropic.com`、`api.openai.com`、`gpt-agent.cc`、`api.llm-token.cn` 等外部 AI 主机直连。
- `src` 应用源码未发现 `eval(`、`new Function(`、`dangerouslySetInnerHTML`、`.innerHTML =`。
- `src/app/api/**` 仍仅保留已审查的 3 个 `readSession()` 例外，见 `docs/session-security-audit-2026-07-06.md`。

## 新增回归锁

新增测试文件：

- `src/security-static-regression.test.ts`

测试内容：

1. 扫描 `src` 与 `scripts`，禁止提交 `sk-*`、`sk_*`、`pk_*`、JWT-like 长 token 等 provider-like secret 字面量。
2. 扫描 `src`，禁止应用源码直接写死外部 AI provider/gateway 主机，避免绕过统一服务端 AI 封装。
3. 扫描 `src`，禁止动态执行与直接 HTML 注入模式。

## 已验证

```powershell
npm run test -- src/security-static-regression.test.ts
```

结果：

- `1` 个测试文件通过。
- `3` 个测试通过。

完整门禁：

```powershell
npx tsc --noEmit --pretty false
npm run lint
git diff --check
npm run test
npm run build
```

结果：

- TypeScript：通过。
- ESLint：通过。
- `git diff --check`：通过，仅有 Windows 行尾提示。
- 全量测试：`98` 个测试文件 / `655` 个测试通过。
- Next.js 生产构建：通过，`61` 个页面生成。

## 说明与边界

- 图片生成脚本中的外部 AI 图片网关仍允许存在于 `scripts/`，因为它们是离线资产生成工具，并通过环境变量读取 key；生产应用源码不得直接写死这些主机。
- 文档中出现的历史 URL、测试策略说明、审计记录不作为生产绕过。
- 如果后续新增第三方 provider、支付、邮件、AI 或行情出口，应优先通过现有服务端封装层与环境变量配置，不要在组件或 API route 中散落硬编码主机与密钥。
