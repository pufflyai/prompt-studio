# Temporary PGlite minor-upgrade adapter

Proposed: 2026-10-23

Status: Proposed. Qualification is complete for the small released fixture and the synthetic transfer cases below. Production transition code is not implemented.

## Context

PS-923 needs full ICU collation resources to preserve the shared views' locale-sensitive numeric order. PGlite 0.4.6 supplies ICU while retaining PostgreSQL 17.5. The installed PGlite 0.3.16 does not supply the required collation behavior. Date display predicates remain a separate query concern.

Ideally, changing the embedded engine would open existing homes through a supported compatible path, with one runtime and no migration adapter. Matching PostgreSQL version strings are insufficient evidence of that support.

## External limitation

[PGlite's upgrade guide](https://pglite.dev/docs/upgrade) prescribes an old-engine logical export followed by import into the new engine for minor upgrades, including 0.3 to 0.4. A [maintainer's compatibility clarification](https://github.com/electric-sql/pglite/issues/932#issuecomment-4129042731) confirms that minor upgrades require recreation or migration.

A disposable copy of a real released 0.45 home opens under 0.4.6 when the database and role are explicitly `template1` and `postgres`. All 42 application/migration tables, surviving column definitions, indexes, constraints and values match, and writes survive reopening. This demonstrates capability for that fixture. It does not establish a supported direct upgrade for every user home. We therefore do not choose direct opening as the production upgrade path.

The matching `@electric-sql/pglite-tools` 0.2.21 public dump API returns a complete `File`. Its implementation creates a whole UTF-8 SQL string from an in-memory filesystem before creating that file. It has no streaming output option. The latest tool fails against the old engine. A whole database dump in the long-lived application would retain unnecessary copies of large binary records.

## Decision

Keep the old engine and its matching dump tool isolated in a temporary upgrade worker. Use their public APIs without patching their internals:

1. Hold the existing external database lock before inspecting or preparing an engine transition.
2. Keep the original home closed and unchanged. Export from an owned copy in a short-lived old-engine process.
3. Export schema in `pre-data` and `post-data` sections through schema-only `pgDump`. Export table rows through PostgreSQL `COPY` using the public `/dev/blob` API in bounded batches. Save sequence values and their `is_called` flags separately.
4. Exit the exporter before starting the importer. Import into a fresh destination based on a prebuilt empty 0.4.6 engine image. Load pre-data schema, row chunks, sequence state and post-data definitions in that order.
5. Verify the imported schema, rows, original binary values and receipts before publication. Close the destination before changing which home is active.

The transfer prototype uses a fixed 512-row CTID walk over an immutable source copy. It has no long-lived cursor across processes and no full table materialization in the host. Production must validate table/column coverage and errors; generated columns, user-defined objects and unusually large single values need explicit production coverage before broadening the supported data shape.

The runtime must select `template1` and `postgres` explicitly. New empty and application-seeded images must come from the same engine assets and full ICU resource version as the runtime. The full ICU resource is necessary: the default small ICU data failed numeric/locale parity probes.

## Publication and recovery ownership

The database open path owns the transition under its existing external lock. The proposed publication design uses sibling staging and backup directories on the same filesystem, with the engine identity inside the verified new directory. It does not use a second application preference or a schema migration to infer the engine generation.

The original home remains authoritative until the destination is fully verified and closed. A crash before that boundary leaves the original usable. A crash between directory renames must be resolved from the actual active, staging and backup directories under the same lock. Once the new directory is active, later startup failures must not silently restore an older backup and discard new writes.

The exact recovery protocol, durability barriers and supported operating-system behavior require adversarial review and interruption tests before implementation is considered ready. This ADR does not claim that the directory-swap protocol is already validated.

## Qualification evidence

RP-1246 retains reproducible scripts and unmodified logs. No live user database or canonical earlier fixture was opened by the new engine.

- The checksum-pinned released 0.45 host creates nested Unicode values, an asset, an offline edit, a deletion and operation receipts. A closed copy contains 42 tables and 62 rows.
- Direct opening with explicit settings preserves 355 surviving columns, 86 indexes, 95 constraints and all values. Source filesystem checksums remain unchanged.
- Logical export/import preserves the same state. Physical ordinal gaps left by dropped columns disappear, while the order and definitions of surviving columns remain unchanged.
- Separate-process transfer of 10,000 and 100,000 rows with 1 KiB varied binary payloads preserves all payload and JSON hashes. The 100,000-row fixture contains 102.4 MB of binary data and exports 211.48 MB of text COPY chunks, each at most 1.083 MB.
- At 100,000 rows, the old exporter peaks at about 692 MB RSS. Import from a prebuilt empty image peaks at about 817 MB, compared with 1.38 GB when the importer also initializes a fresh engine. Export and image-based import take about 3.04 and 5.29 seconds in this shared-load diagnostic.
- Reopened image-based import also preserves all original released tables and three sequence states.

These are upgrade diagnostics, not fixed-workload view or save acceptance. Setup is outside the transfer timing. The unchanged external diagnostic allowance is 60 seconds. No production timeout or performance budget changes follow from these measurements.

## Limitations

A row batch does not bound the size of one existing binary cell. A single102.4MB owner value required a204.8MB text COPY chunk and1.65GB importer RSS. A second public-API prototype exports512KiB bytea substrings, imports bounded chunks into a temporary table, then assembles the final bytea inside PostgreSQL. It preserves the exact102.4MB value with521MB exporter and868MB importer peakRSS. No whole value crosses host JavaScript. Database assembly still needs memory proportional to the value; values larger than102.4MB remain unqualified. Schema-only dump memory depends on schema size. The transfer also needs temporary disk space for the original copy, row chunks and new destination.

The probes use macOS arm64. Windows/Linux packaging, interruption recovery, disk-exhaustion recovery, progress/cancellation, lock contention and a real packaged new-host public API reopen are not yet qualified. ICU initialization remains substantial. No generic query contract or Planner adoption is implemented by this decision.

## Removal

Remove the old-engine adapter and its assets when the supported upgrade policy no longer includes 0.3 homes, or when an upstream supported bounded transition replaces it. Keep engine identity and recovery rules only while they protect a supported transition. Do not keep the adapter as a general-purpose database export framework.

## Proposed recovery states

The next slice will enforce these states under the existing external database lock. They describe a process-interruption protocol; they do not claim power-loss qualification yet.

The sibling transfer directory owns an immutable source copy, archive and candidate target. Publication moves the original active home into that directory, then moves the verified target into the active path. The engine identity travels inside the verified target. There is no separately mutable phase flag.

| Files observed after acquiring the lock | Authoritative data and action |
| --- | --- |
| Active legacy home; no renamed original | Active home is authoritative. Discard only recognized incomplete transfer outputs and prepare again from a fresh copy. |
| Active path absent or empty; renamed original and verified target exist | Complete the interrupted publication by moving the target into place. |
| Active path absent or empty; renamed original exists but no verified target | Restore the original before reporting the failed upgrade. |
| Active home has the new engine identity | Active home is authoritative. Clean up owned old transfer outputs; never roll back later writes automatically. |
| Active unmarked nonempty home and renamed original both exist | Stop without changing either. An older writer may have created a new database during the crash gap; choosing one silently could lose data. |
| Active path missing and no renamed original exists | Do not infer authority from an export copy. Report missing data rather than silently restoring a possibly stale copy. |

The candidate database closes before its verification identity is written. File and directory durability barriers must precede publication. The process will hold one stable external lock across both renames and recovery. Windows rename/directory flushing and abrupt termination at each boundary need actual tests before connecting this to normal startup.

## Isolated implementation checkpoint

The private transfer module and bundled child now implement schema-only dump, ordinary COPY chunks, sliced bytea transfer, sequence state and chunk/value SHA256 checks. They are not connected to active-home startup. The current application schema and an actual released0.45 copy both pass complete schema/value comparisons through this module.

Generated columns and CHECK constraints involving bytea are rejected before publishing an archive, because temporary binary placeholders cannot preserve those rules. Large bytea also requires a non-binary primary key. These shapes are absent from the qualified application schemas; the adapter is not a generic database migration framework.

Ordinary row chunks and binary slices bound payload handling, but the manifest retains file descriptors, table metadata and large-value locators. That metadata grows with the number of chunks and values. The measured memory results must not be described as a strict constant-space bound for arbitrary databases.
