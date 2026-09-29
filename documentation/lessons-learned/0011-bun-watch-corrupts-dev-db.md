# `bun --watch` Corrupts the Dev Database

## What

Running the `pst serve` backend under `bun --watch` (Bun 1.3.13) corrupts the embedded PGlite database at `$PSTDIO_HOME/pstdio.db` (e.g. `~/.pstdio-dev/pstdio.db`) over successive reloads. The symptom on the next open is:

```
RuntimeError: Aborted(). Build with -sASSERTIONS for more info.
```

A second symptom appeared after an attempted fix (a data-directory lock): the dashboard showed nothing after every reload, because the backend never rebound its port.

## Why

`bun --watch` reloads by re-execing the **same process**: the pid is stable across reloads and the JS heap/globals are wiped. Critically, it does **not** deliver `SIGINT`/`SIGTERM` to the script, so the serve command's shutdown handler never runs and `pglite.close()` is never called before the reload. PGlite (single-writer PostgreSQL in WASM) is then reopened on a data directory that was never cleanly flushed → inconsistent WAL → `Aborted()`.

This is the same corruption class as [PGlite WAL Corruption](0002-pglite-wal-corruption.md), via a different trigger: unclean teardown on reload, not two concurrent writers.

A data-directory lock does **not** help: it cannot make a teardown clean, and a pid-based lock deadlocks against `bun --watch`'s stable pid (the reloaded process treats its own lock as live), which is what blanked the dashboard.

## Prevention

Do not run the backend under `bun --watch`. Use `bun run dev:isolated` for development and `bun run dev:playwright` for manual browser validation. These commands isolate the database in Docker. Backend restarts must let the owning process close PGlite cleanly. See [ADR 0005: Run the Backend Dev Server Without `bun --watch`](../adrs/0005-no-watch-backend-dev-server.md).

Tests are unaffected: [scripts/test-setup.ts](../../scripts/test-setup.ts) points `PSTDIO_HOME` at a fresh temp dir per run and API tests use `:memory:`, so `bun test` / `bun run validate` never open the real database.

## Recovery

See [PGlite WAL Corruption → Recovery](0002-pglite-wal-corruption.md#recovery). Preserve the original data directory and follow the recovery procedure; resetting corrupt WAL is not a guarantee that committed data remains consistent.
