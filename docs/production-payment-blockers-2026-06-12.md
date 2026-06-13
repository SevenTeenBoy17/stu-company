# Production Payment Blockers - 2026-06-12

## Current Status

- Latest production deployment: `https://brown-zone-web.vercel.app`
- Public pages work: `/` returns 200.
- Anonymous billing status works: `/api/billing/status` returns a safe anonymous state.
- Supabase project was restored from `INACTIVE` to `ACTIVE_HEALTHY`.
- Login is no longer blocked by DB: demo student / teacher / parent / admin / guest logins return 200 with the current demo passwords.
- Authenticated pages work: `/student`, `/student/market`, `/student/history`, and `/admin` return 200.
- Real WeChat subscription activation is still not yet verifiable because WeChat merchant variables are not configured in Production.

## Evidence

Supabase connector:

```text
project: brone-web
ref: pdxrgsseoxiliotjzsiu
region: us-east-2
status before restore: INACTIVE
status after restore: ACTIVE_HEALTHY
database host: db.pdxrgsseoxiliotjzsiu.supabase.co
```

Update: the project has been restored and now reports `ACTIVE_HEALTHY`.
If this project becomes inactive again, Vercel production login will fail even
when the application code is correct.

Local environment doctor:

```text
[WARN] DATABASE_URL: postgres://localhost:5433/brownzone ... 线上不能使用 localhost 数据库
[FAIL] DATABASE_CONNECTION: Postgres 无法连接：ECONNREFUSED@::1@5433, ECONNREFUSED@127.0.0.1@5433
[FAIL] WeChat Pay: 缺少真实微信支付变量
[FAIL] WECHAT_NOTIFY_URL: 缺少微信支付回调地址
```

Production smoke:

```text
GET  /                         -> 200
GET  /api/billing/status       -> 200
POST /api/auth/login           -> 200 for current demo credentials
GET  /student                  -> 200
GET  /student/market           -> 200
GET  /student/history          -> 200
GET  /admin                    -> 200
```

Vercel log:

```text
[repo.fallback] fn=authenticateUser reason=query_failed ... host=aws-1-us-east-2.pooler.supabase.com ...
causeCode=XX000 causeMessage=(ENOTFOUND) tenant/user postgres.pdxrgsseoxiliotjzsiu not found
[repo.fallback] fn=authenticateUser retry=direct_supabase ... host=db.pdxrgsseoxiliotjzsiu.supabase.co ...
[repo.fallback] fn=authenticateUser:direct_supabase ... causeCode=ENOTFOUND
causeMessage=getaddrinfo ENOTFOUND db.pdxrgsseoxiliotjzsiu.supabase.co
```

Meaning: the current Supabase project reference / connection information is no
longer resolvable by either the configured pooler host or the derived direct
host. The app code now tries both safely, but this cannot be solved without a
valid Supabase project and connection string.

## Required Fixes Before Real Paid Subscription Can Work

### 1. Replace `DATABASE_URL`

The current local `DATABASE_URL` points to `localhost:5433`, which cannot work in Vercel.
The current production `DATABASE_URL` points at a Supabase project reference that
is not resolvable by the pooler/direct hosts.

Use Supabase:

1. Open Supabase project settings.
2. Go to `Settings -> Database -> Connection string`.
3. Choose `Connection pooling` / `Transaction`.
4. Copy the pooled Postgres URI.
5. Put it in both `.env.local` and Vercel Production env as `DATABASE_URL`.
6. Run:

```powershell
npm run env:doctor
```

Expected:

```text
[PASS] DATABASE_CONNECTION: Postgres 连接成功
```

### 2. Configure WeChat Pay Merchant Variables

Static personal collection QR codes cannot return payment results to the app. Real auto-unlock requires WeChat Pay Native/JSAPI merchant credentials.

Set these in Vercel Production:

```text
WECHAT_MCH_ID=
WECHAT_API_KEY_V3=
WECHAT_APP_ID=
WECHAT_NOTIFY_URL=https://brown-zone-web.vercel.app/api/billing/notify
WECHAT_PRIVATE_KEY=
WECHAT_CERT_SERIAL_NO=
WECHAT_PLATFORM_PUBLIC_KEY=
WECHAT_PAY_MOCK_MODE=false
WECHAT_PAY_SKIP_NOTIFY_SIGNATURE=false
```

Aliases are also supported:

```text
WECHAT_PAY_MCH_ID
WECHAT_PAY_API_V3_KEY
WECHAT_PAY_API_KEY_V3
WECHAT_PAY_APP_ID
WECHAT_PAY_NOTIFY_URL
WECHAT_PAY_PRIVATE_KEY
WECHAT_PAY_CERT_SERIAL_NO
WECHAT_PAY_PLATFORM_PUBLIC_KEY
```

### 3. Redeploy and Verify

After DB and WeChat variables are configured:

```powershell
npm run env:doctor
npm run lint
npx tsc --noEmit
npm run test
npm run build
npx vercel --prod --yes
```

Production verification:

1. Login with a demo account.
2. Open `/pricing`.
3. Create a `standard` Native payment order.
4. Scan the generated WeChat QR code.
5. Confirm WeChat sends `/api/billing/notify`.
6. Confirm `/api/billing/order-status?outTradeNo=...` changes from `pending` to `paid`.
7. Confirm the target user has `subscriptionTier=standard` and can use paid AI assessment features.

## Do Not Work Around This With Memory Fallback

Do not set `ALLOW_MEMORY_FALLBACK=true` for real production subscriptions.

Memory fallback is only for offline classroom demos. A real paid subscription must write to Postgres so the WeChat callback, order polling, user subscription state, and future sessions all see the same result.
