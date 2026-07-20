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
- 参赛团队 / 超级管理员 (competition students who are also product users **and** super-admins;
  password `Super001!!!`, seeded only in dev/`SEED_DEMO`; authority is centralized in
  `src/lib/auth-roles.ts` and env-extendable via `SUPERADMIN_EMAILS`):
  - 白杨晋美 `baiyangjinmei@brownzone.ai`
  - 罗布朗 `luobulang@brownzone.ai`
  - 刘煜柯 `liuyuke@brownzone.ai`
  - 张珺湘 `zhangjunxiang@brownzone.ai`
  - plus the built-in `superadmin`

## 2. Architecture Truth

| Area | Current State | Notes |
| --- | --- | --- |
| Persistence | Supabase Postgres through Drizzle ORM | `src/lib/db/repo.ts` is the API-facing repository layer. |
| Seed data | `npm run db:seed` | Seeds users, profiles, invites, assignments, scenario runs, and reports. |
| RLS policies | `drizzle/policies.sql` + `npm run db:apply-policies` | Only effective when `DATABASE_ROLE=authenticated` AND queries run through `withRls()` in `src/lib/db/client.ts`. Default `owner` connection bypasses RLS — `repo.ts` application-layer checks are the primary defence. |
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
| `education_narrative_designer` | `src/lib/market-data.ts`, `src/lib/content.ts`, `src/lib/simulation.ts`, `docs/curriculum-*` | API routes, components, db, auth |
| `monetization_wechat_engineer` | `src/app/api/billing/**`, `src/app/api/wechat/**`, `src/lib/billing/**`, `drizzle/billing-*` | Educational API routes, components, public schema |
| `teen_ux_specialist` | `src/components/student/**`, `src/components/shared/**`, `docs/ui-spec/gamification-*` | API routes, db, auth, AI gateway |
| `finance_event_simulator` | `src/lib/market-data.ts`, `src/lib/simulation.ts`, `scripts/simulate-*` | API routes, components, db schema |
| `behavior_ai_analyst` | `src/lib/ai.ts`, `src/lib/tutor-radar.ts`, `src/lib/history-review.ts`, `src/app/api/ai/**` | Components, db schema, auth, payment |

Red lines:

- Do not use `git commit -a`; inspect `git diff` first.
- Do not commit `.env.local`.
- Do not use `git add .`; stage explicit paths only when the user asks for a commit.
- Do not fetch AI providers directly outside `src/lib/ai.ts`.

## Definition of Done (强制)

- "完成" means the named acceptance commands are green and all `git grep` gates pass; do not accept "应该可以" or "稍后处理".
- Every task must append the real command output to `progress.md`, including tests, grep gates, build output, and failure text when a gate fails.
- Do not mark work complete with `TODO`, `FIXME`, placeholder implementations, or edits outside the prompt's declared allowed scope.
- Any write-path change must be verified once while `npm run db:up` is healthy and once through the stopped-DB failure path.

## 3.1 Agency Agents Stage Routing

This repository also installs the full `agency-agents-zh` Codex agent set under `.codex/agents/`. Use those agents as a specialist pool, but keep Brown Zone custom agents as the first-choice owners when their scope matches.

Stage routing:

- Product and requirement shaping: `product-manager` or `product-sprint-prioritizer`; review with `testing-reality-checker`.
- UI implementation: `engineering-frontend-developer` or `ui_implementer`; review with `design-ui-designer` plus `testing-accessibility-auditor`.
- API and auth implementation: `engineering-backend-architect` or `api_wirer`; review with `engineering-code-reviewer`.
- Payment and subscription implementation: `monetization_wechat_engineer` first, then `engineering-wechat-mini-program-developer` when WeChat-specific behavior is needed; review with `compliance-auditor` or `support-legal-compliance-checker`.
- Database work: `db_architect`; review with `engineering-database-optimizer`.
- Test work: `qa_engineer`, `testing-api-tester`, or `testing-test-results-analyzer`; review with `reviewer`.
- Final release audit: `reviewer`, `engineering-code-reviewer`, and `testing-reality-checker`.

Stage rule:

- The agent that implements a stage and the agent that reviews it must come from different responsibility groups.
- Every stage must end with a visible verdict: `APPROVE`, `REQUEST_CHANGES`, or `NEEDS_DISCUSSION`.
- If an Agency agent conflicts with this file, `AGENTS.md`, `CODEX-WORKFLOW.md`, and the active user request win.

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
