# Temporarily forward title-bar geometry to the workbench view

## Status

Temporary workaround for Electron 43.6.0. Remove after upgrading to a stable
Electron release containing electron/electron#53639.

## Ideal design

Electron supplies Window Controls Overlay CSS environment values to every view
intersecting the title bar. The shared title-bar recipe uses those values to keep
project tabs and the project picker clear of native controls.

## External limitation

Electron 43.6.0 supplies these values only to BrowserWindow.webContents. The
workbench is a child WebContentsView so it receives no safe area. A real Electron
test reproduces content extending across the full window width under the controls.
The upstream fix merged on September 10, 2026, but is not in a stable release:
https://github.com/electron/electron/pull/53639.

## Decision and trade-offs

Return the primary view's overlay rectangle when applying native title-bar
appearance. The preload translates its device-independent dimensions for the
workbench zoom and exposes two CSS custom properties. The shared recipe uses
them only as fallbacks when native environment values are unavailable.
Clear the fallback when the native overlay is hidden, including in full screen.

This is a temporary workaround, not the intended design. It adds one geometry
read to appearance updates. The existing resize/theme observer updates the
geometry after window resizing and zooming. No persistent geometry is stored.

## Isolation and removal

Keep the bridge in the desktop window controller and preload. The only UI change
is the recipe's environment fallback. After an Electron upgrade containing the
upstream fix, remove the geometry return, preload properties, and recipe fallback.
Keep the native geometry regression checks.
