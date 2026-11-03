import { expect, test } from "bun:test";
import { createNativeProjectionQueue } from "./projection-queue";

test("a failed projection still processes a newer queued change", async () => {
  const first = Promise.withResolvers<number>();
  const started = Promise.withResolvers<void>();
  let calls = 0;
  let failures = 0;
  const address = { owner: { workbenchId: "project", extensionId: "example.source" }, documentKey: "source" };
  const queue = createNativeProjectionQueue({
    reconcile: async () => {
      if (++calls === 1) {
        started.resolve();
        return first.promise;
      }
      return 2;
    },
    failed: () => failures++,
  });
  const initial = queue.through(address, 1);
  await started.promise;
  const newer = queue.through(address, 2);
  const results = Promise.allSettled([initial, newer]);
  first.reject(new Error("The earlier projection failed"));
  expect(await results).toEqual([
    { status: "fulfilled", value: undefined },
    { status: "fulfilled", value: undefined },
  ]);
  await queue.drain();
  expect(calls).toBe(2);
  expect(failures).toBe(0);
});

test("a failed projection rejects when no newer change is queued", async () => {
  const failure = new Error("Projection failed");
  let calls = 0;
  const reported: unknown[] = [];
  const address = { owner: { workbenchId: "project", extensionId: "example.source" }, documentKey: "source" };
  const queue = createNativeProjectionQueue({
    reconcile: async () => {
      calls++;
      throw failure;
    },
    failed: (_address, error) => reported.push(error),
  });
  await expect(queue.through(address, 1)).rejects.toBe(failure);
  await queue.drain();
  expect(calls).toBe(1);
  expect(reported).toEqual([failure]);
});

test("a captured projection fence completes while a later trailing projection remains pending", async () => {
  const first = Promise.withResolvers<void>();
  const firstStarted = Promise.withResolvers<void>();
  const trailing = Promise.withResolvers<void>();
  const trailingStarted = Promise.withResolvers<void>();
  let revision = 0;
  const address = { owner: { workbenchId: "project", extensionId: "example.source" }, documentKey: "source" };
  const queue = createNativeProjectionQueue({
    reconcile: async () => {
      if (revision === 0) {
        firstStarted.resolve();
        await first.promise;
        return ++revision;
      }
      trailingStarted.resolve();
      await trailing.promise;
      return ++revision;
    },
    failed: () => {},
  });
  const captured = queue.through(address, 1);
  await firstStarted.promise;
  const later = queue.through(address, 2);
  first.resolve();
  await trailingStarted.promise;
  try {
    await captured;
    expect(revision).toBe(1);
  } finally {
    trailing.resolve();
    await later;
    await queue.drain();
  }
});
