# Fatal Exit Skips Async Cleanup

## What

The serve process and the standalone API entry points handled `uncaughtException` and `unhandledRejection` like this:

```ts
void closeApp();
process.exit(1);
```

`closeApp()` runs only until its first `await`. `process.exit(1)` then ends the process at once. The app close function reaches `pglite.close()` only after many awaits, so a fatal error always left PGlite open. The next start could fail with `RuntimeError: Aborted()`.

Two related gaps left the database open too:

- `createApp` opened the database and then built the rest of the app. If a later step threw, for example on an unwritable storage folder, nothing closed the database.
- The app close function closed the database last, with no `finally`. If an earlier part failed to stop, the database stayed open.

## Why

`process.exit()` does not wait for pending promises. Any cleanup started with `void` before it is cut off. This is the same unclean teardown as [PGlite WAL Corruption](0002-pglite-wal-corruption.md) and [`bun --watch` Corrupts the Dev Database](0011-bun-watch-corrupts-dev-db.md), reached through an error handler.

The fatal handlers were reached in practice by errors that should never be fatal: a file watcher with no `error` listener, and a detached session start cleanup with no final `catch`.

## Prevention

- Before a fatal exit, wait for close with a deadline. Use `closeBeforeFatalExit` from `pstdio-api/app`. It waits up to 5 seconds, so a close that hangs cannot keep a broken process alive.
- Whoever opens a resource closes it when its own startup fails. `createApp` closes the database if building the app throws.
- Close the database in a `finally` block so a failing part cannot skip it.
- Do not let routine errors reach the fatal handlers. Attach an `error` listener to every `FSWatcher`, and end every detached promise chain with a `catch` that logs.

Tests: `packages/pstdio-api/src/app-database-close.test.ts` reopens the same database after a failed startup and after a failed close. The PGlite lock refuses the reopen while the first open is still active. `serve-app.test.ts` checks that the fatal handler exits only after close finishes.
