import { strict as assert } from "node:assert";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import {
  assertBenchmarkWorker,
  assertMeasurementWindow,
  createRow,
  measure,
  type seedOwner,
  type Workload,
} from "storage-scale-fixture";
import { createDb } from "../../db/connection.pglite";
import { runDatabaseScaleEntrypoint } from "./database-scale-entrypoint";
import { createDocumentStorageDBService } from "./document-storage";
import { resourceDocumentId } from "./resource-document-persistence";

const projectId = "00000000-0000-4000-8000-000000000903";
const address = { workbenchId: projectId, extensionId: "scale.owner" };

// This owns a disposable database, never the running application's data directory.
export const benchmarkDatabase = async (kind: Workload, count: number, root: string) => {
  assertBenchmarkWorker();
  const lease = assertMeasurementWindow();
  console.log(JSON.stringify({ phase: "timing-window", lease }));
  const opened = await measure(() => createDb({ path: join(root, "database") }));
  const { db, close } = opened.value;
  const emit = (name: string, data: object) =>
    console.log(JSON.stringify({ layer: "database", kind, count, phase: name, ...data }));
  const service = createDocumentStorageDBService(db);
  const storage = service.open({ owner: address });
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
  try {
    emit("database-open", { ...opened, value: undefined });
    // The very first storage access after process restart is this write, with no read/export first.
    const row = createRow(kind, 0, 37, 3);
    const operationId = `first-write-${crypto.randomUUID()}`;
    const commit = { operationId, edits: [{ recordId: row.id, replace: { ...row, title: operationId } }] };
    const first = await measure(() => storage.records.commit(commit));
    emit("first-durable-write", {
      ...first,
      durable: first.value.status === "saved-locally",
      fullOwnerLoads: 0,
      note: "Loads only the written record's document",
    });
    assert.equal(
      (await storage.records.read(row.id)).value &&
        ((await storage.records.read(row.id)).value as { title: string }).title,
      operationId,
    );
    for (let sample = 0; sample < 10; sample++) {
      const warm = await measure(() =>
        storage.records.commit({
          operationId: `warm-${crypto.randomUUID()}`,
          edits: [{ recordId: row.id, replace: { ...row, title: `Warm ${sample}` } }],
        }),
      );
      emit("warm-durable-write", { ...warm, sample });
    }
    const list = await measure(() => storage.records.list());
    assert.equal(list.value.length, count);
    emit("list", {
      ...list,
      value: undefined,
      scanned: count,
      materialized: count,
      payloadBytes: Buffer.byteLength(JSON.stringify(list.value)),
    });
    const atomicRows = Array.from({ length: 100 }, (_, index) => ({
      ...createRow(kind, 0, index, 3),
      title: `Atomic ${operationId} ${index}`,
    }));
    const atomic = await measure(() =>
      target.commit({
        operationId: `atomic-${crypto.randomUUID()}`,
        rows: atomicRows,
        deleted: [],
      }),
    );
    emit("atomic-100", { ...atomic, rows: 100, rowsPerSecond: 100_000 / atomic.durationMs, budgetMs: null });
    for (const value of atomicRows) assert.deepEqual((await storage.records.read(value.id)).value, value);
    await target.commit({
      operationId: `reset-atomic-${operationId}`,
      rows: Array.from({ length: 100 }, (_, index) => createRow(kind, 0, index, 3)),
      deleted: [],
    });
    // Cross the record's persisted folding boundary and retain every individual duration.
    // A record's head is its newest update tail; its document row keeps the checkpoint revision.
    const history = async () =>
      (
        await db.execute<{ revision: string; folded_revision: string }>(sql`
          select greatest(saved.revision, (select max(tails.revision) from storage_document_updates tails
            where tails.workbench_id = saved.workbench_id and tails.extension_id = saved.extension_id
              and tails.document_id = saved.document_id)) as revision, saved.folded_revision
          from storage_documents saved
          where saved.workbench_id = ${address.workbenchId} and saved.extension_id = ${address.extensionId}
            and saved.document_id = ${resourceDocumentId(row.id)}`)
      ).rows;
    const before = await history();
    for (let sample = 0; sample < 129; sample++) {
      const fold = await measure(() =>
        storage.records.commit({
          operationId: `fold-${crypto.randomUUID()}`,
          edits: [{ recordId: row.id, replace: { ...row, title: `Fold ${sample}` } }],
        }),
      );
      emit("folding-writes", { ...fold, sample });
    }
    const after = await history();
    emit("fold-boundary", { before, after });
    assert(Number(after[0].folded_revision) > Number(before[0].folded_revision));
    emit("disk", {
      tables: (
        await db.execute(
          sql`select relname, pg_total_relation_size(oid) as bytes from pg_class where relname like 'storage_document%'`,
        )
      ).rows,
    });
    emit("gaps", {
      indexMaintenance: "not implemented",
      lockWaitMs: null,
      queueDepth: null,
      notificationMs: null,
      renderMs: null,
      warning: "Layer benchmark is not view or SDK acceptance",
    });
    await target.commit({ operationId: `restore-${operationId}`, rows: [row], deleted: [] });
  } finally {
    await close();
  }
  assertMeasurementWindow();
};

if (import.meta.main) await runDatabaseScaleEntrypoint(benchmarkDatabase);
