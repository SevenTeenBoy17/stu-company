# Vercel Environment Checklist

`vercel.json` declares the Next.js framework and the weekly parent-report cron:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "crons": [{ "path": "/api/cron/weekly-report", "schedule": "0 9 * * 1" }]
}
```

The cron runs `/api/cron/weekly-report` every Monday 09:00 UTC. Vercel sends it as
`Authorization: Bearer $CRON_SECRET` — **`CRON_SECRET` must be set in Production**
or the endpoint refuses to run (503) in production.

All secrets must be configured in Vercel Dashboard -> Project Settings -> Environment Variables.

## Required Variables

Configure these variables for Production and Preview:

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
- `ITICK_API_TOKEN`
- `ITICK_REST_BASE_URL`
- `ITICK_STOCK_WS_URL`
- `ALLTICK_API_KEY`
- `ALLTICK_STOCK_BASE_URL`

Transactional email + verification + cron (optional, but required to activate those features):

- `RESEND_API_KEY` — Resend API key. Without it, email verification and password reset
  degrade to dev-surfaced links (no email is sent).
- `EMAIL_FROM` — verified Resend sender, e.g. `Mr.Brown 经济沙盘 <noreply@yourdomain.com>`.
- `REQUIRE_EMAIL_VERIFICATION` — gray-launch gate. Keep `false` until Resend delivery is
  confirmed in production; set `true` to block unverified trial users from the AI assessment.
- `CRON_SECRET` — **required in Production** so `/api/cron/weekly-report` rejects
  unauthenticated calls; Vercel Cron sends it as `Authorization: Bearer $CRON_SECRET`.

If real WeChat Pay is enabled, also configure these variables for Production:

- `WECHAT_MCH_ID`
- `WECHAT_API_KEY_V3`
- `WECHAT_APP_ID`
- `WECHAT_NOTIFY_URL`
- `WECHAT_PRIVATE_KEY`
- `WECHAT_CERT_SERIAL_NO`
- `WECHAT_PLATFORM_PUBLIC_KEY`
- `WECHAT_PAY_MOCK_MODE`
- `WECHAT_PAY_SKIP_NOTIFY_SIGNATURE`
- `WECHAT_MANUAL_QR_URL` (optional fallback: static collection QR image URL for manual verification)
- `WECHAT_MANUAL_PAYEE_NAME` (optional: collection account display name)
- `WECHAT_MANUAL_INSTRUCTION` (optional: custom manual payment instruction shown to users)

The runtime also accepts the `WECHAT_PAY_*` aliases for merchant deployments
(`WECHAT_PAY_MCH_ID`, `WECHAT_PAY_API_V3_KEY`, `WECHAT_PAY_API_KEY_V3`,
`WECHAT_PAY_APP_ID`, `WECHAT_PAY_NOTIFY_URL`, `WECHAT_PAY_PRIVATE_KEY`,
`WECHAT_PAY_CERT_SERIAL_NO`, `WECHAT_PAY_PLATFORM_PUBLIC_KEY`). Prefer one naming
style and keep it consistent across Production and Preview.

## Suggested Production Values

- `APP_URL`: the final Vercel production URL, for example `https://brown-zone-web.vercel.app`
- `SESSION_SECRET`: a long random string, at least 32 characters
- `DATABASE_URL`: Supabase Postgres pooled connection string
- `AI_BASE_URL_PRIMARY`: your operator-supplied Anthropic-compatible endpoint. Leave empty to disable remote AI (local fallback narratives still work).
- `AI_BASE_URL_SECONDARY`: optional second endpoint for failover.
- `ITICK_REST_BASE_URL`: `https://api0.itick.org`
- `ITICK_STOCK_WS_URL`: `wss://api.itick.org/stock`
- `ALLTICK_STOCK_BASE_URL`: `https://quote.alltick.co/quote-stock-b-api`
- `WECHAT_NOTIFY_URL`: the public HTTPS callback URL, for example `https://brown-zone-web.vercel.app/api/billing/notify`.
- `WECHAT_PRIVATE_KEY`: merchant private key in PEM format. Keep line breaks intact in the Vercel secret value.
- `WECHAT_PLATFORM_PUBLIC_KEY`: WeChat Pay platform public key used for APIv3 callback signature verification.
- `WECHAT_PAY_MOCK_MODE`: use `false` in real production. Use `true` only for classroom/local demo environments where no real charge should happen.
- `WECHAT_PAY_SKIP_NOTIFY_SIGNATURE`: keep `false` in real production. Use `true` only for local mock callback development.

## 微信支付真实接入步骤 (Activating real WeChat Pay)

