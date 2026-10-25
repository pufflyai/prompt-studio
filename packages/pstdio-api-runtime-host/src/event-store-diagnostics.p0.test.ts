import { expect, spyOn, test } from "bun:test";
import { createEventStore } from "./event-store";

test("reads retained history and subscriber queues without copying their payloads", async () => {
  const store = createEventStore();
  const first = store.subscribe()[Symbol.asyncIterator]();
  const second = store.subscribe()[Symbol.asyncIterator]();
  const patch = { op: "add" as const, path: "/messages/0", value: "text" };
  store.push(patch);
  expect(store.diagnostics()).toEqual({
    historyEvents: 1,
    historyBytes: Buffer.byteLength(JSON.stringify(patch)),
    subscribers: 2,
    queuedEvents: 2,
    queuedBytes: Buffer.byteLength(JSON.stringify(patch)) * 2,
  });
  await first.next();
  expect(store.diagnostics().queuedEvents).toBe(1);
  await second.return!();
  expect(store.diagnostics().queuedEvents).toBe(0);
  expect(store.diagnostics().subscribers).toBe(1);
  store.close();
  expect(store.diagnostics().subscribers).toBe(0);
});

test("diagnostic reads do not traverse growing subscriber backlogs", async () => {
  const store = createEventStore();
  const iterator = store.subscribe()[Symbol.asyncIterator]();
  const patch = { op: "add" as const, path: "/messages/0", value: "text" };
  const bytes = Buffer.byteLength(JSON.stringify(patch));
  for (let index = 0; index < 10_000; index++) store.push(patch);

  // Count the existing queue scan's work, rather than asserting machine timings.
  const reduce = Array.prototype.reduce;
  let visited = 0;
  const scan = spyOn(Array.prototype, "reduce").mockImplementation(function <T>(
    this: unknown[],
    callback: (value: T, entry: unknown, index: number, array: unknown[]) => T,
    initial?: T,
  ) {
    return reduce.call(
      this,
      (value, entry, index, array) => {
        visited++;
        return callback(value as T, entry, index, array);
      },
      initial,
    ) as T;
  });
  let diagnostics: ReturnType<typeof store.diagnostics>;
  try {
    diagnostics = store.diagnostics();
  } finally {
    scan.mockRestore();
  }
  expect(diagnostics.queuedEvents).toBe(10_000);
  expect(diagnostics.queuedBytes).toBe(bytes * 10_000);
  expect(visited).toBe(0);
  await iterator.next();
  expect(store.diagnostics().queuedBytes).toBe(bytes * 9_999);
  await iterator.return!();
  expect(store.diagnostics().queuedBytes).toBe(0);
  store.close();
});

test("history eviction leaves a subscriber's complete byte span readable", async () => {
  const patches = ["first", "é", "third", "oversized".repeat(100), "after empty"].map((value) => ({
    op: "add" as const,
    path: "/message",
    value,
  }));
  const sizes = patches.map((patch) => Buffer.byteLength(JSON.stringify(patch)));
  const store = createEventStore({ maxSizeBytes: sizes[1]! + sizes[2]! });
  const iterator = store.subscribe()[Symbol.asyncIterator]();
  for (const patch of patches.slice(0, 3)) store.push(patch);
  expect(store.getHistory()).toEqual(patches.slice(1, 3));
  store.push(patches[3]!);
  expect(store.getHistory()).toEqual([]);
  store.push(patches[4]!);
  expect(store.getHistory()).toEqual([patches[4]!]);
  // Collection may begin after a backlog already exists. No diagnostic read or
  // capture activation is needed while producing and retaining these events.
  expect(store.diagnostics()).toMatchObject({
    historyBytes: sizes[4],
    queuedEvents: 5,
    queuedBytes: sizes.reduce((sum, size) => sum + size, 0),
  });
  expect((await iterator.next()).value).toEqual(patches[0]);
  expect((await iterator.next()).value).toEqual(patches[1]);
  expect(store.diagnostics().queuedBytes).toBe(sizes.slice(2).reduce((sum, size) => sum + size, 0));
  store.close();
  for (const patch of patches.slice(2)) expect((await iterator.next()).value).toEqual(patch);
  expect((await iterator.next()).done).toBe(true);
});

test("separate queued spans exclude bytes delivered directly to a waiting reader", async () => {
  const store = createEventStore({ maxSizeBytes: 0 });
  const iterator = store.subscribe()[Symbol.asyncIterator]();
  const patch = { op: "add" as const, path: "/message", value: "body" };
  const size = Buffer.byteLength(JSON.stringify(patch));
  const pending = iterator.next();
  store.push(patch);
  expect((await pending).value).toEqual(patch);
  expect(store.diagnostics().queuedBytes).toBe(0);
  store.push(patch);
  store.push(patch);
  expect(store.diagnostics().queuedBytes).toBe(size * 2);
  await iterator.next();
  await iterator.next();
  const nextPending = iterator.next();
  store.push(patch);
  await nextPending;
  store.push(patch);
  expect(store.diagnostics()).toMatchObject({ historyBytes: 0, queuedEvents: 1, queuedBytes: size });
  await iterator.return!();
  expect(store.diagnostics().queuedBytes).toBe(0);
  store.close();
});
