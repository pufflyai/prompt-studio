import { expect, test } from "bun:test";
import * as Y from "yjs";
import { captureCheckpoint } from "./checkpoint-capture";
import { createDocumentStorage } from "./document-storage";
import { memoryDocumentState } from "./document-types";

const owner = { workbenchId: "w", extensionId: "e" };
const storage = (document: Y.Doc) =>
  createDocumentStorage({
    owner,
    store: { transaction: async (_owner, action) => action(memoryDocumentState(document)) },
  });

test("save-handler writes publish together as one document update", async () => {
  const document = new Y.Doc();
  const captured = await captureCheckpoint([Y.encodeStateAsUpdate(document)], owner, async (store) => {
    const { records } = createDocumentStorage({ owner, store });
    for (const value of ["first", "transformed"])
      await records.commit({
        operationId: crypto.randomUUID(),
        edits: [{ recordId: "projection", replace: value }],
      });
    await records.commit({ operationId: "other", edits: [{ recordId: "other", replace: true }] });
    return "result";
  });
  expect(await storage(document).records.list()).toEqual([]);
  expect(captured.value).toBe("result");
  let updates = 0;
  document.on("update", () => updates++);
  Y.applyUpdate(document, captured.update);
  expect(updates).toBe(1);
  expect((await storage(document).records.read("projection")).value).toBe("transformed");
  expect((await storage(document).records.read("other")).value).toBe(true);
  document.destroy();
});

test("a failed save handler discards all its staged writes", async () => {
  const document = new Y.Doc();
  await expect(
    captureCheckpoint([Y.encodeStateAsUpdate(document)], owner, async (store) => {
      await createDocumentStorage({ owner, store }).records.commit({
        operationId: "write",
        edits: [{ recordId: "projection", replace: "hidden" }],
      });
      throw new Error("handler failed");
    }),
  ).rejects.toThrow("handler failed");
  expect(await storage(document).records.list()).toEqual([]);
  document.destroy();
});
