# Pre-Launch Audit - 2026-05-25

## Stage 5.1 Checklist

| Gate | Result | Evidence |
| --- | --- | --- |
| `globalThis.__brownZoneStore__` absent from `src/app/api/` | PASS | `git grep -n "globalThis.__brownZoneStore__" -- src/app/api/` returned no matches. |
| API routes no longer import `@/lib/store` | PASS | Double-quote and single-quote import greps returned no matches. |
| Request-body routes use zod validation | PASS | Body-reading routes are `ai/chat`, `ai/tutor`, `auth/login`, `auth/register-by-invite`, `sim/actions`, and `teacher/assignments`; all use zod schemas. |
| Route errors use `{ error, message }` shape | PASS | Routes use `apiError`, `handleRouteError`, or explicit `{ error, message }`. |
| `.env.example` matches `.env.local` keys | PASS | Key comparison returned no missing keys and no extra keys; secret values were not printed. |
| README includes Supabase setup | PASS | `README.md` now documents Supabase variables, seed, policy application, and verification commands. |
| Vercel env requirements documented | PASS | `README.md` and `docs/VERCEL-ENV.md` list the required Vercel variables. |
| `AGENTS.md` is accurate | PASS | Updated with current Supabase/Drizzle architecture, subagent contract, demo accounts, redlines, and quality bar. |
| No leaked secrets in committed source files | PASS | Strict secret scan found no actual keys. The broad sample regex can match words such as `KeyAI` and `MoneyText`, so those were treated as false positives rather than leaked credentials. |

## Redline Audit

| Redline | Result | Evidence |
| --- | --- | --- |
| Do not use `git commit -a` | PASS | No commit command was run. |
| Do not use `git add .` | PASS | No staging command was run. |
| Do not commit `.env.local` | PASS | `.env.local` remains ignored and unstaged. |
| AI calls go through `src/lib/ai.ts` | PASS | No raw external `fetch("https://...")` calls were found outside `src/lib/ai.ts`. |

## Verification Pipeline

| Command | Result |
| --- | --- |
| `npm run lint` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run test` | PASS - 10 files / 33 tests |
| `npm run build` | PASS |
| `$env:NODE_ENV='production'; npm run build` | PASS |
| `npx playwright test` | PASS - 3 Chromium smoke tests |
| `python -m code_review_graph build --repo . --skip-flows` | PASS |
| `python -m code_review_graph detect-changes --repo . --base HEAD --brief` | PASS - 0 affected flows, 0 test gaps, risk 0.00 |

## Reviewer Result

Independent read-only reviewer audit result: PASS, blockers: none.

## Remaining Non-Blocking Notes

- Student chart/radar components intentionally retain some visualization palettes; `docs/ui-spec/audit-2026-05-25.md` tracks this as follow-up UI debt.
- Route-level loading/error states for some platform pages are still marked as UI debt, not launch blockers.
