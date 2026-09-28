# Extension resource identities

Extensions declare an optional prefix on `defineResourceKind`. A literal prefix such as `RP` belongs to that extension and kind. `projectPrefix()` uses the project's stable shorthand. Prefixes contain uppercase letters and digits, start with a letter, and have at most 16 characters. `WS` is reserved for host workspaces.

`ctx.resources.allocate({ kind: "ticket" })` returns a fresh UUID and a shorthand. The host stores one sequence per project, stable extension package ID, and local kind. A single database upsert increments the number. Failed domain writes may leave gaps. Deleting domain data or uninstalling an extension never resets the sequence. The extension stores its own data and may use external storage.

Normalization reports duplicate literal or project-derived declarations. Project enablement rejects those conflicts. A database unique constraint on project and prefix also rejects a literal that collides with a project-derived prefix. The error names both owners. Existing kinds without prefixes remain valid but cannot allocate identities.

`ResourceRef.shorthand` carries display identity alongside the UUID. It is a value, not a persisted resource registry.

## Planner migration

Planner automatically migrates existing ticket identities before creating a ticket or writing a draft. Users do not need to run a maintenance command. Concurrent creation requests and the optional `pstdio pstdio-planner migrate-ticket-identities` command share one migration per project in the host. The migration renumbers saved tickets in stable order, beginning at 1 in a project with no previous host allocations. UUIDs remain unchanged. Requests that start, join, or resume a migration resolve parent and dependency references through its original identity map.

The migration backs up all local ticket files under `.pstdio/ticket-identity-migration`, including unsaved edits and orphan files. It moves checked-out drafts and their files to the new paths, preserving unsaved content and updating identity references in frontmatter. Tickets without a checkout are rebuilt from saved content. Orphan files remain in the backup. Session anchor labels and shorthands are refreshed.

A persisted migration journal and per-ticket allocation map allow an interrupted migration to resume on the next creation attempt without allocating a second shorthand for tickets already mapped. New identities are allocated only after migration completes. A completed rerun does nothing and does not require local ticket files. Empty projects initialize directly without touching the local checkout. Other clients must discard or back up their old local ticket files and pull fresh copies before saving.

The journal records when the original checkout backup is complete so retries never treat rewritten paths as original drafts. Ticket writes and identity changes share a per-ticket queue. Normal writes preserve the stored shorthand, so an editor holding an older snapshot cannot undo migration. Migration reads the current ticket inside that queue and skips tickets deleted while it was running.

The result lists linked workspaces for manual review. It does not rename live Git branches or worktrees. Old external links and commit messages retain their old numbers.

## Shared SDK helpers

Import in-memory storage, repository files, resource allocators, and command contexts from `@pstdio/sdk/testing`. Command fixtures pass a prefix map for declared kinds. Import frontmatter quoting and replacement, name resolution, and safe draft layouts from `@pstdio/sdk/data`. Domain schemas and commands stay in the extension.

The host, SDK, Planner, and Reports changes ship together in this PR. Publish the SDK with its new `data` and `testing` subpaths before distributing the updated extension packages to installations that use the published SDK.
