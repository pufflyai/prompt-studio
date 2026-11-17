# Temporary React Scan overlay lifecycle adapter

Proposed: 2026-11-17

## Ideal design

React Scan should expose a supported start, pause, and dispose API. Disabling the Performance tool should stop scanning and immediately hide its overlay without changing global browser APIs.

## External limitation

The pinned React Scan 0.5.3 package exposes scan and setOptions, but no overlay disposal API. Its canvas, timers, and early DevTools hook remain installed after pausing. Even showToolbar:false installs interaction timing observers, which can collect component details while render highlighting is paused. Its options also read a saved enabled value that can override the caller's choice. The production entry bundles a separate library instance from the main entry.

## Decision

Pin 0.5.3. Later releases add an external version check that is unnecessary for local highlighting. The selected published bundle has no fetch calls. Its canvas worker uses blob URLs already allowed by the desktop policy; no policy relaxation is needed.

Use one main-entry instance with the documented production option. Import it before React. Clear only its saved options before applying the host's local choice. Start instrumentation once; subsequent toggles use setOptions. Immediately invoke the pinned library's window.reactScanCleanupListeners callback to remove its auxiliary interaction observers and notification canvas. Repeat this cleanup when its deferred setup inserts an overlay host. The library exposes no supported equivalent; this version-specific callback stays isolated in the bootstrap. Only render highlighting remains active.

Hide the library's data-react-scan overlay host while paused, and restore that same host when enabled. Do not remove and recreate its render canvas or patch global timers. No toolbar or inspector is enabled. The auxiliary cleanup prevents subsequent interactions from collecting component details for its hidden toolbar.

## Limitations

The early hook and the library's idle infrastructure remain until the window closes. Disabled does not mean zero overhead. The overlay host selector belongs to the pinned dependency and needs packaged browser coverage when that dependency changes.

## Isolation

Only the dashboard React Scan integration knows the saved-options key, overlay selector, and upstream cleanup callback. Extensions use the public performance control API. No application payloads, fibers, or component state enter diagnostics.

## Removal

When React Scan provides supported nonpersistent options, highlighting without interaction tracking, and overlay disposal, replace the storage reconciliation, upstream cleanup callback, and host visibility handling with those APIs. Keep the default-off, repeated-toggle, interaction-cleanup, and packaged overlay checks.
