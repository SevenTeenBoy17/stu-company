# Brown Zone GSAP Motion System

## Scope

Brown Zone now uses GSAP as the single animation runtime for app-wide motion. The global entry is:

- `src/components/shared/premium-motion-provider.tsx`
- `src/lib/motion-system.ts`

`framer-motion` has been removed from runtime dependencies. New animation work should use either the global data-attribute contract below or a scoped `useGSAP` timeline for stateful visualizations.

## Global Data Attributes

- `data-motion-reveal`: viewport reveal for sections and content groups.
- `data-motion-card`: hover lift for cards and large clickable surfaces.
- `data-motion-button`: hover/press response for buttons and chips.
- `data-motion-depth`: pointer-following 3D tilt for hero/stage surfaces.
- `data-motion-float`: ambient yoyo float for decorative elements.
- `data-motion-shine`: repeated soft highlight sweep for decorative beams.
- `data-motion-number`: animated numeric counter.
- `data-motion-bar`: transform-based progress/bar fill.
- `data-motion-draw`: SVG path draw animation.
- `data-motion-reward`: one-shot reward pulse for claimable actions.
- `data-motion-overlay`: fade-in overlay for modal/drawer backgrounds.
- `data-motion-modal`: modal entrance.
- `data-motion-drawer`: drawer/panel entrance.
- `data-motion-scene`: ScrollTrigger scene container for editorial/story sections.
- `data-motion-scene-item`: staged child inside a scene timeline.
- `data-motion-parallax`: scroll-linked depth layer. Value is the y-distance in px.
- `data-motion-viz`: data visualization group animated when it enters view.
- `data-motion-viz-bar`: transform-based chart bar reveal inside a visualization group.
- `data-motion-viz-path`: SVG path draw inside a visualization group.
- `data-motion-viz-point`: SVG point/pop reveal inside a visualization group.

Optional attributes:

- `data-motion-delay`: numeric delay in seconds.
- `data-motion-side`: `right`, `left`, `bottom`, or `none` for drawer direction.
- `data-motion-scrub`: numeric ScrollTrigger scrub value for parallax layers.
- `data-motion-value`: numeric value for counters.
- `data-motion-prefix`: prefix for counters, such as `¥` or `#`.
- `data-motion-suffix`: suffix for counters.
- `data-motion-format`: `currency`, `integer`, `percent`, or `plain`.
- `data-motion-origin`: transform origin for bars, defaults to `left center`.

## Scroll Storytelling Rule

Use `data-motion-scene` when a section needs a deliberately choreographed reading path,
not just a generic entrance. Put `data-motion-scene-item` on the few important child
blocks that should appear in sequence. Avoid applying both ordinary reveal and scene-item
motion to the same element; choose one owner so the section does not flicker or feel
over-animated.

For first-paint hero content, prefer ordinary `data-motion-reveal` plus optional
`data-motion-depth` / `data-motion-parallax`. Do not hide the entire initial hero behind
a scroll scene, because the first viewport must be readable even if ScrollTrigger refresh
is delayed by images, fonts, or browser startup.

Use `data-motion-parallax` only for spatial orientation or depth, such as hero stage art
and product-world layers. Keep distances small (`8-24px`) and always provide stable
static layout before animation starts.

## Data Visualization Motion Rule

Use `data-motion-viz` for chart containers where motion carries analytical meaning:

- `data-motion-viz-path` draws trend lines so users perceive direction over time.
- `data-motion-viz-point` pops key observations after the line is established.
- `data-motion-viz-bar` reveals magnitude through scale, not layout width changes.

Do not use motion as a substitute for labels, legends, or readable static values. On
`prefers-reduced-motion`, charts must render immediately in their final readable state.

## Local `useGSAP` Rule

Use local `useGSAP` only when an animation depends on component state and must rerun without a route change, for example:

- market K-line and trend drawing
- onboarding step transitions
- dashboard-specific chart choreography

Local GSAP must:

- pass a component `scope`
- include dependencies when state changes should replay animation
- set `revertOnUpdate: true`
- respect `prefers-reduced-motion`
- animate transform/opacity instead of layout properties wherever possible

## Verification Checklist

Before shipping motion changes:

- `Select-String` confirms no `framer-motion`, `AnimatePresence`, `<motion`, or `</motion` in `src`.
- `npx tsc --noEmit --pretty false`
- `npm run lint -- --max-warnings=0`
- `npm run test -- src/lib/motion-system.test.ts`
- `npm run build`
- Playwright smoke verifies `/`, `/demo?auth=login`, `/student`, `/student/market`, `/student/history`, and onboarding if available.
