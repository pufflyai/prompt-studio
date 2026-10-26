import { expect, test } from "bun:test";
import { createHarnessAuthenticationLifetime } from "./harness-authentication";

test("provider retirement cancels an account prompt and waits for worker cleanup", async () => {
  const lifetime = createHarnessAuthenticationLifetime();
  const started = Promise.withResolvers<void>();
  let cleaned = false;
  const operation = lifetime.run(
    { signal: new AbortController().signal, emit: async () => {}, request: () => new Promise(() => {}) },
    async (channel) => {
      try {
        started.resolve();
        await channel.request({ type: "input", title: "Key", secret: true });
      } finally {
        cleaned = true;
      }
    },
  );
  const rejected = operation.catch((error) => error);
  await started.promise;
  await lifetime.dispose();
  expect(await rejected).toMatchObject({ name: "AbortError" });
  expect(cleaned).toBe(true);
});
