import { afterEach, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../db/schemas.pg";
import { storage_document_operations, storage_documents } from "../../db/schemas.pg";
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

test("a group commit of multi-megabyte records saves without exhausting database memory", async () => {
  const f = await fixture();
  // Tickets with attached files reach several megabytes each.
  const content = "x".repeat(8_000_000);
  await f.storage.records.commit({
    operationId: "large",
    edits: Array.from({ length: 24 }, (_, index) => ({
      recordId: `ticket-${index}`,
      replace: { files: [{ name: "report.md", content }] },
    })),
  });
  const records = await f.storage.records.list();
  expect(records).toHaveLength(24);
  expect((records[0].value as { files: { content: string }[] }).files[0].content).toHaveLength(8_000_000);
});
