import { describe, expect, test } from "bun:test";
import type { JsonPatch } from "pstdio-api-contracts";
import { createEventStore } from "./event-store";

const patch = (index: number): JsonPatch => ({
  op: "add",
  path: `/messages/${index}`,
  value: { id: `msg-${index}`, role: "assistant", parts: [{ type: "text", text: `message ${index}` }] },
});

const collect = async (iterable: AsyncIterable<JsonPatch>, limit: number) => {
  const items: JsonPatch[] = [];

  for await (const item of iterable) {
    items.push(item);
    if (items.length >= limit) break;
  }

  return items;
};

describe("createEventStore", () => {
  test("push stores patches in history", () => {
    const store = createEventStore();

    store.push(patch(0));
    store.push(patch(1));

    expect(store.getHistory()).toHaveLength(2);
    expect(store.getHistory()[0]).toMatchObject({ op: "add", path: "/messages/0" });
    expect(store.getHistory()[1]).toMatchObject({ op: "add", path: "/messages/1" });
  });

  test("getHistory returns a copy", () => {
    const store = createEventStore();

    store.push(patch(0));
    const history = store.getHistory();
    history.push(patch(99));

    expect(store.getHistory()).toHaveLength(1);
  });

  test("subscribe receives live patches", async () => {
    const store = createEventStore();
    const received: JsonPatch[] = [];

    const iterator = store.subscribe()[Symbol.asyncIterator]();

    store.push(patch(0));
    store.push(patch(1));

    const first = await iterator.next();
    const second = await iterator.next();

    received.push(first.value, second.value);

    expect(received).toHaveLength(2);
    expect(received[0]).toMatchObject({ path: "/messages/0" });
    expect(received[1]).toMatchObject({ path: "/messages/1" });
  });

  test("subscribe does not include patches pushed before subscribing", async () => {
    const store = createEventStore();

    store.push(patch(0));

    const iterator = store.subscribe()[Symbol.asyncIterator]();

    store.push(patch(1));

    const result = await iterator.next();
    expect(result.value).toMatchObject({ path: "/messages/1" });
  });

  test("multiple subscribers receive the same patches", async () => {
    const store = createEventStore();

    const iter1 = store.subscribe()[Symbol.asyncIterator]();
    const iter2 = store.subscribe()[Symbol.asyncIterator]();

    store.push(patch(0));

    const r1 = await iter1.next();
    const r2 = await iter2.next();

    expect(r1.value).toMatchObject({ path: "/messages/0" });
    expect(r2.value).toMatchObject({ path: "/messages/0" });
  });

  test("historyPlusStream replays history then streams live", async () => {
    const store = createEventStore();

    store.push(patch(0));
    store.push(patch(1));

    const stream = store.historyPlusStream();

    // Push a live patch after starting the stream
    setTimeout(() => store.push(patch(2)), 10);

    const items = await collect(stream, 3);

    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ path: "/messages/0" });
    expect(items[1]).toMatchObject({ path: "/messages/1" });
    expect(items[2]).toMatchObject({ path: "/messages/2" });
  });

  test("historyPlusStream works with empty history", async () => {
    const store = createEventStore();

    const stream = store.historyPlusStream();

    setTimeout(() => store.push(patch(0)), 10);

    const items = await collect(stream, 1);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ path: "/messages/0" });
  });

  test("snapshotAndSubscribe returns history separately and streams only live patches", async () => {
    const store = createEventStore();

    store.push(patch(0));
    store.push(patch(1));

    const snapshot = store.snapshotAndSubscribe();

    setTimeout(() => store.push(patch(2)), 10);

    const items = await collect(snapshot.stream, 1);

    expect(snapshot.history).toHaveLength(2);
    expect(snapshot.history[0]).toMatchObject({ path: "/messages/0" });
    expect(snapshot.history[1]).toMatchObject({ path: "/messages/1" });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ path: "/messages/2" });
  });

  test("FIFO eviction when exceeding maxSizeBytes", () => {
    const smallPatch: JsonPatch = { op: "add", path: "/messages/0", value: "x" };
    const patchSize = JSON.stringify(smallPatch).length;

    const store = createEventStore({ maxSizeBytes: patchSize * 2 + 1 });

    store.push({ op: "add", path: "/messages/0", value: "a" });
    store.push({ op: "add", path: "/messages/1", value: "b" });
    store.push({ op: "add", path: "/messages/2", value: "c" });

    const history = store.getHistory();

    // Should have evicted the oldest to stay within budget
    expect(history.length).toBeLessThanOrEqual(2);
    expect(history[history.length - 1]).toMatchObject({ path: "/messages/2" });
  });

  test("close terminates active subscribers", async () => {
    const store = createEventStore();
    const iterator = store.subscribe()[Symbol.asyncIterator]();

    store.push(patch(0));
    const first = await iterator.next();
    expect(first.done).toBe(false);

    store.close();

    const end = await iterator.next();
    expect(end.done).toBe(true);
  });

  test("close terminates historyPlusStream", async () => {
    const store = createEventStore();

    store.push(patch(0));

    const items: JsonPatch[] = [];
    const stream = store.historyPlusStream();

    setTimeout(() => store.close(), 20);

    for await (const item of stream) {
      items.push(item);
    }

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ path: "/messages/0" });
  });

  test("push after close is a no-op", () => {
    const store = createEventStore();

    store.close();
    store.push(patch(0));

    expect(store.getHistory()).toHaveLength(0);
  });
});
