import { afterEach, expect, test } from "bun:test";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { createDocumentStorage, createMemoryDocumentStore } from "pstdio-sync";
import * as Y from "yjs";
import * as schema from "../../db/schemas.pg";
import { storage_document_operations, storage_document_updates, storage_documents } from "../../db/schemas.pg";
import { createExtensionUserDataDBService } from "../extension-user-data/extension-user-data";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { resourceDocumentId } from "./resource-document-persistence";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

const fixture = async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  const service = createDocumentStorageDBService(f.db);
  return { ...f, owner, service, storage: service.open({ owner }) };
};

test("each record is its own document and a group commit writes all of its records or none", async () => {
  const f = await fixture();
  await f.storage.records.commit({
    operationId: "seed",
    edits: [
      { recordId: "a", replace: { title: "A" } },
      { recordId: "b", replace: "text" },
    ],
  });
  const documents = (await f.db.select({ id: storage_documents.document_id }).from(storage_documents)).map(
    (row) => row.id,
  );
  expect(documents).toEqual(expect.arrayContaining([resourceDocumentId("a"), resourceDocumentId("b")]));

  const failure = await f.storage.records
    .commit({
      operationId: "invalid",
      edits: [
        { recordId: "a", replace: { title: "Must not be saved" } },
        { recordId: "b", shared: [{ kind: "text.delete", index: 40, count: 1 }] },
      ],
    })
    .catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(Error);
  expect((await f.storage.records.read("a")).value).toEqual({ title: "A" });
  expect(await f.storage.records.outcome("invalid")).toBeUndefined();
});

test("a retried operation keeps its first result and rejects a changed payload", async () => {
  const f = await fixture();
  const group = { operationId: "once", edits: [{ recordId: "a", replace: 1 }] };
  await f.storage.records.commit(group);
  await f.storage.records.commit({ operationId: "later", edits: [{ recordId: "a", replace: 2 }] });
  await f.storage.records.commit(group);
  expect((await f.storage.records.read("a")).value).toBe(2);
  await expect(
    f.storage.records.commit({ operationId: "once", edits: [{ recordId: "a", replace: 3 }] }),
  ).rejects.toThrow("changed payload");
  const receipts = await f.db
    .select()
    .from(storage_document_operations)
    .where(eq(storage_document_operations.operation_id, "once"));
  expect(receipts).toHaveLength(1);
});

test("owner metadata writes leave record pages and cursors valid", async () => {
  const f = await fixture();
  await f.storage.records.defineIndexes([{ name: "all", fields: { n: { path: ["n"], type: "number" } } }]);
  await f.storage.records.commit({
    operationId: "seed",
    edits: [1, 2, 3].map((n) => ({ recordId: `r${n}`, replace: { n } })),
  });
  const first = await f.storage.records.query({ index: "all", limit: 2 });
  await f.storage.setDataVersion("scope", 2);
  expect(await f.storage.dataVersion("scope")).toBe(2);
  const next = await f.storage.records.query({ index: "all", limit: 2, cursor: first.cursor! });
  expect(next.records.map((record) => record.recordId)).toEqual(["r3"]);
});

test("transactions read and commit under one owner lock and notify watchers after commit", async () => {
  const f = await fixture();
  const changed: string[] = [];
  f.service.watch((owner) => changed.push(owner.extensionId));
  const created = await f.storage.records.transaction(async (records) => {
    if ((await records.read("job")).exists) return false;
    await records.commit({ operationId: "create", edits: [{ recordId: "job", replace: { state: "new" } }] });
    expect(changed).toEqual([]);
    return true;
  });
  expect(created).toBe(true);
  expect(changed).toEqual(["ext.example"]);
  expect((await f.storage.records.read("job")).value).toEqual({ state: "new" });
});

