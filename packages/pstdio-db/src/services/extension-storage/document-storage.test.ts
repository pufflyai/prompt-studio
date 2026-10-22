import { afterEach, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDocumentStorage } from "pstdio-sync";
import { extension_storage_journal, storage_document_updates, storage_documents } from "../../db/schemas.pg";
import { createExtensionUserDataDBService } from "../extension-user-data/extension-user-data";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { createGroupedStorageDBService } from "./grouped-storage";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const fixture = async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  const service = createDocumentStorageDBService(f.db);
  cleanup.push(service.flushCheckpoints);
  const storage = service.open({ owner });
  return { ...f, owner, service, storage };
};

test("save-handler capture reads the durable snapshot and releases the database before staging writes", async () => {
  const f = await fixture();
  await f.storage.records.commit({
    operationId: "seed-capture",
    edits: [{ recordId: "note", replace: { title: "before", count: 0 } }],
  });
  const cold = createDocumentStorageDBService(f.db);
  const storage = createDocumentStorage({
    owner: f.owner,
    store: {
      ...cold,
      transaction: async () => {
        throw new Error("Capture must use its durable binary snapshot");
      },
    },
  });
  const captured = await storage.capture(async (fork) => {
    await f.storage.records.commit({
      operationId: "concurrent-capture",
      edits: [{ recordId: "note", replace: { title: "before", count: 1 } }],
    });
    await createDocumentStorage({ owner: f.owner, store: fork }).records.commit({
      operationId: "staged-capture",
      edits: [{ recordId: "note", replace: { title: "after", count: 0 } }],
    });
  });
  expect((await f.storage.records.read("note")).value).toEqual({ title: "before", count: 1 });
  await f.storage.applyUpdate(captured.update);
  const reopened = createDocumentStorageDBService(f.db).open({ owner: f.owner });
  expect((await reopened.records.read("note")).value).toEqual({ title: "after", count: 1 });
});

test("clearing owner data refreshes every open store and allows operation IDs to be reused", async () => {
  const f = await fixture();
  const other = createDocumentStorageDBService(f.db).open({ owner: f.owner });
  await f.storage.records.commit({ operationId: "save", edits: [{ recordId: "old", replace: "Private data" }] });
  expect((await other.records.read("old")).value).toBe("Private data");
  await createExtensionUserDataDBService(f.db).deleteForInstance(f.instanceAId);
  expect((await other.records.read("old")).exists).toBe(false);
  await f.storage.records.commit({ operationId: "save", edits: [{ recordId: "new", replace: "New data" }] });
  expect((await other.records.list()).map(({ value }) => value)).toEqual(["New data"]);
  expect((await f.storage.records.read("old")).exists).toBe(false);
});

test("a durable multi-record update survives a new service and folds without replaying the journal", async () => {
  const f = await fixture();
  for (let index = 0; index < 130; index++)
    await f.storage.records.commit({
      operationId: `save-${index}`,
      edits: [
        { recordId: "ticket", replace: { title: `Title ${index}`, status: "ready" } },
        { recordId: "note", replace: "first\nlast" },
      ],
    });
  const reopened = createDocumentStorageDBService(f.db).open({ owner: f.owner });
  await f.service.flushCheckpoints();
  expect((await reopened.records.read("ticket")).value).toEqual({ title: "Title 129", status: "ready" });
  expect((await reopened.records.read("note")).value).toBe("first\nlast");
  expect(await f.db.select().from(extension_storage_journal)).toHaveLength(0);
  expect((await f.db.select().from(storage_document_updates)).length).toBeLessThan(128);
  expect(await f.db.select().from(storage_documents)).toHaveLength(1);
});

test("the journal is projected once per owner and later writes leave it untouched", async () => {
  const f = await fixture();
  const legacy = createGroupedStorageDBService(f.db).open({
    owner: f.owner,
    environmentId: (await f.service.getEnvironment()).environmentId,
  });
  await legacy.records.commit({
    operationId: "old-save",
    edits: [{ recordId: "note", replace: { title: "Imported" } }],
  });
  expect((await f.storage.records.read("note")).value).toEqual({ title: "Imported" });
  await f.storage.records.commit({
    operationId: "new-save",
    edits: [{ recordId: "note", replace: { title: "Current" } }],
  });
  const rows = await f.db.select().from(extension_storage_journal);
  expect(rows).toHaveLength(1);
  const restarted = createDocumentStorageDBService(f.db).open({ owner: f.owner });
  expect((await restarted.records.read("note")).value).toEqual({ title: "Current" });
});

