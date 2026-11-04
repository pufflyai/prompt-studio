import { strict as assert } from "node:assert";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { orderedProjection, projectOrderedOperation, verifyOrderedOperation } from "pstdio-sync/records";
import { fingerprint } from "pstdio-sync-contracts";
import { createRow, owners, scaleStorageIndexes, seedOwner, type Workload, workload } from "storage-scale-fixture";
import { createDb, type DbClient } from "../../db/connection.pglite";
import { projects, storage_ordered_operations, storage_record_projections } from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { createOrderedJournal } from "./ordered-journal";
import { decodeOrderedJson, orderedOwnerWhere } from "./ordered-sql";
import { readProjectedRecords } from "./record-queries";

export const databaseFixtureOwner = { workbenchId: "00000000-0000-4000-8000-000000000903", extensionId: "scale.owner" };

/** Owner 0 is measured. The frozen full workloads add nine more owners; scaling counts measure one. */
export const databaseFixtureOwners = (kind: Workload, count: number) =>
  owners(workload(kind))
    .filter((owner) => owner.index === 0 || count === workload(kind).rows)
    .map((owner) => ({
      index: owner.index,
      rows: owner.index === 0 ? count : owner.rows,
      owner:
        owner.index === 0
          ? databaseFixtureOwner
          : { workbenchId: databaseFixtureOwner.workbenchId, extensionId: `scale.owner-${owner.index}` },
    }));

type Records = ReturnType<ReturnType<typeof createDocumentStorageDBService>["open"]>["records"];
const seedTarget = (records: Records) => ({
  commit: ({ operationId, rows, deleted }: Parameters<Parameters<typeof seedOwner>[0]["commit"]>[0]) =>
    records.commit({
      operationId,
      edits: [
        ...rows.map((row) => ({ recordId: row.id, replace: row })),
        ...deleted.map((recordId) => ({ recordId, deleted: true })),
      ],
    }),
});
const verifyReceipts = async (db: DbClient, kind: Workload, count: number, churn: boolean) => {
  const receipts = await db
    .select()
    .from(storage_ordered_operations)
    .where(orderedOwnerWhere(storage_ordered_operations, databaseFixtureOwner));
  const actual = new Map(receipts.map((row) => [row.operation_id, row]));
  let seedCommits = 0;
  // The unchanged seed schedule supplies expected receipts without writing to storage.
  const target = {
    commit: async ({ operationId, rows, deleted }: Parameters<Parameters<typeof seedOwner>[0]["commit"]>[0]) => {
      const edits = [
        ...rows.map((row) => ({ recordId: row.id, replace: row })),
        ...deleted.map((recordId) => ({ recordId, deleted: true })),
      ];
      const saved = actual.get(operationId);
      assert(saved?.envelope, `Missing author envelope ${operationId}`);
      assert.equal(
        saved.request_fingerprint,
        await fingerprint({ operationId, edits }),
        `Invalid seed history receipt ${operationId}`,
      );
      const operation = await verifyOrderedOperation(decodeOrderedJson(saved.envelope));
      assert.equal(operation.fingerprint, saved.fingerprint, `Invalid envelope identity ${operationId}`);
      seedCommits++;
    },
  };
  for (const variant of churn ? [false, true] : [false]) await seedOwner(target, kind, 0, count, variant, () => {});
  assert.equal(receipts.length, seedCommits, "Unexpected fixture receipts");
  return seedCommits;
};

/** Rebuild from canonical state plus immutable pending groups, then compare every public query row. */
export const verifyDatabaseFixture = async (db: DbClient, kind: Workload, count: number, churn: boolean) => {
  const seedCommits = await verifyReceipts(db, kind, count, churn);
  const [projection] = await db
    .select()
    .from(storage_record_projections)
    .where(
      and(
        eq(storage_record_projections.workbench_id, databaseFixtureOwner.workbenchId),
        eq(storage_record_projections.extension_id, databaseFixtureOwner.extensionId),
      ),
    );
  assert.equal(projection?.revision, seedCommits, "Incomplete owner revision");
  assert.equal(projection.live_count, count, "Stored live count differs");
  for (const deleted of churn ? [false, true] : [false]) {
    for (let offset = 0; offset < count; offset += 500) {
      const expected = Array.from({ length: Math.min(500, count - offset) }, (_, index) =>
        createRow(kind, 0, offset + index, 3, deleted),
      );
      const ids = expected.map((row) => row.id);
      const rebuilt = await db.transaction(async (tx) => {
        const journal = createOrderedJournal(tx, databaseFixtureOwner);
        const views = await journal.canonical(ids);
        let after = 0;
        while (true) {
          const page = await journal.pendingFor(ids, { after, limit: 100 });
          if (!page.length) break;
          for (const { operation } of page)
            for (const record of projectOrderedOperation(views, operation)) views.set(record.recordId, record);
          after = page.at(-1)!.sequence;
        }
        return Promise.all(
          ids.map(async (id) => {
            const record = views.get(id);
            assert(record, `Missing authoritative record ${id}`);
            return orderedProjection(record);
          }),
        );
      });
      const projected = await readProjectedRecords(db, databaseFixtureOwner, ids);
      for (const [index, row] of expected.entries()) {
        const actual = rebuilt[index]!;
        assert.equal(actual.deleted, deleted);
        if (!deleted) assert.deepEqual(actual.value, row);
        assert.deepEqual({ nativeSources: {}, ...projected[index] }, actual, `Projection differs for ${row.id}`);
      }
    }
  }
  return { records: count, seedCommits };
};

export const prepareDatabaseFixture = async (
  kind: Workload,
  count: number,
  root: string,
  churn: boolean,
  emit: (event: object) => void,
) => {
  const opened = await createDb({ path: join(root, "database") });
  const service = createDocumentStorageDBService(opened.db);
  try {
    await opened.db.insert(projects).values({
      id: databaseFixtureOwner.workbenchId,
      name: "Scale",
      shorthand: "SC",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    for (const { index, rows, owner } of databaseFixtureOwners(kind, count)) {
      const records = service.open({ owner }).records;
      // Extensions declare their indexes before their runtime writes, so seeding maintains them.
      await records.defineIndexes(scaleStorageIndexes());
      for (const variant of churn && index === 0 ? [false, true] : [false])
        await seedOwner(seedTarget(records), kind, index, rows, variant, (progress) =>
          emit({ phase: "fixture-seed-progress", owner: index, ...progress, churn: variant, acceptedTiming: false }),
        );
      if (index) assert.equal((await records.aggregate({ index: "scale-rows" })).count, rows, `Owner ${index} rows`);
    }
    await service.flushStatistics();
    const verification = await verifyDatabaseFixture(opened.db, kind, count, churn);
    emit({ phase: "fixture-verified", ...verification, acceptedTiming: false });
    return verification;
  } finally {
    // Canonical/pending writes commit atomically; flushStatistics finished deferred query statistics.
    await opened.close();
  }
};
