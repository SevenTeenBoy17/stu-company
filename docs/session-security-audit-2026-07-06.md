# Brown Zone P2-2b API 会话吊销安全扫描记录

## 目标

验证 `src/app/api/**` 中是否仍存在直接调用 `readSession()`、从而绕过 `requireUser()` 中 `tokenVersion` 吊销校验的 API 路由。

## 结论

当前 API 路由中只有 3 个经过审查的直接 `readSession()` 例外：

| 路由 | 允许原因 | 补偿控制 |
| --- | --- | --- |
| `src/app/api/auth/logout/route.ts` | 登出接口需要读取旧 session 才能吊销旧 token | 先 `clearSession()`，再 `bumpTokenVersion(session.userId)` |
| `src/app/api/billing/status/route.ts` | 允许匿名用户读取免费态；登录用户读取增强状态 | 存在 session 后继续调用 `requireUser()`，校验 tokenVersion |
| `src/app/api/ai/chat/route.ts` | 游客聊天允许匿名；登录用户保留历史会话 | 存在 session 后 `findUserById()`，并手动比对 `user.tokenVersion` 与 `session.tv` |

除上述例外外，所有登录态或角色态 API 都应使用 `requireUser(role?)`，而不是直接使用 `readSession()`。

## 新增回归锁

新增测试文件：

- `src/app/api/session-security-regression.test.ts`

测试内容：

1. 递归扫描 `src/app/api/**/route.ts`，忽略注释后查找真实 `readSession(` 调用。
2. 断言直接 `readSession()` 使用只能出现在上述 3 个允许例外中。
3. 断言 3 个例外仍保留各自补偿控制：
   - AI Chat 必须查用户并校验 `tokenVersion`。
   - Billing Status 必须在 session 存在时继续走 `requireUser()`。
   - Logout 必须清 cookie 并 bump tokenVersion。

## 已验证

```powershell
npm run test -- src/app/api/session-security-regression.test.ts
```

结果：

- `1` 个测试文件通过。
- `2` 个测试通过。

## 后续建议

- 如果后续增加“匿名可读 + 登录增强”的 API，可以复用本审计标准：匿名分支允许无 session，但登录分支必须继续走 `requireUser()` 或进行等价的 `tokenVersion` 校验。
- 不建议扩大直接 `readSession()` 白名单；优先新增专用 helper 来表达“可选登录但需要吊销校验”的语义。
