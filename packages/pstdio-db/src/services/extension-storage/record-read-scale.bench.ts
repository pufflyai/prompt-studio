import { strict as assert } from "node:assert";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { assertBenchmarkWorker, contract, createRow, measure, type Workload } from "storage-scale-fixture";
import { createDb } from "../../db/connection.pglite";
import { runDatabaseScaleEntrypoint } from "./database-scale-entrypoint";
import { databaseFixtureOwner, databaseFixtureOwners } from "./database-scale-fixture";
import { createDocumentStorageDBService } from "./document-storage";
import { createViewReader, type ReadOperation, readOperations } from "./record-read-views";
import { resourceDocumentId } from "./resource-document-persistence";
import { resourceFoldEvery } from "./resource-records";

const coldOperations = [...readOperations, "all-owner-burst"] as const;
type ColdOperation = (typeof coldOperations)[number];

const coldOperation = () => {
  const requested = process.env.PSTDIO_SCALE_READ_COLD ?? "view";
  if (!coldOperations.includes(requested as ColdOperation)) throw new Error(`Use one of ${coldOperations.join(", ")}`);
  return requested as ColdOperation;
};

// This owns a disposable database, never the running application's data directory.
export const benchmarkReads = async (kind: Workload, count: number, root: string) => {
  assertBenchmarkWorker();
  const cold = coldOperation();
  const emit = (phase: string, data: object) =>
    console.log(JSON.stringify({ layer: "database-read", kind, count, phase, ...data }));
  const owners = databaseFixtureOwners(kind, count);
  emit("experiment", {
    acceptedTiming: false,
    format: "production storage, one document per record, indexed projection",
    coldOperation: cold,
    owners: owners.map(({ index, rows }) => ({ index, rows })),
    caveat: "The controller copies the fixture just before this process, so the OS file cache may hold it",
  });
  const opened = await measure(() => createDb({ path: join(root, "database") }));
  const { db, close } = opened.value;
  emit("database-open", { ...opened, value: undefined });
  const service = createDocumentStorageDBService(db);
  const services = owners.map(({ owner }) => service.open({ owner }));
  const readers = owners.map(({ index, rows }, position) =>
    createViewReader(services[position].records, kind, index, rows),
  );
  const records = services[0].records;
  const reader = readers[0];
  // Counters cover the projection table only. Forcing a flush makes each delta exact.
  const counters = async () => {
    await db.execute(sql`select pg_stat_force_next_flush()`);
    const table = await db.execute<Record<string, string>>(
      sql`select seq_scan, seq_tup_read, idx_scan, idx_tup_fetch from pg_stat_user_tables where relname = 'storage_current_records'`,
    );
    const indexes = await db.execute<{ read: string }>(
      sql`select coalesce(sum(idx_tup_read), 0) as read from pg_stat_user_indexes where relname = 'storage_current_records'`,
    );
    const row = table.rows[0];
    return {
      seqScans: Number(row.seq_scan),
      seqRows: Number(row.seq_tup_read),
      indexScans: Number(row.idx_scan),
      indexHeapRows: Number(row.idx_tup_fetch),
      indexEntries: Number(indexes.rows[0].read),
    };
  };
  const timed = <T>(work: Promise<T>) => {
    const started = performance.now();
    return work.then((value) => ({ value, durationMs: performance.now() - started }));
  };
  // Every owner's view is requested at once; each owner's latency runs from the shared start.
  const burst = async () => {
    const results = await Promise.all(readers.map((owner) => timed(owner.run("view"))));
    return { returned: results.length * 100, ownerMs: results.map((result) => result.durationMs) };
  };
  const sample = async (phase: string, operation: ColdOperation, extra: object = {}, cursor?: string) => {
    const before = await counters();
    const measured = await measure(() =>
      operation === "all-owner-burst" ? burst() : reader.run(operation as ReadOperation, cursor),
    );
    const after = await counters();
    const work = Object.fromEntries(
      Object.entries(after).map(([key, value]) => [key, value - before[key as keyof typeof before]]),
    );
    const passed = measured.durationMs < contract.ceilingMs;
    emit(phase, { operation, ...measured, ...measured.value, value: undefined, work, passed, ...extra });
  };
  try {
    // The first storage access in this fresh process is the measured cold read.
    await sample("cold-read", cold);
    for (const operation of readOperations)
      for (let index = 0; index < 10; index++) await sample("warm-read", operation, { sample: index });
    const cursor = await reader.secondPageCursor();
    for (let index = 0; index < 10; index++) await sample("warm-read", "second-page", { sample: index }, cursor);
    if (owners.length > 1)
      for (let index = 0; index < 10; index++) await sample("warm-read", "all-owner-burst", { sample: index });

    // A read issued while a write holds the database shows what a user waits for during saves.
    const atomicRows = Array.from({ length: 100 }, (_, index) => ({
      ...createRow(kind, 0, index, 3),
      title: `Contention ${index}`,
    }));
    const atomic = timed(
      records.commit({
        operationId: `read-contention-${crypto.randomUUID()}`,
        edits: atomicRows.map((row) => ({ recordId: row.id, replace: row })),
      }),
    );
    await sample("read-during-atomic-100", "view");
    emit("contending-write", { durationMs: (await atomic).durationMs, rows: 100 });

    if (owners.length > 1) {
      // Another owner receives the contract's offered write rate while this owner keeps reading.
      // These are local commits; relay receive for resource documents is not implemented yet.
      const { durationMs, intervalMs, operations } = contract.incoming;
      const other = owners[1];
      const writes: Promise<{ durationMs: number }>[] = [];
      const writer = (async () => {
        for (let index = 0; index < operations; index++) {
          const row = createRow(kind, other.index, index % other.rows, 3);
          writes.push(
            timed(
              services[1].records.commit({
                operationId: `incoming-${crypto.randomUUID()}`,
                edits: [{ recordId: row.id, replace: { ...row, title: `Incoming ${index}` } }],
              }),
            ),
          );
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
      })();
      const started = performance.now();
      let reads = 0;
      while (performance.now() - started < durationMs) await sample("read-during-incoming", "view", { read: reads++ });
      await writer;
      const acknowledged = await Promise.all(writes);
      emit("incoming-writes", {
        operations: acknowledged.length,
        maxAckMs: Math.max(...acknowledged.map((write) => write.durationMs)),
        drainedMs: performance.now() - started,
      });
    }

    // Advance one resource to the write that compacts its checkpoint, outside the measurement.
    const row = createRow(kind, 0, 1, 3);
    // A resource's revision is its newest update tail; its document row keeps the checkpoint.
    const history = async () => {
      const result = await db.execute<{ revision: string; folded: string }>(sql`
        select greatest(saved.revision, (select max(tails.revision) from storage_document_updates tails
          where tails.workbench_id = saved.workbench_id and tails.extension_id = saved.extension_id
            and tails.document_id = saved.document_id)) as revision, saved.folded_revision as folded
        from storage_documents saved
        where saved.workbench_id = ${databaseFixtureOwner.workbenchId}
          and saved.extension_id = ${databaseFixtureOwner.extensionId}
          and saved.document_id = ${resourceDocumentId(row.id)}`);
      return { revision: Number(result.rows[0].revision), folded: Number(result.rows[0].folded) };
    };
    const write = (title: string) =>
      records.commit({
        operationId: `fold-${crypto.randomUUID()}`,
        edits: [{ recordId: row.id, replace: { ...row, title } }],
      });
    for (let saved = await history(); saved.revision + 1 - saved.folded < resourceFoldEvery; saved = await history())
      await write(`Before fold ${saved.revision}`);
    const before = await history();
    const boundary = timed(write("Fold boundary"));
    await sample("read-during-fold", "view");
    emit("contending-write", { durationMs: (await boundary).durationMs, fold: true });
    assert((await history()).folded > before.folded, "The contending write did not compact its resource");

    emit("projection-size", {
      relations: (
        await db.execute(
          sql`select relname, pg_total_relation_size(oid) as bytes from pg_class where relname like 'storage_current_records%' or relname like 'storage_query_%'`,
        )
      ).rows,
    });
  } finally {
    try {
      await service.flushStatistics();
    } finally {
      await close();
      emit("sample-closed-memory", {
        memory: process.memoryUsage(),
        maxRssBytes: process.resourceUsage().maxRSS * 1_024,
      });
    }
  }
};

if (import.meta.main) await runDatabaseScaleEntrypoint(benchmarkReads);
