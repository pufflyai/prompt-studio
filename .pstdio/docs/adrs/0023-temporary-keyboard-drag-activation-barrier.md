# Temporary keyboard drag activation barrier

## Intended behavior

Once a sortable tab announces that a keyboard drag started, it must accept the next arrow key. Browser tests should be able to use that visible state as readiness.

## External limit

The installed dnd-kit KeyboardSensor publishes drag state before attaching its document keydown listener. It attaches the listener in a later timer task. The public sensor API has no readiness signal and its attachment methods are private.

A browser probe reproduced the macOS CI failure on Linux: Space arrived at 463.7 ms, ArrowRight at 471.6 ms, and the listener attached at 480.4 ms. The tab already had aria-pressed=true and announced its starting target. The arrow key was lost. See the PS-74 CI reliability report for the trace and probe output.

Changing the shared drag implementation only to synchronize automated input would require replacing or patching third-party sensor internals. The current public API cannot expose the missing readiness transition cleanly.

## Temporary workaround

After Space starts a keyboard drag, the desktop test helper waits for a browser timer task before sending another key. The library's already queued attachment task runs first. This is an event-loop barrier, with no fixed sleep, timeout increase, or repeated action. Existing assertions still check activation, target changes, cancellation, final order, and persistence.

The barrier stays in the packaged desktop test helper. It does not alter product behavior. It adds one browser round trip per keyboard drag and cannot test keys sent before the library attaches its listener.

## Removal

Remove the barrier when dnd-kit attaches keyboard listeners before publishing activation or provides a supported readiness signal. Repeat rapid Space/Arrow input in the Window Tabs story and the packaged project-tab journey on Linux and macOS before removing it.
