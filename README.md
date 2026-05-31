# Brown Zone Web

Brown Zone 是一个面向中学财商教育的网页端经济沙盘。当前版本包含公共官网、课程页、试玩入口、学生策略台、市场信息、历史复盘、教师端、家长端和管理端。

## 技术栈

- Next.js 16 App Router + React 19 + TypeScript
- Tailwind CSS v4 + Framer Motion
- Supabase Postgres + Drizzle ORM
- Vitest + Playwright
- Anthropic-compatible AI gateway through `src/lib/ai.ts`

## 本地启动

1. 安装依赖：

```powershell
npm install
```

2. 复制环境变量并填写真实值：

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

3. 启动开发服务器：

```powershell
npm run dev
```

4. 打开浏览器访问：

```text
http://localhost:3000
```

如果 3000 端口不可用，可以改用：

```powershell
npm run dev -- -p 3100
```

## 必需环境变量

`.env.example` 是唯一的本地示例模板，必须和 `.env.local` 的 key 保持一致：

- `APP_URL`
- `SESSION_SECRET`
- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AI_API_KEY`
- `AI_MODEL`
- `AI_BASE_URL_PRIMARY`
- `AI_BASE_URL_SECONDARY`
- `ALLTICK_API_KEY`
- `ALLTICK_STOCK_BASE_URL`

可选（用于邮件 / 验证 / 定时任务，缺省时优雅降级）：

- `RESEND_API_KEY` / `EMAIL_FROM` — 邮件发送（验证邮件、找回密码、家长周报）。缺省时验证/重置链接在开发环境直接返回，不发邮件。
- `REQUIRE_EMAIL_VERIFICATION` — 灰度开关，默认 `false`；确认 Resend 发信正常后再设 `true` 强制邮箱验证。
- `CRON_SECRET` — 生产环境必填，用于 Vercel Cron 周报接口鉴权（详见 `docs/VERCEL-ENV.md`）。

激活顺序：先配 `RESEND_API_KEY`+`EMAIL_FROM` → 验证发信正常 → 再设 `REQUIRE_EMAIL_VERIFICATION=true`；并在首个周一前配好 `CRON_SECRET`。

不要提交 `.env.local`。AI 网关密钥、Supabase service role key 和数据库连接串只能放在本地或部署平台的加密环境变量中。

## Supabase 设置步骤

1. 在 Supabase 创建项目并复制 Project URL、Anon Key、Service Role Key。
2. 在 Supabase Database Settings 中复制 Postgres 连接串，填入 `DATABASE_URL`。
3. 生成并应用 Drizzle 迁移：

```powershell
npm run db:generate
npm run db:seed
npm run db:apply-policies
```

4. 连接检查建议：

```powershell
npx tsc --noEmit
npm run test
```

## 演示账号

种子数据会创建以下演示账号，默认密码为 `BrownZone2026!`：

- 学生端：`student@brownzone.ai`
- 教师端：`teacher@brownzone.ai`
- 家长端：`parent@brownzone.ai`
- 管理端：`admin@brownzone.ai`

## 验证命令

发布前建议按顺序执行：

```powershell
npm run lint
npx tsc --noEmit
npm run test
npm run build
npx playwright test
```

## Vercel 部署

`vercel.json` 只声明 Next.js framework，不写入任何 secret。请在 Vercel Dashboard 的 Project Settings -> Environment Variables 中配置与 `.env.example` 相同的一组 key。

部署前本地生产构建检查：

```powershell
$env:NODE_ENV='production'
npm run build
```

部署方式二选一：

```powershell
vercel --prod
```

或连接 GitHub 仓库后通过 git push 触发 Vercel 自动部署。

更多部署变量说明见 `docs/VERCEL-ENV.md`。
