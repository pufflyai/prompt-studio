# Database Upgrades

Prompt Studio upgrades the local database in place when a new release starts. This page defines which older databases a release must still upgrade, so legacy migration code has a real removal date.

## Supported upgrade window

A release upgrades a database written by any Prompt Studio release published in the **last 90 days**.

- The window is counted from the publish date of the release that ships the removal, back to the publish date of the oldest supported release.
- A database older than the window upgrades in two steps: first install a release from inside the window and start it once, then install the current release.
- The window is in days, not in minor versions, because Prompt Studio publishes several minor releases a week. For example, `pstdio@0.34.0` to `pstdio@0.40.0` shipped between 2026-09-25 and 2026-10-02.

## Legacy migration code

Code that only repairs databases older than a given release may be deleted once that release falls out of the window. Delete it in the next breaking release after the removal date, together with the other removals (see [API versioning](../extensions/0014-api-versioning.md) for how breaking releases are grouped).

| Code | First shipped | Removal date (90 days later) |
| --- | --- | --- |
| `pstdio-db/src/db/legacy-template-migration.ts`, `legacy-template-owners.ts`, and the startup repair and source adoption from [ADR 0015](../../adrs/0015-template-content-belongs-to-extensions-temporary-migration.md) | `pstdio@0.30.0`, 2026-08-28 | 2026-11-26 |
| `pstdio-db/src/db/contribution-id-renames.ts` | `pstdio@0.31.0`, 2026-09-07 | 2026-12-06 |
| `pstdio-db/src/db/legacy-worktree.ts`, `workspace-location-migration.ts`, and the `migrateThrough(db, migrationsFolder, 31)` step in `connection.pglite.ts`. `migrate-through.ts` goes with its last caller. | `pstdio@0.36.0`, 2026-09-28 | 2026-12-27 |
| `pstdio-db/src/db/shared-workspace-folders.ts` | `pstdio@0.37.0`, 2026-09-29 | 2026-12-28 |

Generated Drizzle migrations (`pstdio-db/drizzle/*.sql`) stay. They are the schema history that new databases replay. Do not edit them by hand, including `0020_harness_id_namespacing.sql`, `0029_contribution_id_grammar.sql` and `0037_nebulous_galactus.sql`, which translate released first-party extension identities.

## Packaged migration files

Compiled runtimes extract their embedded SQL and journal into a unique, owner-only `pstdio-drizzle-*` folder under the configured Prompt Studio home (`PSTDIO_HOME`, or `~/.pstdio`). Each startup owns its folder. It never deletes or reuses another runtime's extraction or a shared system temporary path.

The database startup removes this folder after migrations succeed or fail. A failed extraction also removes its partial files. A process killed before cleanup can leave its own folder behind; later startups do not adopt or delete it. Source-mode runtimes read the repository's Drizzle folder directly and leave it intact.

## Extension data belongs to extensions

The core database does not own extension data, so new database code and new migrations must not name extension ids. The resource-anchor migration and `pstdio-db/src/services/legacy-resource-links.ts` translate the released anchor arrays under [ADR 0061](../../adrs/0061-project-resource-anchors.md). This is the only new exception: the public Extension API must preserve released anchor methods until their grouped breaking removal. Delete the legacy bridge with those methods; the generated schema migration stays. Generic resource-link storage must use explicit owners. `pstdio-db/src/db/extension-owned-ids.test.ts` fails when a file outside the legacy list above names a first-party extension id.

An extension that renames its own commands, schedules, or stored values needs an extension-owned data migration that ships with the extension. That capability does not exist yet; it is the missing piece [ADR 0015](../../adrs/0015-template-content-belongs-to-extensions-temporary-migration.md) names. Until it exists, an extension keeps reading its old values or migrates them in its own startup code.
