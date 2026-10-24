# Database Upgrades

Prompt Studio upgrades the local database in place when a new release starts. This page defines which older databases a release must still upgrade, so legacy migration code has a real removal date.

## Supported upgrade window

A release upgrades a database written by any Prompt Studio release published in the **last 90 days**.

- The window is counted from the publish date of the release that ships the removal, back to the publish date of the oldest supported release.
- A database older than the window upgrades in two steps: first install a release from inside the window and start it once, then install the current release.
- The window is in days, not in minor versions, because Prompt Studio publishes several minor releases a week. For example, `pstdio@0.34.0` to `pstdio@0.40.0` shipped between 2026-09-25 and 2026-10-02.

## Legacy migration code

The PGlite engine upgrade prepares a private copy, exports with the previous engine, then imports and checks a new database before publication. It emits `database_upgrade_copying`, `database_upgrade_exporting` and `database_upgrade_importing` before each operation so desktop can explain the work underway. Ordinary starts on the current engine omit these phases. See [ADR 0098](../../adrs/0098-temporary-pglite-minor-upgrade-adapter.md) for data ownership and interruption recovery.

Code that only repairs databases older than a given release may be deleted once that release falls out of the window. Delete it in the next breaking release after the removal date, together with the other removals (see [API versioning](../extensions/0014-api-versioning.md) for how breaking releases are grouped).

| Code | First shipped | Removal date (90 days later) |
| --- | --- | --- |
| Planner and Reports template imports and their retained source records, under [ADR 0077](../../adrs/0077-extension-owned-data-migrations.md) | Original schema removal: `pstdio@0.30.0`, 2026-08-28 | 2026-11-26 |
| `pstdio-db/src/db/contribution-id-renames.ts` | `pstdio@0.31.0`, 2026-09-07 | 2026-12-06 |
| `pstdio-db/src/db/legacy-worktree.ts`, `workspace-location-migration.ts`, and the `migrateThrough(db, migrationsFolder, 31)` step in `connection.pglite.ts`. The generic table-retention helper stays. | `pstdio@0.36.0`, 2026-09-28 | 2026-12-27 |
| `pstdio-db/src/db/shared-workspace-folders.ts` | `pstdio@0.37.0`, 2026-09-29 | 2026-12-28 |

Generated Drizzle migrations (`pstdio-db/drizzle/*.sql`) stay. They are the schema history that new databases replay. Do not edit them by hand, including `0020_harness_id_namespacing.sql`, `0029_contribution_id_grammar.sql` and `0037_nebulous_galactus.sql`, which translate released first-party extension identities.

## Legacy templates

Releases before `pstdio@0.30.0` kept templates in core tables. When a migration drops such a table, `migrateThrough` first keeps its rows as an opaque snapshot (`pstdio-db/src/db/retired-data.ts`). Core does not read these rows, choose an owner, or install an extension.

Planner owns `ticket`, `prompt`, and `document` templates, and Reports owns `report` templates. Each extension imports its own templates the first time its template storage is used, with `ctx.storage.readLegacy` inside a versioned `ctx.storage.migrate` step. The import replaces `_` with `-` in names and keeps records that already exist in extension storage. It stops with an error, so content is never discarded silently, when two names collide after that change or a record is invalid. A failed import does not advance the migration version, so the next access retries it.

Tests: `migrate-templates.test.ts` in Planner and Reports, and `packages/e2e/src/packaged/packaged-template-storage-smoke.ts`.

## Extension data belongs to extensions

The core database does not own extension data, so new database code and new migrations must not name extension ids. The resource-anchor migration and `pstdio-db/src/services/legacy-resource-links.ts` translate the released anchor arrays under [ADR 0061](../../adrs/0061-project-resource-anchors.md). This is the only new exception: the public Extension API must preserve released anchor methods until their grouped breaking removal. Delete the legacy bridge with those methods; the generated schema migration stays. Generic resource-link storage must use explicit owners. `pstdio-db/src/db/extension-owned-ids.test.ts` fails when a file outside the legacy list above names a first-party extension id.

An extension that renames its own commands, schedules, or stored values ships its migration with the extension. Use [versioned storage migrations](../extensions/0018-data-migrations.md) with `ctx.storage.migrate` and `ctx.storage.readLegacy` to check the previous successful version and retry safely ([ADR 0077](../../adrs/0077-extension-owned-data-migrations.md)). Core retains records before table removal without assigning domain owners or installing packages. The extension chooses its import and merge rules. This replaces the temporary core bridge in [ADR 0015](../../adrs/0015-template-content-belongs-to-extensions-temporary-migration.md). These helpers ship in `@pstdio/sdk` 0.44.0; `@pstdio/sdk@0.43.1` does not have them.
