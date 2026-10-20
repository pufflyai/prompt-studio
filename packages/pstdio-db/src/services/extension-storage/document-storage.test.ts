import { afterEach, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { extension_storage_journal, storage_document_updates, storage_documents } from "../../db/schemas.pg";
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
  const storage = service.open({ owner });
  return { ...f, owner, service, storage };
};

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
