# Temporarily filter misplaced stationary mouse events on macOS

## Status

Temporary workaround for PS-375. The user confirmed the coordinate filter fixes
DELL tab clicks, dragging, and the native header. The next revision narrows its
scope to stationary presses that began on a project-tab trigger. The user reports
the revision works on a 1080p monitor. The original DELL is unavailable, so its
live retest is pending. Replay of the recorded DELL events passes.

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

The failing display was a DELL U2718Q at 3840 × 2160 physical pixels, reported by
Electron as 1920 × 1080 points at 2× scale. Its bounds were
`{ x: -196, y: -1080, width: 1920, height: 1080 }`, above the built-in Retina
display (`1512 × 982` points, 2× scale, origin `0, 0`). The failure occurred in
native full screen entered with the green window button. Upper tab text/icon
clicks failed; lower tab padding, close buttons, the project picker, and drag
reordering worked. A later 1080p monitor working does not replace this case.

That move starts dnd-kit's drag sensor, whose normal click suppression prevents
project selection. Hiding or repositioning native window controls does not fix
the input contract and can damage the revealed macOS header.

The conversion happens below the renderer. Changing dnd-kit thresholds would
hide an invalid native event and change valid drag behavior. We cannot patch
the distributed Chromium native code in this TypeScript application.

## Decision and trade-offs

Use Electron's `before-mouse-event` hook only during a stationary project-tab
press in macOS full screen. The preload measures the actual visible tab triggers
inside the window title bar and sends their bounds to that workbench's native
input handler. The renderer owns these bounds; the native copy is only an input
hit-test projection. No shared UI component or public renderer API changes.

Arm the filter on a left press inside one of those bounds. Stop on real movement,
release, cancellation, focus loss, full-screen transitions, navigation, or a
change to the tab bounds. Require the actual cursor to remain at the press point.
Presses on close buttons, the project picker, and workbench content never arm it.

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

This is a temporary workaround, not the intended design. It adds a native copy of
tab hit-test bounds and one pending press point, both owned by the workbench
input handler. Bounds refresh after layout changes and clear during navigation.
Missing bounds leave all input alone. No polling or display-specific offsets are
used. The extra geometry message is necessary because the native hook cannot
inspect a DOM event target. A renderer-only drag sensor cannot use the native
cursor and movement fields that identify the captured error.

The bounds message is asynchronous. Before fresh geometry arrives, a click may
miss the workaround or briefly use a former tab's area. Geometry changes clear
the pending press rather than extend filtering into another interaction.
Native logs and Playwright must verify that
the filter remains effective after full-screen transitions, zoom, and reordering.

## Isolation

Keep event classification, press ownership, and geometry observation in the
desktop window module. Do not change shared UI drag sensors, native frame styles,
or header visibility. Scope IPC to the workbench's main frame.

## Validation and removal

Test misplaced stationary events, valid stationary events, real movement,
fractional coordinates, and other input types. Prove the same coordinate pattern
passes unchanged for content presses, completed drags, and cancelled gestures.
Verify tab bounds follow zoom, resizing, and tab removal. Replay the captured event path in
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
