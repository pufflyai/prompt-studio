# UI Canvas

Explore and compare live UI designs inside Prompt Studio. A source registry defines named canvases and previews; the workbench saves their camera, frame positions, and individual frame themes.

UI Canvas is an optional extension. After upgrading to a release that includes it, install it from the extension catalog:

```sh
pst extensions add canvas
```

Catalog installation uses the host's configured registry or the matching Git release.
A downloaded package also works without Git or a source checkout:

```sh
pst extensions add /path/to/pstdio.canvas-<version>.tgz
```

Its catalog is downloaded on demand and is not embedded in the core CLI. It is not installed or enabled by default. The extension includes the `canvas` skill for browsing, comparing variants and themes, arranging frames, and source maintenance. Installed previews are precompiled and work without a Prompt Studio source checkout. Editing the catalog itself requires its source checkout and the development commands below.

Use a runtime that satisfies the extension API range declared in `package.json`.

Open **UI Canvas** in the project navigation. Browse **Design System**, **Workbench Core**, **Dashboard**, **Extensions**, and **Landing Page**, with expandable subgroups. All canvases use one shared, project-owned tab viewer. Selecting a canvas opens an unpinned preview tab by default. The next unpinned selection replaces that preview. Use Pin tab to pin a canvas; pinned canvases retain their preview inputs and camera in the shared tab list. Landing-page components have their own Landing Page group. Host UI such as Paused extension view belongs under Workbench Core → Chrome; actual extension-owned examples belong under Extensions. **Foundations** contains three previews of semantic colors, typography, spacing, and radii. **Shared components** contains nine previews of controls, feedback, identity, surfaces, keyboard hints, empty states, and overlays. All previews use synthetic data and local state. Creating a project in the preview never creates a real project.

## Work with a design

Canvases use the diamond icon in navigation, resource search, breadcrumbs, and tabs. Select a frame before using its contents: the first click selects it without activating a control. The selected frame has an outline. Clicking another frame or empty canvas space changes or clears selection; Escape clears it when the canvas has focus. The larger grip selects and moves its frame. Selection is local to the open canvas and is not saved; changing selection preserves mounted previews and draft input.

- Click a preview name to copy its exact name. Enter, Space, and touch also work. If clipboard access fails, select and copy the displayed name.
- Drag its move handle or focus the handle and use arrow keys. Shift moves farther. Preview content remains interactive.
- Drag empty space, hold Space while dragging, or use the middle mouse button to pan. Space-to-pan stays off while a control or editable region has focus.
- Use Ctrl/Meta + wheel or trackpad pinch to zoom around the pointer. Ordinary wheel input scrolls nested content while it can scroll, then pans the canvas.
- Focus the canvas for arrow-key pan, `+`/`-` zoom, `F` to fit, and `0` to reset. Camera buttons stay fixed above the canvas. Reset keeps frame positions and preview drafts.

Frames show a shared loading panel and spinner while their compiled preview starts. Each canvas starts at most four frames at once, prioritizing selected and visible frames. A slot is released after module imports finish, before asynchronous fixture setup. Offscreen frames continue loading and loaded frames stay mounted to retain drafts.

Each frame has a **Theme** menu: Follow app, Light, Dark, Solarized Light, Solarized Dark, Dracula, or Monokai. Its choice is saved independently. Theme changes preserve mounted inputs and local state. The canvas shell follows the workbench. Physical touch and trackpad behavior depends on the browser; automation does not prove those device behaviors.

## Edit source

`src/canvases/definitions.ts` owns canvas IDs, unique readable names, preview membership, component keys, initial positions, and intended dimensions. `src/canvases/previews.tsx` maps component keys to source files and named React exports. The compiler creates a lazy lookup so frames import only their native component group. Add another canvas to the definitions array and another preview component when needed. Camera and gesture code do not need to change.

Preserve IDs and names in follow-up edits. Add a new named entry for another version. Keep unrelated designs. Place new entries in nearby empty space and reveal them through the camera. Use the `canvas` skill for the full authoring and validation rules.

Use public production component APIs, shared styles, safe data, and local callbacks. Do not change production components to make previews work. Keep experiment code in this extension. Content is compiled with the extension; the browser never interprets stored source strings as code. Runtime content editing, resizing, drawing, connectors, and property editors are outside this extension's scope.

The `src/controller/` files own geometry, cached bounds, input routing, and batched transforms. Native portals stay in their library-owned document roots. Each preview document handles links, including portal links: `#canvas-item=<item-id>` reveals an item, and other links stay in the preview.

## Commands and saved data

```bash
pst canvas list
pst canvas open --canvas foundations
pst canvas layout read --canvas foundations
pst canvas layout update --canvas foundations --change '{"positions":{"colors":{"x":80,"y":40}}}'
pst extensions dev extensions/canvas
```

The browser and CLI use the same layout commands. `list` and `open` return project-owned dashboard links for tickets. `ctx.storage.records` stores one versioned shared map per project and canvas. Each position has its own map entry, so simultaneous moves of different frames merge. Source IDs filter saved positions. The saved data cannot hide frames or replace names, dimensions, preview code, or form contents. Frame themes use separate shared-map entries; the workbench owns the shell theme.

Canvas saves after gestures or a bounded debounce. It renders source defaults when storage is unavailable and reports read or save failures beside the canvas. Draft input survives camera and layout changes but is intentionally not persisted across reload.

## Ticket designs

Canvas is the source of truth for UI appearance, component states, and example prop usage. When the project's Canvas policy is enabled and Canvas is available, tickets that change UI update the relevant live design before production work. Record a skipped step when disabled or unavailable. Link the canvas page, exact preview names, source paths, and a short walkthrough in the ticket. Planner's **Update canvas designs for UI changes** setting controls this guidance.

