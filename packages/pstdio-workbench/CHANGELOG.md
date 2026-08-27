# @pstdio/workbench

## 0.8.0

_2026-08-27_

### Minor Changes

- 5329cb7: Replace overlapping extension UI contracts with alpha.4 views, placements, navigation, and shared workflow statuses.
- d7a5b16: Add generic resource menus, dashboard anchors, and contribution diagnostics.
- 545d925: Add stable workbench views and migrate extension navigation.

### Patch Changes

- 004b96c: Preserve extension command responses, register extension shortcuts, and restore artifact workflow behavior.
- 24fcc75: Fix PS-296 workspace, terminal, shortcut, chat tool, and skill ownership regressions.
- 82138c3: Update the Bun toolchain requirement to 1.3.14.
- Updated internal dependencies: `@pstdio/sdk@0.21.0`, `@pstdio/ui@0.21.0`

## 0.7.1

_2026-08-25_

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.20.0`

## 0.7.0

_2026-08-24_

### Minor Changes

- 88e89b2: Add workspace file browsing, stable Monaco editing, file and folder actions, drag-to-move entries, file icons, live change badges, current and fork-point Changes views, and macOS Finder reveal.

### Patch Changes

- 4f0094a: Allow project creation without detected harnesses, preserve project selection controls, and block input behind overlays
- dd7fa91: Support extension command file parameters through the parameter editor, workbench upload preparation, and command-scoped API storage.
- c257623: Prevent project picker backdrop clicks from reaching the page and print authenticated isolated dashboard URLs.
- c257623: Keep the settings overlay fixed while panel content scrolls, and keep the Extensions toolbar visible without overview counts.
- Updated internal dependencies: `@pstdio/ui@0.20.1`, `@pstdio/sdk@0.19.0`

## 0.6.0

_2026-08-21_

### Minor Changes

- 76b5f72: Add editable rich Markdown tables and native heading navigation.
- b0457fc: Add explicit event-driven refresh contracts for native extension renderers.
- fcd283d: Let panels place every native renderer through one renderer reference.
- 86f01d9: Remove unwired extension renderer surfaces and legacy navigation metadata.

### Patch Changes

- 8b7adf9: Add the atomic workbench navigator: mode and resource commit together with one layout-scope rotation, incompatible modes restore their last or default compatible resource, and history replay uses the same transaction
- e2b8668: rewrite documentation, skills, and templates in plain technical English
- 8b7adf9: Make resource hierarchy traversal cycle-safe and keep breadcrumbs on the acyclic resource path
- 8b7adf9: Add composition conformance fixtures: two Lab modes over one shared resource, a cross-extension inspector in the Planner ticket slot, and the tests that lock both in
- 8b7adf9: Add the workbench composition resolver: one reconciliation pass restores required placements on every context activation, panel menus follow their owner panel, and layouts from older schema versions are discarded
- 883e31b: Add explicit row activation callbacks for data table and Kanban renderers.
- 70135ed: Restore closed optional composition panels from Add Panel.
- b0457fc: Keep editor focus and selection across saves: the markdown editor no longer reports the initial content import as an edit, saves of unchanged content are skipped, refresh events during a save are treated as self-invalidation, and a reload only remounts the editor when the content actually changed.
- 7cb9939: Replace renderer-owned command bindings with private callbacks.
- 8b7adf9: Preserve editable file drafts, focus, and revision-aware refreshes across save and recovery.
- 4dc237f: Share renderer invocation context contracts across first-party renderers.
- b0457fc: Fix ticket view UX: enum dropdowns are portaled so panels no longer clip them, tree node resources share the host's canonical URIs so reopening a ticket from the sidenav keeps its properties menu, navigation entries render above the active resource's tree, and reopened documents mount from a content cache instead of a spinner.
- 7c538c9: Unify extension navigation targets and placement strategies.
- 62aedfb: Make composition the sole owner of panel placement and expose placement-aware panel queries.
- Updated internal dependencies: `@pstdio/sdk@0.18.0`, `@pstdio/ui@0.20.0`

## 0.5.0

_2026-08-13_

### Minor Changes

- 0818856: Add a settings overlay header, widen the settings dialog, make settings nav groups non-collapsable, support contentWidth/contentMaxWidth on overlay widgets, and keep overlay dialogs open when interacting with nested overlays.

### Patch Changes

- 0cfd2c8: Persist Side Panel tabs, presentation, session selection, and chat drafts while showing ticket workspace sessions.
- 0917cfb: Recover navigation when persisted extension modes are no longer registered.
- 541ec5d: Honor extension panel placement when registering and opening workbench tabs.
- e777925: Reconcile extension-owned layouts in local dashboard storage.
- d9b7d32: Restore terminal connections in Vite development through runtime WebSocket configuration.
- 9bfcaf1: Build every command parameter form from param editor rows so ticket actions like refine and break into sub-tickets match the run attempt form
- c9fffc3: Keep run parameter menus interactive above dialogs and add icon-aware searchable grouped selections to the standard editor layout
- b66ef5d: Add Mod+Enter accept shortcuts to modal submit actions.
- b8059df: Ensure workspace terminals use their effective directories and render content when the bottom panel first opens
- 8d1b072: Show Panel icons in tab dropdowns and on added Sub Panel tabs; render data tables instantly with a skeleton while the first query loads
- d9b7d32: Restore terminal tab selection after project layout changes.
- 8d1b072: Add workbench foundations for extension mode chrome: panel icons, native activity items with a host-rendered rail, mode-scoped activity/status regions with sidenav ownership, Side Panel resource inspectors for side-only kinds, native-bodied panel menus on webview panels, a guard that keeps Sub Panels out of Locations, instant cached rendering for table and controls panels, and reconnecting extension webviews after iframe reparent reloads.
- Updated internal dependencies: `@pstdio/sdk@0.17.0`, `@pstdio/ui@0.19.0`

## 0.4.0

_2026-08-04_

### Minor Changes

- 225af02: Add multi-row selection and bulk actions to DataTable renderer contributions

### Patch Changes

- 053867b: Add complete parameter editor parity and preload file renderers for reliable document startup.
- Updated internal dependencies: `@pstdio/ui@0.18.0`

## 0.3.0

_2026-07-28_

### Minor Changes

- 488d0cb: Add vertical split resizing, persistent Secondary Panel state, and terminal tab restoration
- ec66e9e: add resource preview tabs and project-stable Side Panel arrangements
- fdec3b2: Derive ticket and workspace breadcrumbs from canonical hierarchy edges with atomic linked-resource history.
- 7e9c33b: Add a first-class workbench data table renderer for modules and extensions
- 43a57b9: Rename the data renderer API to kanban renderer and adopt the saved-view Kanban design.
- 39de767: Restore ticket interactions and settings, add renderer-owned create forms, and refresh local extension modes.
- 397e448: Generalize the Side Panel controller and preserve its live host across attached, floating, and closed modes.
- d990134: Collapse narrow Panel menus into their owning header and prevent preview tabs from duplicating existing content.
- 336b8be: Place resource actions beside rows and selected breadcrumbs
- da4ea62: Rename Sidebar to Sidenav and add persistent Sidenav visibility and ordering
- 73bc10c: Preserve mode-owned layouts while switching panels without resetting project chrome.
- 1525fed: Restore resource-owned panel layouts across navigation scopes
- 9c5337a: add independently attachable menus to every workbench panel
- aaf9e96: Match the canonical desktop workbench geometry and migrate layout contracts to Region terminology
- d5455b0: Render create forms from the full param vocabulary and the resource's own editable attributes: add markdown and files field types, localize field and chrome copy, and reject unsupported param types instead of dropping them.
- 0e8df32: Add composable Panel tabs and shared add-panel discovery.
- b4b601b: Unify Workbench panel authoring, presentation, navigation, and persistence APIs
- 920fdb7: Keep the full-height Side Panel live while it closes and reopens from Nav Chrome.
- ac90b19: Put navigation history, breadcrumbs, and region controls in persistent Nav Chrome
- 9c5337a: formalize extension roles and persist project-scoped workbench navigation

### Patch Changes

- b22eff8: Persist the Secondary Panel state and keep it closed on first dashboard open.
- 8f4b5f8: Fix workspace terminal cwd inheritance
- ab427b9: Preserve the floating Side Panel when adding a panel tab.
- 5141b36: Migrate the chat UI to the latest design system. Sync the dark-mode neutral and status-border color tokens (and a new `bg.elevated`) to the Pencil source of truth and make the primary accent mode-independent; rebuild the composer so the model, attach, and send controls share one 28px row with the editor; move the workspace hub to wrap the composer with the workspace selector, an open-workspace icon action, and ready/setting-up/failed states; replace the "Working…" label with an elapsed-run-time indicator; and add a `ConversationBrowse` scrubber. Breaking: `ChatPanel`/`ChatInput` drop the `repoMenu` prop and `ChatWorkspaceHub` replaces `changesLabel` with `workspaceControl`.
- 0e8df32: Fix workbench navigation, panel menu placement, terminal actions, and extension webview scrolling
- 1014f2f: Carry recovery and validation steps in shipped messages and skills instead of pointing at repository-only files
- Updated internal dependencies: `@pstdio/ui@0.17.0`, `@pstdio/sdk@0.16.0`

## 0.2.1

_2026-07-09_

### Patch Changes

- f7e81ee: Declare `@pstdio/sdk` and `@pstdio/ui` with caret version ranges instead of `workspace:*`. `changeset publish` runs npm, which does not convert the bun workspace protocol, so `@pstdio/workbench@0.2.0` shipped unresolvable `workspace:*` dependencies and could not be installed outside the monorepo.

## 0.2.0

_2026-07-09_

### Minor Changes

- eeaaef2: Publish the workbench as a standalone, self-contained `@pstdio/workbench` package. The build inlines its private workspace dependencies (`pstdio-extensions`, `pstdio-api-contracts`) and externalizes shared peers (`react`, `@pstdio/sdk`, `@pstdio/ui`, Chakra), so external apps can build a workbench host and mount extension webviews. Adds a `./webview-runtime` entry point that serves the inlined guest runtime bundle.

### Patch Changes

- Updated internal dependencies: `@pstdio/ui@0.16.0`, `@pstdio/sdk@0.15.0`
