# Canvas

Explore and compare live UI designs inside Prompt Studio. A source registry defines named canvases and previews; the workbench saves their camera and frame positions.

This repository extension needs extension API 0.2.2, as provided by the current source runtime. Desktop 0.43.1 provides API 0.1.6 and cannot load it.

Open **Canvases** in the project navigation. Select a canvas in its navigation tree. **Foundations** contains three previews of the Pencil file's colors, typography, spacing, and radii. **Shared components** contains nine previews of controls, feedback, identity, surfaces, keyboard hints, empty states, and overlays. The starter **Design playground** contains **Project form · default** and **Shared controls · interactive**. All previews use synthetic data and local state. Creating a project in the preview never creates a real project.

## Work with a design

- Click a preview name to copy its exact name. Enter, Space, and touch also work. If clipboard access fails, select and copy the displayed name.
- Drag its move handle or focus the handle and use arrow keys. Shift moves farther. Preview content remains interactive.
- Drag empty space, hold Space while dragging, or use the middle mouse button to pan. Space-to-pan stays off while a control or editable region has focus.
- Use Ctrl/Meta + wheel or trackpad pinch to zoom around the pointer. Ordinary wheel input scrolls nested content while it can scroll, then pans the canvas.
- Focus the canvas for arrow-key pan, `+`/`-` zoom, `F` to fit, and `0` to reset. Camera buttons stay fixed above the canvas. Reset keeps frame positions and preview drafts.

Theme follows the workbench, including native portals. Change it through the workbench's Appearance controls. The public webview API does not expose a complete installed-theme catalog or a supported global-theme setter, so Canvas does not create a separate theme preference. Physical touch and trackpad behavior depends on the browser; automation does not prove those device behaviors.

## Edit source

`src/canvases/definitions.ts` owns canvas IDs, unique readable names, preview membership, component keys, initial positions, and intended dimensions. `src/canvases/previews.tsx` maps component keys to live React components. Add another canvas to the definitions array and another preview component when needed. Camera and gesture code do not need to change.

Preserve IDs and names in follow-up edits. Add a new named entry for another version. Keep unrelated designs. Place new entries in nearby empty space and reveal them through the camera. Use the `canvas` skill for the full authoring and validation rules.

Use public production component APIs, shared styles, safe data, and local callbacks. Do not change production components to make previews work. Keep experiment code in this extension. Content is compiled with the extension; the browser never interprets stored source strings as code. Runtime content editing, resizing, drawing, connectors, and property editors are outside this extension's scope.

The `src/controller/` files own geometry, cached bounds, input routing, and batched transforms. Native portals stay in their library-owned document roots. The canvas host handles links, including portal links: `#canvas-item=<item-id>` reveals an item, and other links stay in the preview.

## Commands and saved data

```bash
pst canvas list
pst canvas open --canvas playground
pst canvas layout read --canvas playground
pst canvas layout update --canvas playground --change '{"positions":{"project-form":{"x":80,"y":40}}}'
pst extensions dev .pstdio/extensions/canvas
```

The browser and CLI use the same layout commands. `list` and `open` return project-owned dashboard links for tickets. `ctx.storage.records` stores one versioned shared map per project and canvas. Each position has its own map entry, so simultaneous moves of different frames merge. Source IDs filter saved positions. The saved data cannot hide frames or replace names, dimensions, preview code, or form contents. The workbench owns the existing global theme preference.

Canvas saves after gestures or a bounded debounce. It renders source defaults when storage is unavailable and reports read or save failures beside the canvas. Draft input survives camera and layout changes but is intentionally not persisted across reload.

## Ticket designs and the Pencil migration

Tickets that add or change UI update the relevant live canvas before production work. Link the canvas page, exact preview names, source paths, and a short walkthrough in the ticket. This replaces the artifact prototype step. Planner's **Update canvas designs for UI changes** setting controls this guidance.

The first migration recreates the main foundation scales and shared component examples as live previews. The existing Pencil files remain intact and retain authority over sections that have not moved. These previews use the production component APIs and theme tokens, rather than copied screenshots.

| Pencil section | Source node | Canvas content |
| --- | --- | --- |
| Colors | `i1gN4b` | Foundations: semantic color tokens |
| Typography | `W0pwAV` | Foundations: display, heading, label, paragraph, and mono styles |
| Spacing & Radius | `el3Rl` | Foundations: spacing and radius scales |
| Buttons & actions | `jQEhP` | Shared components: variants, sizes, disabled and loading states |
| Inputs & form controls | `lOGqd` | Shared components: field and selection states |
| Keyboard | `HDvXd` | Shared components: shortcut styles |
| Feedback & status | `Q31Kq` | Shared components: alerts and session indicators |
| Badges & resources | `tMDs1` | Shared components: badges, chips, and ticket tags |
| Overlays & menus | `awyYC` | Shared components: tooltip, popover, and dialog behavior |
| Layout & navigation | `ZhucE` | Shared components: card, tabs, rows, and empty state examples |

Coverage is partial. Component masters, advanced menus, resource widgets, composite screens, workbench layouts, chat, Planner, and the website still need migration. Move these in reviewable groups, each with its own named canvas. Reuse shared components across groups. Compare each group with its Pencil frames and record missing content or states. Change design authority only after coverage, dimensions, and appearance have been checked.

## Validation

Run `bun run --cwd .pstdio/extensions/canvas test` and `bun run --cwd .pstdio/extensions/canvas typecheck`. The workspace stories cover the interactive starter, zoomed-out previews, and a populated 24-preview canvas. Validate changes with Playwright in the isolated Docker app. Report physical-device and browser behaviors that were not tested.
