import { expect, test } from "bun:test";
import { createDocumentStorage, memoryDocumentState } from "pstdio-sync";
import * as Y from "yjs";
import { createMemoryStorage } from "./memory-storage";

test("concurrent moves converge to the same order with each stable item once", async () => {
  const device = (id: string) => {
    const document = new Y.Doc();
    const state = memoryDocumentState(document);
    const storage = createDocumentStorage({
      owner: { extensionId: "notes", workbenchId: "shared" },
      store: { transaction: async (_owner, run) => run(state) },
    });
    const { positions } = createMemoryStorage({ deviceId: id });
    const move = (recordId: string, position: string) =>
      storage.records.commit({ operationId: crypto.randomUUID(), edits: [{ recordId, replace: { position } }] });
    return { document, storage, positions, move };
  };
  const first = device("device-a");
  const second = device("device-b");
  const a = first.positions.between();
  const b = first.positions.between(a);
  const c = first.positions.between(b);
  await first.move("a", a);
  await first.move("b", b);
  await first.move("c", c);
  Y.applyUpdate(second.document, Y.encodeStateAsUpdate(first.document));

  // Both devices move a and c into the same gap while offline.
  for (const current of [first, second]) {
    await current.move("a", current.positions.between(b, c));
    await current.move("c", current.positions.between(b, c));
  }
  const updates = [first, second].map(({ document }) => Y.encodeStateAsUpdate(document));
  for (const current of [first, second]) {
    for (const update of [...updates].reverse()) Y.applyUpdate(current.document, update);
  }
  const ordered = async (current: typeof first) => {
    const records = (await current.storage.records.list()).map(({ recordId, value }) => {
      expect(typeof (value as Record<string, string>).position).toBe("string");
      return { recordId, position: (value as Record<string, string>).position! };
    });
    return records.sort((left, right) => (left.position < right.position ? -1 : 1));
  };
  const result = await ordered(first);
  expect(await ordered(second)).toEqual(result);
  expect(result.map(({ recordId }) => recordId).sort()).toEqual(["a", "b", "c"]);
  expect(new Set(result.map(({ position }) => position)).size).toBe(3);
  first.document.destroy();
  second.document.destroy();
});
