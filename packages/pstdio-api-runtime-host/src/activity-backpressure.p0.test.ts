import { expect, test } from "bun:test";
import { createEventStore } from "./event-store";

test("an activity watchdog retains one notification without retaining message payloads", async () => {
  const store = createEventStore({ maxSizeBytes: 1 });
  const iterator = store.subscribe({ activityOnly: true })[Symbol.asyncIterator]();
  for (let index = 0; index < 1000; index++)
    store.push({ op: "replace", path: "/messages/0", value: "x".repeat(10000) });
  expect(store.diagnostics().queuedBytes).toBe(0);
  expect((await iterator.next()).done).toBe(false);
  store.close();
  expect((await iterator.next()).done).toBe(true);
});
