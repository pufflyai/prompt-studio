# pstdio

## 0.27.0

_2026-08-21_

### Minor Changes

- 76b5f72: Add editable rich Markdown tables and native heading navigation.
- de6a77b: Version the extension API as `1.0.0-alpha.1` and refuse extensions that declare a different version or a range.
- 26e949f: Stop adopting new extension source automatically. A changed folder in the extensions root is offered as an update in the extension panel, and installs pin to the commit they resolved to.
- b0457fc: Add explicit event-driven refresh contracts for native extension renderers.
- d34a989: Support attempt orchestration with atomic extension claims, session anchors, workspace filters, managed skill refreshes, and repo-owned planner automation.
- fcd283d: Let panels place every native renderer through one renderer reference.
- 86f01d9: Remove unwired extension renderer surfaces and legacy navigation metadata.

### Patch Changes

- 8b7adf9: Add the atomic workbench navigator: mode and resource commit together with one layout-scope rotation, incompatible modes restore their last or default compatible resource, and history replay uses the same transaction
- 8b7adf9: Add composition conformance fixtures: two Lab modes over one shared resource, a cross-extension inspector in the Planner ticket slot, and the tests that lock both in
- 8b7adf9: Add extension composition contracts: resource kinds with semantic slots, resource-panel contributions, plural mode recipes, navigation targets, hierarchy providers, one shared renderer base, and one reference rule with stable composition diagnostics
- 8b7adf9: Update the extension authoring skill, reference docs, and testbench to the replacement composition contracts
- 8b7adf9: Add the workbench composition resolver: one reconciliation pass restores required placements on every context activation, panel menus follow their owner panel, and layouts from older schema versions are discarded
- 883e31b: Add explicit row activation callbacks for data table and Kanban renderers.
- 8b7adf9: Migrate the dashboard extension modules to the replacement composition contracts
- 62e813b: Keep ticket breadcrumbs in sync after creates and renames.
- 70135ed: Restore closed optional composition panels from Add Panel.
- b0457fc: Keep editor focus and selection across saves: the markdown editor no longer reports the initial content import as an edit, saves of unchanged content are skipped, refresh events during a save are treated as self-invalidation, and a reload only remounts the editor when the content actually changed.
- 8b7adf9: Declare Planner and Extension Lab composition with resource kinds, slots, and mode recipes, and move the Lab status bar to a typed status item
- 7cb9939: Replace renderer-owned command bindings with private callbacks.
- 9a09dbf: Prevent browser connections from blocking graceful runtime shutdown.
- 8b7adf9: Preserve editable file drafts, focus, and revision-aware refreshes across save and recovery.
- 8b7adf9: Open browse-root resources from tree items and render group-null tree items at the root without a heading
- 8b7adf9: Serve every extension runtime consumer from one invalidated project snapshot catalog
- e2b8668: update Prompt Studio product descriptions
- 4dc237f: Share renderer invocation context contracts across first-party renderers.
- b0457fc: Fix ticket view UX: enum dropdowns are portaled so panels no longer clip them, tree node resources share the host's canonical URIs so reopening a ticket from the sidenav keeps its properties menu, navigation entries render above the active resource's tree, and reopened documents mount from a content cache instead of a spinner.
- fcd283d: Restore the Tickets breadcrumb root and let tree items opt out of the Extensions group with `group: null`.
- 7c538c9: Unify extension navigation targets and placement strategies.
- 62aedfb: Make composition the sole owner of panel placement and expose placement-aware panel queries.

## 0.26.2

_2026-08-16_

### Patch Changes

- 1d01fc6: Load sandboxed extension webviews across Chromium, Firefox, and Safari/WebKit without cookie authentication.
- 1d01fc6: Close active runtime connections during graceful shutdown

## 0.26.1

_2026-08-14_

### Patch Changes

- b1ea645: Allow authenticated opaque extension webviews to load their read-only runtime assets.

## 0.26.0

_2026-08-13_

### Minor Changes

- 660ec29: Add the secure Electron lifecycle and runtime client foundation.
- 0ade6ec: Add a watch-based extension development workflow with dependency recovery.
- cf7f9d4: Secure local runtime REST, SSE, WebSocket, and extension process transport.
- 0818856: Redesign extension settings with a grouped list, per-extension detail page, default-on automation toggles, and retry/attempt-fix actions for load errors.
- 660ec29: Package the desktop sidecar and isolated development workflow.
- 5e57bf7: Let extensions contribute their own settings sections through a `settingsSections` contribution that panels opt into with `section`, and group the planner's Ticket status and Ticket tags panels under a Planner section; adopt status ring and level bar glyphs as the default status and tag icons
- 4e25f08: Discover, share, promote, and gracefully stop one authenticated ephemeral-port runtime.

### Patch Changes

- 0cfd2c8: Persist Side Panel tabs, presentation, session selection, and chat drafts while showing ticket workspace sessions.
- e66bcae: Validate extension dashboard capability compatibility during extension checks.
- 0917cfb: Recover navigation when persisted extension modes are no longer registered.
- aadc46f: Clean stale attachment dispatch rows after session reattach.
- 541ec5d: Honor extension panel placement when registering and opening workbench tabs.
- 1b8ac94: Rebuild managed extension webviews when source files, manifests, lockfiles, or dependencies change.
- 78e3af9: Rework the Extension Lab into a single Lab mode: native activity items with a project-home shortcut, a status strip, panel menus for creating artifacts and picking cameras, and a Side Panel artifact inspector.
- e777925: Reconcile extension-owned layouts in local dashboard storage.
- 1de89fd: Keep extension replacements available, recover deleted project selections, and keep packaged dashboard API routing runtime-owned.
- 0665a9a: Keep active chat turns sticky and preserve live follow-up order
- d9b7d32: Restore terminal connections in Vite development through runtime WebSocket configuration.
- 9bfcaf1: Build every command parameter form from param editor rows so ticket actions like refine and break into sub-tickets match the run attempt form
- c9fffc3: Keep run parameter menus interactive above dialogs and add icon-aware searchable grouped selections to the standard editor layout
- f924ca2: Show the created-at date in the ticket properties panel next to the updated-at date
- 6603da2: Show the latest workspace session status on ticket cards and open that session in the Side Panel from the workspace badge indicator
- d248bdd: Route extension file ownership mutations through a dedicated domain service so upload/delete own their persistence and live-sync events instead of route handlers
- 5e57bf7: Rebuild the tag editor as flat hairline rows with a combined colour/icon swatch, an appearance popover carrying status ring and level bar glyphs from the new prompt-studio-icons font, inline renaming of tag definitions, a shared segmented control, and one header save bar per settings screen that marks unsaved edits and offers Reset
- cf7f9d4: Bind the runtime before database startup while publishing only after database ownership is acquired.
- 650bbfa: Keep extension sidenav navigation visible in custom modes.
- 7bf5d83: Warn when extension panels use empty eligibleLocations and document panel role choices for extension authors.
- 6766c64: Preserve actionable Bun diagnostics when managed extension webview builds fail.
- b8059df: Ensure workspace terminals use their effective directories and render content when the bottom panel first opens
- 6216218: Route extension template and skill catalogs through the runtime snapshot.
- 78e3af9: Improve Extension Lab modes and Glass Lab artifact workflows
- 78e3af9: Keep first-party extension UI dependencies aligned with the host UI package
- 8d1b072: Show Panel icons in tab dropdowns and on added Sub Panel tabs; render data tables instantly with a skeleton while the first query loads
- 660ec29: Rebuild only webviews affected by extension dependency changes.
- 8d1b072: Add workbench foundations for extension mode chrome: panel icons, native activity items with a host-rendered rail, mode-scoped activity/status regions with sidenav ownership, Side Panel resource inspectors for side-only kinds, native-bodied panel menus on webview panels, a guard that keeps Sub Panels out of Locations, instant cached rendering for table and controls panels, and reconnecting extension webviews after iframe reparent reloads.

## 0.25.2

_2026-08-04_

### Patch Changes

- 0ac6992: Keep auto-started API processes alive after the launching CLI exits while preserving correlated startup diagnostics.
- 225af02: Refresh installed extension revisions when source files reload.
- 225af02: Support extension DataTable multi-selection actions end to end
- 053867b: Stabilize extension webview builds and browser test process cleanup.

## 0.25.1

_2026-07-28_

### Patch Changes

- 08a0fdc: Limit the session tab dropdown to the five latest sessions and give it a fixed width so long titles no longer stretch the menu.

## 0.25.0

_2026-07-28_

### Minor Changes

- 488d0cb: Add vertical split resizing, persistent Secondary Panel state, and terminal tab restoration
- ec66e9e: add resource preview tabs and project-stable Side Panel arrangements
- fdec3b2: Derive ticket and workspace breadcrumbs from canonical hierarchy edges with atomic linked-resource history.
- 7e9c33b: Add a first-class workbench data table renderer for modules and extensions
- 43a57b9: Rename the data renderer API to kanban renderer and adopt the saved-view Kanban design.
- 397e448: Generalize the Side Panel controller and preserve its live host across attached, floating, and closed modes.
- da4ea62: Keep global collections persistent and show selected-resource trees in the Sidenav
- 336b8be: Place resource actions beside rows and selected breadcrumbs
- da4ea62: Rename Sidebar to Sidenav and add persistent Sidenav visibility and ordering
- 73bc10c: Preserve mode-owned layouts while switching panels without resetting project chrome.
- 1525fed: Restore resource-owned panel layouts across navigation scopes
- aaf9e96: Match the canonical desktop workbench geometry and migrate layout contracts to Region terminology
- d5455b0: Render create forms from the full param vocabulary and the resource's own editable attributes: add markdown and files field types, localize field and chrome copy, and reject unsupported param types instead of dropping them.
- 0e8df32: Add composable Panel tabs and shared add-panel discovery.
- b4b601b: Unify Workbench panel authoring, presentation, navigation, and persistence APIs
- 2cd0050: Extract planner automation into a repository extension and derive work activity from live sessions.
- 920fdb7: Keep the full-height Side Panel live while it closes and reopens from Nav Chrome.
- ac90b19: Put navigation history, breadcrumbs, and region controls in persistent Nav Chrome
- 9c5337a: formalize extension roles and persist project-scoped workbench navigation

