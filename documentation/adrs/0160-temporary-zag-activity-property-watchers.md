# Temporary Zag property watcher reconciliation after React Activity

Proposed: 2026-11-19

Status: Accepted.

## Intended behavior

Leaving a retained view closes its overlays. React Activity may suspend that view's effects, but resuming must reconcile native overlay machines with their current controlled properties. Document inputs and trigger children keep their identity.

## External limitation

Zag React 1.35.3's `useTrack` skips its first effect call and uses a separate mounted flag to detect subsequent calls. Activity cleanup clears that flag. On reconnection, a property watcher runs before the effect that sets the flag again, so it skips a controlled `open` change made while hidden. The machine can remain open even after the application has committed `open={false}`.

## Decision

Patch Zag's dependency tracker in both module formats to compare current dependency values with the values from its last committed effect. Skip initial registration and unchanged effect replays. Run changed-property watchers when effects reconnect, including changes committed during suspension.

View-owned portal containers hide overlays immediately while their content is suspended. A dismissal revision closes application-owned state when that content resumes. These are platform lifecycle ownership; the dependency patch only repairs Zag's property reconciliation.

## Limitations

The patch touches a shared dependency hook. It must retain initial-mount and unchanged StrictMode replay behavior. Whole-workbench suspension still preserves unfinished overlay state because it does not advance a view's dismissal revision.

## Removal

Remove the patch when Zag reconciles property changes across Activity effect cleanup and reconnection. Verify controlled and uncontrolled popovers, tooltips, nested activity scopes, hidden status widgets, trigger toggles, keyboard dismissal, and retained workbench draft restoration. The regression is `packages/canvas-tests/src/ui/pstdio-workbench/overlay-navigation.p1.spec.ts`.
