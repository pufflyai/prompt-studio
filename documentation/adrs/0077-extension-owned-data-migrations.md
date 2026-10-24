# ADR 0077: Extension-owned data migrations

Proposed: 2026-10-16

## Status

Accepted. SDK preparation precedes extension adoption and removal of the temporary bridge in [ADR 0015](0015-template-content-belongs-to-extensions-temporary-migration.md).

## Decision

Core provides storage migration checkpoints, serialization, and retained source records. Extensions choose their data versions and transformations. Core never chooses an extension owner from a domain record or installs extension code because of that record.

`ctx.storage.migrate(version, run)` serializes calls for one extension instance and storage scope. It reads the last successful integer version, invokes the callback with that version, and advances only after success. Failed work may have written data, so callbacks must support retry. A newer stored version refuses a downgrade. The host keeps only active calls in memory.

Successful versions live in the dedicated `extension_data_versions` table. They never read or overwrite public custom storage scopes. An explicit extension-data purge clears them; deleting an instance clears them by foreign key. A no-op successful migration alone does not count as user content when deciding whether an install can be pruned.

Before a released schema migration drops a table, the database retains its original JSON rows and preceding schema version in the isolated `pstdio_legacy.snapshots` archive. That archive is migration infrastructure, outside the active Drizzle schema; it must exist before older table-drop migrations execute. Released SQL files stay unchanged. Retention does not interpret domain columns or create extension identities.

`ctx.storage.readLegacy(source)` reads only archive records for the invoking project. Records with an extension instance owner remain restricted to that instance. It cannot query active tables or execute SQL. Extensions read existing project files through their ordinary file API and write imported data through ordinary storage APIs.

Extensions run these helpers at their own data entry points. Core readiness never waits for an extension migration. Original records stay retained after import, failure, or missing extension code.

## Consequences

First-party and external extensions use the same public contract. Domain mappings and merge rules live in extensions. A migration failure affects the invoking extension operation and remains retryable. Migration callbacks must not recursively enter migration on the same scope.

SDK preparation ships first. Extension adoption then removes the old template migration and installation repair. The existing 90-day upgrade window governs later removal of retained sources; this change does not delete them.

The temporary Drizzle selection adapter is isolated under [ADR 0078](0078-superseded-temporary-drizzle-migration-selection.md).

Since 0.46 ([ADR 0103](0103-database-baseline-replaces-in-place-upgrades.md)) the host starts with a new database. There is no `pstdio_legacy.snapshots` archive, so `readLegacy` resolves to `undefined`. The `extension_data_versions` table is gone too: successful migration versions live in each owner's metadata document. `migrate` behaves as before.
