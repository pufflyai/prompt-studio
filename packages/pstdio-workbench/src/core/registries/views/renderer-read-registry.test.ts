import { expect, test } from "bun:test";
import { createRendererReadRegistry } from "./renderer-read-registry";

test("a timed-out read preserves the latest pending refresh until it settles", async () => {
  const registry = createRendererReadRegistry({ deadlineMs: 10 });
  const binding = registry.bind("board");
  const child = Promise.withResolvers<number>();
  const started = Promise.withResolvers<void>();
  const deadline = Promise.withResolvers<void>();
  const values: number[] = [];
  let calls = 0;
  const request = {
    queryKey: "all",
    load: async () => {
      calls++;
      if (calls === 1) {
        started.resolve();
        return child.promise;
      }
      return calls;
    },
    onValue: (value: number) => values.push(value),
    onError: () => deadline.resolve(),
  };
  try {
    binding.request(request);
    await started.promise;
    for (let index = 0; index < 1000; index++) binding.request(request);
    await deadline.promise;
    expect(calls).toBe(1);
    child.resolve(1);
    await Bun.sleep(0);
    expect(calls).toBe(2);
    expect(values).toEqual([2]);
  } finally {
    child.resolve(1);
    binding.dispose();
    await registry.dispose();
  }
});

test("a thousand refreshes produce one active read and one latest follow-up", async () => {
  const registry = createRendererReadRegistry();
  const binding = registry.bind("board");
  const first = Promise.withResolvers<number>();
  let calls = 0;
  const values: number[] = [];
  const request = {
    queryKey: "all",
    load: async () => (++calls === 1 ? first.promise : calls),
    onValue: (value: number) => values.push(value),
    onError: () => {},
  };
  binding.request(request);
  await Bun.sleep(0);
  for (let index = 0; index < 1000; index++) binding.request(request);
  expect(calls).toBe(1);
  first.resolve(1);
  await Bun.sleep(0);
  expect(calls).toBe(2);
  expect(values).toEqual([1, 2]);
  binding.dispose();
  await registry.dispose();
});

test("remount and repeated retry retain the slot until the aborted child settles", async () => {
  const registry = createRendererReadRegistry();
  const child = Promise.withResolvers<number>();
  let calls = 0;
  let signal: AbortSignal | undefined;
  const values: number[] = [];
  const first = registry.bind("stable-placement");
  first.request({
    queryKey: "a",
    load: (input) => {
      signal = input;
      calls++;
      return child.promise;
    },
    onValue: (value) => values.push(value),
    onError: () => {},
  });
  await Bun.sleep(0);
  first.dispose();
  const next = registry.bind("stable-placement");
  const request = {
    queryKey: "b",
    load: async () => ++calls,
    onValue: (value: number) => values.push(value),
    onError: () => {},
  };
  next.request(request);
  for (let index = 0; index < 1000; index++) next.request(request, "retry");
  await Bun.sleep(0);
  expect(signal?.aborted).toBe(true);
  expect(calls).toBe(1);
  child.resolve(1);
  await Bun.sleep(0);
  expect(calls).toBe(2);
  expect(values).toEqual([2]);
  next.dispose();
  await registry.dispose();
});

test("a deadline aborts the transport but does not release uncooperative work", async () => {
  const registry = createRendererReadRegistry({ deadlineMs: 10 });
  const binding = registry.bind("board");
  const child = Promise.withResolvers<number>();
  const errors: unknown[] = [];
  let calls = 0;
  let signal: AbortSignal | undefined;
  const request = {
    queryKey: "all",
    load: async (input: AbortSignal) => {
      signal = input;
      calls++;
      return child.promise;
    },
    onValue: () => {},
    onError: (error: unknown) => errors.push(error),
  };
  binding.request(request);
  await Bun.sleep(20);
  expect(signal?.aborted).toBe(true);
  expect(errors).toHaveLength(1);
  binding.request(request, "retry");
  await Bun.sleep(0);
  expect(calls).toBe(1);
  binding.dispose();
  child.resolve(1);
  await registry.dispose();
});
