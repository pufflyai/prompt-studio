# PRD: Simplify extension APIs

Status: Proposed. Created: 2026-10-17.
**0.44 adds features and deprecations. 0.45 releases all extension updates. 0.46 removes old APIs
and deprecated paths in a coordinated breaking release.** This PRD plans changes; it does not implement them.

## Purpose and scope

An extension should handle the same command rejection, notification selection or resource link the
same way in its command, webview and external SDK client. Today those surfaces expose different
types and behavior. Some APIs also retain several ways to describe the same operation.

This PRD covers the extension context, SDK clients, webview bridge, public renderer/UI contracts,
manifest contributions and the CLI/HTTP paths that expose them. The
[storage PRD](0009-standardize-storage-api.md) owns records, assets and file roots; its
[capacity PRD](0010-bound-client-storage-and-isolate-sync-failures.md) owns retention and recovery.
Those changes use the same three releases.

Relay has no deployed users during alpha. Patch all maintained extensions before relay rollout.
Do not build support for old extension binaries or old-format relay writers. Preserve existing local
data, interrupted conversions, active drafts and promised links through the supported upgrade path.

## What improves

- A review button and its background command select the same notification and receive the same result.
- A workspace activity view requests relevant sessions with paging instead of loading all history.
- A ticket links its session and workspace through `resources`, with consistent validation and events.
- A stale-save rejection keeps its code and conflict details in a webview, CLI or SDK caller.
- A board and a table use the same saved filter and sort definitions. Extensions return their own options.
- Settings, terminal access and navigation get consistent adapters without losing their owner or permission rules.

Measure author code for these tasks before and after adoption. Count exported methods, accepted
manifest fields, bridge operations and retired adapters separately. A namespace rename does not
demonstrate less implementation work. The storage entry-point percentage is not a whole-SDK reduction.

## Inventory and decisions

The [base context](../../../packages/pstdio-api-contracts/src/extension-kernel/types/context.ts)
has 24 service properties plus six identity/invocation fields. The table accounts for every service;
the additional public surfaces appear below. Share operation contracts where their meaning matches.

| Surface | Decision and preserved behavior |
| --- | --- |
| `storage`, `artifacts`, `files`, `projectFiles`, `workspaceFiles`, `packageFiles`, `extensionFiles` | Apply the storage PRD. Keep root selection, read-only types, mount grants and provider checks. |
| `commands` | Share validated outcomes, typed errors and high-level stream handling across clients. Keep middleware decisions distinct from command execution. |
| `sessions` | Use `query` for collection reads and `get` for an exact ID. Keep agent runs and queued input as session operations. |
| `workspaces` | Use `delete` for deletion; remove archive aliases. Keep provider selection, readiness, resolution, cancellation and repository removal distinct. |
| `resources` | Own link additions, removals and queries. Preserve domain validation, changed-edge events and source lifecycle rules. |
| `views` | Keep the saved-view owner. Share filter/sort definitions across renderer, HTTP, CLI and UI adapters. |
| `notify` | Use an explicit transition selector and uniform result. Keep transient notices separate from persistent actions. |
| `settings` | Match typed command and webview methods, including deletion. Preserve installed-extension and project-instance owners. |
| `navigation` | Share typed navigation targets and owner-aware file links across callers. Preserve headless behavior and page/placement ownership. |
| `events` | Keep typed domain event delivery and diagnostics. Do not treat it as a durable command queue or storage receipt. |
| `activity` | Keep persisted activity records with resource references. A toast or event does not replace an activity record. |
| `automation` | Share command references and invocation validation. Keep durable queueing, idempotency keys and explicit environment targets. |
| `process`, `terminal` | Keep separate process and PTY contracts. Share cancellation/error conventions where semantics match. |
| `connections` | Keep credential-controlled outbound requests and byte streams. Do not merge them into general filesystem/network access. |
| `skills` | Keep the resolved skill catalog. Package-file access is not a replacement for catalog resolution. |
| `net` | Keep host port allocation; avoid inventing a second generic HTTP client around it. |
| `logger` | Keep diagnostic logging. Do not merge it into user activity or persistent notifications. |

Keep `projectId`, `workspaceId`, `project`, `extensionId`, `name` and `source` as context identity.
Project/workspace administration, agents and runtime clients are scoped external control APIs.
Align shared DTOs and errors when they describe the same operation; do not give a webview their authority.

The [HTTP SDK root](../../../packages/sdk/src/client/client.ts) also needs explicit coverage:

