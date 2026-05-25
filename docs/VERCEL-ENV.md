# Vercel Environment Checklist

`vercel.json` intentionally only declares the Next.js framework:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs"
}
```

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

## Suggested Production Values

- `APP_URL`: the final Vercel production URL, for example `https://brown-zone-web.vercel.app`
- `SESSION_SECRET`: a long random string, at least 32 characters
- `DATABASE_URL`: Supabase Postgres pooled connection string
- `AI_BASE_URL_PRIMARY`: `https://gpt-agent.cc/v1`
- `AI_BASE_URL_SECONDARY`: `https://gpt-agent.cc`
- `ALLTICK_STOCK_BASE_URL`: `https://quote.alltick.co/quote-stock-b-api`

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
