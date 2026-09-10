# Temporarily show the startup window after its document loads

## Status

Temporary workaround for hidden-window painting in Electron 43.6.0 on Linux.
Recheck the native readiness event after upgrading Electron.

## Ideal design

The native window should show after its startup document paints. Electron's
`ready-to-show` event should confirm that the first frame is ready. Only then
should the desktop attach its workbench view and update the native title bar.

## External limitation

Linux CI still intermittently leaves the startup window hidden after the title
bar ordering fix in ADR 0021. A failure with an isolated Electron profile recorded
a completed document load, no paint entries, a visible renderer document, a hidden
native window, and no child views. The native first-paint event never released the
window controller's startup wait within the existing five-second check.

This also happened before profile isolation. Repeating the unchanged CI job could
pass, while 40 isolated local Linux x64 launches did not reproduce the stall.
The renderer and native compositor own hidden painting. The controller cannot
make that event reliable by waiting longer.

## Decision and trade-offs

Show the native window in the local startup document's `did-finish-load` handler,
then resolve the existing first-show promise. Workbench attachment and native title
bar updates still wait for that promise. This lets Chromium paint in a visible
window. This is a temporary workaround, not the intended first-paint ordering.

Initialize lifecycle actions without waiting for animation frames. The lifecycle
renderer remains mounted under the workbench, where occlusion can pause animation
frames. Recovery and quit actions must continue to work in that state.

The first native frame may appear before Chromium composites the startup content.
Waiting for the local document and its assets to load limits that interval. The
packaged readiness checks still measure both native visibility and first contentful
paint; showing an empty window does not satisfy those checks.

## Isolation

Keep the ordering in the desktop window controller. Log the first native `show`
event as desktop window readiness. Keep the existing startup visibility assertion,
record native and renderer state on failure, and check that showing the lifecycle
document resolves only after its window is visible. No timers, retries, extra
flags, or test timeout changes are needed.

## Removal

After upgrading Electron, verify repeated cold starts with the themed lifecycle
renderer on Linux in source and packaged builds. If hidden first painting is
reliable, restore the `ready-to-show` gate and remove this workaround. Preserve
the rule that the lifecycle window is visible before the workbench attaches.
