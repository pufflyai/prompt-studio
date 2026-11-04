import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace, openBlob, openState } from "pstdio-sync/encryption";
import { createRecordStreamSync, decodeOrderedEntry, decodeRecordFrame } from "pstdio-sync/relay";
import { createDb } from "../../db/connection.pglite";
import {
  projects,
  storage_current_records,
  storage_documents,
  storage_ordered_operations,
  storage_ordered_owners,
  storage_ordered_receipts,
  storage_ordered_records,
  storage_ordered_touches,
  storage_record_projections,
} from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { withOrderedOwner } from "./ordered-journal";
import { createRelay } from "./record-stream-relay.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const fixture = async () => {
  const projectId = crypto.randomUUID();
  const owner = { workbenchId: projectId, extensionId: "example.receipts" };
  const space = await createSyncSpace({
    projectId,
    spaceOwner: null,
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const documentId = await space.documentId(JSON.stringify([owner.extensionId, "record-stream"]));
  const relay = createRelay();
  const device = async (path = ":memory:") => {
    const { db, close } = await createDb({ path });
    cleanup.push(close);
    const now = new Date().toISOString();
    await db
      .insert(projects)
      .values({ id: projectId, name: "Receipts", shorthand: "R", created_at: now, updated_at: now })
      .onConflictDoNothing();
    const service = createDocumentStorageDBService(db);
    const records = service.open({ owner }).records;
    const start = () =>
      createRecordStreamSync({
        space,
        documentId,
        relay: relay.relay,
        store: service.documents.recordStream(owner),
        limits: { bytes: Number.MAX_SAFE_INTEGER, updates: 0 },
        quarantine: async () => {},
      });
    return {
      db,
      records,
      service,
      sync: start(),
      restart: start,
      close: async () => {
        await service.flushStatistics();
        cleanup.splice(cleanup.indexOf(close), 1);
        await close();
      },
    };
  };
  const metadata = async () => {
    const state = relay.latest()!;
    const manifest = JSON.parse(
      new TextDecoder().decode(await openState(space, documentId, state, await relay.relay.state())),
    );
    const entries = [];
    for (const reference of manifest.chunks) {
      const frame = decodeRecordFrame(
        await openBlob(space, reference.blobId, await relay.relay.blobs.get(reference.blobId)),
      );
      for (const record of frame.records) entries.push(await decodeOrderedEntry(record.bytes));
    }
    return entries.find((entry) => entry.type === "meta")!;
  };
  return { device, metadata, owner, relay, space, documentId };
};
const save = (operationId: string, model: string) => ({
  operationId,
  edits: [{ recordId: "settings", replace: { model } }],
});

const capture = async (db: Awaited<ReturnType<typeof createDb>>["db"]) => ({
  documents: await db.select().from(storage_documents),
  owners: await db.select().from(storage_ordered_owners),
  records: await db.select().from(storage_ordered_records),
  operations: await db.select().from(storage_ordered_operations),
  touches: await db.select().from(storage_ordered_touches),
  receipts: await db.select().from(storage_ordered_receipts),
  current: await db.select().from(storage_current_records),
  projections: await db.select().from(storage_record_projections),
});
const restore = async (db: Awaited<ReturnType<typeof createDb>>["db"], backup: Awaited<ReturnType<typeof capture>>) => {
  for (const row of backup.documents) await db.insert(storage_documents).values(row);
  for (const row of backup.owners) await db.insert(storage_ordered_owners).values(row);
  for (const row of backup.records) await db.insert(storage_ordered_records).values(row);
  for (const row of backup.operations) await db.insert(storage_ordered_operations).values(row);
  for (const row of backup.touches) await db.insert(storage_ordered_touches).values(row);
  for (const row of backup.receipts) await db.insert(storage_ordered_receipts).values(row);
  for (const row of backup.projections) await db.insert(storage_record_projections).values(row);
  for (const row of backup.current) await db.insert(storage_current_records).values(row);
};

test("ordered latest states retain an encrypted receipt root instead of an inline history", async () => {
  const f = await fixture();
  const first = await f.device();
  await first.records.commit(save("seed", "small"));
  await first.sync.synchronize();
  const meta = await f.metadata();
  expect(meta).toHaveProperty("receiptRoot");
  expect(meta).not.toHaveProperty("receipts");
  expect(JSON.stringify(meta).length).toBeLessThan(512);
  const root = (meta as unknown as { receiptRoot: { blobId: string } }).receiptRoot;
  expect(f.relay.latest()!.blobIds).toContain(root.blobId);
  const rows = await first.db.select().from(storage_ordered_receipts);
  expect(rows.every((row) => row.indexed)).toBe(true);
});

test("an older pre-admission backup settles a compacted refusal from its exact receipt root", async () => {
  const f = await fixture();
  const writer = await f.device();
  const competing = await f.device();
  await writer.records.commit(save("seed", "small"));
  await writer.sync.synchronize();
  await competing.sync.synchronize();
  const revision = (await writer.records.read("settings")).revision;
  await writer.records.commit({
    operationId: "careful",
    edits: [
      { recordId: "settings", expectedRevision: revision, replace: { model: "careful" } },
      { recordId: "audit", replace: "must not appear" },
    ],
  });
  const backup = await capture(writer.db);
  await competing.records.commit(save("earlier", "large"));
  await competing.sync.synchronize();
  await writer.sync.synchronize();
  expect((await writer.records.outcome("careful"))?.state).toBe("refused");
  f.relay.trim();
  const restored = await f.device();
  await restore(restored.db, backup);
  await restored.db.delete(storage_ordered_receipts);
  const updates = f.relay.requests.updates;
  await restored.sync.synchronize();
  expect((await restored.records.outcome("careful"))?.state).toBe("refused");
  expect((await restored.records.read("audit")).exists).toBe(false);
  expect((await restored.records.read("settings")).value).toEqual({ model: "large" });
  expect(f.relay.requests.updates).toBe(updates);
});

test("after all relay blobs are lost only a full durable receipt graph can found the next order", async () => {
  const f = await fixture();
  const full = await f.device();
  for (let index = 0; index < 17; index++) await full.records.commit(save(`authored-${index}`, `model-${index}`));
  await full.sync.synchronize();
  const meta = await f.metadata();
  if (meta.type !== "meta" || !meta.receiptRoot) throw new Error("Expected a rooted checkpoint");
  expect(f.relay.manifestChildren().get(meta.receiptRoot.blobId)!.length).toBeGreaterThan(0);
  const partial = await f.device();
  await partial.sync.synchronize();
  f.relay.lose();
  f.relay.loseBlobs();
  await expect(partial.restart().synchronize()).rejects.toThrow("Local receipt graph is incomplete");
  expect(f.relay.latest()).toBeNull();
  expect((await partial.records.read("settings")).value).toEqual({ model: "model-16" });
  await full.restart().synchronize();
  expect(f.relay.latest()).not.toBeNull();
  const cold = await f.device();
  await cold.sync.synchronize();
  expect((await cold.records.read("settings")).value).toEqual({ model: "model-16" });
});

test("the encrypted receipt cache survives closing and reopening the full writer database", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ordered-receipt-restart-"));
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  const f = await fixture();
  const first = await f.device(directory);
  await first.records.commit(save("on-disk", "retained"));
  await first.sync.synchronize();
  await first.close();
  f.relay.lose();
  f.relay.loseBlobs();
  const reopened = await f.device(directory);
  await reopened.sync.synchronize();
  const cold = await f.device();
  await cold.sync.synchronize();
  expect((await cold.records.read("settings")).value).toEqual({ model: "retained" });
  expect((await reopened.records.outcome("on-disk"))?.state).toBe("synced");
});

