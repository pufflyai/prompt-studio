# ADR 0078: Superseded: Temporary Drizzle migration selection adapter

Proposed: 2026-10-16

## Status

SUPERSEDED on 2026-10-24 by [ADR 0103](0103-database-baseline-replaces-in-place-upgrades.md). The squashed 0.46 baseline has no migration prefix to select, so startup uses the public Drizzle PGlite migrator and the adapter is gone.

## Ideal behavior

The database applies a selected prefix of generated migrations through Drizzle. Core retains opaque source records immediately before a table is removed. Selecting that prefix must not require copying SQL into a writable temporary directory.

## External limitation

Drizzle's public PGlite migrator accepts a folder, not selected migration records. Its exported `PgDialect.migrate` executor accepts records, but its session parameter defaults to an empty relational schema and rejects the application's typed session. The executor only runs SQL and transactions; it does not access relational query metadata.

## Temporary workaround

Keep the adapter inside `pstdio-db/src/db/migrate-through.ts`. Read generated records with Drizzle's exported `readMigrationFiles`, select them in journal order, and call the exported dialect executor with the existing session. Erase the session's relational-schema type at that one boundary.

This uses the same execution path as Drizzle's PGlite migrator. It preserves generated hashes, timestamps, transaction boundaries, and statement order. No SQL files or migration records are rewritten. Upgrade tests cover cutoff and resume, table retention, and startup without a writable system temporary directory.

## Limitations

The adapter depends on Drizzle's exported lower-level executor and the database's typed session metadata. A Drizzle update must keep the upgrade tests passing. This is a temporary library adapter, not a new migration engine.

## Removal

Remove the adapter and schema-type erasure when Drizzle's PGlite migrator accepts selected migration records or an equivalent cutoff through a typed public entry point. Keep the generic retention boundaries and extension-owned transformations.
