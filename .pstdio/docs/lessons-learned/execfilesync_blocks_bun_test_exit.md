# CI-only background scheduler hangs need CI isolation

## What went wrong

After PS-60 added scheduled automation execution, GitHub Actions "Test and Build" started timing out at the 15-minute job limit. Local runs still passed: `bun test packages/pstdio-api` finished in about a minute, and `bunx lerna run test --ignore e2e` exited green.

On CI, lerna reported the other packages green and then sat inside `pstdio-api:test` until GitHub cancelled the job. The cancellation log listed orphan `sh`, `bun`, and `MainThread` processes.

## What made it CI-only

There was not one clean local reproducer for the whole failure. The useful finding was that several scheduler/runtime-loader assumptions were only true on a warm macOS dev machine:

- `createApp` created an automation service, and the service immediately started the scheduler. Most API tests do not exercise scheduled automation, so they were paying for a background daemon they did not need.
- Runtime workspace setup used `execFileSync("bun install", ...)`. That blocks the event loop while the child process runs. A small reproducer confirmed the mechanism: `setImmediate(() => execFileSync("sleep", ["20"]))` makes `bun test` wait about 20 seconds before exiting.
- Cold Ubuntu runners made runtime workspace installs much slower than local warm-cache installs.
- Linux runtime loading can fall back to `Bun.build`, which means a test cannot rely on the scheduler's dynamic import sharing module-level state with the test's own `import()`.
- Concurrent scheduler/UI/test loads for the same project could duplicate runtime loading work.

So the accurate lesson is broader than "`execFileSync` blocks `bun test` exit": sync child processes were one confirmed failure mode, but the CI hang came from background scheduling plus cold runtime workspace setup plus Linux-specific loader behavior.

## How it was solved

- Scheduler startup is opt-in; normal API tests do not start the scheduler.
- Runtime workspace installs use async `execFile`, not `execFileSync`.
- Scheduler intervals and directory watchers call `unref()` so leaked handles do not keep a process alive by themselves.
- The CI workflow pre-warms the Bun install cache used by runtime workspaces.
- The scheduler test uses a `globalThis` sigil instead of module-level state so it works whether Linux loads automation through direct import or a fresh `Bun.build` bundle.
- Runtime loads are deduped per project while a load is already in flight.

## Key takeaways

- Do not start background schedulers from broad test helpers unless the test is explicitly about the scheduler.
- Avoid `execFileSync` / `execSync` in request, hook, scheduler, or test-exercised paths. Use async child processes and await them.
- `unref()` background timers and watchers unless they are intentionally responsible for process lifetime.
- Do not rely on automation module-level state in tests. Use observable behavior or a shared process-level signal when the loader may bundle on Linux.
- For CI-only hangs, isolate on CI with a short-timeout single-file step. Local macOS runs are not a reliable signal for Bun loader, inotify, or cold install behavior.
