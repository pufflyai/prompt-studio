---
name: canvas
description: Create or update live UI designs in the repository Canvas extension before adding or changing production UI.
---

# Canvas designs

Use the Canvas extension for UI exploration and ticket designs. Read repository rules and `design/DESIGN.md` first.

1. Run `pst canvas list`. Reuse the relevant canvas for follow-up requests.
2. Edit `.pstdio/extensions/canvas/src/canvases/definitions.ts`. This typed registry owns canvas IDs, names, item membership, readable names, component keys, initial positions, and intended dimensions. Implement previews in `src/canvases/previews.tsx`, or split growing previews into nearby files and register their component keys. Keep the controller independent of preview content.
3. Reuse exported `@pstdio/ui` components and existing tokens. Use synthetic data and local callbacks. Do not import application internals, make real requests, use real credentials, or modify production components to support a preview. Never evaluate stored strings as code.
4. Preserve existing IDs, names, positions, dimensions, and unrelated designs. For another version, add a new stable ID and unique readable name. For a change to the current version, update it in place. Remove only requested entries. Keep comparison data and global theme the same when comparing one feature.
5. Add new items in nearby empty space using current bounds and saved positions from `pst canvas layout read --canvas <id>`. Allow intentional overlap. Reveal additions through camera changes using `pst canvas layout update`; do not rearrange existing items. Define mobile and desktop dimensions in the registry when needed.
6. Use `pst extensions dev .pstdio/extensions/canvas` to rebuild source changes. Open with `pst canvas open --canvas <id>`. Check the updated view, interactions, runtime errors, and themes with Playwright through the repository's isolated Docker workflow.
7. On tickets that add or change UI, update the canvas before production work. Link the canvas page, exact preview names, and source paths in the ticket. Do not publish an artifact prototype for this requirement. Save the ticket with `pst tickets save --id <id>`.

The source registry is the design record. Project storage contains only a versioned camera and positions keyed by source IDs. It never contains names, dimensions, membership, preview drafts, credentials, or executable code. New source entries must always appear, and removed IDs must be ignored. Handle malformed or unavailable storage without breaking the canvas.

Keep the workspace plain: a viewport background, subtle preview boundaries, readable names above previews, separate move handles, and minimal fixed camera controls. The name copies its exact text on click, Enter, Space, and touch. Explain copying on hover and focus. Keep names visible during successful feedback; provide selectable text if copying fails. Handles support pointer and keyboard movement. Use the default cursor only on navigation surfaces and handles; preserve native preview cursors.

Preserve preview input and local state during camera movement, copying, moving frames, and theme changes. Keep live components mounted. Keep portals in their native document roots at screen-space size. Use public positioning and container APIs; do not patch libraries, browser APIs, preview DOM, or portal roots. If portal positioning fails under transforms, report it before adding a workaround. Canvas item links reveal their targets. Other preview links must not navigate away or perform real project actions, including links inside portals.

Controller changes must preserve these behaviors:

- Empty-space mouse pan; Space + primary drag and middle drag over previews, with explicit pan taking priority over copying and moving. A completed pan must not activate controls, links, names, or middle-click autoscroll.
- Preserve Space activation and preview shortcuts while controls or editable regions have focus. Keep modal portals outside canvas gesture handling. Clear held keys on cancellation, blur, and hidden tabs.
- Ctrl/Meta + wheel and trackpad pinch zoom around the pointer over both previews and empty space, without drift. Buttons and keyboard zoom use the viewport center. Keep camera values finite and bounded.
- Route ordinary wheel input to nested scroll areas while they can scroll in the gesture direction, then pan the canvas. Modified-wheel zoom takes priority. Portal scrolling stays native.
- One-finger handle movement and empty-space pan; two-finger pan and pinch where the browser permits them. Preserve native preview touch input. Handle pointer-count changes, cancellations, and lost capture. Report device limits instead of disabling native input globally.
- Keyboard camera controls when the shell has focus, visible focus, fixed fit-all and reset controls. Fit measured preview and title bounds after layout settles. Reset only the camera. Reveal offscreen keyboard focus with the camera; native page scrolling must not move the canvas.
- Apply horizontal overscroll prevention to the document viewport and canvas boundary while mounted, restore prior styles on teardown, and preserve nested horizontal scrolling and browser navigation shortcuts. Do not trap history or patch browser APIs.
- Batch wrapper transforms into one animation frame. Keep gesture values outside React state. Cache bounds; refresh measurements together when content or dimensions change. Ignore temporary placeholders. Do not measure previews each frame or write storage for every event.
- Save after gestures or a bounded debounce. Safely flush pending saves and clean up listeners, captures, observers, timers, and animation frames on teardown. Do not add virtualization, memoization, or persistent compositing hints without profiling evidence.

Use the workbench's global theme. The webview currently exposes the active preference and theme variables but no supported API to list or change all installed themes. Change themes with the workbench's Appearance controls. Do not add another theme preference or per-preview themes.

Do not add runtime content editing, delete shortcuts, resizing, presets, drawing, connectors, property editors, multi-selection, snapping, arrangements, or undo/redo unless requested.

For controller changes, test every behavior above at several zooms, viewport sizes, and reloads with saved layout. Use a real supported touch device and actual trackpad input with a real history entry for history-swipe checks. Report unavailable tests honestly. Before claiming smooth performance, profile a populated representative canvas and record preview count, browser, device, timings, long tasks, layout work, storage writes, and preview rerenders.

Finish with changed paths and exact preview names, checks run, limits or untested behaviors, and defaults chosen. The Pencil design-system and website files remain the reference for designs that have not yet moved to canvases. Migrate one topic at a time, verify coverage and fidelity, and update design authority only after the corresponding canvas is complete.