test("a receipt learned while a checkpoint uploads is not marked indexed by that earlier CAS", async () => {
  const f = await fixture();
  const first = await f.device();
  await first.records.commit(save("seed", "small"));
  await first.sync.synchronize();
  const [owner] = await first.db.select().from(storage_ordered_owners);
  const replace = f.relay.relay.replace;
  let replacements = 0;
  f.relay.relay.replace = async (state) => {
    replacements++;
    if (replacements > 1) throw new Error("Later checkpoint paused");
    await withOrderedOwner(first.db, f.owner, (journal) =>
      journal.recordDecision(
        { epoch: owner!.epoch!, operationId: "learned-during-upload", fingerprint: "c".repeat(64), state: "accepted" },
        "d".repeat(64),
      ),
    );
    return replace(state);
  };
  await first.records.commit(save("covered", "large"));
  await expect(first.sync.synchronize()).rejects.toThrow("Later checkpoint paused");
  const cached = await first.db.select().from(storage_ordered_receipts);
  expect(cached.find((row) => row.operation_id === "covered")?.indexed).toBe(true);
  expect(cached.find((row) => row.operation_id === "learned-during-upload")?.indexed).toBe(false);
  expect((await first.records.read("settings")).value).toEqual({ model: "large" });
});

test("founding settles an exact retained old receipt before replaying its immutable envelope", async () => {
  const f = await fixture();
  const author = await f.device();
  await author.records.commit(save("old-save", "old"));
  await author.sync.synchronize();
  const [original] = await author.db.select().from(storage_ordered_operations);
  await author.records.commit(save("later-save", "current"));
  await author.sync.synchronize();
  const recovered = await f.device();
  await recovered.sync.synchronize();
  const { decodeOrderedJson } = await import("./ordered-sql");
  const operation = decodeOrderedJson<import("pstdio-sync/records").OrderedOperation>(original!.envelope!);
  await withOrderedOwner(recovered.db, f.owner, (journal) => journal.queue(operation, original!.request_fingerprint!));
  f.relay.lose();
  f.relay.loseBlobs();
  await recovered.restart().synchronize();
  expect((await recovered.records.read("settings")).value).toEqual({ model: "current" });
  const decision = await withOrderedOwner(recovered.db, f.owner, (journal) => journal.outcome("old-save"));
  expect(decision?.epoch).toBe(
    (await withOrderedOwner(author.db, f.owner, (journal) => journal.outcome("old-save")))?.epoch,
  );
});

