# Deployment Checklist - 2026-05-25

## Vercel Project

- Target project: `brown-zone-web`
- `vercel.json` only declares the Next.js framework.
- Secrets must be configured in Vercel Dashboard, not in `vercel.json`.

## Required Vercel Environment Variables

Configure the following for Production and Preview:

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

## Local Production Build Check

Passed:

```powershell
$env:NODE_ENV='production'
npm run build
```

## Recommended Deploy Options

Manual production deploy:

```powershell
vercel --prod
```

Git-based deploy:

1. Push the reviewed source to the connected GitHub repository.
2. Confirm Vercel receives the commit and starts a production deployment.
3. Verify the production URL after build completion.

## Post-Deploy Smoke Test

Open these routes on the deployed URL:

- `/`
- `/learn`
- `/demo`
- `/student`
- `/student/market`
- `/student/history`
- `/teacher`
- `/parent`
- `/admin`

Then confirm:

- Public pages render.
- Login and role guards behave as expected.
- `/api/market/ticker-tape` returns a non-empty payload.
- AI features degrade gracefully if the remote gateway is unavailable.
- No `.env.local` values appear in client source or page HTML.