### Patch Changes

- b22eff8: Persist the Secondary Panel state and keep it closed on first dashboard open.
- 39de767: Restore ticket interactions and settings, add renderer-owned create forms, and refresh local extension modes.
- f0c6bbf: Fix OpenCode skill status guidance and interactive question responses
- da4ea62: Move the project selector from the Sidenav into the global navigation header.
- 7497fd4: Show complete workspace IDs and add JSON output to workspace listings.
- 7e9c33b: Fix multi-step queued follow-up reordering across queue position gaps
- 8b9e6de: Refuse concurrent PGlite database openers with an owned process lock
- d9e33d5: Show active keyboard shortcuts when hovering sidebar rows
- 39de767: Prevent the project picker from reopening after switching projects
- 3acfedb: Add configurable harness run parameters, dynamic provider-qualified model catalogs with model-specific thinking levels, concrete model defaults, and isolated dev seeding.
- 7e9c33b: Improve chat transcript rendering, queued follow-up display, and DataTable interactions.
- 5141b36: Migrate the chat UI to the latest design system. Sync the dark-mode neutral and status-border color tokens (and a new `bg.elevated`) to the Pencil source of truth and make the primary accent mode-independent; rebuild the composer so the model, attach, and send controls share one 28px row with the editor; move the workspace hub to wrap the composer with the workspace selector, an open-workspace icon action, and ready/setting-up/failed states; replace the "Working…" label with an elapsed-run-time indicator; and add a `ConversationBrowse` scrubber. Breaking: `ChatPanel`/`ChatInput` drop the `repoMenu` prop and `ChatWorkspaceHub` replaces `changesLabel` with `workspaceControl`.
- 8f4b5f8: Keep the workspace terminal opener available after closing an auto-opened terminal.
- 09043c8: Add session creation to expanded Sidenav Sessions groups
- 3acfedb: Validate harness select params before registration.
- 0e8df32: Fix workbench navigation, panel menu placement, terminal actions, and extension webview scrolling
- 7e9c33b: Add DataTable renderers for Param Editor-backed JSON, theme-aware color scales, categorical colors, and visualization palettes
- 1014f2f: Carry recovery and validation steps in shipped messages and skills instead of pointing at repository-only files

## 0.24.0

_2026-07-09_

### Minor Changes

- 9b18789: Add host-owned workbench terminal tabs with workspace-scoped PTY sessions, workspace-only terminal chrome, faster terminal first paint, and Extension Lab cleanup that opens host terminals instead of rendering its own xterm route.
- bdfaf8d: Add a native workbench `controls` render surface: extensions contribute command-backed control panels (query/update/apply/reset) that render through the @pstdio/ui ParamEditor, and the check/metadata pipeline threads `controls` records end to end. ParamEditor also gains range, segmented, action, anchor-grid, vector, and file-drop inputs under `param-editor/inputs`.
- bdfaf8d: Rework extension control panels to mirror tree/file renderers: rename the `controls` contribution to `controlsRenderers` (a reusable, placement-free renderer) and place it with a `view` via `controlsRenderer: "<id>"`, so the standard resource-companion path opens it. Resolve localized labels in controls query results, and let resource param chips open their target resource from the panel.
- 9b18789: Add the workspace terminal foundation: host-owned workbench terminal surface backed by the Bun PTY supervisor, `terminal.session` webview capability with host→guest event delivery, `ctx.terminal` runtime wiring, and `createTerminalSessionBridge` in the SDK. The workspace-mode example replaces its static terminal mock with the real surface, and dashboard extension contributions now stay live during same-project metadata refreshes.

### Patch Changes

- ab0193c: Rename bundled core extensions to Prompt Studio labels and stabilize provision hooks.
- ab0193c: Filter dev-only files from installed and packaged extension source copies.
- bdfaf8d: Center dynamic module story header controls vertically.
- 1597b7c: Add workspace reports for agent handoff artifacts.
- bdfaf8d: Refine tree navigation row spacing
- 51d5a3f: Preserve workspace context for nested extension commands.
- bdfaf8d: Use square full-width rows for dropdown menu items
- 0b4be1a: Consolidate API workbench extension metadata mapping through the shared extensions builder.
- b073546: Harden API startup diagnostics, PGlite shutdown handling, and extension reload storm controls.
- dcd55b6: Make Knip dependency and export checks actionable
- 4cb3f17: Stop the chat panel from blanking and remounting on follow-up submit. The session messages hook now preserves the rendered conversation across same-session reconnects, and the message animation hook is StrictMode-safe so the optimistic fade-in doesn't get silently dropped.
- 51d5a3f: Show sidebar row shortcut badges on hover and remove menu chevrons.
- 51d5a3f: Resolve repoFiles for extension commands run from inside a worktree-backed workspace: a worktree now maps to its owning registered repo and mounts its own working tree, so `pst tickets save`/`pull` work from a workspace instead of failing with "This command must be run inside a project repository."
- 51d5a3f: Clear workspace provisioning state when reprovisioning throws.
- 3743e92: Restore each project's previously open workbench view when reopening or switching projects.
- bdfaf8d: Add a full-width ListRow variant for square command palette, project switcher, and searchable menu rows.
- 9b18789: Skip fork-point diff requests for current-branch workspaces, register the history story close command locally, and clean up terminal streams on disconnect.
- 51d5a3f: Fix a skill showing "Out of date" in the dashboard when its installed version already matches the catalog — the badge now compares versions instead of file content, so cosmetic drift no longer flags an update. Also drop the redundant "Skill updated" toast and refresh the skill viewer after an update so it no longer shows the stale version.
- 51d5a3f: Stamp the host workspace id into a worktree's `.pstdio/config.json` on creation so CLI and extension commands run from inside the worktree resolve their current workspace without a flag. The execute endpoint resolves the worktree path from the workspace id and threads both into the command environment, surfacing `ctx.workspaceId` to commands.
- bdfaf8d: Remove notices screen and tighten foundation UI styling
- 9b18789: Name workbench terminal tabs after their running foreground process and update them live, VSCode-style (e.g. `zsh` while idle, `opencode` while it runs).
- 879312c: Add a React xterm.js terminal surface (shipped as `@pstdio/ui/terminal`): a high-level `<Terminal />` component plus a lower-level `useTerminalSession` hook for advanced webviews, consuming the `terminal.session` bridge surface.

  Update planner extension button variants for the current Chakra UI recipe surface.

- 51d5a3f: Provision agent skills through an awaited workspace lifecycle so a session never starts before its skill files exist — fixing the intermittent "Unknown skill" in worktree-backed sessions. Workspace creation now emits an awaited `workspace.provision` event (harness extensions sync their own skill directory) before the workspace is marked ready, session launch waits for readiness, and background setup runs on a non-blocking `workspace.ready`. Harness extensions own their file contributions via the new `ctx.skills` and `ctx.workspaceFiles.syncDir` SDK surfaces, so the host no longer hardcodes `.claude`/`.opencode`/`.agents`.

## 0.23.0

_2026-06-28_

### Minor Changes

- aec472d: Add durable notification center and inbox workflows.
- 21d7d58: Refactor the dashboard sidebar into one mode-reactive widget: a single sidebar composes its header/body/footer from mode-gated contributions (project/session/workspace plus extension-declared modes such as ticket). The session list becomes one collapsible "Sessions" group shown/hidden as a unit; search · new-session are header-region contributions (mirroring the footer) rendered as stacked rows under the project selector, so search stays available in every mode including extension modes like ticket. The workbench left side-panel header now sizes to its content to host the stacked cluster.

### Patch Changes