| SDK client | Shared contract or boundary |
| --- | --- |
| `assets` | Storage PRD; retain explicit owner and streaming guarantees. |
| `filesystem` | Privileged runtime directory browsing/creation for setup. Keep machine-path authority out of `ctx.files.open`. |
| `resources`, `views` | Resource links and saved views below; preserve HTTP authorization. |
| `sessions`, `workspaces`, `notifications` | Align shared operations below; keep runtime administration out of extension contexts. |
| `extensions` | Align command execution/streaming; installation, upgrades and connection configuration remain privileged administration. |
| `automation` | Share invocation/outcome definitions where applicable; token issuance/revocation remain privileged and durable runs keep their queue semantics. |
| `settings` | Runtime settings under `/v1/settings` differ from declared extension settings and scoped preferences. Keep the owners separate. |
| `projects`, `agents`, `runtime` | Keep project administration, agent configuration, environment targeting and browser-login operations with explicit runtime authority. |
| `skills`, `sync` | Keep resolved catalog and UI synchronization transports. Their output is not a durable relay-acceptance receipt. |

## Notification transitions

Current context calls prioritize `id`; the browser prioritizes `dedupeKey` when both are supplied.
The context returns `Notification[]`, while the bridge returns a notification or a batch wrapper.
The bridge type also permits expiry by ID, which its browser implementation rejects.

Add this contract in 0.44, with a new bridge capability for the new operation:

```ts
await ctx.notify.transition({
  selector: { by: "id", id: "review-123" },
  status: "done",
});
// { notifications: Notification[] }
```

The other selector is `{ by: "dedupeKey", dedupeKey: "review-123" }`. Require exactly one selector.
Use the same schema and result for command, typed webview and HTTP adapters. Define empty matches,
idempotent terminal transitions and stale/not-found outcomes. Preserve project boundaries, source
attribution and capability checks. A selector must not grant access to a different project.

Decide whether `expired` is a system-owned transition or an author operation before publishing the
contract. Encode that decision in all schemas and implementations. Do not advertise unsupported combinations.
Deprecate the ambiguous `resolve`/`dismiss` inputs in 0.44, migrate callers in 0.45 and remove their
old methods and bridge paths in 0.46. Keep action creation and transient notices with distinct results.

Evidence: [context adapter](../../../packages/pstdio-api/src/features/extensions/command-environment/notifications.ts),
[browser adapter](../../../packages/pstdio-dashboard/src/shared/extensions/components/extension-webview-frame.tsx),
[bridge contracts](../../../packages/pstdio-api-contracts/src/extension-kernel/types/webview-capabilities.ts).

## Session queries and pagination

The context already exposes `query({ workspaceId, status, limit, cursor })`; `list` and
`listByWorkspace` are deprecated. Its default page size is 50. The HTTP list still returns an
unpaged array and uses a different filter shape. Add a paged HTTP/SDK query in 0.44 with the same
filter meanings and `{ items, nextCursor }` result. Keep `get(id)` for exact lookup and run evidence.

Specify cursor stability, deterministic ordering, archived-session inclusion, timestamp bounds and
status arrays. Use an explicit end-of-results cursor value in new contracts. Do not apply session
filter semantics to unrelated catalogs merely to reuse a method name.

In 0.45 migrate activity displays and automation safety checks. Planner's
[stack update](../../../extensions/pstdio-planner/src/commands/update-stack.ts) rejects work when
another live session uses its workspace. Reading only the first page could miss that session.
Filter for live statuses and follow every relevant page; check the owning session separately by ID.
Preserve intentional ordering and archived behavior. Remove old collection-read paths in 0.46.

Apply the same page result and cancellation conventions to other potentially large histories, such
as automation runs, after checking their ordering and completeness requirements. Small provider and
capability catalogs may keep array reads. List every retained unpaged history and justify its bound.

Evidence: [context types](../../../packages/pstdio-api-contracts/src/extension-kernel/types/sessions.ts),
[HTTP endpoint](../../../packages/pstdio-api/src/features/sessions/endpoints/list-sessions.ts),
[SDK session client](../../../packages/sdk/src/client/sessions.ts).

## Resource links

Use the existing `ctx.resources.addAnchors`, `removeAnchors` and `listAnchors` for existing resources:

```ts
await ctx.resources.addAnchors(
  { type: "session", id: sessionId, extensionId: "pstdio" },
  [{ type: "ticket", id: ticketId, extensionId: plannerOwner }],
);
```

