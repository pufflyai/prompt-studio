import { afterEach, expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import type { StorageGroup } from "pstdio-sync-contracts";
import { storage_current_records, storage_document_operations, storage_record_projections } from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

test("a failed backfill leaves the source and operation identities intact and retries atomically", async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  const storage = createDocumentStorageDBService(f.db).open({ owner });
  const commit: StorageGroup = {
    operationId: "offline-operation",
    edits: [
      { recordId: "note", replace: { body: "first\nlast", nested: { tags: ["one", "two"] } } },
      { recordId: "stop", replace: { title: "Recoverable" } },
    ],
  };
  await storage.records.commit(commit);
  await storage.records.commit({ operationId: "delete", edits: [{ recordId: "removed", deleted: true }] });
  const identities = await f.db.select().from(storage_document_operations);
  const source = await storage.exportUpdate();
  await f.db.delete(storage_record_projections);
  await f.db.delete(storage_current_records);
  await f.db.execute(sql`ALTER TABLE storage_current_records ADD CONSTRAINT fail_backfill CHECK (record_id <> 'stop')`);
  const restarted = createDocumentStorageDBService(f.db).open({ owner });
  await expect(restarted.records.defineIndexes([])).rejects.toThrow();
  expect(await f.db.select().from(storage_record_projections)).toHaveLength(0);
  expect(await f.db.select().from(storage_current_records)).toHaveLength(0);
  expect(await restarted.exportUpdate()).toEqual(source);
  expect(await f.db.select().from(storage_document_operations)).toEqual(identities);
  await f.db.execute(sql`ALTER TABLE storage_current_records DROP CONSTRAINT fail_backfill`);
  await restarted.records.defineIndexes([]);
  expect(
    (await restarted.records.readMany(["note", "stop", "removed"])).map(({ value, deleted }) => ({ value, deleted })),
  ).toEqual([
    { value: commit.edits[0].replace!, deleted: false },
    { value: commit.edits[1].replace!, deleted: false },
    { value: null, deleted: true },
  ]);
  await restarted.records.commit(commit);
  expect(await f.db.select().from(storage_document_operations)).toEqual(identities);
  expect(await restarted.exportUpdate()).toEqual(source);
});

test("an older writer cannot silently serve a stale projection and reinstall repairs it once", async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  const indexes = [{ name: "notes", fields: { title: { path: ["title"], type: "string" as const } } }];
  const storage = createDocumentStorageDBService(f.db).open({ owner });
  await storage.records.defineIndexes(indexes);
  await storage.records.commit({ operationId: "before", edits: [{ recordId: "note", replace: { title: "Before" } }] });
  const oldProjection = await f.db.select().from(storage_record_projections);
  const oldRecords = await f.db.select().from(storage_current_records);
  await storage.records.commit({
    operationId: "older-writer",
    edits: [{ recordId: "note", replace: { title: "After" } }],
  });
  // A pre-projection writer advances the durable document but leaves derived rows untouched.
  await f.db.update(storage_record_projections).set({ revision: oldProjection[0].revision });
  await f.db.update(storage_current_records).set({ value: oldRecords[0].value, revision: oldRecords[0].revision });
  const phases: string[] = [];
  const reopened = createDocumentStorageDBService(f.db, undefined, (event) => phases.push(event.phase)).open({ owner });
  await expect(reopened.records.query({ index: "notes" })).rejects.toThrow("out of date");
  await expect(reopened.records.aggregate({ index: "notes" })).rejects.toThrow("out of date");
  await expect(reopened.records.readMany(["note"])).rejects.toThrow("out of date");
  await expect(reopened.records.read("note")).rejects.toThrow("out of date");
  expect(phases).not.toContain("document-loaded");
  await expect(
    reopened.records.commit({ operationId: "new-host-write", edits: [{ recordId: "other", replace: "Saved" }] }),
  ).rejects.toThrow("out of date");
  await reopened.records.defineIndexes(indexes);
  expect((await reopened.records.read("other")).exists).toBe(false);
  await reopened.records.commit({ operationId: "new-host-write", edits: [{ recordId: "other", replace: "Saved" }] });
  expect((await reopened.records.query({ index: "notes" })).records[0].fields.title).toBe("After");
  expect((await reopened.records.readMany(["note"]))[0].value).toEqual({ title: "After" });
  phases.length = 0;
  const final = createDocumentStorageDBService(f.db, undefined, (event) => phases.push(event.phase)).open({ owner });
  await final.records.defineIndexes(indexes);
  expect((await final.records.read("note")).value).toEqual({ title: "After" });
  expect(phases).not.toContain("document-loaded");
  expect(phases).not.toContain("records-projected");
  expect(
    await f.db
      .select()
      .from(storage_record_projections)
      .where(eq(storage_record_projections.workbench_id, owner.workbenchId)),
  ).toHaveLength(1);
});
