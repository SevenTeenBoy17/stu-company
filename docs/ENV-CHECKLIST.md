# Brown Zone Environment Variables Checklist

> 把这份清单的每一项搞定再开始执行 `CODEX-WORKFLOW.md`。  
> **不要把真实密钥提交到 git**。

---

## 1. 必备变量总表

| 变量名 | 来源 | 必填 | 用途 |
|---|---|---|---|
| `APP_URL` | 自定义 | ✅ | 本地 http://localhost:3000 ；线上 https://your-domain |
| `SESSION_SECRET` | 自生成 32+ 字节 | ✅ | jose JWT 签名密钥 |
| `DATABASE_URL` | Supabase Settings → Database → Pooler | ✅ | Postgres 连接（含连接池）|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Settings → API → URL | ✅ | 前端 supabase-js 客户端 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Settings → API → anon | ✅ | 前端公钥 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Settings → API → service_role | ✅ | seed 脚本和 RLS 绕过 |
| `AI_API_KEY` | 运营方自选的 Anthropic 兼容网关 | ⚠️ | 没有则降级为本地教学兜底 |
| `AI_MODEL` | 模型 ID（默认 claude-sonnet-4-6）| ⚠️ | |
| `AI_BASE_URL_PRIMARY` | 主网关 URL（**必须由运营方显式提供，不再有内置第三方默认**）| ⚠️ | 不填则 AI 走本地兜底，不会静默把数据发到陌生域名 |
| `AI_BASE_URL_SECONDARY` | 备网关 URL | ⚠️ | 主挂时自动 fallback |
| `ALLTICK_API_KEY` | https://alltick.co 注册 | ⚠️ | 没有则用本地教学行情 |
| `ALLTICK_STOCK_BASE_URL` | 默认 https://quote.alltick.co/quote-stock-b-api | ⚠️ | |

图例：✅ 必填阻断 · ⚠️ 没有也能跑（功能降级）

---

## 2. 三处归宿

```
.env.local          → 开发本地（被 .gitignore 排除）
Vercel Project Env  → 线上部署
Supabase Dashboard  → 仅 DB 内部需要的（如 vault 密钥）
```

---

## 3. 一步步获取（按顺序）

### 3.1 SESSION_SECRET（30 秒）

```powershell
# PowerShell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
```

把输出粘贴到 `SESSION_SECRET=`。

### 3.2 Supabase 项目（10 分钟）

1. 打开 https://supabase.com → Sign in（GitHub 登录最快）
2. New Project → 名称 `brown-zone` → 区域选 **Tokyo / Singapore**（中国大陆访问友好）→ 创建
3. 等 2 分钟项目初始化完成
4. Settings → Database → Connection String → **URI** 选项卡
   - 选 **Connection pooling**（重要！Vercel serverless 必须用 pooler）
   - 模式选 `Transaction`
   - 复制 → `DATABASE_URL`
5. Settings → API
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`（**点 reveal 复制，注意不要泄露**）

### 3.3 AI 网关密钥（可选）

- 选定 Anthropic 兼容网关：在该运营方控制台创建 API Key，写入 `AI_API_KEY`，并在 `AI_BASE_URL_PRIMARY` 显式填该网关地址。**不再有内置默认**——空值即视为禁用远端 AI。
- 如果直连 Anthropic：从 https://console.anthropic.com 取 key，把 `AI_BASE_URL_PRIMARY` 改成 `https://api.anthropic.com/v1`
- **不填的后果**：所有 AI 请求降级到 `src/lib/ai.ts` 内置的本地教学回复（功能完整但不智能）

### 3.4 AllTick 行情密钥（可选）

1. https://alltick.co 注册
2. 控制台 → API Token → 复制 → `ALLTICK_API_KEY`
3. **不填的后果**：行情显示 `src/lib/market-data.ts` 内置的 12 回合教学数据（演示足够）

---

## 4. 完整 `.env.local` 模板

```bash
# === Required ===
APP_URL=http://localhost:3000
SESSION_SECRET=<paste from 3.1>
DATABASE_URL=<paste from 3.2 step 4>
NEXT_PUBLIC_SUPABASE_URL=<paste from 3.2 step 5>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste from 3.2 step 5>
SUPABASE_SERVICE_ROLE_KEY=<paste from 3.2 step 5>

# === Optional (graceful fallback exists) ===
AI_API_KEY=
AI_MODEL=claude-sonnet-4-6
# Leave both empty to use local AI fallback; never use a third-party default.
AI_BASE_URL_PRIMARY=
AI_BASE_URL_SECONDARY=
ALLTICK_API_KEY=
ALLTICK_STOCK_BASE_URL=https://quote.alltick.co/quote-stock-b-api

# === Hardening switches (added by PR-A/PR-B) ===
# Required in production; keep this commit-safe placeholder out of .env.local.
# SESSION_SECRET=<32+ random chars>
# Set true ONLY for the offline teacher-laptop demo; defaults to false in prod.
# ALLOW_MEMORY_FALLBACK=false
# Set to "authenticated" to opt drizzle/policies.sql into the request path.
# DATABASE_ROLE=owner
```

---

## 5. 验证脚本

填完后跑：

```powershell
cd D:\树德实验中学（清波）\C2\brown-zone-web
node -e "require('dotenv').config({path:'.env.local'}); const e=process.env; ['DATABASE_URL','SESSION_SECRET','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'].forEach(k=>console.log((e[k]?'✅':'❌')+' '+k))"
```

5 个全 ✅ 才能进 CODEX-WORKFLOW 阶段 2。

---

## 6. Vercel 上线时同步项

在 Vercel Dashboard → Project → Settings → Environment Variables，**逐个粘贴上面 11 个变量**到 `Production` 和 `Preview` 两个环境。完成后 redeploy 一次。

---

## 7. 常见坑

| 症状 | 原因 | 解决 |
|---|---|---|
| `Error: getaddrinfo ENOTFOUND` | DATABASE_URL 复制成了 Direct 而不是 Pooler | 重新到 Supabase 选 Connection pooling |
| `JWT malformed` | SESSION_SECRET 少于 16 字符 | 重新生成 32+ 字符的串 |
| AI 回复总是 "本地教学兜底" | AI_API_KEY / AI_BASE_URL_PRIMARY 没填或 key 失效 | 检查运营方网关余额与 key |
| 行情数据 12 回合循环 | ALLTICK_API_KEY 没填或限流 | 检查 AllTick 控制台 |
| Vercel build OK 但运行 500 | Vercel env 没设 | Settings → Env Variables 逐项核对 |
