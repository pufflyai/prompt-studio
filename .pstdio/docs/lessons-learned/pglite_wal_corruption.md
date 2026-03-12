# PGlite WAL Corruption

## What

PGlite databases can become unrecoverable when WAL recovery is interrupted or written inconsistently. Common startup errors are:

```
PANIC: invalid max offset number
RuntimeError: Aborted(). Build with -sASSERTIONS for more info.
```

Confirmed trigger: running Drizzle Studio against the same `PSTDIO_DB_PATH` while `pstdio` is running can corrupt WAL.

## Why

PGlite uses PostgreSQL's storage engine compiled to WASM and does not safely support concurrent writers to the same data directory.

Drizzle Studio + `pstdio` against the same DB path creates exactly that unsupported state:

1. `pstdio` opens and writes to the database in one process.
2. Drizzle Studio opens the same database from a second process.
3. Both processes can write/checkpoint WAL concurrently, which can produce invalid WAL offsets and unrecoverable startup failures.

## Risk

All data in the PGlite database can become inaccessible until the WAL is repaired or the database is recreated. Running Drizzle Studio concurrently with `pstdio` materially increases this risk.

## Prevention

Do not run Drizzle Studio against `~/.pstdio/pstdio.db` while `pstdio` is running. Stop `pstdio` first, or inspect a copied DB snapshot.

## Recovery

If corruption occurs, use native PostgreSQL's `pg_resetwal` to reset the WAL:

```bash
# Remove stale runtime files if present
rm ~/.pstdio/pstdio.db/postmaster.pid

# Reset the WAL (requires matching PG version — PGlite uses PG 17)
pg_resetwal -f ~/.pstdio/pstdio.db
```

This discards uncommitted transactions but preserves all committed data.
