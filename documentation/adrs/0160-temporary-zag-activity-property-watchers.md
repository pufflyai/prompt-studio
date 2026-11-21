# Temporary Zag property watcher reconciliation after React Activity

Proposed: 2026-11-19

Status: Accepted.

## Intended behavior

Leaving a retained view closes its overlays. React Activity may suspend that view's effects, but resuming must reconcile native overlay machines with their current controlled properties. Document inputs and trigger children keep their identity.

## External limitation

Zag React 1.35.3's `useTrack` skips its first effect call and uses a separate mounted flag to detect subsequent calls. Activity cleanup clears that flag. On reconnection, a property watcher runs before the effect that sets the flag again, so it skips a controlled `open` change made while hidden. The machine can remain open even after the application has committed `open={false}`.

The same adapter snapshots `state.ref.current` when its layout effect mounts rather than when cleanup disconnects it. A machine that changes state before Activity hides it can reconnect effects for the wrong state. Presence is exposed when a collection closes on pointer-down before click navigation: it suspends an exit animation but reconnects without the matching animation listeners. The native Tickets display menu then renders visibly with `data-state="closed"`. The Presence watcher can acknowledge `present=false` and queue its animation decision before navigation suspends it. That deferred transition is then dropped while the machine is stopped. On reconnect, the unchanged property does not trigger the watcher again, leaving Presence mounted even though the popup reports closed.

## Decision

Patch Zag's dependency tracker in both module formats to compare current dependency values with the values from its last committed effect. Skip initial registration and unchanged effect replays. Run changed-property watchers when effects reconnect, including changes committed during suspension.

Capture the machine’s live state during cleanup so reconnection restores effects for the preserved state, including Presence exit listeners. Presence also reconciles its current `present` property on machine entry, including reconnection. This replays a deferred visibility decision that Activity may have interrupted. Deferred close decisions recheck the current property so they cannot hide a popup that has since reopened. These repairs do not remount documents, retain disconnected DOM, or override styling.

View-owned portal containers hide overlays immediately while their content is suspended. A dismissal revision closes application-owned state when that content resumes. These are platform lifecycle ownership; the dependency patches repair Zag’s property and effect reconciliation.

## Limitations

The patches touch the shared React adapter and Presence cleanup. It must retain initial-mount and unchanged StrictMode replay behavior. Whole-workbench suspension still preserves unfinished overlay state because it does not advance a view's dismissal revision.

## Removal

Remove the patch when Zag reconciles property changes across Activity effect cleanup and reconnection. Verify controlled and uncontrolled popovers, tooltips, nested activity scopes, hidden status widgets, trigger toggles, keyboard dismissal, and retained workbench draft restoration. Regressions are `packages/canvas-tests/src/ui/pstdio-workbench/overlay-navigation.p1.spec.ts` and the real app journey `packages/e2e/src/ui/overlay-navigation.p1.spec.ts`. The collection case exercises pointer-down close followed by navigation during its exit animation, not only navigation from an open popup.
