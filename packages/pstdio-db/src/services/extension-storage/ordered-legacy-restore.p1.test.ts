import { expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import {
  storage_record_outbox as outbox,
  storage_ordered_owners as owners,
  storage_record_sync as sync,
} from "../../db/legacy-records-schema";
import { storage_current_records as current, documents, owners as projections } from "../../db/schemas.pg";
import { captureDocumentFiles, restoreDocumentBackup } from "./document-history.fixture";
import { peers } from "./ordered-legacy-pending.fixture";

test("a restored old pending frontier cannot reuse a known raw-frame identity with a new effective payload", async () => {
  const { first, second } = await peers();
  await first.legacy.commit({
    operationId: "seed",
    edits: [{ recordId: "card", replace: { title: "base", body: "base" } }],
  });
  await first.oldSync.synchronize();
  await second.oldSync.synchronize();
  await second.legacy.commit({
    operationId: "old-frame",
    edits: [{ recordId: "card", replace: { title: "first", body: "first" } }],
  });
  const saved = {
    files: await captureDocumentFiles(second.db),
    current: await second.db.select().from(current),
    projections: await second.db.select().from(projections),
    sync: await second.db.select().from(sync),
    outbox: await second.db.select().from(outbox),
  };
  const a = await first.upgrade();
  const b = await second.upgrade();
  await a.sync.synchronize();
  await b.sync.synchronize();
  await a.sync.synchronize();
  await second.db.transaction(async (tx) => {
    await tx.execute(sql`DELETE FROM storage_ordered_records`);
    await tx.execute(sql`DELETE FROM storage_ordered_operations`);
    await tx.execute(sql`DELETE FROM storage_ordered_receipts`);
    await tx.delete(owners);
    await tx.delete(current);
    await tx.delete(documents);
    await tx.delete(sync);
    await restoreDocumentBackup(tx, saved.files);
    for (const row of saved.projections)
      await tx
        .update(projections)
        .set({
          revision: row.revision,
          live_count: row.live_count,
          epoch: row.epoch,
          joined: row.joined,
          after: row.after,
          state_id: row.state_id,
          through: row.through,
          pending_bytes: row.pending_bytes,
          state_bytes: row.state_bytes,
          skipped: row.skipped,
          receipt_root: row.receipt_root,
        })
        .where(eq(projections.id, row.id));
    for (const row of saved.current) await tx.insert(current).values(row);
    for (const row of saved.sync) await tx.insert(sync).values(row);
    for (const row of saved.outbox) await tx.insert(outbox).values(row);
  });
  await second.legacy.commit({
    operationId: "later-frontier",
    edits: [{ recordId: "card", replace: { title: "later", body: "first" } }],
  });
  const restored = await second.upgrade();
  await expect(restored.sync.synchronize()).rejects.toThrow("identity reused");
  expect((await restored.records.read("card")).value).toEqual({ title: "later", body: "first" });
  expect((await a.records.read("card")).value).toEqual({ title: "first", body: "first" });
});
