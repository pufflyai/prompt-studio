# PRD: Simplify extension APIs

Status: Proposed. Created: 2026-10-17. This PRD plans changes; it does not implement them.
0.44 removes the APIs deprecated in 0.43.1, adds the new APIs and deprecates the ones they replace.
0.45 moves every extension to the new APIs and removes everything deprecated in 0.44.
See [Delivery and acceptance](#delivery-and-acceptance).

## Purpose and scope

An extension should handle the same command rejection, notification selection or resource link the
same way in its command, webview and external SDK client. Today those surfaces expose different
types and behavior. Some APIs also keep several ways to describe the same operation.

This PRD covers the extension context, SDK clients, webview bridge, public renderer and UI
contracts, manifest contributions and the CLI and HTTP paths that expose them. The
[storage PRD](0009-standardize-storage-api.md) owns records, assets and file roots. The
[capacity PRD](0010-bound-client-storage-and-isolate-sync-failures.md) owns retention and recovery.
[Align extension API shapes](0012-align-extension-api-shapes.md) covers smaller shape cleanups.
Host bugs found in this audit are fixed in ticket PS-805, not here.

Relay has no deployed users during alpha. Do not build relay compatibility for old extension
binaries or old-format relay writers. The extension API still follows the deprecation rules in
[API versioning](../../references/extensions/0014-api-versioning.md). Preserve local data, active
drafts and promised links through the supported upgrade path.

## What improves

- A review button and its background command select the same notification and get the same result.
- A workspace activity view pages through relevant sessions instead of loading all history.
- A ticket links its session and workspace through `resources`, with the same validation and events.
- A stale-save rejection keeps its code and conflict details in a webview, CLI or SDK caller.
- A board and a table use the same saved filter and sort definitions.
- Sessions and workspaces have one camelCase shape in every API.

The [prototype and measurements](../../references/sdk/0005-api-clarity-prototype.md) compare 15
tasks. Their syntax counts describe those examples only; they are not comprehension scores.

## Inventory and decisions

The [base context](../../../packages/pstdio-api-contracts/src/extension-kernel/types/context.ts)
has 24 service properties plus identity and invocation fields. The table covers every service.

| Surface | Decision and preserved behavior |
| --- | --- |
| `storage`, `artifacts`, `files`, `projectFiles`, `workspaceFiles`, `packageFiles`, `extensionFiles` | Apply the storage PRD. Keep root selection, read-only types, mount grants and provider checks. |
| `commands` | Share validated outcomes, typed errors and stream handling across clients. Keep middleware separate from execution. |
| `sessions` | Paged `query`, an SDK iterator and `get` by ID, all returning `ExtensionSession`. Keep agent runs as session operations. |
| `workspaces` | Use `delete`. Return `ExtensionWorkspace`. Keep provider selection, readiness, resolution, cancellation and worktree removal. |
| `resources` | Own link additions, removals and queries. Keep domain validation, changed-link events and source rules. |
| `views` | Keep the saved-view owner. Share filter and sort definitions across renderer, HTTP, CLI and UI. |
| `notify` | `setStatus(id, status)` and `setStatusByKey(key, status)`. Keep toasts separate from persistent notifications. |
| `settings` | Match typed command and webview methods, including deletion. Keep installed-extension and project-instance owners. |
| `navigation` | Share typed targets and owner-aware file links. Keep headless behavior and page or placement ownership. |
| `events` | Keep typed domain events and diagnostics. It is not a durable command queue or storage receipt. |
| `automation` | Share command references and invocation validation. Keep durable queueing, idempotency keys and explicit targets. |
| `process`, `connections`, `logger` | Keep. Share cancellation and error conventions where meanings match. |
| `skills` | Keep the resolved skill catalog. Package-file access does not replace catalog resolution. |
| `terminal`, `net`, `activity`, queued input | No extension calls them. [0012](0012-align-extension-api-shapes.md#d-services-with-no-callers) deprecates them unless a supported caller appears. |

Project and workspace administration, agents and runtime clients are scoped external control APIs.
Share DTOs and errors when they describe the same operation; do not give a webview their authority.
The [HTTP SDK root](../../../packages/sdk/src/client/client.ts) also needs explicit coverage:

| SDK client | Shared contract or boundary |
| --- | --- |
| `assets` | Storage PRD. Keep explicit owners and streaming guarantees. |
| `resources`, `views`, `sessions`, `workspaces`, `notifications` | Share the operations below. Keep HTTP authorization and runtime administration. |
| `extensions`, `automation` | Share command execution, streams and outcomes. Installation, connections and tokens stay privileged. |
| `filesystem`, `settings`, `projects`, `agents`, `runtime` | Runtime administration. Keep machine paths and `/v1/settings` apart from extension files and settings. |
| `skills`, `sync` | Keep the catalog and UI sync transports. Their output is not a relay-acceptance receipt. |

## Notification status

The context prefers `id` when both `id` and `dedupeKey` are given; the browser prefers `dedupeKey`.
The context returns `Notification[]`; the bridge returns one notification or a batch wrapper. The
bridge type allows expiry by ID, which the browser rejects. Authors can pass `"expired"` to
`ctx.notify.resolve`, although expiry belongs to the host.

Add these calls in 0.44, with a matching HTTP adapter. Webviews reach them through commands:

```ts
const notification = await ctx.notify.setStatus("review-123", "done"); // Notification | null
const notifications = await ctx.notify.setStatusByKey("review-group", "dismissed"); // Notification[]
```

The single-ID call needs 16 tokens in the prototype; the discarded nested `transition` call needs
43. Do not add a third selector method unless a maintained workflow needs it. Authors may set `done`
and `dismissed`. Missing IDs return `null`; empty groups return `[]`; repeating the same final
status is a no-op. An ID does not grant access to another project.

HTTP has five status routes: `/read`, `/done`, `/dismiss`, `/snooze` and
`/resolve-by-dedupe-key`. `PATCH` also sets `snoozedUntil`. In 0.44 add one status route by ID and
one by key, both taking the status and optional snooze time. `PATCH` stops accepting `snoozedUntil`
in 0.45. The CLI redeclares the client type in its own
[notifications client](../../../packages/pstdio/src/adapters/cli/commands/notifications/client.ts);
it must use the SDK `NotificationsClient` type.

The webview capabilities `notification.action`, `.resolve` and `.dismiss` have no callers in
`extensions/` or `.pstdio/extensions/`; only the internal workbench lab fixture uses `.action`. Do
not build `setStatus` parity in the bridge. Keep `notification.show`. Deprecate the three
capabilities, `ctx.notify.resolve`, `ctx.notify.dismiss`, the author `"expired"` status and the old
HTTP routes in 0.44. Remove them in 0.45. Evidence:
[context adapter](../../../packages/pstdio-api/src/features/extensions/command-environment/notifications.ts),
[browser adapter](../../../packages/pstdio-dashboard/src/shared/extensions/components/extension-webview-frame.tsx),
[HTTP status routes](../../../packages/pstdio-api/src/features/notifications/endpoints/transition-notification.ts),
[HTTP update route](../../../packages/pstdio-api/src/features/notifications/endpoints/update-notification.ts),
[SDK client](../../../packages/sdk/src/client/notifications.ts).

### Final-status decision for 0.44

Allow `done` ↔ `dismissed`. A repeated status returns the current notification without a write,
activity entry or sync event. Read and snooze cannot reopen a final item. Host-expired items stay
expired. Key operations lock their project-scoped matching rows and return that snapshot, including
unchanged rows. A notification inserted after selection belongs to the next operation. Legacy
resolve and dismiss adapters share these rules through the same service.

## Session queries and shapes

The context `query` already defines the contract: newest first by `created_at`, then `id`;
`includeArchived`; inclusive timestamp bounds; status arrays; and `nextCursor: string | null`. Its
default page size is 50. `list` and `listByWorkspace` were deprecated in 0.43.1 and are removed in
0.44 (PS-805).

Cursor decision for 0.44: keep the immutable creation-time and ID boundary, without a snapshot.
Newer inserts do not shift later pages. Rows archived during paging drop out unless `includeArchived`
is true. Callers keep the same filters across pages; iterators retain them and support cancellation.

The gap is HTTP. [List sessions](../../../packages/pstdio-api/src/features/sessions/endpoints/list-sessions.ts)
is unpaged and takes a single status. In 0.44 add a paged HTTP and SDK query with the same filters
and `{ items, nextCursor }` result, and deprecate the unpaged route. Add SDK `sessions.iterate(filter)`
over `query` so callers read complete results without cursor loops.

Planner's [stack update](../../../extensions/pstdio-planner/src/commands/update-stack.ts) refuses
work when another live session uses its workspace; reading only the first page could miss it. It
must filter for live statuses and follow every page. The prototype iterator reads 63 sessions in two
pages; production keeps all query filters and cancellation.

Session and workspace shapes leak storage details.
[`ExtensionSessionSummary`](../../../packages/pstdio-api-contracts/src/extension-kernel/types/sessions.ts)
exposes `workspace_id`, `anchors_json`, `last_selected_model`, `original_session_id` and
`last_request_*`. `sessions.get` has its own inline type with `cwd` and `last_exit`. The
[host adapter](../../../packages/pstdio-api/src/features/extensions/command-environment/sessions.ts)
returns `cwd` from `query`, `list` and `create` too, though their types omit it. The
[workspace adapter](../../../packages/pstdio-api/src/features/extensions/command-environment/workspaces.ts)
casts the database row to `ExtensionWorkspace`, leaking `provider_ref_json`, `provider_error_json`
and `deleted_at`. `CreateExtensionWorkspaceInput` is snake_case.

In 0.44 add camelCase `ExtensionSession` and `ExtensionWorkspace` types and a camelCase create
input. `query`, `get`, `create` and `sessions.iterate` return the new types. In 0.44 the host also
returns the old snake_case fields, marked `@deprecated`, so current callers keep working. Authors
then migrate once in 0.45, when the old fields are removed. The new types carry no anchors; links
come only from `resources`. Use the same types in the SDK client.

The 0.44 workspace type keeps its existing optional properties and adds optional camelCase
properties so older callers can still construct sparse workspace values. Host readers always fill
the camelCase fields. Deprecated snake_case fields, including `anchors_json`, remain only for
the compatibility window. The new session type has no anchor field; readers intersect it with
the deprecated summary during that window. Provider references, errors and deletion metadata
are never part of the command workspace projection.

Use the same page rules for other large histories, such as automation runs. The 0.44 list decision is below.

No resource or dynamic catalog list in this PRD or PRD 0012 F qualifies for an unpaged exception:
the current agent, model, provider and board registries have no enforced finite size bound.
Projects, workspaces, skills, sessions and saved views must page. Agent, model, provider and board
catalogs also page. The canonical limit is 50 by default and at most 200; resource links keep their
existing maximum of 100. No existing data is truncated to meet these limits.

Unpaged routes and methods remain deprecated compatibility readers through 0.44, not bounded
catalog exceptions. Finite vocabularies embedded in records, such as enum choices, are not resource
collection endpoints. File storage and filesystem listing capacity remain owned by PRDs 0009 and
0010; this decision does not invent a bound for them. See the
[client conventions](../../references/extensions/0023-client-conventions.md) for cursor ordering,
null rules, per-read behavior and canonical routes.

## Resource links

Use `ctx.resources.addAnchors`, `removeAnchors` and `listAnchors` for existing resources:

```ts
await ctx.resources.addAnchors({ type: "session", id: sessionId }, [{ type: "ticket", id: ticketId }]);
```

An owner is needed only when it is ambiguous. `ResourceRef.extensionId` is optional.
[`canonicalResource`](../../../packages/pstdio-api/src/features/extensions/command-environment/resource-link-policy.ts)
fills it: host kinds (`project`, `workspace`, `session`) get `pstdio`, then a kind owned by the
calling extension, then the only owner of that kind. It throws when none of these rules applies.

Host sources must exist in the current project. Generic and legacy additions and removals lock
that source row, commit the entire batch in one transaction, and update its timestamp only when
links change. A missing, deleted or foreign host source is refused before any edge is written.
The project, workspace and session tables own these checks; no extra link status is stored.
Extension-owned references remain under their resource kind's validation policy because their
records and timestamps belong to the extension. A declared kind may describe a virtual resource.

Dedicated columns own source identity, target identity and role. Equivalent legacy details that
omit those fields are the same link. Repeating either API does not update a timestamp or emit a
changed-link event. Label, metadata and role changes still count as changes. Validation hooks,
owner inference, removal checks and changed-link events remain shared.

`sessions.addAnchors`/`removeAnchors` and `workspaces.addAnchors`/`removeAnchors` are marked
`@deprecated` in 0.44 and removed in 0.45. Keep anchors passed during resource creation, where the
host saves creation and linkage together. Evidence:
[generic adapter](../../../packages/pstdio-api/src/features/extensions/command-environment/resource-links.ts),
[legacy transaction](../../../packages/pstdio-db/src/services/legacy-resource-links.ts).

## Command results, errors and streams

The kernel has a discriminated `CommandOutcome`. The HTTP outcome schema accepts `ok` and `status`
separately, including contradictory pairs. The typed webview unwraps a failure into a plain `Error`
and loses its code, data and diagnostics. HTTP and webview stream clients end in different shapes.

The host loses rejections too.
[`workbench-extension-command.ts`](../../../packages/pstdio-workbench/src/extensions/host/workbench-extension-command.ts)
calls `unwrapCommandValue`, so webviews get a plain `Error`. In the dashboard's
[webview command router](../../../packages/pstdio-dashboard/src/shared/extensions/components/extension-webview-command.ts),
an ID without `.command.` runs as a workbench command and returns a raw value. PS-805 fixes the
host path. The shared outcome contract below covers that path too.

In 0.44 add a shared validated outcome contract and adapters. Keep success values, rejection codes
and data, causes, diagnostics and notices; keep transport metadata outside. A throwing helper is
optional and must carry the complete outcome. Recommend explicit outcomes for recoverable rejections.

Add a command stream with iterable chunks, a final outcome promise and cancellation. Specify early
return, cancellation before start, disconnect and rejected completion. Keep backpressure and bounds.
A disconnected client must not re-run a command that has external effects.

The 0.44 stream contract is `CommandStream<TChunk, TResult>` in `/extensions`. Webviews use
`client.streams.<command>()`; HTTP clients use `client.extensions.streamCommand(projectId,
commandId, input?, options?)`. Each stream has one chunk consumer. Every terminal path closes the
chunks and resolves `outcome`, including rejection and transport failure. `getCommandValue` throws
`CommandOutcomeError` with the complete failed outcome when the caller needs a value.

Cancellation before start opens no subscription. `cancel()`, an aborted signal and early iterator
return stop the remote command, clear unread chunks and resolve a cancelled outcome. Local cleanup
never waits for a remote acknowledgement. Disconnect closes the subscription with a structured error
outcome and its original cause; it never reconnects that command. Existing byte bounds and host
backpressure stay in place. Deprecated webview `.result` still returns the value or rejects, and the
old HTTP event iterator remains callable through 0.44.

`validatedCommandOutcomeSchema` validates the kernel union and `commandExecutionResultSchema`
wraps it with transport metadata. The old object schemas stay callable, including their Zod object
methods, until removal. Existing SDK `execute` returns the canonical result intersected with the old
optional fields during 0.44, preserving source compatibility for unguarded legacy field access.

A ticket save rejected with `stale_revision` keeps its draft and conflict details in a webview or
an external client. Deprecate the old schemas and adapters in 0.44; remove them in 0.45.
Evidence: [kernel outcomes](../../../packages/pstdio-api-contracts/src/extension-kernel/types/commands.ts),
[HTTP schema](../../../packages/pstdio-api-contracts/src/extensions/execute.ts),
[unwrap helper](../../../packages/sdk/src/extensions/command-outcome.ts),
[webview streams](../../../packages/sdk/src/extensions/webview-streams.ts),
[HTTP streams](../../../packages/sdk/src/client/extension-stream.ts).

## Settings and preferences

Keep settings and preferences separate. Settings belong to an installed extension or a project
instance. Preferences have user, project, workspace and session scopes with fallbacks.

Add the missing typed webview `settings.delete` wrapper in 0.44; the bridge capability exists.
Deleting a project override restores the declared fallback instead of storing `null`.

Keep caller-owned preference names, including dynamic names, and the supported core preferences.
Deprecate access to another extension's preference names in 0.44 and remove it in 0.45. Evidence:
[typed settings client](../../../packages/sdk/src/extensions/webview-client.ts),
[preference owner](../../../packages/pstdio-workbench/src/extensions/bridge/webview-preferences-capability.ts).

## Saved views and renderer options

Use `ViewFilterGroup`, ordered `ViewSort[]` and an explicit default-view ID across saved views,
board and table queries, UI controls, CLI and HTTP. The flat `filters`, single-sort `ordering`,
`defaultFilters`, `isDefault` and `onReorder` were deprecated in 0.43.1. In 0.44 the host stops
sending `filters` and `ordering` and the types drop them (PS-805). Keep compound filters, relative
dates, manual order, built-in views, custom titles and default selection when converting saved views.

Status contributions were also deprecated in 0.43.1 and are removed in 0.44. Extensions return enum
options and `boardColumnConfigs` from their queries. Use `onMove` to save a complete drag. Keep
`onAttributeChange` for inline edits. Do not delete `StatusBarItemContribution`; it is a different
feature. Evidence: [renderer contract](../../../packages/pstdio-api-contracts/src/extension-kernel/types/kanban-renderer.ts),
[saved views](../../../packages/pstdio-api-contracts/src/board-views.ts),
[public UI view type](../../../packages/ui/src/components/collection-view/collection-view-types.ts).

## Workspace lifecycle, navigation and file links

Use `workspaces.delete`, the provider `delete` hook and `capabilities.delete`. The archive method,
hook, capability and event were deprecated in 0.43.1 and are removed in 0.44 (PS-805).

The HTTP [workspace contract](../../../packages/pstdio-api-contracts/src/workspaces.ts) also
used `capabilities.archive`. That field was already deprecated in stable 0.43.1, so PS-805 removes
it in 0.44 along with the extension capability. Do not restore it for a second deprecation window.

The remaining HTTP `provider_operation_kind: "archive"` value is deprecated in 0.44. Use
`"delete"` for new operations. Keep returning the original value for historical operations until
0.45; deprecating this value does not deprecate the supported `create`, `cancel` and `delete`
values or rewrite stored history. Stored rows may still keep `archive` in
[`provider_capabilities_json`](../../../packages/pstdio-db/src/db/schemas/workspaces.ts), plus
`archiving` and `archived` provider states. In 0.45 remove the legacy operation value and convert
stored rows. Generate any schema change with `db:generate`; never hand-write schema SQL.

PS-805 now emits `workspace.deleted` through the
[kernel slots](../../../packages/pstdio-api-contracts/src/extension-kernel/kernel-slots.ts).
Consumers that replace `archived` with `deleted` build on that prerequisite.

Share `NavigationTarget` and owner-aware file links across command results, browser navigation,
message renderers and CLI opening. Keep page params, resource identity, workspace, source position
and preview or pin intent. Calls without a UI navigation scope still drop navigation requests. A
bare path must not pick another machine or the default workspace. The chat `onOpenFile` props were
deprecated in 0.43.1 for `linkHandler` and are removed in 0.44.
Evidence: [workspace API](../../../packages/pstdio-api-contracts/src/extension-kernel/types/workspaces.ts),
[navigation targets](../../../packages/pstdio-api-contracts/src/extension-kernel/types/navigation-target.ts),
[resource path requirements](0008-resource-path-opening.md).

## SDK helper exports and old hook contexts

The [hooks entry point](../../../packages/sdk/src/hooks/index.ts) exports filesystem-hook context
types, the `BaseHookContext.payload` mirror and a singular `client.session.followup` facade. No
extension imports `@pstdio/sdk/hooks`. These exports and compatibility members are deprecated
in 0.44 and removed in 0.45. Typed extension hooks use their declared context fields; external SDK
clients use the plural `client.sessions.followUp(sessionId, input)` method. Keep
lifecycle payloads that typed host slots still need.

Deprecate [`requireRepoFiles`](../../../packages/sdk/src/data/draft-layout.ts) in 0.44 and remove
it in 0.45 after the replacement ships. Planner and Reports pass `ctx.projectFiles` into it; they
move to the named file handle from PRD 0009 in separate extension PRs using its published SDK.
Keep the pure frontmatter, draft-layout, name-resolution and prompt-rendering helpers.

## Open decisions

Each decision is made in 0.44 before the contracts freeze. The named section owns it.

| Decision | Owner section |
| --- | --- |
| Allowed changes between final notification statuses, for example `done` to `dismissed` | [Notification status](#notification-status) |
| Session cursor stability when rows are inserted or archived during paging | [Session queries and shapes](#session-queries-and-shapes) |
| Which unpaged lists stay arrays, with the bound that justifies each | [Session queries and shapes](#session-queries-and-shapes) |
| Source-existence and timestamp rules for generic links | [Resource links](#resource-links) |
| Whether stopping a stream consumer stops execution | [Command results, errors and streams](#command-results-errors-and-streams) |

## Removal inventory

See the [release appendix](../../references/extensions/0024-simplification-release-plan.md#removal-inventory)
and the detailed [removal inventory](../../references/extensions/0020-api-0-3-removal-inventory.md).

## Delivery and acceptance

The [release appendix](../../references/extensions/0024-simplification-release-plan.md#delivery-and-acceptance)
contains the required release order and acceptance checks. The PRD remains proposed until the
0.45 removal ships.
