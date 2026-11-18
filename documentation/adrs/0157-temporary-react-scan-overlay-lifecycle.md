# Temporary React Scan highlight lifecycle adapter

Proposed: 2026-11-17

Status: Accepted

## External limitation

React Scan 0.5.3 exports a scanner with one lifetime per document. Pausing leaves commit traversal, frame-rate sampling and periodic outline and report flushes active. Its toolbar also installs interaction tracking. Version 0.5.7 still has no disposable visual scanner. Its separate Lite entry provides capture events without visual outlines.

## Decision

Install only the renderer hook before React starts. A local highlight request loads React Scan and subscribes to commits through Bippy's disposable instrumentation API. A version-pinned patch gives the dashboard a narrow interface to React Scan's rendered-component traversal, outline collection and canvas painter. Each session owns its canvas, pending outlines and animation frame. Ending the session unsubscribes before removing the canvas and cancelling drawing. Closing the requesting view while the module loads cancels that start.

This entry never starts React Scan's toolbar, FPS loop, worker, reports or persistent options. Stored scanner settings cannot activate it. Extensions control the window-local switch through the existing permission-checked performance bridge.

## Limitations

The React renderer retains its small early hook. The browser caches code loaded on first use for the lifetime of the window. Highlighting measures visible element bounds and paints component outlines while active. Production component names can be shortened.

## Removal

Replace the patch and session adapter when upstream publishes a disposable outline-only entry. Keep production checks for initial loading, visible highlights, and releasing all active work on disable.
