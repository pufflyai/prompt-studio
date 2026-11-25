import { expect, spyOn, test } from "bun:test";
import { importValue } from "./remote-imports";
import { FUNCTION_MARKER, ITERATOR_MARKER } from "./remote-markers";
import { createImportTracker } from "./remote-values";

test("an iterator kept without its iterable keeps its remote references", async () => {
  const released: string[] = [];
  const tracker = createImportTracker((ids) => released.push(...ids));
  const track = spyOn(tracker, "track");
  const ref = { [ITERATOR_MARKER]: { next: { [FUNCTION_MARKER]: "n" }, return: { [FUNCTION_MARKER]: "r" } } };
  const invoke = async (id: string) => (id === "n" ? { done: false, value: 1 } : { done: true, value: undefined });
  // A separate frame, so no stack slot keeps the iterable reachable afterwards.
  const take = () => (importValue(ref, invoke, tracker) as AsyncIterable<number>)[Symbol.asyncIterator]();
  const iterator = take();
  expect(track).toHaveBeenCalledWith(iterator, ["n", "r"]);
  track.mockRestore();
  for (let attempt = 0; attempt < 5; attempt++) {
    Bun.gc(true);
    await Bun.sleep(10);
  }
  expect(released).toEqual([]);
  expect(await iterator.next()).toEqual({ done: false, value: 1 });
});

test("a pending read owns its iterator after the caller drops the iterator", async () => {
  const response = Promise.withResolvers<IteratorResult<number>>();
  const released: string[] = [];
  const tracker = createImportTracker((ids) => released.push(...ids));
  const ref = { [ITERATOR_MARKER]: { next: { [FUNCTION_MARKER]: "n" }, return: { [FUNCTION_MARKER]: "r" } } };
  const read = () => {
    const source = importValue(ref, () => response.promise, tracker) as AsyncIterable<number>;
    const iterator = source[Symbol.asyncIterator]();
    return { pending: iterator.next(), iterator: new WeakRef(iterator) };
  };
  const { pending, iterator } = read();
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      await Bun.sleep(10);
      Bun.gc(true);
    }
    expect(iterator.deref()).toBeDefined();
    expect(released).toEqual([]);
  } finally {
    response.resolve({ done: false, value: 1 });
  }
  expect(await pending).toEqual({ done: false, value: 1 });
});
