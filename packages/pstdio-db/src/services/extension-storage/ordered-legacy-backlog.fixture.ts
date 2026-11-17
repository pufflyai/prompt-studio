import { sql } from "drizzle-orm";
import { encodeRecordFrame } from "pstdio-sync/relay";
import * as Y from "yjs";
import { createDb } from "../../db/connection.pglite";
import {
  projects,
  storage_current_records,
  storage_documents,
  storage_record_outbox,
  storage_record_sync,
} from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { ensureOrderedOwner } from "./ordered-conversion";
import { readConversion } from "./ordered-conversion-state";
import { lockRecordOwner } from "./record-changes";
import { resourceDocumentId } from "./resource-document-persistence";

export const backlogOwner = { workbenchId: "backlog-project", extensionId: "example.backlog" };
export const seedLegacyBacklog = async (db: Awaited<ReturnType<typeof createDb>>["db"], count = 60_000) => {
  const now = new Date().toISOString();
  await db
    .insert(projects)
    .values({ id: backlogOwner.workbenchId, name: "Backlog", shorthand: "B", created_at: now, updated_at: now });
  await db
    .insert(storage_record_sync)
    .values({ workbench_id: backlogOwner.workbenchId, extension_id: backlogOwner.extensionId, joined: true });
  await db.transaction((tx) => lockRecordOwner(tx, backlogOwner));
  const clean = count / 3;
  for (let offset = 0; offset < count; offset += 100) {
    const documents: (typeof storage_documents.$inferInsert)[] = [];
    const records: (typeof storage_current_records.$inferInsert)[] = [];
    const frames: (typeof storage_record_outbox.$inferInsert)[] = [];
    for (let index = offset; index < Math.min(count, offset + 100); index++) {
      const id = `record-${String(index).padStart(6, "0")}`;
      const document = new Y.Doc();
      const name = JSON.stringify(["record", id]);
      document.getMap("records").set(id, name);
      document.getMap(name).set("value", "x".repeat(1_000));
      const creation = Y.encodeStateAsUpdate(document);
      const before = Y.encodeStateVector(document);
      const deleted = index >= clean || index < (count * 2) / 15;
      if (deleted) {
        document.getMap("records").delete(id);
        document.getMap("deleted").set(id, true);
      }
      const address = { workbench_id: backlogOwner.workbenchId, extension_id: backlogOwner.extensionId };
      documents.push({ ...address, document_id: resourceDocumentId(id), state: Y.encodeStateAsUpdate(document) });
      records.push({
        ...address,
        record_id: id,
        deleted,
        value: deleted ? null : "x".repeat(1_000),
        revision: "legacy",
      });
      if (index >= clean)
        for (const bytes of [creation, Y.encodeStateAsUpdate(document, before)])
          frames.push({ ...address, frame: encodeRecordFrame({ records: [{ recordId: id, bytes }], assets: [] }) });
      document.destroy();
    }
    await db.transaction(async (tx) => {
      await tx.insert(storage_documents).values(documents);
      await tx.insert(storage_current_records).values(records);
      if (frames.length) await tx.insert(storage_record_outbox).values(frames);
    });
  }
};

if (import.meta.main) {
  const [mode, path] = process.argv.slice(2);
  if (!path) throw new Error("A test database path is required");
  const connection = await createDb({ path });
  if (mode === "seed") {
    await seedLegacyBacklog(connection.db);
    console.log(JSON.stringify({ seeded: true }));
  } else {
    const originalTransaction = connection.db.transaction.bind(connection.db);
    connection.db.transaction = (run, config) => {
      const start = performance.now();
      return originalTransaction(run, config).finally(async () => {
        const elapsed = performance.now() - start;
        if (elapsed > 250)
          console.log(
            JSON.stringify({
              slowBatchMs: elapsed,
              cursor: await readConversion(connection.db, backlogOwner),
              at: new Date().toISOString(),
            }),
          );
      });
    };
    const started = performance.now();
    let completed = false;
    let turns = 0;
    let last = performance.now();
    let maxGap = 0;
    let lastCpu = process.cpuUsage();
    let phase: string | undefined;
    let unrelatedDuring = false;
    const timer = setInterval(() => {
      const now = performance.now();
      const usage = process.cpuUsage(lastCpu);
      lastCpu = process.cpuUsage();
      const gap = now - last;
      if (gap > 250)
        console.log(
          JSON.stringify({
            timerGapMs: gap,
            cpuMs: (usage.user + usage.system) / 1000,
            phase,
            at: new Date().toISOString(),
          }),
        );
      maxGap = Math.max(maxGap, gap);
      last = now;
      turns++;
    }, 100);
    const service = createDocumentStorageDBService(connection.db);
    const converting = ensureOrderedOwner(connection.db, backlogOwner).then(() => {
      completed = true;
    });
    const other = service.open({ owner: { ...backlogOwner, extensionId: "example.unrelated" } }).records;
    const unrelated = other.read("missing").then(() => {
      unrelatedDuring = !completed;
    });
    const monitor = setInterval(
      async () => {
        const cursor = await readConversion(connection.db, backlogOwner);
        if (mode !== "interrupt" && cursor?.phase !== phase) {
          phase = cursor?.phase;
          console.log(JSON.stringify({ phase, cursor }));
        }
        if (mode === "interrupt" && cursor?.phase === "records" && cursor.after) {
          const row = await connection.db.execute(
            sql`SELECT xmin::text AS version FROM storage_ordered_records WHERE workbench_id=${backlogOwner.workbenchId} AND extension_id=${backlogOwner.extensionId} AND record_id='record-000000'`,
          );
          console.log(JSON.stringify({ checkpoint: cursor, firstVersion: row.rows[0]!.version }));
          // The parent kills this process after observing committed progress.
          clearInterval(monitor);
        }
      },
      mode === "interrupt" ? 10 : 1000,
    );
    try {
      await Promise.all([converting, unrelated]);
      const row = await connection.db.execute(
        sql`SELECT xmin::text AS version FROM storage_ordered_records WHERE workbench_id=${backlogOwner.workbenchId} AND extension_id=${backlogOwner.extensionId} AND record_id='record-000000'`,
      );
      console.log(
        JSON.stringify({
          completed,
          durationMs: performance.now() - started,
          turns,
          maxGap: Math.max(maxGap, performance.now() - last),
          unrelatedDuring,
          firstVersion: row.rows[0]!.version,
          counts: (
            await connection.db.execute(
              sql`SELECT (SELECT count(*) FROM storage_ordered_records) AS records, (SELECT count(*) FROM storage_ordered_operations) AS operations, (SELECT count(*) FROM storage_record_outbox) AS legacy, (SELECT count(*) FROM projects) AS projects, (SELECT count(*) FROM storage_current_records) AS projected, (SELECT count(*) FROM storage_current_records WHERE deleted) AS tombstones`,
            )
          ).rows[0],
        }),
      );
    } finally {
      clearInterval(timer);
      clearInterval(monitor);
      await service.flushStatistics();
    }
  }
  await connection.close();
}
