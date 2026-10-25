import { afterEach, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { storage_document_updates, storage_documents } from "../../db/schemas.pg";
import { createExtensionUserDataDBService } from "../extension-user-data/extension-user-data";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

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
  expect((await reopened.records.read("ticket")).value).toEqual({ title: "Title 129", status: "ready" });
  expect((await reopened.records.read("note")).value).toBe("first\nlast");
  expect((await f.db.select().from(storage_document_updates)).length).toBeLessThan(128);
  // The owner metadata document plus one document per record.
  expect(await f.db.select().from(storage_documents)).toHaveLength(3);
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
  await f.storage.records.commit({ operationId: "later", edits: [{ recordId: "one", replace: 3 }] });
  expect(await f.db.select().from(storage_document_updates)).toHaveLength(1);
  await f.db.delete(storage_documents).where(eq(storage_documents.workbench_id, f.owner.workbenchId));
  expect(await f.db.select().from(storage_document_updates)).toHaveLength(0);
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
  const directory = await first.service.documents
    .open("records")
    .transaction(first.owner, async ({ document }) => (await import("yjs")).encodeStateAsUpdate(document));
  await second.service.documents.open("records").transaction(second.owner, async ({ document }) => {
    (await import("yjs")).applyUpdate(document, directory);
  });
  expect(await second.service.documents.list(second.owner)).toEqual(["records", '["text-file","note.md"]']);
  const update = await first.service.documents
    .open('["text-file","note.md"]')
    .transaction(first.owner, async ({ document }) => (await import("yjs")).encodeStateAsUpdate(document));
  await second.service.documents.open('["text-file","note.md"]').transaction(second.owner, async ({ document }) => {
    (await import("yjs")).applyUpdate(document, update);
  });
  expect(await second.service.openTextDocument({ owner: second.owner, fileId: "note.md" }).read()).toBe("offline text");
});
