# @pstdio/sdk

## 0.21.0

_2026-08-27_

### Minor Changes

- 3e31835: Add CLI, SDK, and dashboard clients for automation tokens, runs, and managed connections.
- 5329cb7: Replace overlapping extension UI contracts with alpha.4 views, placements, navigation, and shared workflow statuses.
- d429bb5: Add persistence and public contracts for remote execution, managed connections, and automation runs.
- 40e4fd6: Add provider-backed workspace creation.
- d7a5b16: Move template content and editing workflows from core into owning extensions.
- d7a5b16: Add extension package files, host state, safe worktree cleanup, and scoped repository files.
- d63d57d: Remove the host workspace mode and target workspace actions with workbenchResourceKinds.workspace.
- 545d925: Pass command and middleware parameters as the second handler argument across the extension API.
- 545d925: Add stable workbench views and migrate extension navigation.

### Patch Changes

- 82138c3: Update the Bun toolchain requirement to 1.3.14.

## 0.20.0

_2026-08-25_

### Minor Changes

- 8db7aa1: Add a typed webview client (`createWebviewClient`) with react-query hooks to the SDK and expose the owning extension id to webview guests.

## 0.19.0

_2026-08-24_

### Minor Changes

- 88e89b2: Add workspace file browsing, stable Monaco editing, file and folder actions, drag-to-move entries, file icons, live change badges, current and fork-point Changes views, and macOS Finder reveal.
- c257623: Fetch default extensions from Git, add concurrent Available installs with contribution details and upgrades, preserve data across clean reinstalls, and seed isolation with a repo-local notification example.

## 0.18.0

_2026-08-21_

### Minor Changes

- d34a989: Add workspace filtering to the session client for attempt orchestration.
- 86f01d9: Remove unwired extension renderer surfaces and legacy navigation metadata.

### Patch Changes

- 8b7adf9: Add extension composition contracts: resource kinds with semantic slots, resource-panel contributions, plural mode recipes, navigation targets, hierarchy providers, one shared renderer base, and one reference rule with stable composition diagnostics
- 883e31b: Add explicit row activation callbacks for data table and Kanban renderers.
- 7cb9939: Replace renderer-owned command bindings with private callbacks.
- 4dc237f: Share renderer invocation context contracts across first-party renderers.
- 7c538c9: Unify extension navigation targets and placement strategies.
- 62aedfb: Make composition the sole owner of panel placement and expose placement-aware panel queries.

## 0.17.0

_2026-08-13_

### Minor Changes

- 0ade6ec: Add a watch-based extension development workflow with dependency recovery.
- cf7f9d4: Secure local runtime REST, SSE, WebSocket, and extension process transport.

### Patch Changes

- 0818856: Re-export extension automation, harness, and attempt-fix API types.

## 0.16.0

_2026-07-28_

### Minor Changes

- 7e9c33b: Add a first-class workbench data table renderer for modules and extensions
- 43a57b9: Rename the data renderer API to kanban renderer and adopt the saved-view Kanban design.
- 39de767: Restore ticket interactions and settings, add renderer-owned create forms, and refresh local extension modes.
- da4ea62: Rename Sidebar to Sidenav and add persistent Sidenav visibility and ordering
- 73bc10c: Preserve mode-owned layouts while switching panels without resetting project chrome.
- d5455b0: Render create forms from the full param vocabulary and the resource's own editable attributes: add markdown and files field types, localize field and chrome copy, and reject unsupported param types instead of dropping them.
- b4b601b: Unify Workbench panel authoring, presentation, navigation, and persistence APIs
- 9c5337a: formalize extension roles and persist project-scoped workbench navigation

### Patch Changes

- 3acfedb: Add configurable harness run parameters, dynamic provider-qualified model catalogs with model-specific thinking levels, concrete model defaults, and isolated dev seeding.

## 0.15.0

_2026-07-09_

### Minor Changes

- bdfaf8d: Add a native workbench `controls` render surface: extensions contribute command-backed control panels (query/update/apply/reset) that render through the @pstdio/ui ParamEditor, and the check/metadata pipeline threads `controls` records end to end. ParamEditor also gains range, segmented, action, anchor-grid, vector, and file-drop inputs under `param-editor/inputs`.
- 51d5a3f: Stamp the host workspace id into a worktree's `.pstdio/config.json` on creation so CLI and extension commands run from inside the worktree resolve their current workspace without a flag. The execute endpoint resolves the worktree path from the workspace id and threads both into the command environment, surfacing `ctx.workspaceId` to commands.
- 9b18789: Add the workspace terminal foundation: host-owned workbench terminal surface backed by the Bun PTY supervisor, `terminal.session` webview capability with host→guest event delivery, `ctx.terminal` runtime wiring, and `createTerminalSessionBridge` in the SDK. The workspace-mode example replaces its static terminal mock with the real surface, and dashboard extension contributions now stay live during same-project metadata refreshes.
- 51d5a3f: Provision agent skills through an awaited workspace lifecycle so a session never starts before its skill files exist — fixing the intermittent "Unknown skill" in worktree-backed sessions. Workspace creation now emits an awaited `workspace.provision` event (harness extensions sync their own skill directory) before the workspace is marked ready, session launch waits for readiness, and background setup runs on a non-blocking `workspace.ready`. Harness extensions own their file contributions via the new `ctx.skills` and `ctx.workspaceFiles.syncDir` SDK surfaces, so the host no longer hardcodes `.claude`/`.opencode`/`.agents`.

