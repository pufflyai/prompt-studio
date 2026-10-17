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

## Session queries and shapes

The context `query` already defines the contract: newest first by `created_at`, then `id`;
`includeArchived`; inclusive timestamp bounds; status arrays; and `nextCursor: string | null`. Its
default page size is 50. `list` and `listByWorkspace` were deprecated in 0.43.1 and are removed in
0.44 (PS-805).

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

Use the same page rules for other large histories, such as automation runs. Small catalogs may stay
arrays; see [Open decisions](#open-decisions).

## Resource links

Use `ctx.resources.addAnchors`, `removeAnchors` and `listAnchors` for existing resources:

```ts
await ctx.resources.addAnchors({ type: "session", id: sessionId }, [{ type: "ticket", id: ticketId }]);
```

An owner is needed only when it is ambiguous. `ResourceRef.extensionId` is optional.
[`canonicalResource`](../../../packages/pstdio-api/src/features/extensions/command-environment/resource-link-policy.ts)
fills it: host kinds (`project`, `workspace`, `session`) get `pstdio`, then a kind owned by the
calling extension, then the only owner of that kind. It throws when none of these rules applies.

Before the wrappers go, define common rules for source existence, project, transaction and
timestamps. Legacy additions lock the source row and update its timestamp; generic additions do not.
Generic canonicalization does not reject a missing host resource. Decide and test the intended
behavior in 0.44. Keep validation hooks, deduplication, removal checks and changed-link events.

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

Archive still exists outside the extension types. The HTTP
[workspace contract](../../../packages/pstdio-api-contracts/src/workspaces.ts) has
`capabilities.archive` and `provider_operation_kind: "archive"`. Stored rows keep `archive` in
[`provider_capabilities_json`](../../../packages/pstdio-db/src/db/schemas/workspaces.ts), plus the
`archiving` and `archived` provider states. Deprecate the HTTP fields in 0.44; the host fills them
until then. In 0.45 remove them and convert stored rows. Generate any schema change with
`db:generate`; never hand-write schema SQL.

The `workspace.deleted` event has no producer today
([kernel slots](../../../packages/pstdio-api-contracts/src/extension-kernel/kernel-slots.ts)).
PS-805 emits it. Consumers that replace `archived` with `deleted` depend on that fix.

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
extension imports `@pstdio/sdk/hooks`. Deprecate them in 0.44 and remove them in 0.45. Keep
lifecycle payloads that typed host slots still need.

Deprecate [`requireRepoFiles`](../../../packages/sdk/src/data/draft-layout.ts) in 0.44 and remove
it in 0.45. Planner and Reports pass `ctx.projectFiles` into it; they move to the named file handle.
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

Before 0.44 ships, record every deprecated export, manifest key, bridge capability, CLI command or
flag, HTTP path and compatibility branch, with its replacement, last caller, data conversion and
removal release. Use export graphs and real registrations; string matching misses runtime aliases.

[API versioning](../../references/extensions/0014-api-versioning.md) and the API report cover only
`@pstdio/sdk/extensions` and `@pstdio/sdk/extensions/react`. Extensions also import
`@pstdio/sdk/testing` (99 imports), `@pstdio/sdk/data` (10) and `@pstdio/sdk/prompts` (2). In 0.44,
extend 0014 and the API report to those subpaths.
[0012](0012-align-extension-api-shapes.md#n-sdk-public-surface) covers `/client`, `/api` and `/resources`.

| Removal family | Replacement | Release |
| --- | --- | --- |
| `sessions.list`, `listByWorkspace` | `query` and `iterate` | Removed in 0.44 (PS-805) |
| `workspaces.archive`, provider `archive` hook, `WorkspaceCapabilities.archive`, `workspaceEvents.archived` | `delete` | Removed in 0.44 (PS-805) |
| `defineStatuses`, `StatusContribution`, `WorkflowStatus`, `StatusActionDefinition`, `StatusRef`, `statuses`, `status.v1` | Query-owned enum options and columns | Removed in 0.44 (PS-805) |
| Renderer `kind: "status"`, `ordering`, `filters`, `defaultFilters`, `isDefault`, `onReorder`, `KanbanRendererFilterState` | Enum options, `sorts`, `filter`, `defaultFilter`, `defaultActiveViewId`, `onMove` | Removed in 0.44 (PS-805) |
| UI `CollectionSavedView.isDefault`, chat `onOpenFile` props | `defaultActiveViewId`, `linkHandler` | Removed in 0.44 (PS-805) |
| Storage KV, collections, mutable file IDs, old file-root properties | Storage PRD | Deprecated in 0.44, removed in 0.45 |
| `ctx.notify.resolve`, `dismiss`, author `"expired"` | `setStatus`, `setStatusByKey` | Deprecated in 0.44, removed in 0.45 |
| Webview `notification.action`, `.resolve`, `.dismiss` | None; no callers | Deprecated in 0.44, removed in 0.45 |
| HTTP `/read`, `/done`, `/dismiss`, `/snooze`, `/resolve-by-dedupe-key`, `PATCH` `snoozedUntil` | Status routes by ID and by key | Deprecated in 0.44, removed in 0.45 |
| Unpaged HTTP session list | Paged query | Deprecated in 0.44, removed in 0.45 |
| `ExtensionSessionSummary`, snake_case session and workspace fields, `CreateExtensionWorkspaceInput` | `ExtensionSession`, `ExtensionWorkspace`, camelCase input | Deprecated in 0.44, removed in 0.45 |
| `sessions.addAnchors`/`removeAnchors`, `workspaces.addAnchors`/`removeAnchors` | `resources` | Deprecated in 0.44, removed in 0.45 |
| HTTP `capabilities.archive`, `provider_operation_kind: "archive"`, stored `archive` capability | `delete`; convert stored rows | Deprecated in 0.44, removed in 0.45 |
| Old command outcome schemas, lossy unwrap, old stream adapters | Shared outcome and stream | Deprecated in 0.44, removed in 0.45 |
| Access to another extension's preference names, except core preferences | Caller-owned names | Deprecated in 0.44, removed in 0.45 |
| Filesystem-hook contexts and singular hook-client facade | Typed hooks and events, or the SDK client | Deprecated in 0.44, removed in 0.45 |
| SDK `requireRepoFiles` | Named file handle | Deprecated in 0.44, removed in 0.45 |
| Planner [`auto-build candidates`](../../../extensions/pstdio-planner/src/commands/auto-build-candidates.ts) | `pst tickets next` | Deprecated in 0.44, removed in 0.45 |
| Planner [`expectedAttemptState`](../../../extensions/pstdio-planner/src/commands/change-requests.ts) and its CLI flag | Ownership checks and `expectedRevision` | Deprecated in 0.44, removed in 0.45 |

Do not delete published data, SQL migration history or promised URL readers because a private name
says legacy. Author-facing aliases such as `pst tickets` are current.

## Delivery and acceptance

0.44 is already a breaking extension API release: `EXTENSION_API_VERSION` is 0.1.6 at
`pstdio@0.43.1` and 0.2.0 on `main`, shipped only in nightlies.

1. 0.44 (API 0.2.0). PS-805 removes every API deprecated in 0.43.1 and fixes the host bugs. Add every
   new API from this PRD and mark the APIs it replaces `@deprecated`. This work merges before the
   0.44 Version Packages PR.
2. 0.45 (API 0.3.0). Core and repository-local extensions adopt the new APIs on the published 0.44
   SDK. Convert saved data. Remove everything deprecated in 0.44 in the same release.

0.44 timing is tight. An API not deprecated in a stable 0.44 is not removed in 0.45; it moves to
the next breaking release.

Core extensions type-check against npm through `scripts/verify/verify-published-extensions.ts`, and
CI keeps SDK and extension PRs separate. Follow step 6 of
[Extension API version checks](../../references/architecture/0024-extension-api-version-checks.md)
and the [PR labels guide](../../guides/development/0004-pull-request-labels.md) in this order:

1. Extension PRs move each first-party extension off deprecated APIs and declare
   `^0.2.0 || ^0.3.0`, since one build works with both. A PR that needs SDK changes not yet on npm
   carries the `waiting-for-release` label.
2. The removal PR deletes the deprecated APIs, sets `EXTENSION_API_VERSION` to 0.3.0 and updates
   the API report. `bun run verify:extension-api-version` then shows every manifest accepts 0.3.0.

Product versions come from the shared Changesets fixed group. The removal PR uses a minor changeset,
so the removal release is the next minor after 0.44. Never pick versions by hand.

Acceptance checks:

- `setStatus` and `setStatusByKey` return the same result from a command and from HTTP.
- A test reads more than 50 sessions through `iterate` and finds a live session on page two.
- Generic link tests cover validation, events and owner inference for host, own and ambiguous kinds.
- A webview, the CLI and the SDK each receive `stale_revision` with its code and data.
- Stream tests cover cancellation before start, early return and disconnect.
- A settings test deletes a project override and reads the declared fallback.
- A conversion test turns stored saved views and workspace rows into the new shapes.
- After 0.45, the API report has no `@deprecated` marker from this PRD, and a grep for each removed
  name in `extensions/`, `.pstdio/extensions/` and `packages/*/src` returns no callers.
- `pst --help`, the HTTP route list and the bridge capability list match the inventory table.

Delete tests for removed paths. Repeat the prototype tasks against real adapters before adoption.
