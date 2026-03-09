# PGlite WAL Corruption

## What

PGlite databases can become unrecoverable when the WAL (write-ahead log) checkpoint record gets corrupted. The error is:

```
PANIC: could not locate a valid checkpoint record
```

## Why

PGlite uses PostgreSQL's storage engine compiled to WASM. When `bun --watch` reloads a module, it starts a new PGlite instance on the same data directory before the old one closes. Two concurrent PGlite instances writing to the same files produces invalid WAL records. If the process is then killed (Ctrl+C, crash, or another reload), the checkpoint record is left in a corrupted state that PGlite cannot recover from.

Reproduced reliably: open two `new PGlite(samePath)` instances, write concurrently, then `kill -9` the process.

## Risk

All data in the PGlite database becomes inaccessible. The WASM runtime aborts on startup with a misleading error (`Failed query: CREATE SCHEMA IF NOT EXISTS "drizzle"`).

## Fix

Signal handlers (`SIGINT`, `SIGTERM`) were added to `pstdio-api` entry points and the `serve` command to call `pglite.close()` before exit. `createApp()` now returns `{ app, close }` so callers can trigger graceful shutdown.

## Recovery

If corruption occurs, use native PostgreSQL's `pg_resetwal` to reset the WAL:

```bash
# Remove stale lock file if present
rm ~/.pstdio/pstdio.db/postmaster.pid

# Reset the WAL (requires matching PG version — PGlite uses PG 17)
pg_resetwal -f ~/.pstdio/pstdio.db
```

This discards uncommitted transactions but preserves all committed data.
