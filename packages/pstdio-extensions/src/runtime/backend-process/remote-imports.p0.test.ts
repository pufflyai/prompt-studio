import { expect, test } from "bun:test";
import { importValue } from "./remote-imports";
import { FUNCTION_MARKER, ITERATOR_MARKER } from "./remote-markers";
import { createImportTracker } from "./remote-values";

test("an iterator kept without its iterable keeps its remote references", async () => {
  const released: string[] = [];
  const tracker = createImportTracker((ids) => released.push(...ids));
  const ref = { [ITERATOR_MARKER]: { next: { [FUNCTION_MARKER]: "n" }, return: { [FUNCTION_MARKER]: "r" } } };
  const invoke = async (id: string) => (id === "n" ? { done: false, value: 1 } : { done: true, value: undefined });
  // A separate frame, so no stack slot keeps the iterable reachable afterwards.
  const take = () => (importValue(ref, invoke, tracker) as AsyncIterable<number>)[Symbol.asyncIterator]();
  const iterator = take();
  for (let attempt = 0; attempt < 5; attempt++) {
    Bun.gc(true);
    await Bun.sleep(10);
  }
  expect(released).toEqual([]);
  expect(await iterator.next()).toEqual({ done: false, value: 1 });
});
