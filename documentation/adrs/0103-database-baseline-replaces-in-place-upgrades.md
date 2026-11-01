# A database baseline replaces in-place upgrades

Proposed: 2026-10-24

Status: Accepted. Consolidates the retired Drizzle migration-selection adapter (ADR 0078) and PGlite engine-transfer adapter (ADR 0098).

## Context

- Startup replayed 53 migrations and many repairs. Release 0.46 also changed the engine and [record document boundaries](0100-one-document-per-resource.md).
- A real two-year-old database contained four broken foreign-key rows, stopping engine transfer. After repair, converting 78 MB of Planner data exhausted PGlite memory.
- Small and synthetic transfer probes had passed. They did not qualify real histories, large values, or every platform. The [upgrade lesson](../lessons-learned/0018-in-place-upgrades-meet-real-data-last.md) retains the failure evidence.

## Decision

1. Release 0.46 breaks local-data compatibility. Start from one generated schema baseline; add later generated migrations on top.
2. Require `.pstdio-engine.json` to contain the exact baseline marker `{ "baseline": "0.46" }`. Retire homes without it: export them, move them to `backups/pre-0.46-<time>-<folder>/` beside the database, and create a fresh database from the built image.
3. Export with the engine that wrote the old home, using `pglite-previous` for unmarked homes. Write every table as JSON lines and decode extension Yjs records into plain records.
4. If export fails, write `export-error.txt`, preserve the old folder, and continue with a fresh home instead of blocking startup.
5. Restore selected data through an agent using the `pst` CLI. Core provides no import path.
6. Keep `ctx.storage.readLegacy` as an API returning `undefined`; deprecate it in the separate SDK change. `ctx.storage.migrate` is unchanged.

## Consequences

- Remove engine transfer, private migration-prefix selection, retired-table archives, and legacy storage/repair paths. Ordinary baseline migrations use Drizzle's public migrator.
- In-app history before 0.46 is unavailable until re-imported. Raw homes and exports remain on disk.
- Keep the [legacy lock fence](0079-temporary-legacy-database-lock-fence.md) to exclude older binaries.
- A future baseline repeats the process with a new marker. See [database upgrades](../references/architecture/0025-database-upgrades.md).
