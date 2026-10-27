# UI Canvas

Explore and compare live UI designs inside Prompt Studio. A source registry defines named canvases and previews; the workbench saves their camera, frame positions, and individual frame themes.

Use a runtime that satisfies the extension API range declared in `package.json`.

Open **Canvases** in the project navigation. Browse **Design System**, **Workbench Core**, **Dashboard**, and **Extensions**, with expandable subgroups. All canvases use one shared, project-owned tab viewer. Selecting a canvas opens a retained workbench tab; switching canvases keeps the same tab list, preview inputs, and camera. Host UI such as Paused extension view belongs under Workbench Core → Chrome; actual extension-owned examples belong under Extensions. **Foundations** contains three previews of the Pencil file's colors, typography, spacing, and radii. **Shared components** contains nine previews of controls, feedback, identity, surfaces, keyboard hints, empty states, and overlays. All previews use synthetic data and local state. Creating a project in the preview never creates a real project.

## Work with a design

- Click a preview name to copy its exact name. Enter, Space, and touch also work. If clipboard access fails, select and copy the displayed name.
- Drag its move handle or focus the handle and use arrow keys. Shift moves farther. Preview content remains interactive.
- Drag empty space, hold Space while dragging, or use the middle mouse button to pan. Space-to-pan stays off while a control or editable region has focus.
- Use Ctrl/Meta + wheel or trackpad pinch to zoom around the pointer. Ordinary wheel input scrolls nested content while it can scroll, then pans the canvas.
- Focus the canvas for arrow-key pan, `+`/`-` zoom, `F` to fit, and `0` to reset. Camera buttons stay fixed above the canvas. Reset keeps frame positions and preview drafts.

Frames show a shared loading panel and spinner while their compiled preview starts.

Each frame has a **Theme** menu: Follow app, Light, Dark, Solarized Light, Solarized Dark, Dracula, or Monokai. Its choice is saved independently. Theme changes preserve mounted inputs and local state. The canvas shell follows the workbench. Physical touch and trackpad behavior depends on the browser; automation does not prove those device behaviors.

## Edit source

`src/canvases/definitions.ts` owns canvas IDs, unique readable names, preview membership, component keys, initial positions, and intended dimensions. `src/canvases/previews.tsx` maps component keys to live React components. Add another canvas to the definitions array and another preview component when needed. Camera and gesture code do not need to change.

Preserve IDs and names in follow-up edits. Add a new named entry for another version. Keep unrelated designs. Place new entries in nearby empty space and reveal them through the camera. Use the `canvas` skill for the full authoring and validation rules.

Use public production component APIs, shared styles, safe data, and local callbacks. Do not change production components to make previews work. Keep experiment code in this extension. Content is compiled with the extension; the browser never interprets stored source strings as code. Runtime content editing, resizing, drawing, connectors, and property editors are outside this extension's scope.

The `src/controller/` files own geometry, cached bounds, input routing, and batched transforms. Native portals stay in their library-owned document roots. Each preview document handles links, including portal links: `#canvas-item=<item-id>` reveals an item, and other links stay in the preview.

## Commands and saved data

```bash
pst canvas list
pst canvas open --canvas foundations
pst canvas layout read --canvas foundations
pst canvas layout update --canvas foundations --change '{"positions":{"colors":{"x":80,"y":40}}}'
pst extensions dev .pstdio/extensions/canvas
```

The browser and CLI use the same layout commands. `list` and `open` return project-owned dashboard links for tickets. `ctx.storage.records` stores one versioned shared map per project and canvas. Each position has its own map entry, so simultaneous moves of different frames merge. Source IDs filter saved positions. The saved data cannot hide frames or replace names, dimensions, preview code, or form contents. Frame themes use separate shared-map entries; the workbench owns the shell theme.

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

## Native documentation catalog

UI Canvas indexes every current CSF export and MDX document. Related scenarios share one source-owned topic canvas and keep their original story IDs. Auto Build combines its status and form examples; Create folder combines folder-picker states. Earlier scenario URLs resolve to the grouped canvas. Select canvases in the navigation panel or find them through global resource search. The Design playground and Documentation panels demo canvases have been removed from navigation. Their interaction fixtures remain in verification stories. Search accepts source paths, export IDs, names, and design keywords.

Each component has one frame. Its **Variant** menu, beside **Theme**, selects an original story’s predefined parameters. Selecting a variant resets that example’s local fixture state and keeps its frame theme and position. Every original story ID remains in the migration ledger and resource search.

Scenarios render compiled original React components in individual preview documents. Each document owns its React, Chakra, theme, and application fixture state so several dialogs and store variants can be used together. This runs native source components without a standalone Storybook server or manager. Preview code is built into a compressed module archive; project storage cannot provide executable content. Application examples use local API and in-memory storage fixtures. Gallery token overrides stay local to each preview. Monaco uses its public worker factory to load the prebuilt classic workers from document-owned URLs, preserving TypeScript diagnostics inside the opaque sandbox. Website analytics is inert in previews. Source play functions remain in their original files for external validation; Canvas does not run them as tests. **Props and source** shows arguments, authored argument types, component references, the source hash, and complete source code.

Documentation frames have content-driven heights. Resize observations and font completion refresh measured bounds. Fit and explicit reveal include a tall panel and its title. Fullscreen application examples retain a minimum viewport inside the documentation frame; lists and editors retain their own scrolling. Long prose, source listings, and API details have no inner vertical scroll area. The **IntrinsicDocumentation** verification story checks expansion and draft retention outside the canvas resource registry.

The 159 Pencil canvases are labeled **Design reference**. Their DOM renderer is reference evidence. The ledger retains all 24,496 source node identities, 292 reusable definitions, reference overrides, and ten owned asset hashes from RP-1. These entries do not claim completed component migration or transferred design authority. Current Pencil verification is blocked by the account's design-tool usage limit.

### Rebuild and verify

From the repository root:

```sh
bun run --cwd scripts canvas:build
bun run --cwd scripts canvas:inventory /path/to/ui-canvas-migration-inventory.json
bun run --cwd .pstdio/extensions/canvas test
bun run --cwd .pstdio/extensions/canvas test
bun run --cwd .pstdio/extensions/canvas typecheck
bun run --cwd scripts canvas:coverage
```

`canvas:build` composes the original sources and records hashes for components, fixtures, dependency versions, and emitted files. Generated modules are build output; edit their sources and rebuild. `canvas:inventory` reads the RP-1 JSON and its adjacent `migration-assets` directory. It never opens or edits a Pencil file. It preserves the evidence snapshot separately from current verification.

Catalog scans read and hash every current source. They reuse the existing parser output only when the compiler, dependency lock, and generated metadata hashes still match. Changed and new sources use the original Storybook parser.

`canvas:coverage` fails if the native build is stale, a design node lacks a real-component destination, or current design freshness is unverified. Ledger integrity tests can pass while this acceptance gate remains incomplete.

Run `canvas:verify` inside the isolated Docker tooling container with Chromium installed. It checks every switchable native variant, documentation expansion, draft retention across a theme change, measured fit, and a populated 24-preview canvas. Failed cases retain screenshots and HTML under `__test-tmp__/native-canvas-verification/`. Original Storybook interaction checks remain required for their scenarios. Physical touch, trackpad behavior, full visual fidelity, packaged verification, full tests, and CI remain separate acceptance work.
