import { expect, test } from "bun:test";
import { createMemoryStorage } from "./memory-storage";

test("committed storage hints include legacy writes, exact records and abort cleanup", async () => {
  const storage = createMemoryStorage();
  const signal = new AbortController();
  const id = storage.records.id("selected");
  const hints: unknown[] = [];
  const observation = storage.observe((hint) => hints.push(hint), { recordIds: [id], signal: signal.signal });
  await storage.set("other", 1);
  expect(hints).toEqual([]);
  await storage.set("selected", 1);
  expect(hints).toEqual([{ recordIds: [id] }]);
  await storage.records.commit({ operationId: "record", edits: [{ recordId: id, replace: 2 }] });
  expect(hints).toHaveLength(2);
  signal.abort();
  await storage.set("selected", 3);
  expect(hints).toHaveLength(2);
  observation.close();
});
