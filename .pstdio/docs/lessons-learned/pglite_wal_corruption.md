# PGlite WAL Corruption

## What

PGlite databases can become unrecoverable when WAL recovery is interrupted or written inconsistently. Common startup errors are:

```
PANIC: invalid max offset number
PANIC: could not locate a valid checkpoint record
RuntimeError: Aborted(). Build with -sASSERTIONS for more info.
```

Confirmed trigger: running Drizzle Studio against the same Prompt Studio database path while `pst` is running can corrupt WAL. By default that path is `$PSTDIO_HOME/pstdio.db`, where `PSTDIO_HOME` defaults to `~/.pstdio`. `PSTDIO_DB_PATH` can still override the database path for targeted debugging or tests.

## Why

PGlite uses PostgreSQL's storage engine compiled to WASM and does not safely support concurrent writers to the same data directory.

Drizzle Studio + `pst` against the same DB path creates exactly that unsupported state:

1. `pst` opens and writes to the database in one process.
2. Drizzle Studio opens the same database from a second process.
3. Both processes can write/checkpoint WAL concurrently, which can produce invalid WAL offsets and unrecoverable startup failures.

## Risk

All data in the PGlite database can become inaccessible until the WAL is repaired or the database is recreated. Running Drizzle Studio concurrently with `pst` materially increases this risk.

## Prevention

Do not run Drizzle Studio against the live Prompt Studio database while `pst` is running. Stop `pst` first, or inspect a copied DB snapshot.

## Recovery

If corruption occurs, use native PostgreSQL's `pg_resetwal` to reset the WAL:

```bash
# Remove stale runtime files if present.
# Replace the path if PSTDIO_HOME or PSTDIO_DB_PATH points elsewhere.
rm ~/.pstdio/pstdio.db/postmaster.pid

# Reset the WAL (requires matching PG version — PGlite uses PG 17)
pg_resetwal -f ~/.pstdio/pstdio.db
```

This discards unflushed WAL. Most committed data is usually recoverable, but tables written near the interrupted shutdown can still need row-by-row salvage from backups or `.pstdio/tickets/` files.

If `pst` reports that the API did not become healthy, inspect the captured startup output in the CLI error and the structured `db.open.failed` entry in `logs.jsonl`. When the output includes `could not locate a valid checkpoint record` and `Aborted()`, stop all `pst` processes before copying the database directory and running recovery commands against the copy first.

## See also

- [`bun --watch` Corrupts the Dev Database](./bun_watch_corrupts_dev_db.md) — the same `Aborted()` corruption reached via unclean teardown on reload, rather than concurrent writers.