test("another store sees a complete update only after its database commit", async () => {
  const f = await fixture();
  const other = createDocumentStorageDBService(f.db).open({ owner: f.owner });
  await other.records.list();
  await f.storage.records.commit({
    operationId: "together",
    edits: [
      { recordId: "one", replace: 1 },
      { recordId: "two", replace: 2 },
    ],
  });
  expect((await other.records.list()).map((record) => record.value)).toEqual([1, 2]);
  expect(await f.db.select().from(storage_document_updates)).toHaveLength(1);
  await f.db.delete(storage_documents).where(eq(storage_documents.workbench_id, f.owner.workbenchId));
  expect(await f.db.select().from(storage_document_updates)).toHaveLength(0);
});

test("two local databases merge offline ticket edits durably and in either update order", async () => {
  const first = await fixture();
  const second = await fixture();
  await first.storage.records.commit({
    operationId: "seed",
    edits: [{ recordId: "ticket", replace: { title: "Before", status: "ready" } }],
  });
  await second.storage.applyUpdate(await first.storage.exportUpdate());
  await first.storage.records.commit({
    operationId: "title",
    edits: [{ recordId: "ticket", replace: { title: "After", status: "ready" } }],
  });
  await second.storage.records.commit({
    operationId: "status",
    edits: [{ recordId: "ticket", replace: { title: "Before", status: "done" } }],
  });
  const updates = await Promise.all([first.storage.exportUpdate(), second.storage.exportUpdate()]);
  await first.storage.applyUpdate(updates[1]);
  await second.storage.applyUpdate(updates[0]);
  for (const f of [first, second])
    expect((await createDocumentStorageDBService(f.db).open({ owner: f.owner }).records.read("ticket")).value).toEqual({
      title: "After",
      status: "done",
    });
});

test("the same data migration on offline devices inserts multiline content once", async () => {
  const first = await fixture();
  const second = await fixture();
  const scope = (f: Awaited<ReturnType<typeof fixture>>) => ({
    extension_instance_id: f.instanceAId,
    project_id: f.projectAId,
    scope_type: "custom",
    scope_id: "shared",
    key: "note",
  });
  await first.svc.setKv({ ...scope(first), value_json: { body: "first\nlast", settings: { enabled: false } } });
  await second.storage.applyUpdate(await first.storage.exportUpdate());
  await first.storage.records.commit({
    operationId: "unrelated-first",
    edits: [{ recordId: "unrelated", replace: 1 }],
  });
  await second.storage.records.commit({
    operationId: "unrelated-second",
    edits: [{ recordId: "unrelated", replace: 2 }],
  });
  for (const f of [first, second])
    await f.svc.migrate(scope(f), 1, async () => {
      await f.svc.setKv({
        ...scope(f),
        value_json: { body: "first\nadded by migration\nlast", settings: { enabled: true } },
      });
    });
  const updates = await Promise.all([first.storage.exportUpdate(), second.storage.exportUpdate()]);
  await first.storage.applyUpdate(updates[1]);
  await second.storage.applyUpdate(updates[0]);
  for (const f of [first, second])
    expect((await f.svc.getKv(scope(f), "note"))?.value_json).toEqual({
      body: "first\nadded by migration\nlast",
      settings: { enabled: true },
    });
  for (const f of [first, second])
    await f.svc.migrate(scope(f), 1, async () => {
      throw new Error("A received migration ran twice");
    });
});

test("upgrading owners with unrelated differences gives unchanged legacy text the same identity", async () => {
  const first = await fixture();
  const second = await fixture();
  for (const [index, f] of [first, second].entries()) {
    const legacy = createGroupedStorageDBService(f.db).open({
      owner: f.owner,
      environmentId: (await f.service.getEnvironment()).environmentId,
    });
    await legacy.records.commit({
      operationId: "old-content",
      edits: [
        { recordId: "note", replace: { body: "first\nlast" } },
        { recordId: "shared-note", shared: [{ kind: "text.insert", index: 0, text: "shared\nbody" }] },
        { recordId: "unrelated", replace: index },
      ],
    });
  }
  const updates = await Promise.all([first.storage.exportUpdate(), second.storage.exportUpdate()]);
  await first.storage.applyUpdate(updates[1]);
  await second.storage.applyUpdate(updates[0]);
  for (const f of [first, second]) {
    expect((await f.storage.records.read("note")).value).toEqual({ body: "first\nlast" });
    expect((await f.storage.records.read("shared-note")).shared).toEqual({ kind: "text", value: "shared\nbody" });
  }
});

