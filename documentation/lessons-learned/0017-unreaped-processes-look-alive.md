# Distinguish an exited process from an existing PID

## 1. When to use

- Waiting for detached processes to stop or running lifecycle tests in Linux containers.

## 2. Failure

- A runtime exited but became a zombie under a PID 1 that did not reap children. `kill(pid, 0)` still succeeded, so `pst close` waited indefinitely.
- A synchronous child-process wait blocked the test runner and hid the cause until its own timeout.

## 3. Prevention

- Use `isRuntimePidAlive` for runtime exit checks. On Linux it treats `/proc` states `Z` and `X` as stopped.
- Run test containers with an init process, but preserve support for users whose containers have none.
- Prefer asynchronous child-process waits so test cancellation and diagnostics can run.
- Investigate process state when shutdown waits persist after ports and descriptors disappear.

## 4. Evidence

- [Runtime liveness](../../packages/pstdio/src/features/runtime/process-liveness.ts)
- [Zombie-process regression](../../packages/pstdio/src/features/runtime/process-liveness.p1.test.ts)