### Patch Changes

- 51d5a3f: Preserve workspace context for nested extension commands.
- 879312c: Add a React xterm.js terminal surface (shipped as `@pstdio/ui/terminal`): a high-level `<Terminal />` component plus a lower-level `useTerminalSession` hook for advanced webviews, consuming the `terminal.session` bridge surface.

  Update planner extension button variants for the current Chakra UI recipe surface.

## 0.14.0

_2026-06-28_

### Minor Changes

- aec472d: Add durable notification center and inbox workflows.

### Patch Changes

- aec472d: Fix notification review actions, extension attribution, and merge completion handling.
- 21d7d58: Extension tree renderers can mark sections and nodes with canHide to opt them into the host tree's hide/show customization menu.
- 56fd893: Add `ctx.sessions.list()` to the extension command API so extensions can enumerate a project's sessions (and their anchors)

## 0.13.2

_2026-06-23_

### Patch Changes

- 0ca1dca: Restrict session attachment uploads to supported document, image, and code files.
- 0ca1dca: Add prototype session attachments across CLI, dashboard, API queueing, and harness dispatch.

## 0.13.1

_2026-06-16_

### Patch Changes

- 2d78f9a: Drop the framework's hardcoded `ticket` slot inference and open `templateTypeSchema` to a string so extensions own their own template types and slot ids.
- 28b38cb: Let extension settings panels declare a sidebar `icon`; default to `Sliders` when omitted, and set `list-checks`/`tag` on the planner's status and tag panels.

## 0.13.0

_2026-06-14_

### Minor Changes

- 989ffbe: HarnessProvider gains an optional `skills` layout ({ dir, globalDir }) declaring where the agent discovers skills; the KNOWN_AGENTS registry exports (KNOWN_AGENTS, findAgent, isKnownAgentId, KnownAgent) are removed and AgentInfo now carries the harness's skills layout. agents.info() accepts a project filter.
- 989ffbe: Show linked workspace badges with diff totals on ticket board cards.

## 0.12.0

_2026-06-11_

### Minor Changes

- fcc68a9: Add a host-native file renderer primitive: extensions declare a `fileRenderer` view body backed by load/save commands, and the workbench renders editable markdown (MarkdownEditor), editable code (Monaco), or read-only images by file type — no webview.
- bb253f4: Replace the thin HarnessProvider with a transport-neutral lifecycle contract (capabilities/detect/listModels/start/resume/reattach/getMessages with an injected event sink and approval channel) and re-export the harness data contract types from @pstdio/sdk/extensions. The agents client shrinks to info/models (config setup/update/remove endpoints no longer exist).
- fcc68a9: Add the terminal session backend: `ctx.terminal` SDK surface, `TerminalSession*` contracts, and a host PTY supervisor built on Bun's native terminal API.

### Patch Changes

- fcc68a9: Use project shorthand when allocating planner ticket IDs
- fcc68a9: Show ticket Workspaces empty states and reopen default tree sections when ticket views start.
- fcc68a9: Add an optional `submitLabel` to tree actions so an action can rename its params dialog confirm button.

## 0.11.0

_2026-06-09_

### Minor Changes

