# PGlite WAL Corruption

## What

PGlite databases can become unrecoverable when WAL recovery is interrupted or written inconsistently. Common startup errors are:

```
PANIC: invalid max offset number
RuntimeError: Aborted(). Build with -sASSERTIONS for more info.
```

## Why

PGlite uses PostgreSQL's storage engine compiled to WASM and does not safely support concurrent writers to the same data directory.

This issue resurfaced because the first fix only handled graceful shutdown on `SIGINT`/`SIGTERM`. Two important gaps remained:

1. There was no inter-process lock, so multiple processes could still open the same `PSTDIO_DB_PATH`.
2. There was no startup failure guard, so if startup failed after `createApp()` (for example `EADDRINUSE`), the DB close path was skipped.

That combination made it possible to leave WAL in a partial recovery state and then crash again during the next boot, resulting in unrecoverable WAL errors.

## Risk

All data in the PGlite database can become inaccessible until the WAL is repaired or the database is recreated.

## Fix

The fix now has two guardrails:

1. `createDb()` acquires an exclusive lock file at `<dbPath>.lock` and rejects concurrent opens with a clear error.
2. `serve` startup is wrapped so if server initialization throws, `close()` is always called before rethrowing.

Signal handlers (`SIGINT`, `SIGTERM`) are still kept for normal graceful shutdown.

## Recovery

If corruption occurs, use native PostgreSQL's `pg_resetwal` to reset the WAL:

```bash
# Remove stale runtime files if present
rm ~/.pstdio/pstdio.db/postmaster.pid
rm ~/.pstdio/pstdio.db.lock

# Reset the WAL (requires matching PG version — PGlite uses PG 17)
pg_resetwal -f ~/.pstdio/pstdio.db
```

This discards uncommitted transactions but preserves all committed data.