> 默认行为：**未配置商户凭证时，开通月卡走 mock**（创建订单但不真实扣款，便于离线演示）。
> 配齐下面的凭证并把 `WECHAT_PAY_MOCK_MODE=false` 后，即切换为**真实 Native 扫码支付**：
> 前端把 `code_url` 渲染成二维码，用户微信扫码付款，`/api/billing/notify` 验签+解密入账，
> 前端轮询 `/api/billing/order-status` 自动确认「支付成功」并开通订阅。
>
> 重要边界：个人/商家后台截图出来的**静态微信收款码**只能收钱，无法把支付结果自动回传到系统，
> 因此不能实现“付款后自动开通”。要做到市面订阅产品一样的自动开通，必须使用这里的
> 微信支付 Native/JSAPI 动态订单二维码 + notify 回调。

### 暂缓商户配置时的可行方案：人工核验开通

如果暂时没有微信支付商户号，可以先使用“静态微信收款码 + 后台人工核验”：

1. 上传静态微信收款码图片到可公开访问的位置，设置 `WECHAT_MANUAL_QR_URL`。
2. 可选设置 `WECHAT_MANUAL_PAYEE_NAME` 和 `WECHAT_MANUAL_INSTRUCTION`，让付款页显示收款方名称和自定义付款说明。
2. 前端 `/pricing` 创建 `manual` 订单，展示订单号和收款码。
3. 用户微信付款时在备注里填写订单号，付款后在页面提交微信转账单号/备注。
4. 超级管理员登录 `/admin`，在“微信收款人工核验”里核对到账后点击“确认到账并开通”。
5. 系统调用同一套 `fulfillPaymentOrder`，写入 `payment_orders` + `subscription_grants`，开通 30 天订阅。

边界：该方案是人工确认，不是自动回调；不要把它宣传成“扫码后立即自动开通”。

1. **开通微信支付商户号 (MCH)**：在 [微信支付商户平台](https://pay.weixin.qq.com) 完成企业资质审核，拿到 **商户号** → `WECHAT_MCH_ID`。
2. **绑定 AppID**：在「产品中心 → AppID 账号管理」把商户号与一个公众号/小程序/开放平台应用绑定，该 AppID → `WECHAT_APP_ID`。
3. **APIv3 密钥**：商户平台「账户中心 → API 安全 → 设置 APIv3 密钥」，生成 32 位密钥 → `WECHAT_API_KEY_V3`。
4. **商户 API 证书（私钥 + 证书序列号）**：在「API 安全 → 申请 API 证书」下载证书压缩包：
   - `apiclient_key.pem` 的内容 → `WECHAT_PRIVATE_KEY`（**保留 PEM 换行**；在 Vercel 里可直接粘贴带 `\n` 的多行值，代码会自动 `normalizePem`）。
   - 证书序列号（商户平台可查，或 `openssl x509 -in apiclient_cert.pem -noout -serial`）→ `WECHAT_CERT_SERIAL_NO`。
5. **微信支付平台证书公钥**：用官方工具（`wechatpay-apiv3` CLI 或商户平台下载）获取**平台证书公钥** → `WECHAT_PLATFORM_PUBLIC_KEY`（用于回调验签；缺省时回调验签会失败，除非本地用 `WECHAT_PAY_SKIP_NOTIFY_SIGNATURE=true` 跳过）。
6. **回调地址**：`WECHAT_NOTIFY_URL` = `https://<你的域名>/api/billing/notify`（必须是**公网 HTTPS**；本地无法收回调，用 mock 或内网穿透）。同时在商户平台配置该回调域名为可信域名。
7. **关闭 mock**：设 `WECHAT_PAY_MOCK_MODE=false`、`WECHAT_PAY_SKIP_NOTIFY_SIGNATURE=false`。
8. **验证**：用真实微信扫码支付 1 分钱（可在商户平台开沙箱/小额）→ 观察订单状态从 `pending` → `paid`，前端自动显示「支付成功」，用户 `subscriptionTier` 变为 `standard/premium`。

**对账与排错**：
- 订单与履约都落库（`payment_orders` + `subscription_grants`），可在数据库核对。
- 回调验签失败 → 检查 `WECHAT_PLATFORM_PUBLIC_KEY` 是否为**平台证书公钥**（非商户证书）。
- 下单报错 → 检查 `WECHAT_PRIVATE_KEY` 换行、`WECHAT_CERT_SERIAL_NO` 是否匹配该私钥对应的证书。
- 学生端不直接付款（合规）：金额由家长/教师代付或经家长付款链接；`prepay` 已强制此规则。

## Pre-Deploy Checks

Run locally before deployment:

```powershell
npm run env:doctor
npm run lint
npx tsc --noEmit
npm run test
$env:NODE_ENV='production'
npm run build
```

## Deploy Command

Manual deploy:

```powershell
vercel --prod
```

Git deploy:

1. Push to the connected GitHub repository.
2. Confirm Vercel build succeeds.
3. Open the production URL and smoke test `/`, `/demo`, `/student`, `/student/market`, and `/student/history`.
