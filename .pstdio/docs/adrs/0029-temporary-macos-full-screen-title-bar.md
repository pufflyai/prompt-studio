# Temporarily reset macOS window button placement in full screen

## Status

Revised candidate for PS-375, pending native user validation. The user confirmed
that hiding the native title-bar container restored upper-edge tab clicks, but
also reported missing native buttons and title when revealing the full-screen
header. That first workaround is rejected.

## Ideal design

Project tabs receive clicks across their visible bounds. macOS owns the native
full-screen header, including its title, traffic lights, and reveal animation.
Custom windowed button placement must not affect that header's hit area.

## External limitation

Electron's macOS window button proxy applies custom margins by resizing the
entire native title-bar container. Our windowed position uses a vertical margin
of 15 points. [Electron's implementation](https://github.com/electron/electron/blob/v43.6.0/shell/browser/ui/cocoa/window_buttons_proxy.mm)
derives the container height from the button height plus twice this margin.
It does not expose separate windowed and full-screen positions.

The user's successful click test with the container hidden points to that native
layer. Custom geometry persisting into full screen is the next candidate cause,
not a confirmed diagnosis. Renderer CSS cannot control this AppKit container.

## Decision and trade-offs

Reset the custom button position to macOS's default after entering full screen.
Restore the configured windowed position after leaving full screen. Use
Electron's documented `setWindowButtonPosition(null)` operation. Leave button
visibility and title visibility to Electron and AppKit.

This is a temporary workaround for the native geometry interaction, not the
intended long-term design. It preserves the system header and removes the need
to hide its controls or replace them with custom buttons. Full-screen and
windowed controls intentionally use different placement owners. No preference,
hover polling, or duplicate full-screen state is added.

## Isolation

Keep this operation in `DesktopWindowController` beside the existing native
full-screen event handling. Share the windowed position with window creation.
Other platforms retain their existing behavior.

## Validation and removal

Run the Electron scenario for native full-screen entry, system button placement,
renderer reload, menu exit, and restored windowed placement. Run repository
validation. Chromium clicks alone cannot prove native mouse hit testing.

Ask the user to enter full screen with the green button, compare the top and
bottom of both project tabs, reveal the macOS header and inspect its buttons and
title, then open Help and repeat the tab checks. Exit using the revealed green
button and confirm normal button placement returns. Keep the PR a draft until
both tabs and native header pass. Remove this candidate if either still fails.

Remove the placement reset when Electron handles the transition from custom
windowed geometry to native full-screen geometry correctly. Repeat the same
native mouse and header checks before removing it.
