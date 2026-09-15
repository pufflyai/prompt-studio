# Temporarily filter misplaced stationary mouse events on macOS

## Status

Accepted temporary workaround for PS-375. The user confirms that the final filter
restores DELL tab clicks, preserves dragging, and keeps the revealed native
header's buttons and title. The earlier title-bar visibility and placement
candidates are rejected.

## Ideal design

The desktop delivers mouse coordinates that describe the real pointer. Clicking
a project tab selects it. Dragging reorders tabs. macOS owns the full-screen
header, its controls, title, and reveal animation.

## External limitation

With Electron 43.6.0 and Chromium 150.0.7871.250, a stationary click on the upper
tab area can generate a misplaced pointer move. The recorded press and release
were both at `(204.391, 23.035)`, but a move between them reported
`(400.391, 1005.035)`. The added `(196, 982)` corresponds to the display layout:
the DELL starts at x=-196, and the built-in display is 982 points high. The
standard native window frame has the same failure.

That move starts dnd-kit's drag sensor, whose normal click suppression prevents
project selection. Hiding or repositioning native window controls does not fix
the input contract and can damage the revealed macOS header.

The conversion happens below the renderer. Changing dnd-kit thresholds would
hide an invalid native event and change valid drag behavior. We cannot patch
the distributed Chromium native code in this TypeScript application.

## Decision and trade-offs

Use Electron's `before-mouse-event` hook for macOS full-screen workbench input.
Reject a left-button mouse move only when its native movement deltas are both
zero and its screen position matches the observed wrong coordinate conversion.
For a full-screen window at `(wx, wy)` with height `h`, primary screen height
`p`, and actual cursor `(cx, cy)`, that misplaced screen position is
`(cx - wx, cy + p - h - wy)`. This matches treating window-local Cocoa
coordinates as screen coordinates; the upstream event producer is not yet
identified. Require that this differs from the actual
cursor. Allow one point for rounding from fractional events to Electron's
integer cursor position.

The first filter rejected any disagreement with the cursor and blocked
independently injected drag movement. Matching the specific conversion error
preserves those events. Preserve real native movement, matching stationary
events, hover events, and other buttons.

This is a temporary workaround, not the intended design. Reading the cursor
position is necessary only for stationary left-button moves in full screen.
It introduces no stored pointer state, renderer API, polling, or display-specific
offsets. Native logging confirms zero movement deltas on the rejected event.
Playwright verifies selection and actual reordering in windowed and full-screen
modes. The final native recording confirms the misplaced events are filtered.

## Isolation

Keep event classification and installation in the desktop window module. Do not
change shared UI drag sensors, native frame styles, or header visibility.

## Validation and removal

Test misplaced stationary events, valid stationary events, real movement,
fractional coordinates, and other input types. Replay the captured event path in
Electron and check tab selection and real reordering. Run repository validation.
Ask the user to check both tab edges, drag reordering, closing, Help, and native
header reveal on both displays.

Remove this workaround after an Electron/Chromium release delivers correct
coordinates for the same native click sequence on both displays. Re-run those
checks before removing it.

## References

- [Electron mouse input hook](https://www.electronjs.org/docs/latest/api/web-contents#event-before-mouse-event)
- [Chromium macOS event conversion](https://github.com/chromium/chromium/blob/150.0.7871.250/components/input/web_input_event_builders_mac.mm)
- PS-375 report: manual pointer events and drag-suppression call stacks.
