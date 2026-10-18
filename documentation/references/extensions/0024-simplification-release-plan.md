# Extension API simplification release plan

This is the release and acceptance appendix of PRD 0011 (`documentation/requirements/platform/0011-simplify-extension-apis.md` in the repository).

## Removal inventory

Before 0.44 ships, record every deprecated export, manifest key, bridge capability, CLI command or
flag, HTTP path and compatibility branch, with its replacement, last caller, data conversion and
removal release. Use export graphs and real registrations; string matching misses runtime aliases.

[API versioning](../../references/extensions/0014-api-versioning.md) and the API report now cover
all eight public SDK entries: `/extensions`, `/extensions/react`, `/testing`, `/data`, `/prompts`,
`/client`, `/api` and `/resources`. Deprecated aliases remain available through 0.44. The `/hooks`
entry is host-only. PRD 0012 (`documentation/requirements/platform/0012-align-extension-api-shapes.md` in the repository)
records this policy. Extensions adopt the new APIs only after the 0.44 SDK is published.

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
| HTTP `capabilities.archive` | `capabilities.delete` | Deprecated in stable 0.43.1, removed in 0.44 by PS-805 |
| HTTP `provider_operation_kind: "archive"`, stored `archive` capability and archived provider states | `delete`; convert stored rows | Operation value deprecated in 0.44; convert stored rows and remove the value in 0.45 |
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
Extension API version checks (`documentation/references/architecture/0024-extension-api-version-checks.md` in the repository)
and the PR labels guide (`documentation/guides/development/0004-pull-request-labels.md` in the repository) in this order:

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