Before deprecating session/workspace wrappers, define common source-existence, owner, project,
transaction and timestamp rules. Legacy additions lock the source row and update its timestamp;
generic additions currently write edges without that source update. Generic canonicalization also
does not reject an absent host resource. Specify and verify the intended behavior in 0.44.

Preserve validation hooks, deduplication, removal checks, changed-edge events and legacy source
refresh until clients migrate. Require declared extension resource kinds and explicit ambiguous owners.
In 0.45 migrate calls; in 0.46 remove session/workspace link wrappers and unused compatibility projections.
Keep anchors supplied during resource creation where the host saves creation and linkage atomically.

Evidence: [generic adapter](../../../packages/pstdio-api/src/features/extensions/command-environment/resource-links.ts),
[canonicalization](../../../packages/pstdio-api/src/features/extensions/command-environment/resource-link-policy.ts),
[legacy transaction](../../../packages/pstdio-db/src/services/legacy-resource-links.ts).

## Command results, errors and streams

The kernel has a discriminated `CommandOutcome`. The HTTP outcome schema accepts `ok` and `status`
independently, including contradictory combinations. The typed webview unwraps failure into a plain
`Error`, losing code, data and diagnostics. HTTP and webview stream clients expose different completion shapes.

In 0.44 add a shared validated outcome contract and adapters. Preserve success values, rejection
codes/data, serialized causes, diagnostics and notices. A throwing helper must expose a typed error
containing the complete outcome. Callers must be able to choose explicit outcomes or throwing helpers.
Keep transport metadata outside the domain outcome; retain raw transport access where it is useful.

Provide a high-level command stream with iterable chunks, a final outcome promise and cancellation.
Specify early iterator return, cancellation before start, disconnect, rejected completion and the
relationship between cancelling consumption and stopping execution. Preserve backpressure and bounds.
Do not copy PTY or agent-session lifetime rules into commands. A disconnected client must not trigger
automatic re-execution of a command with external effects.

Example: a ticket save rejected with `stale_revision` retains its draft and conflict details whether
called from a webview or an external client. In 0.45 migrate callers and stream consumers; in 0.46
remove incompatible legacy schemas and adapters. Do not change old method return shapes in place in 0.44.

Evidence: [kernel outcomes](../../../packages/pstdio-api-contracts/src/extension-kernel/types/commands.ts),
[HTTP schema](../../../packages/pstdio-api-contracts/src/extensions/execute.ts),
[current unwrap helper](../../../packages/sdk/src/extensions/command-outcome.ts),
[webview streams](../../../packages/sdk/src/extensions/webview-streams.ts),
[HTTP streams](../../../packages/sdk/src/client/extension-stream.ts).

## Settings and preferences

Keep declared extension settings and preferences separate. Settings resolve to an installed
extension or a project extension instance. Preferences can have user, project, workspace and session
scopes with fallback and ownership rules. Storing both through arbitrary records would lose those contracts.

Add the missing typed webview `settings.delete` wrapper in 0.44; its bridge capability already exists.
Share settings key/value typing, deletion results and default/fallback semantics with command callers.
Example: deleting a project override restores its declared fallback, rather than storing `null`.
Test installed-global and project-instance cases separately.

Preserve caller-owned preference names, including dynamic names without registration, and explicitly
supported core preferences. Deprecate other cross-extension-name authoring access in 0.44, migrate
callers in 0.45 and remove that path in 0.46. Keep registered scopes/fallbacks and owned dynamic
storage with their existing validation, quotas and ownership; do not require every UI preference to be registered.

Evidence: [typed settings client](../../../packages/sdk/src/extensions/webview-client.ts),
[preference owner](../../../packages/pstdio-workbench/src/extensions/bridge/webview-preferences-capability.ts).

## Saved views, renderer options and drag operations

Use `ViewFilterGroup`, ordered `ViewSort[]` and an explicit default-view ID across saved views,
board/table queries, UI controls, CLI and HTTP schemas. Stop generating old flat filters and single-sort
`ordering` fields once callers migrate. Preserve compound filters, relative date values, manual order,
built-in views, custom titles and default selection when converting existing saved views.

Replace status contributions with extension-owned records/commands and query-returned enum options
and `boardColumnConfigs`. Core renders options and validates the generic contract; the extension owns
allowed workflow transitions and its settings editor. Preserve status values, order, colors and action IDs.
Use `onMove` to save a complete drag once. Keep `onAttributeChange` for actual inline editing.

