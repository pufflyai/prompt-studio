# Database Upgrades

Prompt Studio keeps local data in an embedded PGlite database. This page explains which databases a release opens and what happens to the others.

## The 0.46 baseline

The schema starts at one generated migration in `pstdio-db/drizzle`, the 0.46 baseline. A new schema change adds a generated migration on top of it with `bun run --cwd packages/pstdio-db db:generate`. Never edit migration SQL by hand.

Every database folder carries `.pstdio-engine.json`. It names the PGlite engine and the baseline:

```json
{ "format": 1, "engine": "pglite-0.4", "baseline": "0.46" }
```

## Homes from older releases

At startup, `prepareCurrentPgliteHome` (`pstdio-db/src/db/pglite-current-home.ts`) handles three cases:

| Data folder | What happens |
| --- | --- |
| Missing or empty | Restore the built empty database and mark it. |
| Marked with the current baseline | Open it and apply newer migrations. |
| Anything else | Retire it, then create an empty database. |

Retiring writes `backups/pre-0.46-<time>-<folder>/` next to the database:

- `export/tables/<schema>.<table>.jsonl`: every table, one JSON row per line.
- `export/extension-records/<project id>/<extension id>.jsonl`: extension records, such as tickets, decoded from their Yjs documents.
- `export/README.md`: how to bring data back with an agent.
- `database/`: the original folder.

The export runs in a separate worker (`pglite-export-worker.ts`) with the engine that wrote the folder. If it fails, startup writes `export-error.txt` and still moves the folder aside. Desktop shows the `retiring` phase while this runs. Startup emits `database_retiring` and `database_retired`.

Core has no import code. To restore old data, ask an agent to read the export and recreate what you need with the `pst` CLI.

## Changing the schema later

- Additive and ordinary changes: generate a migration on top of the baseline. Fresh databases and current homes both apply it.
- A change that would need a data repair for existing homes: prefer a schema that does not need one. If it is unavoidable, the repair ships as a generated migration, tested on a copy of a large real database first. See [the lesson from 0.46](../../lessons-learned/0018-in-place-upgrades-meet-real-data-last.md).
- A new baseline repeats the 0.46 process: squash, change the marker's `baseline`, and update the backup folder name. Decide it as a breaking release, in an ADR.

A home written by the latest published nightly must open in the next build. `packages/e2e/src/packaged/packaged-nightly-home.p1.test.ts` runs in the P1 packaged CLI suite in the merge queue and nightly validation. It downloads that nightly and creates a project with it. It then starts the candidate build on the same home and fails if the candidate retires it. If the nightly cannot be downloaded or cannot write a home, the test skips with a warning, so a broken nightly cannot block its own fix. A pull request that starts a new baseline adds the published marker to `deliberateRetirements` in that test, in the same pull request as its ADR. Remove the entry once a nightly with the new baseline ships. This way nightly users lose their home only after a recorded decision. The rule exists because the 0.46 baseline marker reached nightly users one day after the previous marker, and their homes were retired without a decision.

## Extension data belongs to extensions

The core database does not own extension data, so database code and migrations must not name extension ids. `pstdio-db/src/services/legacy-resource-links.ts` translates the released anchor arrays under [ADR 0061](../../adrs/0061-project-resource-anchors.md) until their grouped breaking removal. `pstdio-db/src/db/extension-owned-ids.p0.test.ts` fails when another file names a first-party extension id.

An extension that renames its own commands, schedules, or stored values ships its migration with the extension, using [versioned storage migrations](../extensions/0018-data-migrations.md) and `ctx.storage.migrate` ([ADR 0077](../../adrs/0077-extension-owned-data-migrations.md)). Since 0.46, `ctx.storage.readLegacy` always resolves to `undefined`.

See [ADR 0103](../../adrs/0103-database-baseline-replaces-in-place-upgrades.md) for the decision.
