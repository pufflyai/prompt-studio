# Temporarily hide the native macOS title bar in full screen

## Status

Candidate temporary workaround for PS-375. User validation of upper-edge project
tab clicks is pending. Do not treat the reported bug as fixed until that passes.

## Ideal design

The project tabs should receive clicks across their visible bounds in every
window mode. Native window controls should remain available without an invisible
native title bar covering the custom controls.

## External limitation

[Electron issue 41065](https://github.com/electron/electron/issues/41065) describes
the native macOS title bar covering a custom title bar in full screen. Electron
does not expose a separate option for removing that native container while
keeping its window controls. Renderer CSS cannot control that AppKit view.

The user reports that the upper part of project tabs fails while the lower part
works and asks to test after pressing the green window button. This is consistent
with the upstream issue, but the cause has not been confirmed locally. Chromium
input passes at both edges because it bypasses native hit testing. Native computer
automation is currently unavailable.

## Decision and trade-offs

On macOS, hide the native window buttons and their title-bar container after
entering full screen. Restore them after leaving full screen. Electron's
`setWindowButtonVisibility` controls both the buttons and their container.

This is a temporary workaround, not the intended design. In full screen the
traffic lights are unavailable, including on hover. The existing View menu and
Control-Command-F shortcut still exit full screen. Windowed and maximized windows
keep their native controls. No user preference or duplicate full-screen state is
added.

## Isolation

Keep the native visibility change in `DesktopWindowController`, beside its
existing full-screen event handling. Derive visibility from the native window's
current state before notifying either renderer. Other platforms keep their
existing behavior.

## Validation and removal

Run the desktop Electron tests for full-screen entry, renderer reload, exit,
viewport resizing, and native menu actions. Run repository validation. These
checks do not prove native mouse hit testing.

Ask the user to try the candidate with two project tabs: press the green button,
click the top and bottom of each tab, open Help and repeat, then exit full screen
with Control-Command-F and confirm the native buttons return. Keep this PR a draft
until the click behavior is confirmed. Revert this candidate if it does not fix
the reported interaction.

When Electron provides native controls without the overlapping title-bar
container, remove this visibility change and repeat the same native mouse checks.