- 21d7d58: Cap the breadcrumb title at 15rem so long titles (e.g. tickets) truncate instead of stretching the header
- aec472d: Fix notification review actions, extension attribution, and merge completion handling.
- 21d7d58: Refine workbench chrome: compact padded outlined area tabs, a non-fullscreen settings dialog with no breadcrumb and sections expanded by default, eye/eye-off + item icons in the tab and tree hide/show menus, and a tighter tree renderer (no top margin)
- 21d7d58: Keep create workspace dialog controls small and let repository menus open at full height.
- 56fd893: Share searchable modal chrome across dashboard overlays
- 21d7d58: Align dashboard sidebar sizing and remove disabled button hover styling.
- 02a9000: Align data renderer filter menu styling, overlay radii, and workspace list context menus.
- 21d7d58: Allow sidebar header search to be hidden from its row menu
- 02a9000: Keep sidebar action controls fixed in the dashboard header.
- 21d7d58: Allow tree views to opt into host header and footer rows.
- 71f4e5a: Reset ticket document editor state when switching between ticket files.
- 56fd893: Keep ticket sidebar files and workspaces fixed.
- 21d7d58: Use compact chat input corners and hide empty attachment tray.
- 56fd893: Move notifications below search in the dashboard sidebar.
- 21d7d58: Keep collapsed main panel controls right-aligned when the main header has no tabs.
- 02a9000: Use the xs border radius for menu surfaces to match popovers.
- 5c87e98: Keep workspace command palette opens in the singleton project view.
- 21d7d58: Add onboarding stories for tree customization, palette resources, and extension contributions.
- 56fd893: Set tooltip border radius to xs.
- 21d7d58: Vertically center the project picker modal's close button so it aligns with the middle of the search field instead of sitting at the top of the header
- 21d7d58: Project picker modal: move the Create Project action into a dedicated footer button instead of a row at the top of the list, and tighten the footer padding to xs
- 02a9000: Keep the sessions-mode sidebar list visible
- 5e7983a: Fix linked ticket resource panels
- 149410f: Differentiate single and multi-select tag controls.
- 21d7d58: Group the session bubble dropdown by workspace: lead with the active workspace's sessions, then list the rest of the project's sessions in a second group below instead of hiding them
- 56fd893: Implement the extension `sessions.list()` command-environment API (returns the project's sessions with their anchors), and open sessions hinted with `sessionSurface: "floating"` in the dashboard's floating panel instead of switching to sessions mode
- 21d7d58: Sidebar project control is now two standard sm ghost buttons: the project label activates project mode, and a chevrons-up-down affordance opens the project selector.
- 21d7d58: Sidebar tree renderer gains a header region that mirrors its footer (compact rows, no padding); the dashboard's search / new-session rows move out of the left-header into it. Right-clicking the tree now hides/shows header rows, footer rows, body categories, and top-level nav entries (Tickets, Sessions, Workspaces, extension boards/links) via explicit canHide; individual leaf items stay non-hideable. Modals also get a 1px border.
- 21d7d58: Fix workbench header project button height
- 21d7d58: Remove shadow styling in favor of border highlights
- 02a9000: Render tree empty states as compact placeholder rows.
- 21d7d58: Hide empty tree and tab visibility menus
- 02a9000: Move workspace creation into the Workspaces sidebar row action.
- 21d7d58: Fix workspace-mode session sidebar customization and keep new session drafts scoped to the open workspace.
- 21d7d58: Show data renderer sorting as Sort by with directional A-Z/Z-A icons, and list dashboard workspaces oldest-first by default.
- 21d7d58: Fix dashboard sidebar showing every session after switching between workspaces: refresh the sidebar when the primary resource changes so the session list rescopes to the newly opened workspace, and show a "No sessions yet" placeholder when the scoped workspace has no sessions

## 0.22.0

_2026-06-23_

### Minor Changes

- b51460e: Allow creating a project when no coding agents are installed; agents can be added later in Settings > Agents.

### Patch Changes

- d2cea90: Prevent ticket title flicker and ignore fenced code blocks in generated titles.
- 213e8d3: Converge dashboard and workbench extension contribution wiring onto a single host adapter so data renderers, tree renderers, file renderers, and command-palette resources all register through the same path.
- 94a7c37: Fix opening a ticket from a data renderer: the row click no longer re-lifts an already-resolved resource, so the ticket view opens again.
- 213e8d3: Fix modal data-renderer create flows opening created resources.
- 0ca1dca: Fix session attachments: agents now read images as images (extension-correct path), image previews render on sent messages, attachment bubbles sit inside the chat input, draft removal works, and conversation loading no longer crashes on sparse message patches.
- d2cea90: Keep refreshed resource placements self-consistent and derive planner titles from visible markdown text.
- d2cea90: Preserve ticket editor focus while updating saved title.
- aa22c92: Show old and new image previews in workspace diffs.
- 4f3df78: Fix session lifecycle extension hook dispatch.
- cc229d5: Persist manual ticket ordering after planner board drag-and-drop.
- 7dee8b3: Harden the Mermaid renderer: switch to `antiscript` security level, repair the SVG XML so HTML labels render in `<img>`, and keep the fullscreen diagram inside the surface.
- 0ca1dca: Treat missing persisted session files as unsubmitted when deleting session attachments.
- 776eda8: Route all workspace and workspace_sessions sync emits through the service seam and log a `sync_emit_skipped` warn when a DB write is a no-op.
- 7d4e231: Fix extension exports and remove the dead toggle panel shortcut.
- 36487b3: Use outline and primary button variants instead of solid buttons.
- aa22c92: Limit image diff preview payloads, ignore invalid image preview sources, and map image files to the Seti image icon.
- 0ca1dca: Handle concurrent session attachment resolution for the same file.
- 0ca1dca: Restrict session attachment uploads to supported document, image, and code files.
- 0ca1dca: Add prototype session attachments across CLI, dashboard, API queueing, and harness dispatch.
- 0ca1dca: Fail a single queued session whose attachment cannot be resolved instead of aborting the whole drain loop.
- 0ca1dca: Ignore stale persisted dashboard resources after reload.
- 7d4e231: Standardize workbench shortcut defaults around safe cross-platform chords; the command palette now opens with `Mod+K`, and the extension runtime warns when contributions use browser, OS, or developer-tool reserved chords.
- 7a0f4e1: Fix chat session chrome and modal overlay regressions.
- dfe19de: Validate extension command params at the runtime trust boundary so invalid payloads return `rejected` outcomes instead of failing inside handler code.

## 0.21.0

_2026-06-17_

### Minor Changes

- d8383a9: Extensions can contribute file icon themes that render in workbench file trees. New `pstdio-base-themes` extension ships Monokai, Solarized Light/Dark, Dracula, and the Seti file icon theme (the default for file trees); appearance themes/icons were removed from `extension-lab`. The theme picker now groups entries by light/dark.
- d8383a9: Project templates now override same-named extension-contributed templates for that project only (resolved by name); a default set on the shadowed extension template follows the name onto the override. Editing an extension-contributed template's content now forks it into a project template instead of failing, so saved edits persist for that project.

### Patch Changes

- d8383a9: Improve recent sessions start page rows.
- d8383a9: Scope ticket board state to the active project.
- fdac48b: Install default extensions during startup and before listing agents.
- 4b480cd: Move extension diagnostics into their owning cards.
- d8383a9: Apply extension template metadata when creating content overrides
- d5cbc8f: Preserve extension user data: a missing source no longer prunes a data-bearing install, the instance foreign keys now restrict instead of cascade, and uninstall keeps data by default with an explicit opt-in to delete it.
- d8383a9: Show canonical extension CLI namespaces in root help.
- d8383a9: Align chat, diff, avatar, badge, tag, and Monaco editor colors with active theme tokens.
- d8383a9: Keep dashboard projects visible after sync collection idle periods

## 0.20.0

_2026-06-16_

### Minor Changes

- 2cbc762: Allow project settings to update installed extension skills from the dashboard.

### Patch Changes

- 2cbc762: Keep session bubble workspace selection local
- 2cbc762: Open the latest linked session when opening a workspace.
- 42aff47: Show current and installed skill versions in skill details
- 2cbc762: Show backend connection loss in the dashboard status bar.
- 42aff47: Hide the dashboard status bar.
- 2cbc762: Refine workbench theme chrome and session bubble borders.
- 2cbc762: Fix extension-created sessions to start from the linked repo path.
- 2cbc762: Nest ticket-linked workspace breadcrumbs under the planner ticket ancestry.
- 2d78f9a: Drop the framework's hardcoded `ticket` slot inference and open `templateTypeSchema` to a string so extensions own their own template types and slot ids.
- 28b38cb: Let extension settings panels declare a sidebar `icon`; default to `Sliders` when omitted, and set `list-checks`/`tag` on the planner's status and tag panels.
- 42aff47: Open ticket card workspace badges as workspaces
- 42aff47: Remove the success toast after creating a workspace
- 2cbc762: Fix main-left ticket workspace creation prompts.
- 42aff47: Route planner ticket details through a resource-owned sidebar mode
- 2cbc762: Open data-renderer row actions with command params modal.
- 2cbc762: Render the backend connection status as a compact status-bar tag and keep the session bubble above the status bar.
- 2cbc762: Copy planner ticket files into newly created worktrees.

## 0.19.1

_2026-06-15_

### Patch Changes

- 5f60df8: Cache the harness registry per scope and memoize harness availability detection so session and agent endpoints stop rebuilding the registry and re-spawning `<cli> --version` on every request.
- 5f60df8: Fix command dialog harness dropdown clipping.
- 5f60df8: Navigate to selected workspaces from the session dropdown.
- 5f60df8: Show planner ticket titles and resource icons in the main-left ticket panel.
- 5f60df8: Fix planner ticket sidebar sections, board actions, workspace menus, placeholders, and diff badges.
- 5f60df8: Avoid bundling unused dashboard icons and fix menu item ARIA roles

## 0.19.0

_2026-06-14_

### Minor Changes

- 989ffbe: Show linked workspace badges with diff totals on ticket board cards.

### Patch Changes

- 989ffbe: Enabling an installed extension now resolves the source from the host's own PSTDIO_HOME (and rejects sources managed by a different home), so a pst client running against another home can no longer register foreign extension paths that produce duplicate extension ids.
- 989ffbe: Keep extension-backed dashboard pages open when extension metadata refreshes.
- 989ffbe: Harness selector: new session drafts start from the last explicitly selected agent/model instead of the project defaults, and the selection no longer resets to the default model after the first message (view refreshes only adopt fields the backend actually changed, and an unknown model list no longer clobbers an explicit pick).
- 989ffbe: Bundle and install the Codex harness extension (harness-codex) as a default extension.
- 989ffbe: Remove the KNOWN_AGENTS registry: skill setup is driven by harness-declared skill directories and follows the harness lifecycle — skills install for project-enabled harnesses and are removed from a harness's directories when its extension is disabled or uninstalled. /agents/info now reports each harness's skills layout and CLI agent commands accept any installed harness id.
- 989ffbe: Skip stale extension sources without manifests

## 0.18.0

_2026-06-11_

### Minor Changes

- fcc68a9: Add a host-native file renderer primitive: extensions declare a `fileRenderer` view body backed by load/save commands, and the workbench renders editable markdown (MarkdownEditor), editable code (Monaco), or read-only images by file type — no webview.
- fcc68a9: Add the terminal session backend: `ctx.terminal` SDK surface, `TerminalSession*` contracts, and a host PTY supervisor built on Bun's native terminal API.
- fcc68a9: Right-click the empty back area of any dashboard tree view to hide or show its entries; the choice persists per tree view.

### Patch Changes

- fcc68a9: Use project shorthand when allocating planner ticket IDs
- fcc68a9: Fix the dashboard crashing on a dropped sync stream: the connection-lost screen renders above the workbench's Chakra provider, so it now brings its own and shows the reconnect page instead of a blank crash.
- fcc68a9: Stop the extension source watcher from crashing the API when an installed extension's tree contains a dangling symlink (e.g. an unresolved devDep inside its node_modules in an isolated container). Watcher errors are now routed to the logger instead of bubbling up as an unhandled 'error' event.
- fcc68a9: Fix workbench story attachment and file renderer tab state.
- fcc68a9: Make extra small buttons shorter.
- fcc68a9: Open command palette sessions in the floating session bubble.
- fcc68a9: Hide the workspace review bar for draft sessions.
- fcc68a9: Move planner-owned translations into the planner extension and capitalize Harness terminology.
- 57aabe6: Stabilize dashboard harness selectors when a selected harness cannot be resolved.
- bb253f4: Dispatch agent sessions to extension-contributed harnesses: the backend resolves namespaced harness ids from installed extensions (data migration included), per-project harness availability follows extension enablement (project-create agent selection disables unselected harness extensions; /agents/\* accept a project filter), and CLI agent commands resolve bare ids against /agents/info. The legacy agent-config storage is gone: the agent_configs table, projects.selected_agents, and the /v1/agents config endpoints are removed; skills targets and session-default fallbacks derive from installed harnesses, and `pst agents` reduces to list/setup/install-skills.
- fcc68a9: Show extension command palette icons in the dashboard
- fcc68a9: Refine the resource-first dashboard: the ticket breadcrumb follows live title edits, the ticket workspaces list updates from realtime DB events, the harness selector always preselects a value, the template picker defaults to "None" with @pstdio/ui menu items, and command params dialogs use a primary confirm button.
- fcc68a9: Render harness and repository selectors instead of a raw JSON field in the command params dialog, remember the last selected harness, and drop the raw command id shown as the dialog subtitle.
- fcc68a9: Add dashboard start page
- fcc68a9: Sort extension folders before checking duplicate extension contributions
- fcc68a9: Keep resource-scoped header actions visible when workbench chrome receives focus.
- fcc68a9: Fix session draft breadcrumbs.
- fcc68a9: Add resource-aware context menus for tree rows.
- fcc68a9: Show ticket template command params as project template dropdowns.
- fcc68a9: Carry ticket metadata on ticket-linked workspace resources so opening a workspace from a ticket nests its breadcrumb under Tickets / Ticket / Workspace.
- fcc68a9: Show ticket Workspaces empty states and reopen default tree sections when ticket views start.
- fcc68a9: Re-apply a tree renderer's default expanded sections on registration so default-expanded sections (e.g. a ticket's workspaces) start expanded even when an older persisted state predates them.
- fcc68a9: Stop the extension source watcher from recursively watching node_modules, VCS, ignored, and symlinked directories
- fcc68a9: Fix workbench Storybook focus command registration and add an onboarding document renderer story.
- fcc68a9: Render primary workbench header actions with the primary button style and tighten the create-ticket modal height.
- fcc68a9: Fix workbench tree navigation selection so active resources clear stale sidebar highlights.
- fcc68a9: Surface workspace actions (rename, archive, delete) consistently across the dashboard: the board row menu, the workspace header overflow menu, and tree context menus now share the same commands, and a new Archive action is available everywhere. The default workspace stays permanent. Renaming an open workspace now also refreshes its breadcrumb.

