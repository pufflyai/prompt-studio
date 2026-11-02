import { expect, test } from "bun:test";
import { createRow } from "storage-scale-fixture";
import * as Y from "yjs";
import { memoryDocumentState } from "../shared/document-types";
import { verifyScaleOfflineMerges } from "./document-scale-offline.fixture";
import { createDocumentStorage } from "./document-storage";

test("offline scale probe verifies concurrent fields, records, deletes and restore in both orders", async () => {
  const document = new Y.Doc();
  const state = memoryDocumentState(document);
  const storage = createDocumentStorage({
    owner: { workbenchId: "scale", extensionId: "scale.owner" },
    store: { transaction: async (_owner, action) => action(state) },
  });
  try {
    await storage.records.commit({
      operationId: "seed",
      edits: [37, 38].map((index) => ({
        recordId: createRow("small", 0, index, 3).id,
        replace: createRow("small", 0, index, 3),
      })),
    });
    const results = await verifyScaleOfflineMerges(Y.encodeStateAsUpdate(document), "small");
    expect(results).toHaveLength(4);
    expect(results.every((result) => result.correct)).toBe(true);
  } finally {
    document.destroy();
  }
});
