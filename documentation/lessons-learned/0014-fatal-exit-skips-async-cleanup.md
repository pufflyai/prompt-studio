# Await cleanup and drain work before closing resources

## 1. When to use

- Changing startup, shutdown, fatal handlers, or background callbacks.

## 2. Failure

- Calling `void closeApp()` before `process.exit()` cut off cleanup at its first await, leaving PGlite open.
- Failed startup or an earlier cleanup error also skipped database close. Detached queries could resume after the engine closed and block the event loop, including shutdown timers.

## 3. Prevention

- Await the shared `closeBeforeFatalExit` helper before fatal exit; keep its existing deadline.
- The owner that opens a resource must close it if startup fails.
- Use `finally` so one cleanup failure cannot skip required resource cleanup.
- Stop admitting work and drain owned callbacks before closing their database.
- Handle watcher errors and detached promise rejections where they occur; logging alone does not manage task lifetime.
- Test that the same database can reopen after failed startup and failed cleanup.

## 4. Evidence

- [App lifecycle](../../packages/pstdio-api/src/app-runtime.ts)
- [Session callbacks](../../packages/pstdio-api/src/services/session-lifecycle-callbacks.ts)
- [Database cleanup tests](../../packages/pstdio-api/src/app-database-close.p1.test.ts)
