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

## Suggested Production Values

- `APP_URL`: the final Vercel production URL, for example `https://brown-zone-web.vercel.app`
- `SESSION_SECRET`: a long random string, at least 32 characters
- `DATABASE_URL`: Supabase Postgres pooled connection string
- `AI_BASE_URL_PRIMARY`: your operator-supplied Anthropic-compatible endpoint. Leave empty to disable remote AI (local fallback narratives still work).
- `AI_BASE_URL_SECONDARY`: optional second endpoint for failover.
- `ALLTICK_STOCK_BASE_URL`: `https://quote.alltick.co/quote-stock-b-api`
- `WECHAT_NOTIFY_URL`: the public HTTPS callback URL, for example `https://brown-zone-web.vercel.app/api/billing/notify`.
- `WECHAT_PRIVATE_KEY`: merchant private key in PEM format. Keep line breaks intact in the Vercel secret value.
- `WECHAT_PLATFORM_PUBLIC_KEY`: WeChat Pay platform public key used for APIv3 callback signature verification.
- `WECHAT_PAY_MOCK_MODE`: use `false` in real production. Use `true` only for classroom/local demo environments where no real charge should happen.
- `WECHAT_PAY_SKIP_NOTIFY_SIGNATURE`: keep `false` in real production. Use `true` only for local mock callback development.

## Pre-Deploy Checks

Run locally before deployment:

```powershell
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