- 900909c: Session and workspace lifecycle payloads carry generic resource anchors only; drop the ticket-specific fields from the SDK types so the host stays domain-agnostic.
- ca7222b: Upgrade data renderers with schema-driven attributes, live option colors, custom empty states, list grouping controls, row actions, and dashboard bridges for extension-backed boards.
- 6e40115: Add an extension keybinding contribution API backed by TanStack Hotkeys, surfaced in extension checks, workbench metadata, and the extension testbench.
- ca7222b: Add the extension platform runtime with user and repo extension discovery, extension settings, workbench attachments, hot reload, packaged extension loading, and SDK workbench target APIs.
- 6f35233: Add command palette resource provider contributions.
- d37d82b: Add generic host primitives `ctx.repoFiles` (the invocation repo's working tree, scoped to its root) and `ctx.workspaces.list()` so extension commands can read/write project files and enumerate workspaces without domain-specific core code.
- e887758: Add extension translation tokens, bundles, locale-aware host rendering, and localized extension-lab samples.
- 6de1f50: Add command-backed extension tree renderer contributions.
- ca7222b: Make the planner extension own ticket storage, board rendering, CRUD actions, create modal, markdown editor, status settings, tags, and detail properties.
- ca7222b: Add ticketless and default workspace flows, workspace status automation settings, worktree setup helpers, and CLI/API create and delete support.

### Patch Changes

- 6de1f50: Add explicit extension command palette contributions
- 6f35233: Add prompted rename actions for planner ticket files.
- ca7222b: Fix file picker cancellation and autosave flush ordering
- 0fcf801: Show ticket-linked workspaces in the ticket sidebar, sort them by latest workspace activity, and make file/image selection explicit
- 6f35233: Add a command palette resource provider API: extensions contribute dynamic, searchable palette results via a queryCommand instead of static command entries.
- 3f77df4: Add workspace rename support across the API and SDK.
- 8891110: Remove legacy backend ticket tables and restore planner-owned ticket workflow automation.
- ca7222b: Support binary request bodies in the SDK request helper
- ca7222b: Fix workspace visibility, ticket creation, and settings panel regressions
- ca7222b: Polish command palette focus colors, sidebar tree reloads, diff loading states, resource icons, side-panel onboarding, shared control behavior, and extension lab layout styling.
- 900909c: Preserve workspace context for header/session actions and expose session resources to extensions.

## 0.10.0

_2026-06-01_

### Minor Changes

- f6ec9d8: Align workbench attachment target names with the renamed layout areas: `workbench.top.actions`/`workbench.top.overflow` → `workbench.nav.actions`/`workbench.nav.overflow`, and `workbench.main.bottom` → `workbench.secondary`.
- f6ec9d8: Replace the legacy project-local automation system with an extension platform: user/repo extension discovery and load scopes, first-class extension settings, extension-provided mode layouts, host-owned workbench target attachments and header actions, hot reload, and SDK workbench/ticket APIs.

### Patch Changes

- f6ec9d8: Add the core tickets extension with bundled ticket skills and templates.
- f6ec9d8: Export all worktree hook context types and use the typed SDK worktree event in the core worktree extension.
- f6ec9d8: Improve shared UI controls: command palette keyboard navigation and focus, arrow-key navigation for tree lists, anchored chat input, breadcrumb separator spacing, and extension SDK authoring types.

## 0.8.0

_2026-05-20_

### Minor Changes

- 57c9122: Move workspace attempt-status automation to a host-owned extension kernel command and remove the default `pstdio-core-workspace` extension.
- 57c9122: Add post-event refs for ticket and attempt-status lifecycle (`ticketEvents.created/statusChanged/deleted`, `attemptStatusEvents.changed`) so extensions can observe these transitions. Removes the unused `"builtin"` value from `extension_source_kind`. Hooks remain observation-only per the spec (gated operations belong on commands with middleware).
- 57c9122: Add extension lifecycle events and worktree helpers for extension-owned worktree setup automation.
- 57c9122: Expose SDK API boundary helpers for settings, known agents, session filters, stream transports, sync projection, and file content access.

## 0.7.0

_2026-05-17_

### Minor Changes

- bdbd3cf: PS-295: SDK `followupSession` queues follow-ups against active sessions instead of failing. `POST /sessions/{id}/follow-up` now returns 200 with a `follow_up: { status, queue_position? }` envelope, allows multiple pending entries per session dispatched FIFO after each terminal transition, and the plugin dispatcher logs swallowed post-hook rejections.

## 0.6.0

_2026-05-16_

### Minor Changes

- e3693cb: Add capability-gated bridge webviews for extension routes and workbench renderers.
- 2fa3aa2: Add native extension theme and file icon theme contribution support.
- 4636558: Remove extension identity fields from defineExtension contributions.

### Patch Changes

- 1cdb3c0: Add global session concurrency settings, persisted queueing, restart recovery, and queued-session UI.

## 0.5.0

_2026-05-10_

### Minor Changes

- 3217943: Move the dashboard command palette to opt-in via a new `projectSlots.commandPanel` menu slot. Extensions now choose which commands to surface in the palette by listing them under `menus`, mirroring how header buttons already work. Drops the prior `commandPanel: boolean | object` field on `CommandDefinition`, the `CommandPanelContribution` interface, and the `excludeFromPalette` record field that was opt-out.
- f934e4d: Expose extension-backed project catalogs and harden ticket shorthand allocation.
- d65a8be: Add API-backed extension command execution and CLI routing
- 095fbd3: Remove package-internal skill and template catalogs now that defaults ship from extensions.

## 0.4.2

_2026-05-07_

### Patch Changes

- 3e89b24: Add the durable extension schema foundation in `pstdio-db`: installed extension sources, scope-aware extension instances, extension KV/collection state, project-owned extension preferences (template/skill), `project_template_defaults`, normalized project skill files (`skill_files` + `entrypoint_file_id`), and reload events. Activity events now accept any `resource_type` string and carry `source_extension_id`; sessions and workspaces expose `anchors_json: ResourceRef[]`. The legacy `templates.is_default` column moves to `project_template_defaults` while the existing API surface continues to compute `is_default` for compatibility.
- 3e89b24: Add editable extension source installation and first-project default extension enablement.

## 0.4.1

_2026-05-07_

### Patch Changes

- 1ca60d5: Tighten the `@pstdio/sdk/extensions` surface: `ParamDescriptor` is now a discriminated union (per-type fields like `options`, `templateType`, `resourceType` only appear where valid), `CommandDefinition` is parameterized by its `params` schema so `ctx.params` is inferred without casts, and a new `commandsOf(extension)` derives typed `CommandRef`s from the extension definition. Added `defineCommand` / `defineMiddleware` / `defineHook` builders, an `apiVersion: "1"` field on `ExtensionDefinition`, capability-mixin interfaces (`UiContributions`, `BehaviourContributions`, …), and JSDoc on the public surface. `MiddlewareDefinition`, `HookDefinition`, and `ScheduleContribution` now split typed refs (`command`/`event`) from untyped string ids (`commandId`/`eventId`) so the typed path can't silently degrade.

## 0.4.0

_2026-04-29_

### Minor Changes

- 0b1dffd: Add activity event APIs and SDK methods for listing ticket, workspace, session, and project activity streams.

### Patch Changes

- 92ce38e: Handle OpenCode question/todowrite UI support and make plugin command execution honor local PATH.

## 0.3.0

_2026-04-24_

### Minor Changes

- 115d70c: Add `saveTicket` SDK plugin helper that persists a local ticket file, its attachments, and artifacts via the client, mirroring `pstdio tickets save`. Use it from plugin hooks or actions to upload ticket edits from a worktree. The bundled code-review lifecycle plugin template now calls `saveTicket` on review-ready transitions so ticket edits and generated artifacts are persisted before the review session starts.
- e6b9f1e: Add first-class scheduled plugin handlers with cron validation, runtime execution, and bundled schedule examples.

### Patch Changes

- c12f747: Fix runCommand to inherit runtime process.env updates when no env option is passed, so plugins picking up PATH mutations see them.

## 0.2.1

_2026-04-17_

### Patch Changes

- 013310f: Fix OpenCode session timeout and restart recovery: separate provider-managed lifecycle from activity-managed lifecycle and add disconnected session status
- c9a2e69: Fix `pstdio tickets save` failing with opaque `[object Object]` errors when the ticket had a `blocked_reason` frontmatter field, and surface zod validation errors in the SDK client instead of stringifying them.
- 3a77d88: Support multi-file bundled skills end-to-end across install paths, API responses, and dashboard skill viewing.
- b01f555: Add `pstdio plugins list` and `pstdio plugins register` commands.

## 0.2.0

_2026-04-06_

### Minor Changes

- 1d384f8: Move `renderPrompt` off the SDK root export and keep it available from `@pstdio/sdk/prompts`.
- 1d384f8: Split SDK ticket attempt helpers into session-backed createAttempt and workspace-only createWorkspace.

### Patch Changes

- 1d384f8: Add a `createSession` plugin helper that automatically injects `project_id` from plugin context.
- 1d384f8: Make session hook contexts expose `ticket` and `workspace` as full objects when a workspace is linked.
- 1d384f8: Add a workspacesForTicket plugin helper for ticket-scoped workspace lookups.
- 1d384f8: Publish the SDK from built dist artifacts instead of raw source.
- 1d384f8: Surface rich ticket and workspace hook objects.
- 1d384f8: Expose ticket/workspace objects in session hook contexts.
- 1d384f8: Add a plugin follow-up helper and fix review lifecycle session routing.
- 1d384f8: Include ticket status_name in session hook ticket context and SDK typing.
- 1d384f8: Consolidate plugin runtime boundaries: introduce pstdio-api-contracts for shared API types, make SDK and API consume contracts, move hook dispatch into pstdio-plugins/hooks, delete pstdio-hooks
- 1d384f8: Keep SDK root imports scoped to shared client and types.
- 1d384f8: Normalize plugin helpers so `ticketId` and `workspaceId` accept either canonical IDs or shorthand refs.
- 1d384f8: Narrow plugin action `ctx.target` by `targetType` discriminant — no cast needed.
- 1d384f8: Align TypeScript dependency ranges to ^5.9.3 across workspace packages.
- 1d384f8: Update setTicketStatus helper input to { ticket, status }.
