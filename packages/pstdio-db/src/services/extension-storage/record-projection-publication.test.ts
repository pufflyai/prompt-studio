import { afterEach, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import type { StorageRecord } from "pstdio-sync-contracts";
import { storage_current_records, storage_record_projections, storage_record_types } from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { decodeProjectionValue } from "./record-projection-codec";
import { publishRecordProjection } from "./record-projection-publication";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

const setup = async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const service = createDocumentStorageDBService(f.db);
  for (const workbenchId of [f.projectAId, f.projectBId]) {
    const storage = service.open({ owner: { workbenchId, extensionId: "ext.example" } });
    await storage.records.defineIndexes([]);
    await storage.records.commit({
      operationId: "seed",
      edits: [
        { recordId: "chosen", replace: { title: "Before" } },
        { recordId: "unrelated", replace: { title: "Unchanged" } },
      ],
    });
  }
  const address = { workbench_id: f.projectAId, extension_id: "ext.example", document_id: "records" };
  const [projection] = await f.db
    .select()
    .from(storage_record_projections)
    .where(eq(storage_record_projections.workbench_id, f.projectAId));
  const record: StorageRecord = {
    recordId: "chosen",
    exists: true,
    deleted: false,
    value: { title: "After\u0000\ud800" },
    asset: null,
    shared: null,
    revision: "changed-content",
  };
  const input = {
    address,
    sourceRevision: projection.revision,
    nextRevision: projection.revision + 1,
    records: [record],
    types: [{ recordId: "chosen", name: "new-root", kind: "text" as const }],
  };
  return { ...f, input };
};

test("selected publication changes only supplied records and preserves projection encoding", async () => {
  const { db, input } = await setup();
  const before = await db.select().from(storage_current_records);
  expect(await db.transaction((tx) => publishRecordProjection(tx, input))).toBe(1);
  const after = await db.select().from(storage_current_records);
  const selected = (row: (typeof after)[number]) =>
    row.workbench_id === input.address.workbench_id && row.record_id === "chosen";
  expect(after.filter((row) => !selected(row))).toEqual(before.filter((row) => !selected(row)));
  expect(decodeProjectionValue(after.find(selected)!.value)).toEqual(input.records[0].value);
  expect(await db.select().from(storage_record_types).where(eq(storage_record_types.type_name, "new-root"))).toEqual([
    {
      workbench_id: input.address.workbench_id,
      extension_id: input.address.extension_id,
      record_id: "chosen",
      type_name: "new-root",
      type_kind: "text",
    },
  ]);
  expect(
    await db.transaction((tx) =>
      publishRecordProjection(tx, {
        ...input,
        sourceRevision: input.nextRevision,
        nextRevision: input.nextRevision + 1,
      }),
    ),
  ).toBe(0);
});

test("stale or absent projection state rejects selected publication without partial rows", async () => {
  const { db, input } = await setup();
  const before = await db.select().from(storage_current_records);
  await expect(
    db.transaction((tx) => publishRecordProjection(tx, { ...input, sourceRevision: input.sourceRevision - 1 })),
  ).rejects.toThrow("out of date");
  expect(await db.select().from(storage_current_records)).toEqual(before);
  await db
    .delete(storage_record_projections)
    .where(eq(storage_record_projections.workbench_id, input.address.workbench_id));
  await expect(db.transaction((tx) => publishRecordProjection(tx, input))).rejects.toThrow("out of date");
  expect(
    await db.select().from(storage_record_types).where(eq(storage_record_types.type_name, "new-root")),
  ).toHaveLength(0);
});

test("publication and its freshness marker roll back together", async () => {
  const { db, input } = await setup();
  const records = await db.select().from(storage_current_records);
  const projections = await db.select().from(storage_record_projections);
  const types = await db.select().from(storage_record_types);
  await expect(
    db.transaction(async (tx) => {
      await publishRecordProjection(tx, input);
      throw new Error("source commit failed");
    }),
  ).rejects.toThrow("source commit failed");
  expect(await db.select().from(storage_current_records)).toEqual(records);
  expect(await db.select().from(storage_record_projections)).toEqual(projections);
  expect(await db.select().from(storage_record_types)).toEqual(types);
});

test("a causal update without changed records still advances the owner freshness marker", async () => {
  const { db, input } = await setup();
  const before = await db.select().from(storage_current_records);
  expect(await db.transaction((tx) => publishRecordProjection(tx, { ...input, records: [], types: [] }))).toBe(0);
  expect(await db.select().from(storage_current_records)).toEqual(before);
  expect(
    await db
      .select()
      .from(storage_record_projections)
      .where(eq(storage_record_projections.workbench_id, input.address.workbench_id)),
  ).toMatchObject([{ revision: input.nextRevision }]);
});
