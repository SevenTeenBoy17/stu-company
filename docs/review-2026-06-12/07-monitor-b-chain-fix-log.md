# Monitor B 链路修复记录（2026-06-12）

## 本轮目标

- 修复学生端游客进入后的可见验收断点。
- 将登录失败时的技术化提示兜底为主流登录错误提示。
- 以自动化和浏览器证据确认本轮没有破坏主链路。

## 已处理问题

1. 学生策略台缺少唯一可见页面级标题，导致 E2E 在 `/student` 断言失败。
   - 处理：在 `StudentSandbox` 主内容顶部补充可见 `h1`：`学生策略台`。

2. 游客升级入口文案与验收口径不一致。
   - 处理：将 `游客可立即升级并开通完整 AI 评定` 统一为 `游客可立即开通完整 AI 评定`。

3. 登录弹窗可能透传通用 `invalid_input / 请求参数格式不正确` 技术提示。
   - 处理：在登录弹窗提交链路增加 `normalizeLoginError`，登录场景统一显示 `账号或密码错误，请重新输入。`。

## 验证记录

- `npm.cmd run lint`：通过。
- `npx.cmd tsc --noEmit`：通过。
- `npm.cmd run test`：52 个测试文件、370 个测试通过。
- `npm.cmd run build`：Next.js 生产构建通过。
- `npx.cmd tsx` 直调 `/api/auth/login` route：
  - 输入：`email=shuwei`、`password=wrong-password`
  - 输出：`401 {"error":"unauthorized","message":"账号或密码错误，请重新输入。"}`
- Playwright 聚焦用例输出：
  - `demo portal supports superadmin login and admin console loads`：OK。
  - `student venture exit api succeeds without a manual amount`：OK。
  - `guest trial enters the student sandbox and shows the upgrade entry`：断言显示 OK，但 Playwright 进程在当前 Windows/Turbopack dev server 环境下未正常退出，shell 以 timeout 结束。

## 剩余风险

- 本地 Next dev server 曾出现 Turbopack chunk 500，生产构建未复现。后续如继续做浏览器自动验收，建议优先使用生产预览服务或修复 Playwright webServer 收尾策略。
- 项目中仍存在历史轮次遗留的大量 UI/文案/编码债务，需按 Monitor B 继续分阶段清理，不能把本轮小修复视为全局完成。

