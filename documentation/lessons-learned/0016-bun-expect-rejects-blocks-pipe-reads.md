# Await I/O before using Bun promise assertions

## 1. When to use

- Testing promises that need child-process output, socket input, or another I/O callback.

## 2. Failure

- Bun promise assertions synchronously drove a nested event loop inside a Windows pipe-read callback. The callback could not return to deliver the output needed to settle the assertion.
- Awaiting `expect(promise).rejects` did not help: the assertion ran before the await.

## 3. Prevention

- Await the operation normally, then assert on its result or captured error.
- Attach rejection handlers immediately when starting work before another await.

```ts
const error = await operation().catch((error: unknown) => error);
expect(error).toMatchObject({ message: "Steer rejected" });
```

- Keep real transport coverage and existing time limits. Immediate validation rejections do not have this I/O dependency.
- Follow the testing policy; do not add retries or repeated reliability runs to obtain a pass.

## 4. Evidence

- [Testing isolation guidance](../guides/development/0002-testing.md#isolation)
- [Question rejection tests](../../extensions/harness-codex/src/async-question-session.p0.test.ts)
- [RPC EOF regression](../../extensions/harness-codex/src/app-server-rpc.p0.test.ts)
