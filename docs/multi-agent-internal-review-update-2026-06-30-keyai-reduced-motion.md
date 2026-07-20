# KeyAI Reduced-Motion QA Update - 2026-06-30

## Scope

- Reviewed the shared `GlobalAiAssistant` chat drawer after the market-chart accessibility pass.
- Focused only on the latest-message auto-scroll behavior inside KeyAI.
- Did not change the chat UI layout, AI API contract, storage model, or task-center surfaces.

## Issue

KeyAI always used smooth scrolling when the drawer opened or new messages arrived. That is visually pleasant for most users, but it ignores the operating-system/browser `prefers-reduced-motion: reduce` accessibility preference.

## Fix

- Added a local `preferredScrollBehavior()` helper in `src/components/shared/global-ai-assistant.tsx`.
- Default users still get `behavior: "smooth"`.
- Reduced-motion users now get `behavior: "auto"` for instant scrolling.
- Added component tests that send a real chat message and assert both branches.

## Verification

```text
npm test -- src/components/shared/global-ai-assistant.test.tsx
Test Files  1 passed (1)
Tests       13 passed (13)

npx tsc --noEmit --pretty false
PASS

npm run lint
PASS

npm run build
PASS

python -m code_review_graph update
PASS

python -m code_review_graph detect-changes --brief --base HEAD
Overall risk score: 0.00
```

## Review Notes

- This is a surgical accessibility patch: two source files changed.
- No raw AI provider calls were introduced.
- No backend, billing, leaderboard, task, market, or simulation logic changed.
- The first test attempt incorrectly asserted scroll on an empty panel; the corrected tests now trigger the realistic message-send path where the message-end ref exists.
