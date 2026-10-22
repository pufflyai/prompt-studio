import { expect, test } from "bun:test";
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
