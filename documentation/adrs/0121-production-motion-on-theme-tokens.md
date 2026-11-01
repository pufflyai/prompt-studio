# Use CSS transitions on theme tokens for production motion

Proposed: 2026-10-11

Status: Accepted for PS-620. The streaming decision is recorded in Planner request `d587c90b-e186-4166-96a0-4e6d7e48e36d`.

## Context

Motion Lab studies define how the app should move. They render in UI Canvas through project-owned canvas files, and the timings live in `design/motion/kit`. The Motion Lab guide (`design/motion/README.md`) says production UI and the host do not depend on Motion Lab or Remotion. Production has no motion system today: no tokens, no animation library, and no reduced motion handling.

Each motion in PS-620 needs four things:

- the study's timing and curve
- reversal from the current state
- a reduced motion form
- no extra work once the motion ends

## Decision

- Production motion uses CSS transitions, defined in `@pstdio/ui` recipes, with duration and easing tokens in `packages/ui/src/theme`. Newly appended text uses a one-time opacity keyframe because it has no prior rendered value to transition from.
- No JavaScript animation library is added.
- The theme owns the adopted values. Motion Lab proposes values. After a review decision, they move into the theme, and the kit reads the released theme values instead of keeping a copy.
- Each animated recipe declares its reduced motion form with `_motionReduce`. Spatial motion becomes instant. Opacity stays only where a study says so.
- Components that must stay mounted while hidden (panels, the floating Side Panel) finish their exit before CSS visibility becomes hidden. Split panels clip their fixed-size contents as their footprint shrinks to zero; their separator loses its footprint at the end. This uses the same CSS in Chromium, Firefox, and WebKit. It does not depend on discrete `display` transitions, which Firefox does not animate. Closed content becomes inert immediately so keyboard focus cannot enter an exiting panel. Tree children remain mounted in clipped reveal containers.

## Consequences

- CSS transitions continue from their current value when reversed, which matches the studies' `track` behavior with no extra code.
- Transitions stop when they finish. Nothing keeps running for the idle renderer benchmarks to catch.
- Motion stays in the design system, so extensions that use `@pstdio/ui` components get the same motion.
- Read-only Markdown uses the existing Lexical renderer with node reconciliation. Unchanged blocks and earlier text chunks keep their keys and DOM. Only appended chunks get a new span and fade. Unfinished Markdown can change its meaning; only that affected structure is reconciled. Code highlighting runs when streaming finishes. No separate streaming renderer is added.
- Browsers without a CSS feature in use fall back to instant changes.

## Alternatives considered

- `motion` (Framer Motion). It handles presence and layout animation, but it adds a runtime dependency and a second styling path next to Chakra recipes. It also keeps work in JavaScript on every frame.
- Chakra keyframe animations through `Presence`. They support exit animations, but a keyframe restarts when reversed instead of continuing from the current value.
