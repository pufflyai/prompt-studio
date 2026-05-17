# @pstdio/sdk

## 0.7.0

### Minor Changes

- bdbd3cfa65cfb2ea251f28a4ea2d9df9c28de809: PS-295: SDK `followupSession` queues follow-ups against active sessions instead of failing. `POST /sessions/{id}/follow-up` now returns 200 with a `follow_up: { status, queue_position? }` envelope, allows multiple pending entries per session dispatched FIFO after each terminal transition, and the plugin dispatcher logs swallowed post-hook rejections.

## 0.6.0

### Minor Changes

- e3693cb: Add capability-gated bridge webviews for extension routes and workbench renderers.
- 2fa3aa2: Add native extension theme and file icon theme contribution support.
- 4636558: Remove extension identity fields from defineExtension contributions.

### Patch Changes

- 1cdb3c0: Add global session concurrency settings, persisted queueing, restart recovery, and queued-session UI.

## 0.5.0

### Minor Changes

- 3217943: Move the dashboard command palette to opt-in via a new `projectSlots.commandPanel` menu slot. Extensions now choose which commands to surface in the palette by listing them under `menus`, mirroring how header buttons already work. Drops the prior `commandPanel: boolean | object` field on `CommandDefinition`, the `CommandPanelContribution` interface, and the `excludeFromPalette` record field that was opt-out.
- f934e4d: Expose extension-backed project catalogs and harden ticket shorthand allocation.
- d65a8be: Add API-backed extension command execution and CLI routing
- 095fbd3: Remove package-internal skill and template catalogs now that defaults ship from extensions.

## 0.4.2

### Patch Changes

- 3e89b24: Add the durable extension schema foundation in `pstdio-db`: installed extension sources, scope-aware extension instances, extension KV/collection state, project-owned extension preferences (template/skill), `project_template_defaults`, normalized project skill files (`skill_files` + `entrypoint_file_id`), and reload events. Activity events now accept any `resource_type` string and carry `source_extension_id`; sessions and workspaces expose `anchors_json: ResourceRef[]`. The legacy `templates.is_default` column moves to `project_template_defaults` while the existing API surface continues to compute `is_default` for compatibility.
- 3e89b24: Add editable extension source installation and first-project default extension enablement.

## 0.4.1

### Patch Changes

- 1ca60d5: Tighten the `@pstdio/sdk/extensions` surface: `ParamDescriptor` is now a discriminated union (per-type fields like `options`, `templateType`, `resourceType` only appear where valid), `CommandDefinition` is parameterized by its `params` schema so `ctx.params` is inferred without casts, and a new `commandsOf(extension)` derives typed `CommandRef`s from the extension definition. Added `defineCommand` / `defineMiddleware` / `defineHook` builders, an `apiVersion: "1"` field on `ExtensionDefinition`, capability-mixin interfaces (`UiContributions`, `BehaviourContributions`, …), and JSDoc on the public surface. `MiddlewareDefinition`, `HookDefinition`, and `ScheduleContribution` now split typed refs (`command`/`event`) from untyped string ids (`commandId`/`eventId`) so the typed path can't silently degrade.

## 0.4.0

### Minor Changes

- 0b1dffd: Add activity event APIs and SDK methods for listing ticket, workspace, session, and project activity streams.

### Patch Changes

- 92ce38e: Handle OpenCode question/todowrite UI support and make plugin command execution honor local PATH.

## 0.3.0

### Minor Changes

- 115d70c: Add `saveTicket` SDK plugin helper that persists a local ticket file, its attachments, and artifacts via the client, mirroring `pstdio tickets save`. Use it from plugin hooks or actions to upload ticket edits from a worktree. The bundled code-review lifecycle plugin template now calls `saveTicket` on review-ready transitions so ticket edits and generated artifacts are persisted before the review session starts.
- e6b9f1e: Add first-class scheduled plugin handlers with cron validation, runtime execution, and bundled schedule examples.

### Patch Changes

- c12f747: Fix runCommand to inherit runtime process.env updates when no env option is passed, so plugins picking up PATH mutations see them.

## 0.2.1

### Patch Changes

- 013310f: Fix OpenCode session timeout and restart recovery: separate provider-managed lifecycle from activity-managed lifecycle and add disconnected session status
- c9a2e69: Fix `pstdio tickets save` failing with opaque `[object Object]` errors when the ticket had a `blocked_reason` frontmatter field, and surface zod validation errors in the SDK client instead of stringifying them.
- 3a77d88: Support multi-file bundled skills end-to-end across install paths, API responses, and dashboard skill viewing.
- b01f555: Add `pstdio plugins list` and `pstdio plugins register` commands.

## 0.2.0

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
