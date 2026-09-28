# Background work can keep a green test process alive

## What went wrong

After scheduled automation was introduced, the API test task timed out in CI while warm local macOS runs passed. A successful test summary did not mean the process had exited.

The investigation found several contributing mechanisms:

- Broad app setup started a background scheduler even when tests did not exercise scheduling.
- Runtime workspace setup used synchronous child processes for dependency installation. These blocked the event loop while the child ran.
- Cold Linux installs cost more than warm local installs.
- Linux runtime loading could bundle code, so a test and the loaded automation did not necessarily share module-level state.
- Concurrent runtime loads repeated setup work.

These observations explain the historical automation-loader failure. They are not a description of the current extension loader.

## Current application

The host now owns an extension scheduler and closes it through the app lifecycle. The scheduler uses unreferenced cron jobs, while a deadline awaited by an active run remains referenced until the run finishes. Unreferencing that deadline previously left a Windows timeout test pending indefinitely.

- [App shutdown](../../../packages/pstdio-api/src/app-runtime.ts)
- [Cron backend](../../../packages/pstdio-scheduler/src/cron-backend.ts)
- [Active run and deadline](../../../packages/pstdio-scheduler/src/run-handler.ts)

## Key takeaways

- Verify that the test command exits; a printed success summary is insufficient.
- Close app-owned background work in test teardown.
- Use asynchronous child processes in request, hook, scheduler, and test paths.
- Unreference background timers only when they are not responsible for completing awaited work.
- Test observable effects across runtime-loader boundaries instead of relying on shared module state.
- Reproduce CI-only hangs on the affected platform and inspect the still-running process.