## Validation

Run `bun run --cwd extensions/canvas test` and `bun run --cwd extensions/canvas typecheck`. The workspace examples cover the interactive starter, zoomed-out previews, and a populated 24-preview canvas. Validate only critical behavior risks with Playwright in the isolated Docker app. Routine cosmetic changes do not require browser runs. Report physical-device and browser behaviors that were not tested.

## Native documentation catalog

UI Canvas indexes every current Canvas variant export and MDX document. Related scenarios share one source-owned topic canvas and keep their original scenario IDs. Auto Build combines its status and form examples; Create folder combines folder-picker states. Earlier scenario URLs resolve to the grouped canvas. Select canvases in the navigation panel or find them through global resource search. The Design playground and Documentation panels demo canvases have been removed from navigation. Their interaction fixtures remain in verification examples. Search accepts source paths, export IDs, names, and design keywords.

Each component has one frame. Its **Variant** menu, beside **Theme**, selects an original scenario’s predefined parameters. Selecting a variant resets that example’s local fixture state and keeps its frame theme and position. Every original scenario ID remains in the migration ledger and resource search.

Scenarios render compiled original React components in individual preview documents. Each document owns its React, Chakra, theme, and application fixture state so several dialogs and store variants can be used together. Preview code is compiled into individually compressed modules; project storage cannot provide executable content. Application examples use local API and in-memory storage fixtures. Gallery token overrides stay local to each preview. Monaco uses its public worker factory to load the prebuilt classic workers from document-owned URLs, preserving TypeScript diagnostics inside the opaque sandbox. Website analytics is inert in previews. Examples contain rendering and fixture setup only. Critical behavioral assertions live in Playwright tests using the same preview renderer and sandbox. **Props and source** shows arguments, authored argument types, component references, the source hash, and complete source code.

Documentation frames have content-driven heights. Resize observations and font completion refresh measured bounds. Fit and explicit reveal include a tall panel and its title. Fullscreen application examples retain a minimum viewport inside the documentation frame; lists and editors retain their own scrolling. Long prose, source listings, and API details have no inner vertical scroll area. The **IntrinsicDocumentation** verification story checks expansion and draft retention outside the canvas resource registry.

### Rebuild and verify

From the repository root:

```sh
bun run --cwd scripts canvas:build
bun run --cwd scripts canvas:inventory
bun run --cwd extensions/canvas test
bun run --cwd extensions/canvas typecheck
bun run --cwd scripts canvas:coverage
```

`canvas:build` composes colocated `*.canvas.tsx` examples and MDX documents, then records source and output hashes. Generated modules are build output; edit the source and rebuild. The builder retains each scenario's existing ID, variant parameters, providers and asynchronous setup. `canvas:inventory` regenerates the source destination ledger. The original scenario inventory checks that every covered export still has a canvas destination.

The extension's normal `build` command discovers current examples and reuses the compiled catalog while its inputs are unchanged. It regenerates stale output, including after release versioning changes its manifest or dependencies. The release version command refreshes these assets before creating its version commit. Freshness verification stays separate from generation.

`typecheck` checks the extension and examples across all owning workspaces. Published extension configurations exclude repository-only examples; the catalog checks them separately with the private authoring types.

`canvas:coverage` rejects stale builds or missing source destinations. It checks current live sources; it does not certify historical visual fidelity.

Run `canvas:verify` inside the isolated Docker tooling container with Chromium installed. It checks representative critical interactions, documentation expansion, retained drafts, measured fit, and the unchanged populated 24-preview workload. It does not behaviorally test every variant. Failed cases retain Playwright traces and screenshots under `packages/canvas-tests/test-results/`. Browser interaction checks live in `packages/canvas-tests`; its static preview build is test-only. The live Canvas is the developer catalog. Physical touch, trackpad behavior, full visual fidelity, packaged verification, full tests, and CI remain separate checks.

### Frame startup

The extension loads each example's dependency graph through its private `preview.assets` command and the public package-file API. The viewer decodes shared immutable module bytes once and reuses them across frames. Each opaque sandbox still creates its own module URLs and owns its React, providers, theme, and fixture state. Reset and variant changes create a fresh sandbox. The catalog lookup table stays separate so one example does not download every other example. Styles follow Vite's per-chunk dependency metadata in the catalog's cascade order; unrelated website fonts, math, and editor styles stay out of a frame's startup graph. Syntax highlighting initializes only when a rendered component needs it.

Run `bun run --cwd packages/canvas-tests perf:startup` for three cold-context repetitions of a button, a documentation frame, and the existing populated 24-frame workload. It reports navigation-to-first-ready and all-ready times, module counts, bytes, queue time, asset preparation, imports, setup, and commit time. Set `CANVAS_STARTUP_RESULTS` to a file path to retain raw JSON lines. The optional double-animation-frame paint marker can be absent for offscreen documents; it never gates readiness. This diagnostic benchmark preserves the normal test readiness allowance and does not replace the existing camera workload or budgets.

### Critical checks only

Require browser or visual checks only for critical risks: a blocked primary task, hidden essential content or controls, broken keyboard/focus behavior, preview isolation, or a critical regression. Use the smallest representative scenario. Add screenshot comparisons only when appearance is the critical contract and behavioral assertions cannot establish it. Routine copy, spacing, cosmetic, and documentation changes do not require browser runs or screenshots. Explicit user-requested visual verification still applies. Keep examples for design exploration without a matching test for each example. Each retained browser test identifies its critical risk.
