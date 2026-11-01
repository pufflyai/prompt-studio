# Background work can keep a green test process alive

## 1. When to use

- Adding schedulers, timers, child processes, or tests that start an app.

## 2. Failure

- Tests printed a passing summary but did not exit because background work remained active.
- Synchronous dependency installs blocked the event loop; cold CI setup exposed costs hidden by warm local runs.

## 3. Prevention

- Check that the command exits, not just that assertions pass.
- Close owned schedulers, subscriptions, and processes during teardown.
- Use asynchronous child processes in request, hook, scheduler, and test paths.
- Unreference idle background timers, but keep deadlines referenced when awaited work depends on them.
- Test observable effects across runtime-loader boundaries rather than assuming shared module state.
- For a CI-only hang, inspect the process tree and active handles on the affected platform.

## 4. Evidence

- [App shutdown](../../packages/pstdio-api/src/app-runtime.ts)
- [Cron backend](../../packages/pstdio-scheduler/src/cron-backend.ts)
- [Active run deadlines](../../packages/pstdio-scheduler/src/run-handler.ts)