test("records saved in an owner document move into their own documents once", async () => {
  const f = await fixture();
  const old = createDocumentStorage({ owner: f.owner, store: createMemoryDocumentStore() });
  await old.setDataVersion("scope", 3);
  await old.records.commit({
    operationId: "old",
    edits: [
      { recordId: "note", replace: { title: "Kept", nested: { items: [1, 2] } } },
      { recordId: "draft", shared: [{ kind: "text.insert", index: 0, text: "Shared text" }] },
      { recordId: "gone", replace: "removed" },
      { recordId: "settings", shared: [{ kind: "map.set", key: "theme", value: "dark" }] },
    ],
  });
  await old.records.commit({
    operationId: "empty-map",
    edits: [{ recordId: "settings", shared: [{ kind: "map.delete", key: "theme" }] }],
  });
  await old.records.commit({ operationId: "delete", edits: [{ recordId: "gone", deleted: true }] });
  await f.db.insert(storage_documents).values({
    workbench_id: f.owner.workbenchId,
    extension_id: f.owner.extensionId,
    document_id: "records",
    state: await old.exportUpdate(),
    revision: 1,
    folded_revision: 1,
  });

  const records = f.storage.records;
  expect((await records.read("note")).value).toEqual({ title: "Kept", nested: { items: [1, 2] } });
  expect((await records.read("draft")).shared).toEqual({ kind: "text", value: "Shared text" });
  expect(await records.read("gone")).toMatchObject({ exists: true, deleted: true });
  expect((await records.read("settings")).shared).toEqual({ kind: "map", value: {} });
  expect((await records.list()).map((record) => record.recordId)).toEqual(["draft", "note", "settings"]);
  expect(await f.storage.dataVersion("scope")).toBe(3);

  const ownerWhere = and(
    eq(storage_documents.workbench_id, f.owner.workbenchId),
    eq(storage_documents.extension_id, f.owner.extensionId),
    eq(storage_documents.document_id, "records"),
  );
  const [owner] = await f.db.select().from(storage_documents).where(ownerWhere);
  const remaining = new Y.Doc();
  Y.applyUpdate(remaining, owner.state);
  expect(remaining.getMap("records").size + remaining.getMap("deleted").size).toBe(0);
  expect(
    await f.db.select().from(storage_document_updates).where(eq(storage_document_updates.document_id, "records")),
  ).toEqual([]);

  // A fresh service finds nothing left to move and keeps later edits.
  await records.commit({ operationId: "after", edits: [{ recordId: "note", replace: { title: "Edited" } }] });
  const reopened = createDocumentStorageDBService(f.db).open({ owner: f.owner });
  expect((await reopened.records.read("note")).value).toEqual({ title: "Edited" });
});

test("unfiltered totals follow live records without reading them", async () => {
  const f = await fixture();
  const statements: string[] = [];
  const db = drizzle(f.db.$client, { schema, logger: { logQuery: (query) => statements.push(query) } });
  const records = createDocumentStorageDBService(db as unknown as typeof f.db).open({ owner: f.owner }).records;
  await records.defineIndexes([{ name: "all", fields: { n: { path: ["n"], type: "number" } } }]);
  const total = async () => (await records.aggregate({ index: "all" })).count;
  const seed = { operationId: "seed", edits: [1, 2, 3].map((n) => ({ recordId: `r${n}`, replace: { n } })) };
  await records.commit(seed);
  await records.commit(seed);
  expect(await total()).toBe(3);
  await records.commit({ operationId: "delete", edits: [{ recordId: "r1", deleted: true }] });
  expect(await total()).toBe(2);
  await records.commit({ operationId: "restore", edits: [{ recordId: "r1", deleted: false, replace: { n: 1 } }] });
  await records.commit({ operationId: "edit", edits: [{ recordId: "r2", replace: { n: 20 } }] });
  expect(await total()).toBe(3);
  statements.length = 0;
  await total();
  expect(statements.filter((query) => query.includes("storage_current_records"))).toEqual([]);
  await createExtensionUserDataDBService(f.db).deleteForInstance(f.instanceAId);
  expect(await total()).toBe(0);
});

test("a failed upgrade leaves the owner document in charge and a later start completes it", async () => {
  const f = await fixture();
  const old = createDocumentStorage({ owner: f.owner, store: createMemoryDocumentStore() });
  await old.records.commit({
    operationId: "old",
    edits: [
      { recordId: "first", replace: { title: "First" } },
      { recordId: "second", replace: { title: "Second" } },
    ],
  });
  await f.db.insert(storage_documents).values({
    workbench_id: f.owner.workbenchId,
    extension_id: f.owner.extensionId,
    document_id: "records",
    state: await old.exportUpdate(),
    revision: 1,
    folded_revision: 1,
  });
  // A real database failure after some record documents were written inside the move.
  await f.db.execute(sql`CREATE FUNCTION fail_second() RETURNS trigger AS $$
    BEGIN IF NEW.record_id = 'second' THEN RAISE EXCEPTION 'interrupted upgrade'; END IF; RETURN NEW; END $$
    LANGUAGE plpgsql`);
  await f.db.execute(
    sql`CREATE TRIGGER fail_second BEFORE INSERT ON storage_current_records FOR EACH ROW EXECUTE FUNCTION fail_second()`,
  );
  await expect(f.storage.records.read("first")).rejects.toThrow();
  expect(
    await f.db
      .select()
      .from(storage_documents)
      .where(eq(storage_documents.document_id, resourceDocumentId("first"))),
  ).toEqual([]);
  const [owner] = await f.db.select().from(storage_documents).where(eq(storage_documents.document_id, "records"));
  const remaining = new Y.Doc();
  Y.applyUpdate(remaining, owner.state);
  expect(remaining.getMap("records").size).toBe(2);

  await f.db.execute(sql`DROP TRIGGER fail_second ON storage_current_records`);
  const restarted = createDocumentStorageDBService(f.db).open({ owner: f.owner });
  expect((await restarted.records.read("second")).value).toEqual({ title: "Second" });
  expect((await restarted.records.list()).map((record) => record.recordId)).toEqual(["first", "second"]);
});
