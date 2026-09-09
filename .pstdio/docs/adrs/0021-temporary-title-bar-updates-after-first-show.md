# Temporarily apply native title bar updates after the first show

## Status

Temporary workaround found while validating PS-60. Remove the ordering restriction
when Electron supports changing the native overlay before the first window paint.

## Ideal design

The desktop should apply the renderer's title bar colors and height before showing
the startup window. Updating those native controls should not prevent the window
from painting or emitting `ready-to-show`.

## External limitation

On Linux with Electron 43.6.0, calling `BrowserWindow.setTitleBarOverlay` while the
startup window is hidden can prevent `ready-to-show` from firing. The lifecycle
document finishes loading, but the window stays hidden and no workbench view is
created. Source Electron tests reproduced this locally and in CI. The active-work
test reached its 30-second limit; disabling the initial overlay update made the
same test pass in two seconds.

The renderer sends its initial appearance as soon as the title bar is mounted.
Electron owns native painting and the readiness event, so the application cannot
repair that event internally. Increasing test timeouts does not resolve the wait.

## Decision and trade-offs

Wait for the window controller's existing first-show promise before applying
native title bar updates. This is a temporary workaround, not the intended design.
The first frame can use Electron's default native control colors. The renderer's
colors and height are applied immediately after the window is shown; later theme
and zoom changes continue to update the overlay normally.

## Isolation

Keep the wait in the desktop window controller, which owns the native window and
its first-show promise. The preload and renderer keep sending the same appearance
data. No extra flags, stored appearance values, or timeout changes are needed.
The active-work Electron test checks native window visibility before waiting for
the workbench, so a stalled first show fails directly.

## Removal

After upgrading Electron, remove the wait and run the source and packaged desktop
suites repeatedly on Linux, including startup with the real themed lifecycle
renderer. If native overlay updates before the first paint no longer stall
startup, remove this temporary ordering restriction and its code comment. Keep
the startup visibility check.