In 0.44 finish the replacement contracts and deprecations. In 0.45 migrate all board/table extensions,
saved data and public UI callers. In 0.46 remove status contributions, flat filter/default aliases,
single-sort projections and the old drag fallback. Do not delete `StatusBarItemContribution`;
the status bar is a different feature. Retain necessary private saved-data decoders during upgrades.

Evidence: [renderer contract](../../../packages/pstdio-api-contracts/src/extension-kernel/types/kanban-renderer.ts),
[status contributions](../../../packages/pstdio-api-contracts/src/extension-kernel/types/statuses.ts),
[saved views](../../../packages/pstdio-api-contracts/src/board-views.ts),
[public UI view type](../../../packages/ui/src/components/collection-view/collection-view-types.ts).

## Workspace lifecycle, navigation and file links

Use `workspaces.delete`, the provider `delete` hook, `capabilities.delete` and the deleted event.
Deprecate any unmarked archive compatibility in 0.44, update providers and consumers in 0.45, and
remove archive aliases in 0.46. Current HTTP routes and CLI already use delete; do not invent archive
routes to remove. Audit retained archived/archiving states and provider references before changing data.
Keep cancellation of provisioning, worktree removal and workspace deletion as explicit operations.

The published 0.44 authoring contract must let a provider return modern capabilities without requiring
the deprecated `archive` field. It is required in the current `WorkspaceCapabilities` type. Add a
compatible authoring input/adapter while keeping old host output usable in 0.44/0.45; otherwise the
published SDK would force a patched provider to keep a field scheduled for removal. Apply this check
to every deprecated required contribution field before calling the 0.45 migration ready.
Also cover required `KanbanRendererSettings.ordering` and `KanbanRendererQueryParams.filters` in
modern query/testing inputs, while keeping old handler projections usable through 0.45.

Share `NavigationTarget` and resource-owned file-link resolution across command results, browser
navigation, message renderers and CLI opening. Preserve page params, resource identity, workspace,
source position and preview/pin intent. Calls without a UI navigation scope continue to discard
navigation requests. Collecting them for headless callers would be a separate feature. Page-param
updates and placement close still belong to the active UI placement.

Migrate deprecated internal chat `onOpenFile` callbacks to `linkHandler` in 0.45 and remove them
in 0.46. Public chat entry points already expose link handlers. Resolve files through their owner;
a bare path must not pick a different machine or the default workspace. Test the same ticket/report
link from messages, UI and CLI.

Evidence: [workspace API](../../../packages/pstdio-api-contracts/src/extension-kernel/types/workspaces.ts),
[provider contracts](../../../packages/pstdio-api-contracts/src/extension-kernel/types/extension.ts),
[navigation targets](../../../packages/pstdio-api-contracts/src/extension-kernel/types/navigation-target.ts),
[resource path requirements](0008-resource-path-opening.md).

## SDK helper exports and old hook contexts

The public [hooks entry point](../../../packages/sdk/src/hooks/index.ts) still exports filesystem-hook
context types. `BaseHookContext.payload` is explicitly a compatibility mirror, and `HookClient` adds
a singular `client.session.followup` facade to the normal client. The source inventory finds these
types exported and typechecked, without a current maintained runtime producer or extension caller.
Trace hook registration and dispatch before finalizing the removal manifest. Deprecate filesystem-hook
compatibility types in 0.44, migrate any discovered consumers to typed extension hooks/events or the
normal SDK client in 0.45, and remove the old export path in 0.46. Keep their distinct lifecycle payloads
where typed host slots still need them; removing an obsolete facade must not remove supported events.

Retire [requireRepoFiles](../../../packages/sdk/src/data/draft-layout.ts) with old file acquisition.
Planner and Reports pass `ctx.projectFiles` into it today. They must open the intended root in 0.45;
deprecate the helper in 0.44 and remove it in 0.46. Keep pure frontmatter, draft-layout, name-resolution
and prompt-rendering helpers. They do not create another storage owner or command execution model.

## Complete the removal inventory before 0.44 ships

Record every deprecated exported symbol, overload, manifest key, bridge capability, registered CLI
command/flag, HTTP path and deprecated internal compatibility branch. Include its replacement, owner,
last caller, data conversion, 0.44 deprecation evidence and 0.46 removal check. Review export graphs,
registration tables and deprecated markers; string matching alone misses runtime aliases and includes
generated files and historical migration metadata that require different treatment.
Enumerate every package export subpath, including SDK client/api/resources/testing/prompts/hooks/data
and UI/workbench entries. The current API report covers only SDK extensions and extensions/react.
Use export graphs plus actual HTTP/CLI/bridge registrations for the rest of the removal audit.

