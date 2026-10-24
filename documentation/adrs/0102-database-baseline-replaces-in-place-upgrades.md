# ADR 0102: A database baseline replaces in-place upgrades

Proposed: 2026-10-24

## Status

Accepted.

## Context

Until 0.45, every release upgraded the local database in place. Startup replayed 53 Drizzle migrations and ran about a dozen hand-written repair steps between them. Release 0.46 also changed the PGlite engine ([ADR 0098](0098-superseded-temporary-pglite-minor-upgrade-adapter.md)) and moved extension records into one document each ([ADR 0100](0100-one-document-per-resource.md)). Both steps needed their own one-time upgrade.

On a real two-year-old database both upgrades failed. Four rows broke their own foreign keys, so the engine transfer stopped. After that was repaired, moving 78 MB of Planner tickets into per-record documents ran out of PGlite memory, and the backend stayed unavailable. The [lesson](../lessons-learned/0018-in-place-upgrades-meet-real-data-last.md) has the full timeline.

## Decision

0.46 is a breaking release for local data.

- `pstdio-db/drizzle` holds one generated baseline migration for the 0.46 schema. Later schema changes add generated migrations on top of it.
- The engine marker `.pstdio-engine.json` names the baseline (`{ "baseline": "0.46" }`). A home without that exact marker is *retired*: startup exports it to JSON, moves it to `backups/pre-0.46-<time>/` next to the database, and creates an empty database from the built image.
- The export worker opens the old home with the engine that wrote it (`pglite-previous` for an unmarked home). It writes every table as JSON lines and decodes extension records from their Yjs documents into plain records. A failed export writes `export-error.txt` and still moves the folder aside, so nobody is locked out.
- People bring data back by asking an agent to read the export and recreate it with the `pst` CLI. Core has no import code.
- The public `ctx.storage.readLegacy` API stays and resolves to `undefined`. Its `@deprecated` marker ships in a separate SDK change, because one pull request may not change both the SDK and extensions. `ctx.storage.migrate` is unchanged.

## Consequences

Startup has no upgrade code paths, and no test needs an old database except the export tests. The removed code includes the engine transfer, `migrateThrough`, the workspace, board view, queued request and capability repairs, retired-table snapshots, the journal and owner-document storage upgrades, the grouped-storage service with its journal, key-value, collection, data-version and unused `ydoc_*` tables, and the upgrade test from 0.45.

Users lose in-app history from before 0.46 until an agent re-imports it. The raw folder and the export stay on disk.

The legacy `pstdio.db.lock` fence ([ADR 0079](0079-temporary-legacy-database-lock-fence.md)) stays, because it stops a still-running older release from opening the new home.

A future baseline repeats this process with a new marker value. See [Database upgrades](../references/architecture/0025-database-upgrades.md).
