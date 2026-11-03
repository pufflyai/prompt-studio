import { strict as assert } from "node:assert";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { readDocumentRecord } from "pstdio-sync/records";
import { fingerprint } from "pstdio-sync-contracts";
import { createRow, owners, scaleStorageIndexes, seedOwner, type Workload, workload } from "storage-scale-fixture";
import * as Y from "yjs";
import { createDb, type DbClient } from "../../db/connection.pglite";
import {
  projects,
  storage_document_operations,
  type storage_document_updates,
  storage_documents,
  storage_record_projections,
} from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { readProjectedRecords } from "./record-queries";
import { loadResourceDocuments, resourceDocumentId } from "./resource-document-persistence";

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
const scope = (
  table: typeof storage_document_operations | typeof storage_documents | typeof storage_document_updates,
) =>
  and(
    eq(table.workbench_id, databaseFixtureOwner.workbenchId),
    eq(table.extension_id, databaseFixtureOwner.extensionId),
  );

const verifyReceipts = async (db: DbClient, kind: Workload, count: number, churn: boolean) => {
  const receipts = await db.select().from(storage_document_operations).where(scope(storage_document_operations));
  const actual = new Map(receipts.map((row) => [row.operation_id, row.fingerprint]));
  let seedCommits = 0;
  // The unchanged seed schedule supplies expected receipts without writing to storage.
  const target = {
    commit: async ({ operationId, rows, deleted }: Parameters<Parameters<typeof seedOwner>[0]["commit"]>[0]) => {
      const edits = [
        ...rows.map((row) => ({ recordId: row.id, replace: row })),
        ...deleted.map((recordId) => ({ recordId, deleted: true })),
      ];
      assert.equal(actual.get(operationId), await fingerprint(edits), `Invalid seed history receipt ${operationId}`);
      seedCommits++;
    },
  };
  for (const variant of churn ? [false, true] : [false]) await seedOwner(target, kind, 0, count, variant, () => {});
  assert.equal(receipts.length, seedCommits, "Unexpected fixture receipts");
  return seedCommits;
};

/** Every record has its own document; rebuilding each one must match the generator and its projection row. */
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
  const documents = await db
    .select({ id: storage_documents.document_id })
    .from(storage_documents)
    .where(scope(storage_documents));
  assert.equal(documents.length, 1 + count * (churn ? 2 : 1), "Unexpected record documents");
  for (const deleted of churn ? [false, true] : [false]) {
    for (let offset = 0; offset < count; offset += 500) {
      const expected = Array.from({ length: Math.min(500, count - offset) }, (_, index) =>
        createRow(kind, 0, offset + index, 3, deleted),
      );
      const ids = expected.map((row) => row.id);
      const { sources } = await db.transaction((tx) =>
        loadResourceDocuments(tx, databaseFixtureOwner, ids.map(resourceDocumentId)),
      );
      const projected = await readProjectedRecords(db, databaseFixtureOwner, ids);
      for (const [index, row] of expected.entries()) {
        const source = sources.get(resourceDocumentId(row.id));
        assert(source, `Missing record document ${row.id}`);
        const tails = source.states.length - 1;
        assert.equal(source.revision - source.folded_revision, tails, `Incomplete history for ${row.id}`);
        const document = new Y.Doc();
        try {
          for (const state of source.states) Y.applyUpdate(document, state);
          const actual = await readDocumentRecord(document, row.id);
          assert.equal(actual.deleted, deleted);
          if (!deleted) assert.deepEqual(actual.value, row);
          assert.deepEqual(projected[index], actual, `Projection differs for ${row.id}`);
        } finally {
          document.destroy();
        }
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
    // Records fold inside their own commits; flushStatistics above finished the only deferred work.
    await opened.close();
  }
};
