import { strict as assert } from "node:assert";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { createDocumentStorage, memoryDocumentState } from "pstdio-sync";
import { fingerprint } from "pstdio-sync-contracts";
import { createRow, seedOwner, type Workload } from "storage-scale-fixture";
import * as Y from "yjs";
import { createDb, type DbClient } from "../../db/connection.pglite";
import {
  projects,
  storage_document_operations,
  storage_document_updates,
  storage_documents,
} from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";

export const databaseFixtureOwner = { workbenchId: "00000000-0000-4000-8000-000000000903", extensionId: "scale.owner" };
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

export const verifyDatabaseFixture = async (db: DbClient, kind: Workload, count: number, churn: boolean) => {
  const seedCommits = await verifyReceipts(db, kind, count, churn);
  const sources = await db.select().from(storage_documents).where(scope(storage_documents));
  assert.equal(sources.length, 1, "Unexpected owner documents");
  const [source] = sources;
  assert.equal(source.document_id, "records");
  assert.equal(source.revision, seedCommits, "Incomplete durable revision");
  const tails = await db
    .select()
    .from(storage_document_updates)
    .where(scope(storage_document_updates))
    .orderBy(storage_document_updates.revision);
  assert.equal(tails.length, source.revision - source.folded_revision, "Incomplete durable update history");
  for (const [index, tail] of tails.entries()) assert.equal(tail.revision, source.folded_revision + index + 1);
  const document = new Y.Doc();
  try {
    document.transact(() => {
      Y.applyUpdate(document, source.state);
      for (const tail of tails) Y.applyUpdate(document, tail.update);
    });
    assert.equal(document.getMap("records").size, count, "Unexpected live resource count");
    assert.equal(document.getMap("deleted").size, churn ? count : 0, "Unexpected deleted resource count");
    const state = memoryDocumentState(document);
    const storage = createDocumentStorage({
      owner: databaseFixtureOwner,
      store: { transaction: async (_owner, run) => run(state) },
    });
    for (const deleted of churn ? [false, true] : [false]) {
      for (let index = 0; index < count; index++) {
        const expected = createRow(kind, 0, index, 3, deleted);
        const actual = await storage.records.read(expected.id);
        assert.equal(actual.exists, true);
        assert.equal(actual.deleted, deleted);
        if (!deleted) assert.deepEqual(actual.value, expected);
      }
    }
  } finally {
    document.destroy();
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
  const storage = createDocumentStorageDBService(opened.db).open({ owner: databaseFixtureOwner });
  try {
    await opened.db.insert(projects).values({
      id: databaseFixtureOwner.workbenchId,
      name: "Scale",
      shorthand: "SC",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const target = {
      commit: ({ operationId, rows, deleted }: Parameters<Parameters<typeof seedOwner>[0]["commit"]>[0]) =>
        storage.records.commit({
          operationId,
          edits: [
            ...rows.map((row) => ({ recordId: row.id, replace: row })),
            ...deleted.map((recordId) => ({ recordId, deleted: true })),
          ],
        }),
    };
    for (const variant of churn ? [false, true] : [false])
      await seedOwner(target, kind, 0, count, variant, (progress) =>
        emit({ phase: "fixture-seed-progress", ...progress, churn: variant, acceptedTiming: false }),
      );
    const verification = await verifyDatabaseFixture(opened.db, kind, count, churn);
    emit({ phase: "fixture-verified", ...verification, acceptedTiming: false });
    return verification;
  } finally {
    // This version folds checkpoints inside durable commits, so no deferred storage work remains.
    await opened.close();
  }
};
