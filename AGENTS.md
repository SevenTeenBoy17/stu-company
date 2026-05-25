# Brown Zone Agent Operating Manual

Any coding agent entering this repository must read this file before editing.

## 1. Project Identity

- Internal brand: **Brown Zone / 幕后之手**
- Product name: **Mr.Brown AI 经济沙盘**
- Roles: `student / teacher / parent / admin`
- Core loop: 12-round economic sandbox -> trade / bank / property / venture actions -> AI review -> teacher and parent reports
- Demo password: `BrownZone2026!`
- Demo accounts:
  - `teacher@brownzone.ai`
  - `student@brownzone.ai`, `student2@brownzone.ai`, `student3@brownzone.ai`
  - `parent@brownzone.ai`
  - `admin@brownzone.ai`
- Demo invite codes: `MRB-STUDENT-2026`, `MRB-PARENT-2026`, `MRB-TEACHER-2026`

## 2. Architecture Truth

| Area | Current State | Notes |
| --- | --- | --- |
| Persistence | Supabase Postgres through Drizzle ORM | `src/lib/db/repo.ts` is the API-facing repository layer. |
| Seed data | `npm run db:seed` | Seeds users, profiles, invites, assignments, scenario runs, and reports. |
| RLS policies | `drizzle/policies.sql` + `npm run db:apply-policies` | Keep policy changes reviewed before applying. |
| Auth | HTTP-only `brown_zone_session` JWT cookie | Claims include user id, role, and classroom id where available. |
| AI gateway | `src/lib/ai.ts` only | Raw provider fetches outside this module are blockers. |
| Market data | AllTick with local teaching fallback | Market refresh cadence is 10 minutes. |
| UI system | Tailwind v4 tokens in `src/app/globals.css` | Token spec lives in `docs/ui-spec/01-tokens.md`. |

## 3. Subagent Contract

Use subagents only for bounded work. Always state the exact write scope and forbidden scope.

| Agent | Owns | Must Not Touch |
| --- | --- | --- |
| `db_architect` | `src/lib/db/**`, `drizzle/**`, `scripts/seed*.ts`, `scripts/db-*.ts` | API routes, components |
| `api_wirer` | `src/app/api/**` | schema, components, db client |
| `ui_implementer` | `src/components/**`, `src/app/**/page.tsx`, `src/app/globals.css` | API routes, db, auth, AI |
| `qa_engineer` | `tests/**`, `*.test.ts`, verification docs | Feature code unless explicitly approved |
| `reviewer` | Read-only repository audit | Any write operation |

Red lines:

- Do not use `git commit -a`; inspect `git diff` first.
- Do not commit `.env.local`.
- Do not use `git add .`; stage explicit paths only when the user asks for a commit.
- Do not fetch AI providers directly outside `src/lib/ai.ts`.

## 4. House Style

- Prefer absolute imports through `@/*`.
- Default to Server Components; add `"use client"` only when browser APIs, state, or effects are required.
- Route errors use stable shape: `{ error: <stable_code>, message: <中文提示> }`.
- User-facing errors should be concise Simplified Chinese.
- Validate external boundaries with zod: request bodies, env, and third-party API responses.
- Tests should avoid `any` outside test scaffolding.
- Financial color convention: red means up / positive market move; green means down / negative market move.
- Money and market numbers should use tabular figures where practical.

## 5. Quality Bar

Run before pre-launch or handoff:

```powershell
npm run lint
npx tsc --noEmit
npm run test
npm run build
npx playwright test
```

Manual smoke target:

- `/`
- `/learn`
- `/demo`
- `/student`
- `/student/market`
- `/student/history`
- `/teacher`
- `/parent`
- `/admin`

## 6. Secrets

- `.env.local` is local only and must remain untracked.
- `.env.example` contains key names and safe sample endpoints only.
- Real secrets belong in local `.env.local`, Vercel encrypted environment variables, or Supabase Dashboard.
- Required env list is documented in `.env.example`, `README.md`, and `docs/VERCEL-ENV.md`.

## 7. Reference Docs

- `CODEX-WORKFLOW.md`: staged migration and implementation playbook
- `docs/ENV-CHECKLIST.md`: environment setup checklist
- `docs/ui-spec/01-tokens.md`: design token source of truth
- `docs/ui-spec/02-student-dashboard.md`: student dashboard spec
- `docs/ui-spec/03-student-market.md`: student market spec
- `docs/ui-spec/audit-2026-05-25.md`: latest Stage 4 UI audit

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may differ from older training data. Read relevant local Next.js docs in `node_modules/next/dist/docs/` before writing framework-sensitive code.
<!-- END:nextjs-agent-rules -->
