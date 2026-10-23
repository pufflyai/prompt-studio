import { expect, test } from "bun:test";
import * as Y from "yjs";
import { findDocumentReplacements, snapshotDocumentRecords } from "./document-replacements";
import { createDocumentStorage } from "./document-storage";
import { memoryDocumentState } from "./document-types";

const device = (clientId: number, update?: Uint8Array) => {
  const document = new Y.Doc();
  document.clientID = clientId;
  if (update) Y.applyUpdate(document, update);
  const state = memoryDocumentState(document);
  const storage = createDocumentStorage({
    owner: { workbenchId: "test", extensionId: "example" },
    store: { transaction: async (_owner, action) => action(state) },
  });
  return { document, storage };
};

test("replacement paths and winners stay the same when updates and diagnostic inputs arrive in reverse order", async () => {
  const seed = device(1);
  await seed.storage.records.commit({
    operationId: "seed",
    edits: [{ recordId: "note", replace: { title: "Before" } }],
  });
  const update = Y.encodeStateAsUpdate(seed.document);
  const first = device(2, update);
  const second = device(3, update);
  const base = snapshotDocumentRecords(seed.document);
  await first.storage.records.commit({
    operationId: "left",
    edits: [{ recordId: "note", replace: { title: "Left" } }],
  });
  await second.storage.records.commit({
    operationId: "right",
    edits: [{ recordId: "note", replace: { title: "Right" } }],
  });
  const left = snapshotDocumentRecords(first.document);
  const right = snapshotDocumentRecords(second.document);
  const leftUpdate = Y.encodeStateAsUpdate(first.document);
  const rightUpdate = Y.encodeStateAsUpdate(second.document);
  Y.applyUpdate(first.document, rightUpdate);
  Y.applyUpdate(second.document, leftUpdate);
  const expected = [{ recordId: "note", path: ["value", "title"], kept: "Right", replaced: "Left" }];
  expect(findDocumentReplacements(base, left, right, snapshotDocumentRecords(first.document))).toEqual(expected);
  expect(findDocumentReplacements(base, right, left, snapshotDocumentRecords(second.document))).toEqual(expected);
});

test("snapshots distinguish a stored null from an unset channel", async () => {
  const { document, storage } = device(1);
  await storage.records.commit({
    operationId: "seed",
    edits: [
      { recordId: "empty", shared: [{ kind: "map.set", key: "title", value: "Title" }] },
      { recordId: "null", replace: null },
    ],
  });
  expect((await storage.records.read("empty")).value).toBeNull();
  expect((await storage.records.read("null")).value).toBeNull();
  expect(snapshotDocumentRecords(document).get("empty")).toEqual({
    shared: { kind: "map", value: { title: "Title" } },
  });
  expect(snapshotDocumentRecords(document).get("null")).toEqual({ value: null });
});
