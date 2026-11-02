# Protect database ownership and clean shutdown

## 1. When to use

- Changing database startup, shutdown, development reloads, or inspection tools.

## 2. Failure

- Opening the same PGlite directory from Drizzle Studio and the runtime corrupted its write-ahead log.
- A Bun watch reload also skipped database cleanup while keeping the same PID. A PID check could not make that reopen safe.

## 3. Prevention

- Use the shared database lock. It holds SQLite's OS lock for the database lifetime and releases it on close or process death.
- Keep the lock file in place; deleting it can let another process lock a different file at the same path.
- Other tools do not participate in this lock. Use public APIs for inspection; copy a database only after stopping its runtime.
- Close PGlite before reopening it. Locking does not replace clean shutdown.
- Use `bun run dev:isolated` or `bun run dev:playwright`; do not reload the backend with `bun --watch`.

## 4. Evidence

- [Database lock](../../packages/pstdio-db/src/db/pglite-lock.ts)
- [Backend reload decision](../adrs/0005-no-watch-backend-dev-server.md)
- Consolidates lesson 0011's reload failure.
