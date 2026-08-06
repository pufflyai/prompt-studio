# @pstdio/workbench

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