| Removal family | Replacement or required action |
| --- | --- |
| Deprecated storage KV/collections, mutable file-ID APIs and old file-root properties | Storage PRD; records/assets/explicit file handles. |
| Ambiguous notification resolve/dismiss operations | Shared explicit transition contract. |
| Session list/listByWorkspace and unpaged compatibility routes | Paged query; migrate completeness-sensitive callers explicitly. |
| Session/workspace link wrappers | `resources` with agreed source validation and events. |
| Old command outcome schemas, lossy unwrap and stream adapters | Shared outcome plus typed adapters; preserve raw transport metadata when needed. |
| Workspace archive API, provider hook/capability and event aliases | Delete contract, with persisted-state audit. |
| `defineStatuses`, `StatusContribution`, `WorkflowStatus`, `StatusActionDefinition`, `StatusRef`, `status.v1` | Extension-owned values and query-owned enum/column metadata. |
| Renderer `kind: "status"`, legacy `ordering`, `filters`, `defaultFilters`, `isDefault`, `onReorder` and their type aliases | Enum options, `sorts`, `filter`, explicit default ID and `onMove`. |
| Public `CollectionSavedView.isDefault` | Explicit default selection. |
| Internal deprecated chat `onOpenFile` props | Owner-aware `linkHandler`; verify the package export graph before classifying internal props as public API. |
| Cross-extension preference access, excluding explicitly supported core preferences | Caller-owned registered or dynamic names and supported scopes. |
| Planner public `auto-build candidates` command | `pst tickets next`; retain/refactor internal helpers still used by automatic execution. |
| Planner command parameter `expectedAttemptState` and its generated CLI flag | Current ownership checks and caller-observed `expectedRevision`. |
| Filesystem-hook compatibility contexts and singular hook-client facade | Typed extension hook/event contexts or the normal SDK client; verify actual producers first. |
| SDK `requireRepoFiles` helper | Open an explicit file root; preserve independent pure data helpers. |

This table starts the inventory; implementation must enumerate exact exports and registrations.
Migrate callers of deprecated internal helpers too. Remove deprecated paths and unused branches in 0.46.
An active nondeprecated helper is not obsolete solely because its name resembles an old public command.
Do not delete published data, SQL migration history or promised URL readers merely because a private name says legacy.
Author-facing aliases such as `pst tickets` are current product interfaces, not automatically deprecated.
For Planner, inventory [the old command](../../../extensions/pstdio-planner/src/commands/auto-build-candidates.ts)
and [the deprecated submission parameter](../../../extensions/pstdio-planner/src/commands/change-requests.ts).

## Delivery and acceptance

1. **0.44:** finish shared contracts, host/bridge/SDK/testing adapters, deprecations, migration guide and
   removal inventory. Publish the SDK before dependent extension adoption. Old public calls keep working.
2. **0.45:** update every maintained, bundled and repository-local extension, provider, webview, CLI/SDK
   consumer, fixture, authoring skill and generated example. Convert saved data and ship the updates.
3. **0.46:** remove all old APIs and deprecated public paths after adoption shipped. Remove unused
   adapters and update the public API report, manifest requirements and breaking upgrade notes.

Use the published 0.44 SDK for 0.45 adoption. Publish any missing contract through the supported
workflow before dependent PRs merge. Keep registry dependency checks; do not substitute workspace SDKs.
For 0.46, verify extensions against the cleaned candidate and update `engines.pstdio` for the actual
breaking extension API version, which is separate from product version 0.46. Use Changesets normally.

Acceptance requires notification selector parity, session completeness beyond 50 results, equivalent
resource-link validation/events, full command rejection details, stream cancellation/disconnect handling,
settings fallback, saved-view conversion, provider deletion and owner-correct navigation. All maintained
extensions and examples must use supported paths. Audit exports, manifests, bridge tables, CLI help and
HTTP registrations against the completed removal inventory. Required private data readers have explicit owners.
Delete tests for removed compatibility paths; preserve checks of supported behavior and required data upgrades.

For this documentation-only PR, validate source claims, links, numbering and formatting. Runtime changes,
published SDKs, data conversions and release acceptance remain implementation work.
