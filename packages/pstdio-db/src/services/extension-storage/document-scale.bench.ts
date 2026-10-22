import { strict as assert } from "node:assert";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { sql } from "drizzle-orm";
import {
  assertBenchmarkWorker,
  assertMeasurementWindow,
  createRow,
  measure,
  runBenchmarkEntrypoint,
  seedOwner,
  type Workload,
} from "storage-scale-fixture";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";

const projectId = "00000000-0000-4000-8000-000000000903";
const address = { workbenchId: projectId, extensionId: "scale.owner" };

// This owns a disposable database, never the running application's data directory.
export const benchmarkDatabase = async (kind: Workload, count: number, root: string, phase: string) => {
  assertBenchmarkWorker();
  const lease = assertMeasurementWindow();
  console.log(JSON.stringify({ phase: "timing-window", lease }));
  mkdirSync(root, { recursive: true });
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
    if (phase === "seed") {
      await db.insert(projects).values({
        id: projectId,
        name: "Scale",
        shorthand: "SC",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      const seeded = await measure(() =>
        seedOwner(target, kind, 0, count, false, (progress) => {
          if (progress.completed % 1_000 === 0) emit("seed-progress", progress);
        }),
      );
      emit("seed", seeded);
      return;
    }
    if (phase === "churn") {
      const churn = await measure(() => seedOwner(target, kind, 0, count, true, () => {}));
      emit("churn", churn);
      assert.equal((await storage.records.list()).length, count);
      return;
    }
    // The very first storage access after process restart is this write, with no read/export first.
    const row = createRow(kind, 0, 37, 3);
    const operationId = `first-write-${crypto.randomUUID()}`;
    const commit = { operationId, edits: [{ recordId: row.id, replace: { ...row, title: operationId } }] };
    const first = await measure(() => storage.records.commit(commit));
    emit("first-durable-write", {
      ...first,
      durable: first.value.status === "saved-locally",
      fullOwnerLoads: 1,
      note: "Current document store hydrates on its first transaction",
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
    // Cross the actual persisted folding boundary and retain every individual duration.
    const before = await db.execute(sql`select revision, folded_revision from storage_documents`);
    for (let sample = 0; sample < 129; sample++) {
      const fold = await measure(() =>
        storage.records.commit({
          operationId: `fold-${crypto.randomUUID()}`,
          edits: [{ recordId: row.id, replace: { ...row, title: `Fold ${sample}` } }],
        }),
      );
      emit("folding-writes", { ...fold, sample });
    }
    const after = await db.execute(sql`select revision, folded_revision from storage_documents`);
    emit("fold-boundary", { before: before.rows, after: after.rows });
    assert(Number(after.rows[0].folded_revision) > Number(before.rows[0].folded_revision));
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

if (import.meta.main) {
  const [kind, rows, root, phase, snapshot] = process.argv.slice(2);
  if (
    (kind !== "rich" && kind !== "small") ||
    ![1_000, 10_000, 100_000].includes(Number(rows)) ||
    !root ||
    !["seed", "sample", "churn"].includes(phase)
  )
    throw new Error("Use rich|small 1000|10000|100000 <disposable-directory> seed|sample|churn");
  await runBenchmarkEntrypoint(`database-${phase}`, async () => {
    if (phase === "sample" && snapshot) {
      console.log(JSON.stringify({ phase: "case-setup", action: "copy-closed-seed", status: "started" }));
      rmSync(resolve(root), { recursive: true, force: true });
      cpSync(resolve(snapshot), resolve(root), { recursive: true });
    }
    await benchmarkDatabase(kind, Number(rows), resolve(root), phase);
  });
}
