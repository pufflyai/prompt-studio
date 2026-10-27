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

test("a retired provider cannot start a later account flow", async () => {
  const lifetime = createHarnessAuthenticationLifetime();
  await lifetime.dispose();
  let started = false;
  await expect(
    lifetime.run({ signal: new AbortController().signal, emit: async () => {}, request: async () => "" }, async () => {
      started = true;
    }),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(started).toBe(false);
});

test("retirement before account dispatch prevents native worker startup", async () => {
  const lifetime = createHarnessAuthenticationLifetime();
  let started = false;
  const operation = lifetime.run(
    { signal: new AbortController().signal, emit: async () => {}, request: async () => "" },
    async () => {
      started = true;
    },
  );
  const outcome = operation.catch((cause) => cause);
  await lifetime.dispose();
  expect(await outcome).toMatchObject({ name: "AbortError" });
  expect(started).toBe(false);
});
