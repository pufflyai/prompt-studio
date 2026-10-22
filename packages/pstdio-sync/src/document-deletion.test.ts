import { expect, test } from "bun:test";
import * as Y from "yjs";
import { createDocumentStorage } from "./document-storage";
import { memoryDocumentState } from "./document-types";

const device = (update?: Uint8Array) => {
  const document = new Y.Doc();
  if (update) Y.applyUpdate(document, update);
  const state = memoryDocumentState(document);
  const storage = createDocumentStorage({
    owner: { workbenchId: "deletion", extensionId: "notes" },
    store: { transaction: async (_owner, action) => action(state) },
  });
  return { document, storage };
};

test("a legacy deletion arriving before its original payload still reclaims that late payload", async () => {
  const seed = device();
  await seed.storage.records.commit({
    operationId: "seed",
    edits: [{ recordId: "note", replace: { body: "old private body\n".repeat(1000) } }],
  });
  const original = await seed.storage.exportUpdate();
  const oldWriter = new Y.Doc();
  Y.applyUpdate(oldWriter, original);
  const vector = Y.encodeStateVector(oldWriter);
  oldWriter.transact(() => {
    oldWriter.getMap("records").delete("note");
    oldWriter.getMap("deleted").set("note", true);
  });
  const deletion = Y.encodeStateAsUpdate(oldWriter, vector);
  for (const updates of [
    [deletion, original],
    [original, deletion],
  ]) {
    const receiver = device();
    for (const update of updates) await receiver.storage.applyUpdate(update);
    expect(await receiver.storage.records.read("note")).toMatchObject({ deleted: true, value: null });
    expect((await receiver.storage.exportUpdate()).length).toBeLessThan(original.length);
    receiver.document.destroy();
  }
  seed.document.destroy();
  oldWriter.destroy();
});

test("deleted nested payload is reclaimed while late offline edits cannot revive it", async () => {
  const first = device();
  const body = "private deleted payload\n".repeat(1000);
  await first.storage.records.commit({
    operationId: "seed",
    edits: [{ recordId: "note", replace: { body, nested: { title: "Original", values: [body] } } }],
  });
  const original = await first.storage.exportUpdate();
  const offline = device(original);
  await offline.storage.records.commit({
    operationId: "offline",
    edits: [{ recordId: "note", replace: { body, nested: { title: "Late", values: [body], extra: body } } }],
  });
  await first.storage.records.commit({ operationId: "delete", edits: [{ recordId: "note", deleted: true }] });
  const removed = await first.storage.exportUpdate();
  // Legacy list identities contain their value in the name. Those causal names
  // remain even after live bodies are reclaimed; they are not removable payload.
  expect(removed.length).toBeLessThan(original.length);
  const late = await offline.storage.exportUpdate();
  for (const updates of [
    [removed, late],
    [late, removed],
  ]) {
    const receiver = device();
    for (const update of updates) await receiver.storage.applyUpdate(update);
    expect(await receiver.storage.records.read("note")).toMatchObject({ exists: true, deleted: true, value: null });
    expect((await receiver.storage.exportUpdate()).length).toBeLessThan(original.length);
    receiver.document.destroy();
  }
  first.document.destroy();
  offline.document.destroy();
});

test("an explicit restore stays intact when an older device sends edits to the deleted generation", async () => {
  const first = device();
  await first.storage.records.commit({
    operationId: "seed",
    edits: [{ recordId: "note", replace: { title: "Original", nested: { old: true } } }],
  });
  const offline = device(await first.storage.exportUpdate());
  await offline.storage.records.commit({
    operationId: "late",
    edits: [{ recordId: "note", replace: { title: "Late", nested: { old: true, surprise: true } } }],
  });
  await first.storage.records.commit({ operationId: "delete", edits: [{ recordId: "note", deleted: true }] });
  await first.storage.records.commit({
    operationId: "restore",
    edits: [{ recordId: "note", deleted: false, replace: { title: "Restored", nested: { current: true } } }],
  });
  const restored = await first.storage.exportUpdate();
  const late = await offline.storage.exportUpdate();
  for (const updates of [
    [restored, late],
    [late, restored],
  ]) {
    const receiver = device();
    for (const update of updates) await receiver.storage.applyUpdate(update);
    expect((await receiver.storage.records.read("note")).value).toEqual({
      title: "Restored",
      nested: { current: true },
    });
    receiver.document.destroy();
  }
  first.document.destroy();
  offline.document.destroy();
});

test("an edit to a restored generation can arrive before the restore itself", async () => {
  const source = device();
  await source.storage.records.commit({
    operationId: "seed",
    edits: [{ recordId: "note", replace: { title: "Before" } }],
  });
  await source.storage.records.commit({ operationId: "delete", edits: [{ recordId: "note", deleted: true }] });
  const deleted = await source.storage.exportUpdate();
  await source.storage.records.commit({
    operationId: "restore",
    edits: [{ recordId: "note", deleted: false, replace: { title: "Restored" } }],
  });
  const restored = await source.storage.exportUpdate();
  const peer = device(restored);
  const vector = Y.encodeStateVector(peer.document);
  await peer.storage.records.commit({
    operationId: "edit-restored",
    edits: [{ recordId: "note", replace: { title: "Restored", nested: { new: true } } }],
  });
  const edit = Y.encodeStateAsUpdate(peer.document, vector);
  const receiver = device(deleted);
  await receiver.storage.applyUpdate(edit);
  await receiver.storage.applyUpdate(restored);
  expect((await receiver.storage.records.read("note")).value).toEqual({ title: "Restored", nested: { new: true } });
  source.document.destroy();
  peer.document.destroy();
  receiver.document.destroy();
});

test("an independent named-map edit survives arriving before its restored generation", async () => {
  const source = device();
  await source.storage.records.commit({
    operationId: "seed",
    edits: [{ recordId: "note", replace: { title: "Before" } }],
  });
  await source.storage.records.commit({ operationId: "delete", edits: [{ recordId: "note", deleted: true }] });
  const deleted = await source.storage.exportUpdate();
  await source.storage.records.commit({
    operationId: "restore",
    edits: [{ recordId: "note", deleted: false, replace: { title: "Restored" } }],
  });
  const root = source.document.getMap<string>("records").get("note")!;
  const reference = source.document.getMap(root).get("value") as { name: string };
  // Named roots have no causal parent. A new peer's first key can arrive without
  // any of the separate record/reference updates that make the root visible.
  const independent = new Y.Doc();
  independent.getMap(reference.name).set("lateIndependent", "kept");
  const receiver = device(deleted);
  await receiver.storage.applyUpdate(Y.encodeStateAsUpdate(independent));
  await receiver.storage.applyUpdate(await source.storage.exportUpdate());
  expect((await receiver.storage.records.read("note")).value).toEqual({ title: "Restored", lateIndependent: "kept" });
  source.document.destroy();
  independent.destroy();
  receiver.document.destroy();
});
