# Extension resource identities

Extensions declare an optional prefix on `defineResourceKind`. A literal prefix such as `RP` belongs to that extension and kind. `projectPrefix()` uses the project's stable shorthand. Prefixes contain uppercase letters and digits, start with a letter, and have at most 16 characters. `WS` is reserved for host workspaces.

`ctx.resources.allocate({ kind: "ticket" })` returns a fresh UUID and a shorthand. The host stores one sequence per project, stable extension package ID, and local kind. A database upsert keeps the local allocation floor and reserves prefix ownership. Core stores identities and number history in its own Yjs document per project. Failed domain writes may leave gaps. Deleting domain data or uninstalling an extension never resets the sequence. The extension stores its own data and may use external storage.

Normalization reports duplicate literal or project-derived declarations. Project enablement rejects those conflicts. A database unique constraint on project and prefix also rejects a literal that collides with a project-derived prefix. The error names both owners. Existing kinds without prefixes remain valid but cannot allocate identities.

`ResourceRef.shorthand` carries display identity alongside the UUID. It is a display snapshot. Extensions adopting the core number API read the current number rather than persisting their own copy. Planner and Reports adoption is separate.

## Planner migration

Existing projects must run `pst pstdio-planner migrate-ticket-identities` from their repository before creating tickets with the updated Planner. Stop ticket writers and automation first, and run one migration command at a time. This maintenance operation renumbers saved tickets in stable order, beginning at 1 in a project with no previous host allocations. UUIDs remain unchanged.

The command backs up all local ticket files under `.pstdio/extension-storage/pstdio-planner/ticket-identity-migration`, including unsaved edits and orphan files. It replaces `.pstdio/extension-storage/pstdio-planner/tickets` with files rebuilt from saved tickets, and refreshes session anchor labels and shorthands. Restore any wanted unsaved edits from the backup into the corresponding new ticket. Do not save old files by their old shorthand.

A persisted migration journal and per-ticket allocation map allow an interrupted command to resume without allocating a second shorthand for tickets already mapped. A completed rerun does nothing. Keep writers stopped until it completes. Other clients must discard or back up their old local ticket files and pull fresh copies before saving.

The result lists linked workspaces for manual review. It does not rename live Git branches or worktrees. Old external links and commit messages retain their old numbers.

## Shared SDK helpers

Import in-memory storage, repository files, resource allocators, and command contexts from `@pstdio/sdk/testing`. Command fixtures pass a prefix map for declared kinds. Import frontmatter quoting and replacement, name resolution, and safe draft layouts from `@pstdio/sdk/data`. Domain schemas and commands stay in the extension.

Publish SDK and host APIs before adopting them in separately released extensions.

## Offline number repair

The core document uses the reserved owner `pstdio` and document `resource-identities`.
It syncs independently of enabled extensions and survives extension data deletion.
Each resource has one current number. Append-only history keeps every earlier number
as an alias. A merge repairs duplicates in the same durable document transaction:
sort resource IDs, keep the first, and assign each other resource a number above all
current and historical numbers for that prefix. Devices use IDs rather than clocks
to choose the keeper. Concurrent repairs merge and are repaired again if necessary.

`resources.identity` reads a current identity. `resources.findByShorthand` includes
aliases and returns current matches first. Both are scoped to the calling project,
extension and kind. The host publishes `resourceEvents.renumbered` only after the
document transaction commits. See the [SDK reference](../sdk/0002-resources.md#resource-numbers).
