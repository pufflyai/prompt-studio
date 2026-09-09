# Extension resource identities

Extensions declare an optional prefix on `defineResourceKind`. A literal prefix such as `RP` belongs to that extension and kind. `projectPrefix()` uses the project's stable shorthand. Prefixes contain uppercase letters and digits, start with a letter, and have at most 16 characters. `WS` is reserved for host workspaces.

`ctx.resources.allocate({ kind: "ticket" })` returns a fresh UUID and a shorthand. The host stores one sequence per project, stable extension package ID, and local kind. A single database upsert increments the number. Failed domain writes may leave gaps. Deleting domain data or uninstalling an extension never resets the sequence. The extension stores its own data and may use external storage.

Normalization reports duplicate literal or project-derived declarations. Project enablement rejects those conflicts. A database unique constraint on project and prefix also rejects a literal that collides with a project-derived prefix. The error names both owners. Existing kinds without prefixes remain valid but cannot allocate identities.

`ResourceRef.shorthand` carries display identity alongside the UUID. It is a value, not a persisted resource registry.

## Planner migration

Existing projects must run `pst pstdio-planner migrate-ticket-identities` from their repository before creating tickets with the updated Planner. Stop ticket writers and automation first, and run one migration command at a time. This maintenance operation renumbers saved tickets in stable order, beginning at 1 in a project with no previous host allocations. UUIDs remain unchanged.

The command backs up all local ticket files under `.pstdio/ticket-identity-migration`, including unsaved edits and orphan files. It replaces `.pstdio/tickets` with files rebuilt from saved tickets, and refreshes session anchor labels and shorthands. Restore any wanted unsaved edits from the backup into the corresponding new ticket. Do not save old files by their old shorthand.

A persisted migration journal and per-ticket allocation map allow an interrupted command to resume without allocating a second shorthand for tickets already mapped. A completed rerun does nothing. Keep writers stopped until it completes. Other clients must discard or back up their old local ticket files and pull fresh copies before saving.

The result lists linked workspaces for manual review. It does not rename live Git branches or worktrees. Old external links and commit messages retain their old numbers.

## Shared SDK helpers

Import in-memory storage, repository files, resource allocators, and command contexts from `@pstdio/sdk/testing`. Command fixtures pass a prefix map for declared kinds. Import frontmatter quoting and replacement, name resolution, and safe draft layouts from `@pstdio/sdk/data`. Domain schemas and commands stay in the extension.

The host, SDK, Planner, and Reports changes ship together in this PR. Publish the SDK with its new `data` and `testing` subpaths before distributing the updated extension packages to installations that use the published SDK.
