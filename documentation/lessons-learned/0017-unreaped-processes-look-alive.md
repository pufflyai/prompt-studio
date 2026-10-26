# Unreaped Processes Look Alive

## What

`pst close` asks the runtime to stop and then waits until the runtime process is gone. It checked this with `process.kill(pid, 0)`. In a Linux container where the test runner was PID 1, the runtime stopped within a second, removed its descriptor, and became a zombie. `pst close` kept waiting until the caller killed it.

The packaged tests `runtime-lifecycle.p1.test.ts` and `packaged.p1.test.ts` ran `close` with `spawnSync` and a 60-second timeout, so each failed at about 60,060 ms. Bun then killed the processes the timed-out test had started, including the API that the next ticket test shared, so that test failed too.

## Why

A zombie is a process that has exited but whose parent has not yet read its exit status. It holds no ports, files, or locks, but its process ID still exists, so `kill(pid, 0)` succeeds.

`pst serve` and API auto-start start the runtime detached. When the launcher exits, the kernel gives the runtime to PID 1. A normal init process reaps it. Bun does not reap adopted processes, and neither do placeholder entry points such as `sleep infinity` or `tail -f /dev/null`. The CI containers use `--init`, so CI never showed the problem.

This was reproduced with Bun 1.4.2 in `oven/bun:1.4.2` on linux-x64 and linux-arm64. Without `--init`, `close` never returned on either platform. On linux-arm64, `/proc/<pid>/stat` showed the runtime in state `Z` with parent 1 while the Bun PID 1 was idle. With `--init`, the same binary closed in about one second.

## Prevention

- Decide whether a process has stopped with `isRuntimePidAlive` from `packages/pstdio/src/features/runtime/process-liveness.ts`. On Linux it also reads `/proc/<pid>/stat` and treats states `Z` and `X` as stopped. Do not add new `kill(pid, 0)` checks for "has this process exited".
- Run test containers with `--init` (or another init process) so zombies are reaped, but do not rely on it: users run Prompt Studio in containers without one.
- When a synchronous child-process call in a test reaches its timeout, look for a process that waits for another process to exit. A `spawnSync` call blocks the test runner, so the test timeout fires only after the child's own timeout.

Test: `packages/pstdio/src/features/runtime/process-liveness.p1.test.ts` makes a zombie on Linux and checks that it counts as stopped.
