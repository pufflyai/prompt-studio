# Temporary Zag lifecycle reconciliation after React Activity

Proposed: 2026-11-19

Status: Accepted.

## Intended behavior

Leaving a retained view closes its overlays. React Activity may suspend that view's effects, but resuming must reconcile native overlay machines with their current controlled properties. Document inputs and trigger children keep their identity.

## External limitation

Zag React 1.35.3's `useTrack` skips its first effect call and uses a separate mounted flag to detect subsequent calls. Activity cleanup clears that flag. On reconnection, a property watcher runs before the effect that sets the flag again, so it skips a controlled `open` change made while hidden. The machine can remain open even after the application has committed `open={false}`.

The adapter also snapshots `state.ref.current` when its layout effect mounts rather than when cleanup disconnects it. A machine can reconnect effects for the wrong state after changing state while mounted.

Presence can be stopped before a queued close decision or exit-animation completion is delivered. Its watcher has already observed `present=false`, so reconnection does not retry the decision. A suspended exit can also lose its animation listeners as DOM references are cleared. The native Tickets display popup consequently returns visibly with `data-state="closed"`.

## Decision

Patch Zag's dependency tracker in both module formats to compare current dependency values with the values from its last committed effect. Skip initial registration and unchanged effect replays. Run changed-property watchers when effects reconnect, including changes committed during suspension.

Capture the machine's live state during cleanup so reconnection restores its matching effects. Presence also reconciles its current `present` property on entry/re-entry:

- Skip already-unmounted closed roots, including non-browser renders.
- Recheck the current property before a deferred close can affect a reopened popup.
- Complete an exit whose animations have finished. Re-enter a suspended exit with unfinished animations to reinstall listeners on its current node.
- Use live animation state for a known suspended exit instead of mistaking its recorded exit name for an unchanged enter animation.

View and trigger identity stay intact, and normal DOM cleanup remains unchanged. Build-cache inputs include patch contents so edits to a registered patch invalidate previously compiled bundles.

Reconciliation does nothing when Presence is already unmounted and `present` is false. Initial closed rendering has no exit animation to schedule, including in non-DOM renderers. Mounted or suspended exits still reconcile on reconnection.

View-owned portal containers hide overlays immediately while their content is suspended. A dismissal revision closes application-owned state when that content resumes. These are platform lifecycle ownership; the dependency patches repair Zag’s property and effect reconciliation.

## Limitations

The patches touch the shared React adapter and Presence state machine. They must retain initial-mount and unchanged StrictMode replay behavior. Whole-workbench suspension still preserves unfinished overlay state because it does not advance a view's dismissal revision.

## Removal

Remove the dependency patches when Zag reconciles properties and Presence across Activity effect cleanup and reconnection. Verify controlled and uncontrolled popovers, tooltips, nested activity scopes, hidden status widgets, trigger toggles, keyboard dismissal, and retained workbench draft restoration. Regressions are `packages/canvas-tests/src/ui/pstdio-workbench/overlay-navigation.p1.spec.ts` and the real app journey `packages/e2e/src/ui/overlay-navigation.p1.spec.ts`. The collection case exercises pointer-down close followed by navigation during its exit animation, not only navigation from an open popup.
