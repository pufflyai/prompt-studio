# Temporary Planner ticket identity migration

Proposed: 2026-09-28

## Status

Temporary workaround. This is not the intended design.

## Intended design

The host allocates every ticket's shorthand through `ctx.resources.allocate({ kind: "ticket" })`. Planner stores the shorthand it receives and never changes it. Ticket creation resolves `parent` and `dependsOn` against saved tickets, and nothing waits on a migration.

## External limitation

Projects created before host-allocated identities (PS-419) already store tickets whose shorthands Planner numbered itself. Those numbers are unknown to the host allocator. If the host allocates for such a project, a new ticket can receive a shorthand that an existing ticket already uses.

Users upgrade in place and keep their existing project data. The extension platform has no versioned data migration step that runs once per extension version before commands. So Planner must renumber existing tickets itself the first time an upgraded project opens, or before the first ticket is created, whichever comes first.

## Temporary workaround

Planner runs a one-time, resumable migration per project:

- `projectEvents.opened` triggers it at startup and whenever an upgraded or reloaded Planner source is adopted.
- `create-ticket` and `write-ticket` await it before allocating a shorthand, and resolve references through the migration's original identity map.
- `pst pstdio-planner migrate-ticket-identities` runs it on demand.
- A persisted journal (`identity-migrations`) and a per-ticket allocation map (`ticket-identity-allocations`) let an interrupted run resume without allocating a second shorthand.
- Local ticket files are backed up under `.pstdio/ticket-identity-migration` before drafts move to their new paths.
- All ticket writes pass through a per-ticket queue that keeps the stored shorthand, so an editor holding a snapshot from before the migration cannot undo it.

Trade-offs:

- Ticket writes serialize per ticket and read the stored ticket before writing.
- Ticket creation reads the migration journal on every call.
- Linked Git branches, worktrees, external links, and commit messages keep their old numbers. The migration result lists linked workspaces for manual review.

The host changes in the same PR are permanent, not part of this workaround. They are the startup upgrade of release-managed extension sources and the delivery of `projectEvents.opened` to every enabled project.

## Isolation

Every piece of the migration lives in `extensions/pstdio-planner/src/migrations/ticket-identities/`:

| File | Role |
| --- | --- |
| `migrate.ts` | Journal, allocation, renumbering, anchor refresh |
| `drafts.ts` | Moves local drafts and files to their new paths |
| `references.ts` | `prepareTicketIdentities`: migration-aware reference lookup for creation |
| `identity-guard.ts` | Per-ticket write queue that keeps stored shorthands |
| `hook.ts` | `projectEvents.opened` hook |
| `command.ts` | `migrate-ticket-identities` CLI command |

Code outside the folder uses it only at these call sites, each marked `ADR 0047`:

- `extension.ts`: registers `projectOpenedHook`
- `src/commands/index.ts`: registers `migrateTicketIdentitiesCommand`
- `src/commands/create-ticket.ts` and `src/commands/write-ticket.ts`: call `prepareTicketIdentities`
- `src/data/collections.ts`: `ticketsCollection` wraps storage with `identityGuardedTickets`

## Limitations

A project that never opens while a release containing this migration is installed keeps its old numbering. If the migration is removed first, creating tickets in that project can reuse existing shorthands. Users who skip past the removal release must first install a release that still contains the migration and open their projects once.

## Removal

Remove the migration in the first minor release that is at least two minor releases after the release that ships PS-419. By then, supported upgrades have passed through a release that ran it. PS-423 tracks this removal.

1. Delete `extensions/pstdio-planner/src/migrations/ticket-identities/`, including its tests.
2. In `extension.ts`, drop `projectOpenedHook`. In `src/commands/index.ts`, drop `migrateTicketIdentitiesCommand` and its `commands.migrateTicketIdentities` strings in `l10n/*.json`.
3. In `create-ticket.ts` and `write-ticket.ts`, resolve `parent` with `resolveTicketId` and `dependsOn` with `resolveDependencyIds` before allocating, as the comments at the call sites describe.
4. In `src/data/collections.ts`, return `storage.collection<StoredTicket>(TICKETS_COLLECTION)` from `ticketsCollection`.
5. Remove the "Planner migration" section from `.pstdio/docs/architecture/extension-resource-identities.md`.
6. Leave the stored `identity-migrations` and `ticket-identity-allocations` records and the `.pstdio/ticket-identity-migration` backups in place. They are inert and belong to users.
7. Rename this ADR's status to superseded, and verify ticket creation, drafts, and the Planner packaged smoke test.
