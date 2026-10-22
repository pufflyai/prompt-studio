import { expect, test } from "bun:test";
import * as Y from "yjs";
import { restoreDocument } from "./document-restore";
import { createDocumentStorage } from "./document-storage";
import { memoryDocumentState } from "./document-types";

test("restore writes fresh edits that resurrect deleted records and converge on another device", async () => {
  const document = new Y.Doc();
  const owner = { workbenchId: "project", extensionId: "notes" };
  const storage = createDocumentStorage({
    owner,
    store: { transaction: async (_, action) => action(memoryDocumentState(document)) },
  });
  await storage.records.commit({
    operationId: "seed",
    edits: [
      {
        recordId: "ticket",
        replace: { title: "Before", tags: ["a"], body: "first\nlast" },
        shared: [{ kind: "text.insert", index: 0, text: "shared text" }],
      },
    ],
  });
  const snapshot = Y.encodeStateAsUpdate(document);
  await storage.records.commit({
    operationId: "delete",
    edits: [
      { recordId: "ticket", deleted: true },
      { recordId: "extra", replace: true },
    ],
  });
  const peer = new Y.Doc();
  Y.applyUpdate(peer, Y.encodeStateAsUpdate(document));
  const vector = Y.encodeStateVector(peer);
  restoreDocument(document, snapshot, "records");
  Y.applyUpdate(peer, Y.encodeStateAsUpdate(document, vector));
  const other = createDocumentStorage({
    owner,
    store: { transaction: async (_, action) => action(memoryDocumentState(peer)) },
  });
  for (const store of [storage, other]) {
    expect((await store.records.read("ticket")).value).toEqual({ title: "Before", tags: ["a"], body: "first\nlast" });
    expect((await store.records.read("ticket")).shared).toEqual({ kind: "text", value: "shared text" });
    expect((await store.records.read("extra")).deleted).toBe(true);
  }
  let updates = 0;
  document.on("update", () => updates++);
  restoreDocument(document, snapshot, "records");
  expect(updates).toBe(0);
  document.destroy();
  peer.destroy();
});

test("text restore changes content without replacing CRDT identity or sync metadata", () => {
  const document = new Y.Doc();
  document.getText("content").insert(0, "before");
  const snapshot = Y.encodeStateAsUpdate(document);
  document.getText("content").insert(6, " after");
  document.getMap("sync").set("identity", "keep");
  restoreDocument(document, snapshot, "text");
  expect(document.getText("content").toString()).toBe("before");
  expect(document.getMap("sync").get("identity")).toBe("keep");
  document.destroy();
});

test("restoring shared text into a new document keeps it editable as text", async () => {
  const source = new Y.Doc();
  const owner = { workbenchId: "project", extensionId: "notes" };
  const open = (document: Y.Doc) =>
    createDocumentStorage({
      owner,
      store: { transaction: async (_, action) => action(memoryDocumentState(document)) },
    });
  await open(source).records.commit({
    operationId: "seed",
    edits: [{ recordId: "note", shared: [{ kind: "text.insert", index: 0, text: "before" }] }],
  });
  const restored = new Y.Doc();
  restoreDocument(restored, Y.encodeStateAsUpdate(source), "records");
  await open(restored).records.commit({
    operationId: "append",
    edits: [{ recordId: "note", shared: [{ kind: "text.insert", index: 6, text: " after" }] }],
  });
  expect((await open(restored).records.read("note")).shared).toEqual({ kind: "text", value: "before after" });
  source.destroy();
  restored.destroy();
});