test("a caught-up device adopts the current authenticated receipt root with its compaction cursor", async () => {
  const f = await fixture();
  const first = await f.device();
  const second = await f.device();
  await first.records.commit(save("seed", "small"));
  await first.sync.synchronize();
  await second.sync.synchronize();
  const replace = f.relay.relay.replace;
  let holdCompaction = true;
  f.relay.relay.replace = async (state) => (holdCompaction && state.baseStateId !== null ? false : replace(state));
  await first.records.commit(save("changed", "large"));
  await first.sync.synchronize();
  await second.sync.synchronize();
  holdCompaction = false;
  await first.sync.synchronize();
  const current = await f.metadata();
  if (current.type !== "meta") throw new Error("Expected checkpoint metadata");
  await second.restart().synchronize();
  const [row] = await second.db.select().from(storage_ordered_owners);
  const { receiptRoots } = await import("./ordered-receipts-state");
  expect(receiptRoots(row!.receipt_root).published).toEqual(current.receiptRoot);
  expect((await second.records.read("settings")).value).toEqual({ model: "large" });
});

test("a future checkpoint root cannot skip unapplied pages or advance across a disconnected prefix", async () => {
  const f = await fixture();
  const first = await f.device();
  const second = await f.device();
  await first.records.commit(save("seed", "small"));
  await first.sync.synchronize();
  await second.sync.synchronize();
  const [initial] = await second.db.select().from(storage_ordered_owners);
  await first.records.commit(save("first-page", "one"));
  await first.sync.synchronize();
  await first.records.commit(save("second-page", "two"));
  await first.sync.synchronize();
  const read = f.relay.relay.read;
  const interrupted = createRecordStreamSync({
    space: f.space,
    documentId: f.documentId,
    store: second.service.documents.recordStream(f.owner),
    quarantine: async () => {},
    relay: {
      ...f.relay.relay,
      read: async (after) => {
        if (after === 1) throw new Error("Disconnected after the first page");
        const page = await read(after);
        if (page.status === "updates" && page.updates.length > 1)
          return { ...page, updates: page.updates.slice(0, 1), more: true };
        return page;
      },
    },
  });
  await expect(interrupted.synchronize()).rejects.toThrow("Disconnected after the first page");
  const [partial] = await second.db.select().from(storage_ordered_owners);
  const { receiptRoots } = await import("./ordered-receipts-state");
  expect(partial!.after).toBe(1);
  expect(receiptRoots(partial!.receipt_root).stateId).toBe(initial!.state_id);
  expect((await second.records.read("settings")).value).toEqual({ model: "one" });
  await second.restart().synchronize();
  expect((await second.records.read("settings")).value).toEqual({ model: "two" });
  const [complete] = await second.db.select().from(storage_ordered_owners);
  expect(receiptRoots(complete!.receipt_root).stateId).toBe(complete!.state_id);
});
