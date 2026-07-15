# Onboarding Reduced-Motion QA Update - 2026-06-30

## Scope

- Continued the internal multi-agent QA queue after the KeyAI reduced-motion fix.
- Focused on `src/components/student/onboarding-flow.tsx`.
- Used one read-only explorer sub-agent to independently scan nearby forced-smooth scroll risks while the main agent implemented the focused fix.

## Issue

The onboarding upgrade shortcut completed onboarding and then scrolled to `#guest-upgrade-checkout` with hard-coded smooth scrolling. CSS `prefers-reduced-motion` cannot override JavaScript `scrollIntoView({ behavior: "smooth" })`, so this needed an explicit component-level guard.

## Fix

- Added a local `preferredScrollBehavior()` helper in `onboarding-flow.tsx`.
- Kept smooth scrolling for default users.
- Switched the upgrade shortcut scroll to `behavior: "auto"` when the learner prefers reduced motion.
- Added `src/components/student/onboarding-flow.test.tsx` with two tests:
  - Default users scroll smoothly to the upgrade area.
  - Reduced-motion users scroll instantly to the upgrade area.

## Sub-Agent Review

Explorer result:

- Confirmed onboarding now uses `preferredScrollBehavior()` for the upgrade shortcut scroll.
- Confirmed onboarding GSAP animation already checks `prefers-reduced-motion`.
- Confirmed nearby KeyAI, rank card, and quest dashboard scroll behaviors route through reduced-motion-aware helpers.
- Noted the residual risk was missing onboarding-specific test coverage, which this update adds.

## Verification

```text
npm test -- src/components/student/onboarding-flow.test.tsx
Test Files  1 passed (1)
Tests       2 passed (2)

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

- This is a surgical accessibility patch: one component and one test file.
- No backend, billing, leaderboard, AI, simulation, or task-card logic changed.
- The code keeps the intended upgrade shortcut behavior while respecting learner accessibility preferences.