## 0.17.1

_2026-06-09_

### Patch Changes

- 77b930c: CLI: list extension command namespaces (e.g. `tickets`) in `pst --help`, show the namespace's commands for a bare or mistyped extension namespace, and align extension namespace help with the yargs layout.

## 0.17.0

_2026-06-09_

### Minor Changes

- ca7222b: Upgrade data renderers with schema-driven attributes, live option colors, custom empty states, list grouping controls, row actions, and dashboard bridges for extension-backed boards.
- 6e40115: Add an extension keybinding contribution API backed by TanStack Hotkeys, surfaced in extension checks, workbench metadata, and the extension testbench.
- ca7222b: Add the extension platform runtime with user and repo extension discovery, extension settings, workbench attachments, hot reload, packaged extension loading, and SDK workbench target APIs.
- d37d82b: Make the `pst` CLI dispatch domain-agnostic: the `tickets` namespace (and all its subcommands, including the draft workflow and `implement`) now resolves entirely through extension-contributed commands. Removes the built-in `tickets`/`statuses`/`tags` CLI groups and the dead legacy ticket api modules from core; only true-core commands stay static.
- 6f35233: Add command palette resource provider contributions.
- d37d82b: Add generic host primitives `ctx.repoFiles` (the invocation repo's working tree, scoped to its root) and `ctx.workspaces.list()` so extension commands can read/write project files and enumerate workspaces without domain-specific core code.
- e887758: Add extension translation tokens, bundles, locale-aware host rendering, and localized extension-lab samples.
- 6de1f50: Add command-backed extension tree renderer contributions.
- 6de1f50: Split shared pstdio skills into a dedicated default extension.
- ca7222b: Make the planner extension own ticket storage, board rendering, CRUD actions, create modal, markdown editor, status settings, tags, and detail properties.
- ca7222b: Move the dashboard onto the workbench runtime with project navigation, sessions, settings, workspace detail views, command palette actions, and persisted panel state.
- ca7222b: Add ticketless and default workspace flows, workspace status automation settings, worktree setup helpers, and CLI/API create and delete support.

### Patch Changes

- e887758: Fix workbench back and forward navigation across mode changes, dashboard ticket editors, and sessions.
- 6de1f50: Add explicit extension command palette contributions
- 900909c: Surface extension command palette resources (such as tickets) in the dashboard command palette.
- e887758: Polish the create ticket modal editor, tag selector flow, and hosted modal sizing.
- ca7222b: Fix extension file upload and storage edge cases
- 900909c: Extension menu actions that declare input (e.g. Run attempt, Refine ticket) now open the shared params dialog to collect agent/model, repository, template, and context before running, instead of executing immediately with no prompt.
- 6de1f50: Add a shared workbench extension host for testbench previews.
- 900909c: Fix ticket-attempt lifecycle and settings: bootstrap worktrees for extension-created attempts, cascade workspace/session/worktree cleanup when a ticket is archived, stop attempt-status pills blanking on workspace changes, persist status/tag reordering and the workspace-status default, and reject unsupported ticket file uploads.
- e887758: Handle deleted extension folders when loading settings
- 6de1f50: Add a Glass Lab artifact demo and testbench theme contribution browsing.
- 88ccfaa: Increase extension source reload debounce.
- 0c45ce8: Fix workbench command palette resource command ids
- 6f35233: Add prompted rename actions for planner ticket files.
- 6de1f50: Fix Docker builds by including the scripts workspace.
- e887758: Simplify diff viewer empty and loading states.
- 6de1f50: Stop command palette success toasts for extension commands
- 6f35233: Clean up default workbench actions and add the mode picker.
- 900909c: Open extension-created sessions automatically in the dashboard.
- 6de1f50: Merge core planning extensions into pstdio-planner and rename worktree setup.
- 8891110: Restore planner ticket workspace creation, bulk ticket reads, review automation failures, status caches, and image attachments.
- 900909c: Set main side panels to the primary background
- 887846e: Discover repo-local extensions live: watch every linked repo's `.pstdio/extensions` root and refresh on repo link changes so extensions added after startup register without an API restart or relink.
- e887758: Make workbench navigation resource-first: add a shared navigation contract suite and route helpers (registerResourceRoute, registerExtensionResourceView); convert the sessions, workspaces, extension board, and ticket-view routes onto them; derive extension view metadata at render time instead of storing it as history identity; replay mode-layout extension views on Back/Forward; and clear project-scoped history when the project is deselected.
- 6f35233: Add a command palette resource provider API: extensions contribute dynamic, searchable palette results via a queryCommand instead of static command entries.
- e887758: Speed up first open by building extension webviews concurrently instead of one at a time.
- 900909c: Remove the help menu entry from the sessions sidebar.
- 3f77df4: Add workspace rename support across the API and SDK.
- ca7222b: Prevent project menu from crashing without picker provider
- 900909c: Make session navigation pick the active or latest session and render static breadcrumbs as non-clickable.
- 900909c: Restore dashboard session bubble chrome.
- d37d82b: Resolve the ticket and ticket-status names for session lifecycle event payloads through the pstdio-planner extension runtime (`get-ticket` / `ticketStatus.read`) instead of the legacy ticket/status services. Resolution stays best-effort so an unavailable extension never breaks session start.
- e887758: Fix extension webview background flashing the wrong color while loading on page switch.
- e887758: Fix dashboard startup i18n and data renderer resource icons.
- 900909c: Fix workspace rename modal and API endpoint
- ca7222b: Use the generic tag editor in settings panels
- 900909c: Restore dashboard ticket location after refresh.
- 88ccfaa: Hide ticket row params for resource-backed extension actions
- e887758: Use the component icon for ticket resources.
- 900909c: Show ticket header actions in the dashboard.
- e887758: Render ticket properties in the workbench right sidepanel with the properties editor, edit tags there, and derive the ticket title from the start of the body instead of a separate input. Give default tags real icons, render them in the create modal and properties panel, and make the create-ticket modal shorter.
- 8891110: Remove legacy backend ticket tables and restore planner-owned ticket workflow automation.
- ca7222b: Fix workspace visibility, ticket creation, and settings panel regressions
- ca7222b: Remove ticket data from workspace list output
- 88ccfaa: Cancel active extension webview builds when the API runtime shuts down.
- 0f29934: Remove persistent extension webview build watchers and rebuild webviews with one-shot builds.
- 0fcf801: fix(PS-35): normalize extension webview resource.open params into the workbench resource shape so guests can open resources by type
- 900909c: Fix dashboard ticket panels and session defaults
- ca7222b: Polish command palette focus colors, sidebar tree reloads, diff loading states, resource icons, side-panel onboarding, shared control behavior, and extension lab layout styling.
- 900909c: Preserve workspace context for header/session actions and expose session resources to extensions.

## 0.16.0

_2026-06-01_

### Minor Changes

- f6ec9d8: Introduce the dashboard workbench: project selection/creation/switching, workspace and session views, date-grouped session sidebar, breadcrumb trail, workspaces board, changes/checks panels (with binary/image diff placeholders), command palette and keyboard shortcuts, help menu, in-workbench project settings including per-attempt-status icons, a host-owned toast viewport, and persisted tree/panel/last-resource state.
- f6ec9d8: Replace the ticket-shaped data renderer with a declarative, schema-driven attribute system (enum/enum-multi/string/date/number/user) whose options can be reactive sources, migrate the workbench data views and persisted store state to it, and drop saved views/favorites.
- f6ec9d8: Replace the legacy project-local automation system with an extension platform: user/repo extension discovery and load scopes, first-class extension settings, extension-provided mode layouts, host-owned workbench target attachments and header actions, hot reload, and SDK workbench/ticket APIs.

### Patch Changes

- f6ec9d8: Add the core tickets extension with bundled ticket skills and templates.
- f6ec9d8: Update ticket list status badges when custom status colors change.
- f6ec9d8: Fix extension setting upserts and source path prefix lookups.
- 88327db: Bundle installed extension entries before importing them in the packaged binary so extensions that depend on `@pstdio/sdk` (or any dependency exposed through an `exports` subpath) load correctly; first-project creation no longer fails with an internal server error.
- f6ec9d8: Group main header side panel presenter buttons on the right.
- 88327db: Surface local API error messages, clearer API startup diagnostics, and add `pstdio logs`.
- f6ec9d8: Resolve local extension dependencies when using skip install.
- f6ec9d8: Cache extension runtime imports under pstdio home and stop resolving extension SDK imports to the workspace SDK.
- f6ec9d8: Remove the extension runtime temp preservation flag.
- f6ec9d8: Add a workbench onboarding story for primary-resource side panel synchronization.
- f6ec9d8: Show button hover theme tokens in the workbench theme story.
- f6ec9d8: Move the bundled Monokai theme into extension lab and map VS Code / extension theme tokens into workbench app tokens.
- f6ec9d8: Move workspace status management into the workspace automations extension with a shared status option editor (icon/color picking).

## 0.15.0

_2026-05-20_

### Minor Changes

- 57c9122: Move workspace attempt-status automation to a host-owned extension kernel command and remove the default `pstdio-core-workspace` extension.
- e03b790: Add workbench collections primitives
- 57c9122: Add post-event refs for ticket and attempt-status lifecycle (`ticketEvents.created/statusChanged/deleted`, `attemptStatusEvents.changed`) so extensions can observe these transitions. Removes the unused `"builtin"` value from `extension_source_kind`. Hooks remain observation-only per the spec (gated operations belong on commands with middleware).
- 57c9122: Add extension lifecycle events and worktree helpers for extension-owned worktree setup automation.
- e03b790: Fold workbench keep-alive into the renderer registry: set `keepAlive: true` on a renderer registration instead of `keepAlive.register({...})` + `WORKBENCH_KEEP_ALIVE_SLOT_RENDERER_ID` bridge widgets. Subtrees read the active widget claim via `useWorkbenchClaim()`.
- b83f965: Add four workbench primitives that unblock dashboard migration: keep-alive widget host (subtrees survive area/mode changes), widened navigation dispatcher (`openTarget` / `navigate` accept resource, view, command, and compound targets), in-memory editor history (`goBack` / `goForward` / `goPrevious` / `recentlyClosed` / `reopenLastClosed`), and scoped layout persistence (`setPersistenceScope` keys layout state per project/workspace).

### Patch Changes

- e03b790: Add workbench onboarding stories, stabilize theme updates, and add widget resource reuse policy.
- 57c9122: Run extension schedules and replace the starter heartbeat plugin with lab heartbeat logging.
- 57c9122: Expose SDK API boundary helpers for settings, known agents, session filters, stream transports, sync projection, and file content access.
- 9077953: Refine project settings Harness controls

## 0.14.0

_2026-05-17_

### Minor Changes

- bdbd3cf: PS-295: SDK `followupSession` queues follow-ups against active sessions instead of failing. `POST /sessions/{id}/follow-up` now returns 200 with a `follow_up: { status, queue_position? }` envelope, allows multiple pending entries per session dispatched FIFO after each terminal transition, and the plugin dispatcher logs swallowed post-hook rejections.

### Patch Changes

- 4193d98: Add a built-in command for focusing the workbench panel.
- b8c09bd: bump mermaid from 11.14.0 to 11.15.0

## 0.13.0

_2026-05-16_

### Minor Changes

- 1cdb3c0: Add global session concurrency settings, persisted queueing, restart recovery, and queued-session UI.
- e3693cb: Add capability-gated bridge webviews for extension routes and workbench renderers.
- 2fa3aa2: Add native extension theme and file icon theme contribution support.
- 4636558: Move extension identity and compatibility metadata into package.json manifests.
- e3693cb: Add the private pstdio-workbench package and workbench foundation APIs.

### Patch Changes

- ebc2c7f: Use a shared performant splitter with collapsible dashboard panels.
- cb8b2d1: Show chat loading state before session messages hydrate.
- c256713: Replace project settings plugins with installed extension metadata.
- 2fa3aa2: Align file tree icon spacing with internal row icon sizing.
- 48ba104: Improve dashboard route workbench performance
- 11079fe: Load workspace diff bodies in the initial workspace changes request.
- 1465bb8: Virtualize command palette asset results and cap default lists
- 18fd50e: Preserve OpenCode message creation times for dashboard chat timestamps.
- 8366f27: Use property params instead of a separate ParamEditor items API.
- cb8b2d1: Preserve the `SessionChatView` instance when toggling between the attached panel and the floating bubble, so the chat no longer rebuilds (virtualizer, chat input, session stream) on every detach/attach. The chat is hosted in a single stable DOM node that is moved between the two chrome slots via `appendChild`, keeping its React state and message viewport intact across the switch.
- 31cd507: Add project Extensions settings panel with enable/disable/uninstall.
- e3693cb: Allow project updates to persist selected agent lists.
- 7fe76bc: Fix chat panel spacing, breadcrumb wrapping, and responsive ticket properties layout.
- 0535717: Enable React Scan in dashboard development mode.
- f857071: Reject unsafe agent skill names with path separators or traversal segments during install and removal.
- 2f5fbad: Restore diff loading and keep interactive diff expansion while hiding only truly large diffs.
- 9ece283: Improve session panel navigation, command palette session search, and unknown CLI command feedback.
- cb8b2d1: Make navigating between the project panels feel instant even with hundreds of sessions and many tickets.

  - `Sidebar` gains an opt-in `virtualize` prop that virtualizes the inner `TreeList` rows via `@tanstack/react-virtual`; the sessions sidebar opts in to keep render cost flat as session count grows.
  - The sessions panel defers mounting the heavy `SessionChatView` subtree one frame after the panel chrome paints.
  - The tickets panel renders its chrome immediately (no more blocking "Loading…" gate) and defers the heavy board view one frame so back-navigation from sessions/workspace feels instant.
  - The project workbench narrows `useRouterState` to a `location` selector so it does not re-render on unrelated router state changes.

- 348dbb3: Surface delete-workspace errors via the injected logger.
- 4eaf2fe: Show ticket card parent paths when parent references use shorthand values.
- 879c960: Fix ticket card session indicators to prefer running and latest active sessions.
- 57f2bb5: Resolve PGlite runtime assets through a vendored package-local directory instead of relative node_modules paths.

## 0.12.0

_2026-05-10_

### Minor Changes

- 3217943: Move the dashboard command palette to opt-in via a new `projectSlots.commandPanel` menu slot. Extensions now choose which commands to surface in the palette by listing them under `menus`, mirroring how header buttons already work. Drops the prior `commandPanel: boolean | object` field on `CommandDefinition`, the `CommandPanelContribution` interface, and the `excludeFromPalette` record field that was opt-out.
- f934e4d: Expose extension-backed project catalogs and harden ticket shorthand allocation.
- d65a8be: Add API-backed extension command execution and CLI routing
- 095fbd3: Remove package-internal skill and template catalogs now that defaults ship from extensions.

### Patch Changes

- 3217943: Surface extension commands in the command palette grouped by extension.
- 9a9087f: Stop dashboard production code from importing backend DTO internals.
- 3217943: Add dashboard extension contribution hosts.
- 2865d17: Use the Harness selector pattern for project default Harness and model settings.
- c1ef6c2: Fix session last-selected model tracking, OpenCode startup payloads, and startup error logs.
- 3217943: Promote the extension webview bridge and runtime-ui helpers from the staging `__TO_MIGRATE/` folder to public locations under `pstdio-extensions`. `bridge/host`, `bridge/guest`, and `bridge/contract` are exposed via subpath exports so dashboard hosts and guest webviews can build against them; runtime-ui's `resolveMenuContributionsForSlot`, `sortDiagnostics`, and `groupDiagnosticsBySeverity` are re-exported from the package root.
- f1b0702: Skip invalid installed extensions during project creation
- eb2f9f4: Fix markdown editor escaping underscores during save/reload, which broke links over multiple round-trips.
- 990b414: Connect the link editor plugin in the markdown editor and add a link button to the floating edit bubble for inserting and removing inline links.
- 03094d7: Prevent ignored private workspaces from being tagged during release.
- 3217943: Restore the `GET /v1/projects/:id/extensions/ui` endpoint so the dashboard's contribution hosts (sidebar nav, header buttons, header overflow, route shell, settings panels, command palette grouping) receive the full `DashboardExtensionMetadata` shape (`extensions`, `commands`, `menuContributions`, `views`, `routes`, `navigation`, `settingsPanels`, `diagnostics`). The endpoint was deleted during the merge with the new extension command runtime; without it every contribution surface stayed empty.
- 3217943: Use Rimless opaque-origin iframe handling from the upstream runtime.
- 3217943: Harden extension webview runtime serving and iframe sandboxing.
- 8adca2c: Add activity components and align semantic UI theme tokens.

## 0.11.0

_2026-05-07_

### Minor Changes

- 3e89b24: Add installed extension source reload, sync, and managed webview build watching.
- 3e89b24: Add editable extension source installation and first-project default extension enablement.

### Patch Changes

- 3e89b24: Add the durable extension schema foundation in `pstdio-db`: installed extension sources, scope-aware extension instances, extension KV/collection state, project-owned extension preferences (template/skill), `project_template_defaults`, normalized project skill files (`skill_files` + `entrypoint_file_id`), and reload events. Activity events now accept any `resource_type` string and carry `source_extension_id`; sessions and workspaces expose `anchors_json: ResourceRef[]`. The legacy `templates.is_default` column moves to `project_template_defaults` while the existing API surface continues to compute `is_default` for compatibility.
- f677fd7: Remove unsupported musl CLI platform packages.

## 0.10.0

_2026-05-07_

### Minor Changes

- c9014e1: Add a Ctrl+Shift+. shortcut to open the command palette pre-filled in command mode, and fix the create ticket and keyboard shortcuts entries closing the follow-up modal instantly.
- 716bbc3: Add a pstdio serve host option for trusted LAN access.
- 0f04d13: Add a project-scoped default Harness and default model: project settings now expose an "Agents" panel, and `createSession` (REST + SDK + plugin helper) falls back to those defaults when callers omit `agent`/`model`.

### Patch Changes

- aa8926b: Add a bundled bug fix ticket template.
- ba88077: Update the Bun toolchain requirement to 1.3.13.
- 8742952: Improve the create-proposal skill to require matching supporting resources.
- 0a1930a: Refresh plugin schedules after project and repo mutations.
- 0a1930a: Extract a new private `pstdio-scheduler` package built on `Bun.cron` and replace the in-process polling scheduler in `pstdio-api` with a thin adapter.
- f394c6a: Flatten ticket and workspace panel spacing
- 5c5d634: Promote `KnownAgent`, `findAgent`, `KNOWN_AGENTS`, `KNOWN_AGENT_IDS`, and `isKnownAgentId` from `pstdio-agents` into `pstdio-api-contracts` so UI and storage layers no longer depend on the runtime LLM package.
- 1ca60d5: Tighten the `@pstdio/sdk/extensions` surface: `ParamDescriptor` is now a discriminated union (per-type fields like `options`, `templateType`, `resourceType` only appear where valid), `CommandDefinition` is parameterized by its `params` schema so `ctx.params` is inferred without casts, and a new `commandsOf(extension)` derives typed `CommandRef`s from the extension definition. Added `defineCommand` / `defineMiddleware` / `defineHook` builders, an `apiVersion: "1"` field on `ExtensionDefinition`, capability-mixin interfaces (`UiContributions`, `BehaviourContributions`, …), and JSDoc on the public surface. `MiddlewareDefinition`, `HookDefinition`, and `ScheduleContribution` now split typed refs (`command`/`event`) from untyped string ids (`commandId`/`eventId`) so the typed path can't silently degrade.
- 0852643: Cap the session selector dropdown at 420px so long session titles do not stretch the menu.
- 7f7cfa2: Add pst npm binary alias.

## 0.9.0

_2026-04-29_

### Minor Changes

- 0b1dffd: Add activity event APIs and SDK methods for listing ticket, workspace, session, and project activity streams.
- 5f6a945: Add parent-id flags to ticket create and update commands

### Patch Changes

- 41f858d: Bound multiline sticky user messages with scroll handoff
- 92ce38e: Handle OpenCode question/todowrite UI support and make plugin command execution honor local PATH.
- 1134ae8: Allow collapsing the ticket sidebar sub-tickets section.
- f8edf81: Fix OpenCode question replies getting stuck and stale question prompts remaining visible.
- 92ce38e: Reduce xs button icon sizing in the shared Chakra recipe.
- 27d8d29: Move shortcut help to a letter-based binding so slash typing works on international keyboards.
- b7b60d0: Fix OpenCode session starts to honor configured default models.
- 1134ae8: Sort sidebar sub-tickets by shorthand and show each sub-ticket status indicator.
- 084969c: Fix ticket workspace grouping menus, filtered columns, list drag-and-drop, and list indentation.
- 0fa25d0: Add parent and sub-ticket field output to `pstdio tickets view`.

## 0.8.0

_2026-04-24_

### Minor Changes

- f86d12b: Add Mermaid block preview and inline editing support in rich text markdown editors.
- 115d70c: Add bundled `architecture-overview`, `contracts`, `research`, and `schemas` document templates for proposal scaffolding.
- 115d70c: `pstdio templates write` now accepts `--target <path>` to render a template to an arbitrary file path (relative to the current directory, parent dirs auto-created, existing files overwritten), and `--ticket <shorthand>` for the previous ticket-scoped behavior (writes `.pstdio/tickets/<shorthand>/ticket.md` and preserves the existing H1 title). Exactly one of the two flags is required. A repeatable `--var KEY=value` flag passes additional placeholders to the template. Breaking: callers that previously used `--target <ticket-shorthand>` must switch to `--ticket <shorthand>`.

  Added bundled document templates `contracts`, `schemas`, and `research` for ticket-scoped API/schema/investigation notes, and updated the `create-proposal` skill to scaffold them with `pstdio templates write --target .pstdio/tickets/<shorthand>/<file>.md`.

- 73e707e: Improve markdown editor code block authoring with inline editing, block insertion, and copy actions.
- 7676e4b: Allow dashboard users to stop active sessions from the chat composer.
- e6b9f1e: Add first-class scheduled plugin handlers with cron validation, runtime execution, and bundled schedule examples.
- 115d70c: Rename bundled template files to `name.[template|prompt].md`, split the code-review prompt into a `review-code` prompt plus a new `code-review` document template, and remove the legacy `review-me` document template.
- 000bdcb: Replace labels with tags system and add inline tag editing via badge dropdowns

### Patch Changes

- d9c5cd4: Add a sidebar action to create empty workspaces without starting a session and preserve workspace-only hook coverage
- ed09ec7: Add right-click resource context menus for ticket cards, workspace items, and session items using shared header action composition so default and plugin actions stay consistent with dialog, pending, and disabled behavior.
- 115d70c: Add `saveTicket` SDK plugin helper that persists a local ticket file, its attachments, and artifacts via the client, mirroring `pstdio tickets save`. Use it from plugin hooks or actions to upload ticket edits from a worktree. The bundled code-review lifecycle plugin template now calls `saveTicket` on review-ready transitions so ticket edits and generated artifacts are persisted before the review session starts.
- 2228ec9: Disable branch switching in session repo menus to prevent misleading branch state and stale workspace defaults
- 70aac27: Remove hard-coded run attempt button from the workspace header.
- 554e738: Fix wrong LLM being used on submit when the agent browser auto-picks a model after an agent switch
- 115d70c: Fix bundled agent skill docs: replace references to the non-existent `pstdio hooks` CLI with the real `pstdio plugins` command group, drop the fictional shell-hook runtime in favor of SDK plugin guidance, rename `write-pstdio-hook` → `create-pstdio-plugin` and extend it to cover both hooks and actions, and clean up the CLI reference (remove `projects startup-script`, `workspaces startup-log`, `docs init`, `workspaces delete --force`; add `agents install-plugins` and the full set of `tickets` subcommands).
- ab2c414: Keep OpenCode follow-up sessions in progress until the assistant response appears.
- beaa04e: Fix CI hangs from scheduled plugin startup during tests.
- 54f69cb: Fix the dashboard shortcut help menu and keyboard shortcut panel behavior
- ab3b73c: Fallback stale sync reconnects to a full init payload so dashboard ticket data stays complete after inactivity.
- e6de23c: Display OpenCode API errors (e.g. server overloaded) in the conversation and mark the session as failed.
- 7b61d53: Stop persisting ticket status in local ticket frontmatter.
- d9c5cd4: Hide the agent selector in create-workspace dialogs while keeping it available for run-attempt flows.
- e9ac4d5: Align diff drawer ordering with file tree sorting
- ab2c414: Support linking an existing worktree when creating a workspace from the CLI.
- 582bcae: Tune rich text spacing across the editor and blog
- c12f747: Fix runCommand to inherit runtime process.env updates when no env option is passed, so plugins picking up PATH mutations see them.
- 59f53b4: Move agent setup from onboarding into project creation with a second agent-selection step and block new project creation when no installed agents are available.
- 808e50b: Fix Claude Code tool timeline rendering so existing tool renderers resolve reliably and Edit and TodoWrite render with structured output.
- 948be5a: Fix ticket workspace grouping columns and trim default display fields.
- d0abed3: Fix markdown editors so nested list items render correctly from markdown and can be indented with Tab.
- 54f69cb: Add a centralized dashboard shortcut registry with project-level handlers, shortcut help, and shared menu shortcut labels
- 95e20be: Fix markdown bubble menu visibility so it only appears for non-collapsed text range selections.

## 0.7.0

_2026-04-17_

### Minor Changes

- 013310f: Fix OpenCode session timeout and restart recovery: separate provider-managed lifecycle from activity-managed lifecycle and add disconnected session status
- b01f555: Show plugin actions in ticket, session, and workspace headers.

### Patch Changes

- b01f555: Set selected text in dark mode to use `fg.inverted` for better contrast on accent highlights.
- b01f555: Refresh the orange theme palette for clearer warning states.
- 36cbefa: Add durable activity-events database schema and query service with cursor pagination.
- f95b332: Strip non-letter characters from project shorthands
- e100c9b: Add built-in workspace archive/delete actions with API-backed mutations and delete confirmation.
- b01f555: Fix legacy plugin ticket actions and cover required action params in e2e.
- 48e08db: Show the tickets list header as a breadcrumb with the shared Tickets icon label.
- e242254: Deprecate the post-hook queue: `postAttemptStatusChange` now fires immediately on transition instead of being deferred until the session reaches a terminal state.
- b1e3fda: Add empty placeholder in ticket sidebar when workspace list is empty.
- b01f555: Use the shared primary button style for dashboard call-to-action buttons.
- b01f555: Restore semantic sidebar icon colors for session status rows.
- 3dd7a83: Fix attempt creation so the worktree starts from the freshest commit on the chosen branch and the branch sent in the request matches what the branch selector displays.
- c9a2e69: Resolve plugin action targets by shorthand so `ctx.target` is populated when a ticket or workspace shorthand is passed as `target_id`.
- c9a2e69: Fix `pstdio tickets save` failing with opaque `[object Object]` errors when the ticket had a `blocked_reason` frontmatter field, and surface zod validation errors in the SDK client instead of stringifying them.
- c9a2e69: Recover stale OpenCode sessions and reconnect dropped session streams.
- b01f555: Hide the attached session panel workspace hub while viewing workspace routes.
- e11371e: Add deferred workspace-scoped session drafts from the ticket sidebar sessions section.
- b01f555: Add a bundled workspace plugin action to open the workspace worktree in VS Code.
- b01f555: Extract reusable bubble and attached panel shells into @pstdio/ui and keep the attached panel mounted across layout-story navigation.
- e242254: Improve shared searchable menus for parent-child list switching and clearer browser headers.
- f95b332: Persist new ticket modal content across dashboard refreshes.
- 2fd38e9: Hide the session workspace hub in bubble view while on workspace routes.
- 3a77d88: Support multi-file bundled skills end-to-end across install paths, API responses, and dashboard skill viewing.
- 62d3854: Highlight both the workspace and its active session in the ticket sidebar
- e242254: Use the compact menu item styling for the session selector footer.
- b01f555: Add `pstdio plugins list` and `pstdio plugins register` commands.
- 3dd7a83: Allow dashboard actions to run independently while other actions are in flight.
- 62d3854: Auto-select and persist workspace session selection in ticket workspace navigation
- b01f555: Preserve the current session panel layout when switching sessions from ticket and workspace navigation.
- f21a710: Improve workspace diff loading, file navigation, and sidebar planning navigation cues
- c9a2e69: Source OpenCode turn liveness from server polling instead of the POST /message HTTP lifetime, so long-running turns no longer get marked disconnected when the POST request times out.
- c9a2e69: Fix bare URLs rendering as clickable links in rich messages.
- e242254: Clarify the default code review template structure and review criteria.
- 8678885: Reuse the shared file list panel for workspace checks so artifacts get the same tree/search/view-mode controls as the diff view.
- 8678885: Add workspace Changes/Checks tabs with DB-backed artifact persistence and refresh behavior.
- 1bd5113: Improve ticket and workspace breadcrumbs with ticket titles and short attempt labels
- a4b7665: Remove the "Open in VS Code" action from the bundled workspace-actions plugin template.
- c9a2e69: Show workspace diff regardless of session status — previously the diff panel was hidden until the workspace's latest attempt session reached a settled state.
- 3a77d88: Render the project settings skill viewer with a file tree (icons + folders) and move the skill title and description above the editor so they align with its width. On startup, also auto-sync existing project skills that still hold a single SKILL.md file with the latest bundled multi-file skill (when the SKILL.md content is unchanged), and reinstall them to repos.
- 013310f: Reattach orphaned OpenCode sessions on server restart instead of marking them disconnected
- 3dd7a83: Fix local checkout CLI startup when `pstdio` is launched outside the repo root.
- b01f555: Make attached session panels resizable in the dashboard and shared UI shell.
- fb19526: Open selected sessions when the panel is closed while preserving attached mode
- 2eaa0b3: Replace ticket workspace/session indicators with a unified workspace badge, including attempt-status tooltip support and sidebar/board integration.
- 3dd7a83: Fix local workspace docker runs and improve long error toasts.
- b01f555: Add a workspace diff-panel empty state when no file changes are available.
- b01f555: Adjust dark active background color to better match the shared theme.
- b01f555: Move the version entry from the shared sidebar project menu into the dashboard Help menu.

## 0.6.1

_2026-04-06_

### Patch Changes

- 42c9d33: Fix starter plugin backfill for linked repos.
- 42c9d33: Fix packaged pstdio plugin loading for project TypeScript plugins.
- 42c9d33: Use package version instead of PSTDIO_VERSION.

## 0.6.0

_2026-04-06_

### Minor Changes

- 1d384f8: Add getAttemptsForTicket helper for plugin ticket attempts lookup.
- 1d384f8: Split SDK ticket attempt helpers into session-backed createAttempt and workspace-only createWorkspace.

### Patch Changes

- 1d384f8: Rename SDK hooks to pre/post naming and document the updated SDK hook cookbook.
- 1d384f8: Add a `createSession` plugin helper that automatically injects `project_id` from plugin context.
- 1d384f8: Make session hook contexts expose `ticket` and `workspace` as full objects when a workspace is linked.
- 1d384f8: Add a workspacesForTicket plugin helper for ticket-scoped workspace lookups.
- 1d384f8: Move `renderPrompt` off the SDK root export and keep it available from `@pstdio/sdk/prompts`.
- 1d384f8: Publish the SDK from built dist artifacts instead of raw source.
- 1d384f8: Surface rich ticket and workspace hook objects.
- 1d384f8: Stabilize attempt session hooks until linked worktree setup completes.
- 1d384f8: Keep plugin-backed API routes working when `.pstdio` SDK installation is unavailable.
- 1d384f8: Expose ticket/workspace objects in session hook contexts.
- 1d384f8: Add a plugin follow-up helper and fix review lifecycle session routing.
- 1d384f8: Include ticket status_name in session hook ticket context and SDK typing.
- 1d384f8: Use wildcard workspace manifest copies in Docker builds to avoid hand-maintained package lists.
- 1d384f8: Consolidate plugin runtime boundaries: introduce pstdio-api-contracts for shared API types, make SDK and API consume contracts, move hook dispatch into pstdio-plugins/hooks, delete pstdio-hooks
- 1d384f8: Restore documented default pstdio plugin templates
- 1d384f8: Keep SDK root imports scoped to shared client and types.
- 1d384f8: Rename bundled plugin templates from .ts to .ts.txt to avoid TypeScript tooling interference.
- 1d384f8: Add SDK plugin helpers for common CLI workflows and expose missing ticket/workspace status helper endpoints.
- 1d384f8: Narrow plugin action `ctx.target` by `targetType` discriminant — no cast needed.
- 1d384f8: Align TypeScript dependency ranges to ^5.9.3 across workspace packages.
- 1d384f8: Backfill missing starter plugins when reopening linked repos.
- 1d384f8: Allow runCommand to accept Bun.spawn directly.
- 1d384f8: Update setTicketStatus helper input to { ticket, status }.
- 1d384f8: Use DB-backed prompt templates for `tickets implement` instead of packaged prompt files.

## 0.5.1

_2026-04-04_

### Patch Changes

- 2af6eba: Stabilize asynchronous hook tests by polling for hook outputs instead of relying on fixed sleeps

## 0.5.0

_2026-04-03_

### Minor Changes

- 00001f2: Add --template and --var flags to sessions create and follow-up commands
- 00001f2: Add attempt-status hooks: blocking pre-hooks that gate status transitions and deferred post-hooks that fire after session completion
- 00001f2: Add shared pino-based runtime logging with configurable JSONL targets across CLI, API, and hooks.

### Patch Changes

- 3e8d1b7: Add API service layer to centralize state-transition orchestration (DB update + EventBus emit + hook firing) for sessions, tickets, and workspaces
- 3e8d1b7: Use the configured default agent for sessions created without --agent.
- 00001f2: Include workspace ticket in attempt-status hook payloads.
- ce8bf76: Refine bundled pstdio skills: remove stale review references, clarify status handling, and split CLI guidance into references.
- ce8bf76: Fix packaged project setup.
- 3e8d1b7: Add structured Hono request logging middleware for API routes.
- 00001f2: Surface pre-hook rejection output when setting workspace attempt status.
- 00001f2: Archive ticket-linked workspaces and sessions together.
- 00001f2: Fix hook logging to recreate the hooks logger when log destination env settings change in-process.
- ce8bf76: Ensure API-managed hooks stay executable and run consistently across all session status-transition paths.
- 00001f2: Add `workspaces list-statuses` and point `workspaces set-status --help` to it.
- 00001f2: Fire post attempt-status hooks immediately when no session id is provided.
- 00001f2: Propagate `original_session_id` into attempt-status hook payloads for session-driven status updates.
- 00001f2: Fix Claude follow-up hangs and reset session timeouts on stream activity.
- 00001f2: Fix Claude follow-up message ordering in the dashboard stream and add provider E2E regression coverage.
- 3e8d1b7: Rename ticket worktree cleanup commands to `tickets worktrees` and add `list` plus `remove-all` subcommands.
- 5684e88: Move `pstdio-logging` to devDependencies so changeset versioning remains valid.
- 00001f2: Fall back to PSTDIO_SESSION_ID in workspaces set-status.
- 00001f2: Fix worktree creation failing when prunable (stale) worktree entries exist
- ce8bf76: Include workspace attempt statuses in session hook payloads so post-session-success can react to review-ready and blocked states.

## 0.4.0

_2026-03-27_

### Minor Changes

- 16dc458: Add `tickets clean-worktrees` CLI command and `post-ticket-archive` hook template to remove worktrees on ticket archive.
- 277d7c9: Replace workspace.session_id with workspace_sessions join table to support multiple sessions per workspace

### Patch Changes

- 8eaf4ac: Add docs initialization guidance to the bundled documentation skill.
- 8eaf4ac: Add a hooks create command and document all supported hook types.
- 8eaf4ac: Fix validate failures in ticket attempts and session chat flows
- 277d7c9: Persist blocked_reason frontmatter and mark saved tickets as non-draft
- 8eaf4ac: Add version metadata to bundled skill templates.
- 16dc458: Fix missing workspace setup translations in the session workspace hub.
- 8eaf4ac: Document hook creation in the bundled pstdio skill template.
- 16dc458: Restore chat input top corners when the workspace hub is hidden
- 8eaf4ac: Create the default post-worktree-create hook when new projects register a repo.
- 277d7c9: Persist parent_id frontmatter when saving tickets
- 47b5f7a: Keep ticket cards within kanban column bounds by wrapping long unbroken title strings and add Storybook coverage for URL-like tokens.
- 8eaf4ac: Add a shared searchable menu for hooks and repo branch selection.
- 277d7c9: Show parent shorthand in the ticket details panel
- 8eaf4ac: Add a token usage story for the chat message parts renderer.

## 0.3.0

_2026-03-24_

### Minor Changes

- 49e6c52: Redesign tags as typed field definitions with options (single-select/multi-select).

### Patch Changes

- 8b04ba9: Improve the documentation empty state with repo authoring guidance
- 8b04ba9: Show a workspace diff hub above session chat inputs for workspace-backed sessions.
- abadf39: Replace read-only Monaco diff surfaces with git-diff-view and add adapter coverage tests.
- 8b04ba9: Keep the first session message visible while a new session starts streaming.
- 8b04ba9: Make project navigation open tickets by default
- 8b04ba9: Fix workspace diff CPU spike: only fetch diffs for settled attempts on kanban, add lightweight diff-summary endpoint, refresh diffs on edit actions in workspace page. **Breaking:** `resolveBase` now prefers the reflog fork point over merge-base, so diffs reflect the actual branch creation point rather than moving with the default branch.
- 8b04ba9: Keep ticket attachment lists in sync after saves and show icons in the ticket sidebar.
- 8b04ba9: Keep session streams alive with heartbeat events and raise Bun idle timeout to 20 seconds.
- 8b04ba9: Add repositories panel to project settings with remove support
- 8b04ba9: Prevent chat repo controls from wrapping
- 0a1f61d: Sort tickets in kanban columns by `created_at` in the default manual ordering.
- 8b04ba9: Replace the session chat empty state with a reusable chat skeleton and unavailable-session fallback.
- 8b04ba9: Use dashboard translations in session chat stories.

## 0.2.1

_2026-03-22_

### Patch Changes

- 403da88: Resolve stale in_progress session status to completed when process handle is lost.
- 205cf2d: Add a Skills section in project settings so users can browse installed skills and read their content in the dashboard.
- 05705ba: Remove the backend connection indicator dot from the dashboard layout.
- 403da88: Fix server startup blocking by making orphaned session resolution non-blocking
- 6e577b6: Add template-aware docs rendering so changelog docs entries use the changelog UI.
- 14b174f: Reshape global settings into a sidebar Agents panel and support manual agent setup with executable paths.
- 05705ba: Use ScrollArea for rich-text content editable scrolling.

## 0.2.0

_2026-03-20_

### Minor Changes

- 7289bdd: Add worktree lifecycle hooks system. Define shell scripts in `.pstdio/hooks/<hook-name>` to run automatically during create, commit, merge, rebase, and remove events. Replaces startup_script with post-create hook.

### Patch Changes

- b3e224d: Recover from incomplete embedded migration extraction
- 7289bdd: Improve chat message spacing and add scroll-area handling for rich messages and chat input.
- c88802f: Add a configurable TicketsWorkspace with persisted display settings, filtering controls, and ticket grouping utilities.
- 7289bdd: Align packaged runtime smoke expectations with the current bundled template seed set.
- d245e21: guard template type updates and fallback invalid settings template routes

## 0.1.7

_2026-03-19_

### Patch Changes

- f711a25: Improve dashboard tab titles for deep project and template settings views.
- 15bf046: Enable ticket details to select, edit, and autosave attached ticket files with URL-synced file selection.
- 20c6787: Sync local ticket file frontmatter when updating ticket status via CLI.

## 0.1.6

_2026-03-17_

### Patch Changes

- 1b823eb: Allow creating project templates with empty content from dashboard settings and cover the flow with a UI e2e regression test.
- d925ee7: Update dashboard page titles to reflect the active project view.
- 79285d3: Add startup script save/pull workflows and settings editor
- 79285d3: Run startup scripts in backend workspace creation for CLI, dashboard, and API flows.
- cad7cc9: Persist unsent chat drafts per session and cap composer height in the sessions chat panel.
- a62b18b: Auto-start ticket refinement sessions from the tickets board when a create action uses a ticket template.
- de3bae4: Keep the new-session chat editor stable while typing and add a sessions e2e regression test that verifies focus is retained across consecutive keystrokes.
- 06ebefb: Remove linked git worktrees when workspaces are deleted or archived.

## 0.1.5

_2026-03-15_

### Patch Changes

- 10d3b38: Update Discord links to the current community invite URL.
- 6ac92d7: Fix untracked file diff stats so new files show correct addition counts.
- 6ac92d7: Fix sync stream race condition that could drop session status updates during SSE bootstrap
- 10d3b38: Generate the pstdio package README from the root README during publish.
- a3cfc65: Add router-agnostic SidebarNext and SidebarTree components with persisted zustand state and story-driven behavior coverage.

## 0.1.4

_2026-03-15_

### Patch Changes

- 07e2570: Fix project creation flow and sync delete handling in dashboard.
- 186ce1e: Show model and repo selectors in workspace conversation chat.
- 186ce1e: Fix dashboard ticket card session indicator to use session lifecycle status.
- 370ca01: Fix packaged project creation seeding in compiled binaries

## 0.1.3

_2026-03-13_

### Patch Changes

- 9f1143f: Fix dashboard serving wrong content-type for root path, skip duplicate GitHub releases, fix version script formatting and lock file sync

## 0.1.2

_2026-03-13_

### Patch Changes

- 9e42007: Fix npm entrypoint failing under Node.js due to require() in ESM scope by renaming bin/pstdio.js to bin/pstdio.cjs

## 0.1.1

_2026-03-13_

### Patch Changes

- 08be990: Add optimistic follow-up messaging and keep chat input focused after send.
- a853ae3: Hide archived sessions in the sessions panel and hide the session bubble on sessions routes.
- a853ae3: Prevent PGlite corruption by rejecting concurrent DB opens and closing on startup failures.
- a853ae3: Hide draft tickets from the dashboard tickets panel list and board views.
- a853ae3: Inject the CLI version from package metadata so compiled binaries report the correct version.
- 08be990: Open the session bubble for implement and refine ticket submits.
- 08be990: Switch ticket local directories to shorthand-only paths and automatically normalize legacy slugged folders.
- 08be990: Improve session UX by returning Open in bubble to the last non-sessions page and exporting full conversation JSON.
- a853ae3: Fix session bubble rendering, musl binary resolution, and release version sync ordering.
- a853ae3: Ensure tickets write always sets draft: true in local frontmatter.
- a853ae3: Handle session stream `/messages` full-array add/replace patches in the dashboard chat reducer.
- 08be990: Skip empty session message parts when storing and rendering.
- 08be990: Show ticket board card session indicators and workspace diff badges with direct open actions.
- a853ae3: Trim bearer tokens before API authentication checks.

## 0.1.0

_2026-03-11_

### Minor Changes

- 5134866: Initial release

### Patch Changes

- 35b773f: Replace the bundled legacy requirements template with a merged `prd` template and update docs and skills to scaffold requirements docs with `prd`.

  Add a bundled `lessons-learned` postmortem template and document it across pstdio skills and template docs.
