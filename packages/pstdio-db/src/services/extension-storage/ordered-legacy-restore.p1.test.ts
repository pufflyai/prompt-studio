import { expect, test } from "bun:test";
import {
  storage_current_records as current,
  storage_documents as documents,
  storage_document_operations as operations,
  storage_record_outbox as outbox,
  storage_ordered_owners as owners,
  storage_record_projections as projections,
  storage_record_sync as sync,
  storage_document_updates as updates,
} from "../../db/schemas.pg";
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
    documents: await second.db.select().from(documents),
    updates: await second.db.select().from(updates),
    operations: await second.db.select().from(operations),
    current: await second.db.select().from(current),
    projections: await second.db.select().from(projections),
    sync: await second.db.select().from(sync),
    outbox: await second.db.select().from(outbox),
  };
  const a = first.upgrade();
  const b = second.upgrade();
  await a.sync.synchronize();
  await b.sync.synchronize();
  await a.sync.synchronize();
  await second.db.transaction(async (tx) => {
    await tx.delete(owners);
    await tx.delete(documents);
    await tx.delete(sync);
    for (const row of saved.documents) await tx.insert(documents).values(row);
    for (const row of saved.updates) await tx.insert(updates).values(row);
    for (const row of saved.operations) await tx.insert(operations).values(row);
    for (const row of saved.projections) await tx.insert(projections).values(row);
    for (const row of saved.current) await tx.insert(current).values(row);
    for (const row of saved.sync) await tx.insert(sync).values(row);
    for (const row of saved.outbox) await tx.insert(outbox).values(row);
  });
  await second.legacy.commit({
    operationId: "later-frontier",
    edits: [{ recordId: "card", replace: { title: "later", body: "first" } }],
  });
  const restored = second.upgrade();
  await expect(restored.sync.synchronize()).rejects.toThrow("identity reused");
  expect((await restored.records.read("card")).value).toEqual({ title: "later", body: "first" });
  expect((await a.records.read("card")).value).toEqual({ title: "first", body: "first" });
});
