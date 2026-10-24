# In-Place Upgrades Meet Real Data Last

## What

The 0.46 nightly carried two upgrades that each rewrote all local data: a PGlite engine transfer ([ADR 0098](../adrs/0098-superseded-temporary-pglite-minor-upgrade-adapter.md)) and the move of extension records into one document each ([ADR 0100](../adrs/0100-one-document-per-resource.md)). On a maintainer's two-year-old 1.9 GB home, both failed. The app could not start for several hours, and the fix was to drop in-place upgrades ([ADR 0102](../adrs/0102-database-baseline-replaces-in-place-upgrades.md)).

1. **The engine transfer crashed.** The import loaded every row, then re-added the foreign keys from the `pg_dump` post-data section. Postgres checks every row when it adds a key, and 4 `workspace_sessions` rows pointed to sessions and workspaces that no longer existed. The whole import rolled back with `23503`.
2. **The crash looped.** Desktop retried startup, and each retry exported 1,000 files again and failed the same way. Each failure logged the whole 50 KB post-data SQL twice, so the one useful line (`Key (session_id)=(…) is not present`) was hard to find.
3. **After the rows were repaired by hand, the backend still stayed unavailable.** Every API call that needed extensions returned 500. The log said only `[unable to serialize, circular reference is too complex to analyze]`.
4. **The real error needed a replay on a copy.** The per-record storage upgrade moved 2,865 Planner records (78 MB; seven tickets held 5–14 MB attached files) inside one transaction, 500 records per statement. Each statement carried the values as JSON, and the documents as hex inside JSON, which PGlite then parsed into `jsonb`. The WASM heap ran out (`53200 out of memory`). Drizzle then built its error message from the full parameters and hit a JavaScript `RangeError: Out of memory`. That error object was what the logger could not serialize.
5. **The failure blocked everything, forever.** The extension catalog retried the upgrade on every request, about every 23 seconds. Each attempt held the database, and the app could not quit without a confirmation dialog.

## Why

- **Old data breaks old rules.** The 4 orphan rows came from earlier corruption and manual repairs (`pg_resetwal`, deletes with `session_replication_role = replica`). A database does not always satisfy its own constraints. Any step that re-validates them meets those rows.
- **Tests used small, clean data.** The upgrade test from 0.45 used one record of about 16 KB. The transfer tests used fixtures that obeyed every key. Neither the size nor the history of a real home was ever exercised.
- **Batches were counted in rows, not bytes.** 500 or 1,000 rows is small for typical records and far too large for records with attached files.
- **Two whole-data upgrades shipped in one release, on the startup path.** Either one failing meant no app at all, and the second one only ran after the first succeeded, so its failure was found a day later.
- **Errors lost their cause.** The useful Postgres error sat under a huge message, or inside an object too large for the logger.

## Prevention

- Before merging any change that rewrites existing data, run it on a copy of the largest real home available, such as a maintainer's `~/.pstdio`. Copy the database while the app is stopped (`cp -R`), never the live folder.
- Prefer a new baseline plus a readable export ([Database upgrades](../references/architecture/0025-database-upgrades.md)) over an in-place rewrite while the product is in alpha. If an upgrade is unavoidable, ship at most one per release.
- A data step must never leave the app unusable. If it fails, keep the original data and let startup continue.
- Bound every statement payload by encoded size, not row count. `jsonBatches` in `pstdio-db/src/services/extension-storage/json-batches.ts` caps a statement at about 4 MB.
- Never assume a source database satisfies its own foreign keys, unique indexes, or checks.
- Log the root error with its cause chain, not the query text or parameters. When a log says `unable to serialize`, replay the failing step on a copy to see the real error.
- When a step fails at startup, stop retrying it on every request. Report it once and wait for a new start.

Tests: `pglite-current-home.test.ts` and `packaged-database-retirement.test.ts` cover retiring an old home. `resource-records.test.ts` saves 24 records of 8 MB each in one commit.
