# Bun promise assertions can deadlock Windows pipe reads

Await child-process results before asserting on them. Bun's `expect(promise).rejects` can run a nested event loop before returning, which can prevent Windows from delivering the output that settles the promise.

## What failed

The Codex harness tests sometimes stopped at the 15-second Windows test limit while checking rejected question replies. The async steering rejection and cleared native request cases needed another message from their child process. The resulting connection-closed error came from cleanup after the timeout.

## Cause

In Bun 1.4.2, `expect(promise).rejects` drives the event loop synchronously before returning. An `await` before the assertion does not change this: JavaScript must first evaluate the assertion.

On Windows, Bun can invoke JavaScript inside a libuv pipe-read callback. When a test resumes inside that callback and synchronously waits for more pipe output, the outer callback cannot return and let the pipe read continue. A question delivered in the same read as the turn acknowledgement can expose this ordering.

[Bun PR #40023](https://github.com/oven-sh/bun/pull/40023) describes this class of nested event-loop failures, including child-process pipes and sockets. Promise assertions such as `.resolves` can also enter a nested loop.

## Fix

Let a normal `await` settle the operation, then assert on the captured error:

```ts
const error = await session
  .replyQuestion!({ callId: "async-1", answers: [] })
  .catch((error: unknown) => error);
expect(error).toMatchObject({ message: expect.stringContaining("Steer rejected") });
```

The assertion still fails if the operation succeeds or rejects with the wrong error. For operations started before another await, attach the catch handler immediately to avoid an unhandled rejection.

Apply this rule when a promise needs process output, socket input, or another I/O callback. Immediate validation rejections and in-memory peers do not have this pipe-read dependency. Review `.rejects` and `.resolves` whenever adding real-process tests.

Production already uses asynchronous waits. Fix the test at its assertion boundary; keep the real transport and its timeout coverage.

## Validation

The existing tests cover rejected steering, unconfirmed native replies, RPC EOF while its peer stays alive, and plan-approval rejections. Run the harness suite on Windows with the existing 15-second limit:

```bash
cd extensions/harness-codex
bun test --timeout 15000 --rerun-each=50
```

The repetitions expose scheduling differences; every repetition must pass. They are a one-time validation for PS-595, not retries that turn a failed run green. See the [testing guide](../guides/development/0002-testing.md).