test("declared text files have separate durable documents and merge offline character edits", async () => {
  const first = await fixture();
  const second = await fixture();
  const text = (f: Awaited<ReturnType<typeof fixture>>, fileId = "note.md") =>
    f.service.openTextDocument({ owner: f.owner, fileId });
  await text(first).save("first\nmiddle\nlast");
  await text(second).applyUpdate(await text(first).exportUpdate());
  await text(first).save("FIRST\nmiddle\nlast");
  await text(second).save("first\nmiddle\nLAST");
  const updates = await Promise.all([text(first).exportUpdate(), text(second).exportUpdate()]);
  await text(first).applyUpdate(updates[1]);
  await text(second).applyUpdate(updates[0]);
  await text(first, "other.md").save("separate");
  for (const f of [first, second]) expect(await text(f).read()).toBe("FIRST\nmiddle\nLAST");
  expect(await text(first, "other.md").read()).toBe("separate");
  expect(await first.storage.records.list()).toEqual([]);
  expect(
    await createDocumentStorageDBService(first.db).openTextDocument({ owner: first.owner, fileId: "note.md" }).read(),
  ).toBe("FIRST\nmiddle\nLAST");
});

test("sync discovers text documents through the encrypted records document", async () => {
  const first = await fixture();
  const second = await fixture();
  await first.service.openTextDocument({ owner: first.owner, fileId: "note.md" }).save("offline text");
  expect(await first.service.documents.list(first.owner)).toEqual(["records", '["text-file","note.md"]']);
  await second.storage.applyUpdate(await first.storage.exportUpdate());
  expect(await second.service.documents.list(second.owner)).toEqual(["records", '["text-file","note.md"]']);
  const update = await first.service.documents
    .open('["text-file","note.md"]')
    .transaction(first.owner, async ({ document }) => (await import("yjs")).encodeStateAsUpdate(document));
  await second.service.documents.open('["text-file","note.md"]').transaction(second.owner, async ({ document }) => {
    (await import("yjs")).applyUpdate(document, update);
  });
  expect(await second.service.openTextDocument({ owner: second.owner, fileId: "note.md" }).read()).toBe("offline text");
});

test("folds and exports use persisted binary updates without encoding the owner", async () => {
  const { spyOn } = await import("bun:test");
  const Y = await import("yjs");
  const f = await fixture();
  await f.storage.records.commit({ operationId: "seed-binary", edits: [{ recordId: "note", replace: "before" }] });
  const encode = spyOn(Y, "encodeStateAsUpdate");
  try {
    for (let index = 0; index < 130; index++)
      await f.storage.records.commit({
        operationId: `binary-${index}`,
        edits: [{ recordId: "note", replace: `after ${index}` }],
      });
    const update = await f.storage.exportUpdate();
    await f.service.flushCheckpoints();
    const reopened = new Y.Doc();
    Y.applyUpdate(reopened, update);
    expect(reopened.getMap("records").has("note")).toBe(true);
    expect(encode.mock.calls).toHaveLength(0);
    reopened.destroy();
  } finally {
    encode.mockRestore();
  }
});

test("accepted out-of-order updates survive restart before their missing predecessor arrives", async () => {
  const Y = await import("yjs");
  const source = new Y.Doc();
  const updates: Uint8Array[] = [];
  source.on("update", (update: Uint8Array) => updates.push(update));
  source.getMap("values").set("one", 1);
  source.getMap("values").set("two", 2);
  const f = await fixture();
  await f.storage.applyUpdate(updates[1]);
  const reopened = createDocumentStorageDBService(f.db);
  await reopened.open({ owner: f.owner }).applyUpdate(updates[0]);
  expect(await reopened.transaction(f.owner, async ({ document }) => document.getMap("values").toJSON())).toEqual({
    one: 1,
    two: 2,
  });
  source.destroy();
});

test("checkpointing retains accepted updates whose predecessor is still offline", async () => {
  const Y = await import("yjs");
  const source = new Y.Doc();
  const updates: Uint8Array[] = [];
  source.on("update", (update: Uint8Array) => updates.push(update));
  source.getMap("values").set("one", 1);
  source.getMap("values").set("two", 2);
  const f = await fixture();
  await f.storage.applyUpdate(updates[1]);
  for (let index = 0; index < 128; index++)
    await f.storage.records.commit({ operationId: `pending-${index}`, edits: [{ recordId: "local", replace: index }] });
  await f.service.flushCheckpoints();
  const reopened = createDocumentStorageDBService(f.db);
  await reopened.open({ owner: f.owner }).applyUpdate(updates[0]);
  expect(await reopened.transaction(f.owner, async ({ document }) => document.getMap("values").toJSON())).toEqual({
    one: 1,
    two: 2,
  });
  source.destroy();
});

test("checkpoint draining includes writes accepted while an earlier fold is pending", async () => {
  const { runBinaryTask } = await import("pstdio-sync");
  const { foldEvery } = await import("./document-persistence");
  const f = await fixture();
  const gate = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  const held = runBinaryTask(async () => {
    entered.resolve();
    await gate.promise;
    return { kind: "checkpoint", updates: [new Uint8Array([0, 0])] };
  });
  await entered.promise;
  try {
    for (let index = 0; index < foldEvery * 2 + 4; index++)
      await f.storage.records.commit({
        operationId: `drain-${index}`,
        edits: [{ recordId: "note", replace: index }],
      });
  } finally {
    gate.resolve();
    await held;
  }
  await f.service.flushCheckpoints();
  const [saved] = await f.db.select().from(storage_documents);
  expect(saved.revision - saved.folded_revision).toBeLessThan(foldEvery);
  expect(await f.db.select().from(storage_document_updates)).toHaveLength(saved.revision - saved.folded_revision);
  expect((await createDocumentStorageDBService(f.db).open({ owner: f.owner }).records.read("note")).value).toBe(
    foldEvery * 2 + 3,
  );
});

test("a delayed checkpoint keeps newer edits and cannot restore purged data", async () => {
  const { runBinaryTask } = await import("pstdio-sync");
  const { readDocumentSnapshot, saveDocumentCheckpoint } = await import("./document-checkpoints");
  const f = await fixture();
  const address = { workbench_id: f.owner.workbenchId, extension_id: f.owner.extensionId, document_id: "records" };
  await f.storage.records.commit({ operationId: "before-fold", edits: [{ recordId: "note", replace: "before" }] });
  const snapshot = (await readDocumentSnapshot(f.db, address))!;
  const prepared = await runBinaryTask({ kind: "checkpoint", updates: snapshot.updates });
  await f.storage.records.commit({ operationId: "after-fold", edits: [{ recordId: "note", replace: "after" }] });
  const checkpoint = { ...snapshot, state: prepared.state };
  expect(await saveDocumentCheckpoint(f.db, address, checkpoint)).toBe(true);
  expect((await createDocumentStorageDBService(f.db).open({ owner: f.owner }).records.read("note")).value).toBe(
    "after",
  );
  await createExtensionUserDataDBService(f.db).deleteForInstance(f.instanceAId);
  expect(await saveDocumentCheckpoint(f.db, address, checkpoint)).toBe(false);
  expect((await f.storage.records.read("note")).exists).toBe(false);
});

test("a failed durable receive publishes no notification or partial owner state", async () => {
  const Y = await import("yjs");
  const f = await fixture();
  const notifications: unknown[] = [];
  const stop = f.service.watch((owner) => notifications.push(owner));
  const remote = new Y.Doc();
  remote.getMap("values").set("note", "uncommitted");
  const update = Y.encodeStateAsUpdate(remote);
  await expect(
    f.service.transaction(f.owner, async (state) => {
      state.applyUpdate!(update);
      throw new Error("Commit interrupted");
    }),
  ).rejects.toThrow("Commit interrupted");
  expect(notifications).toEqual([]);
  expect(await f.service.transaction(f.owner, async ({ document }) => document.getMap("values").size)).toBe(0);
  expect(await f.db.select().from(storage_document_updates)).toHaveLength(0);
  stop();
  remote.destroy();
});
