import { afterEach, expect, test } from "bun:test";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createLegacyRecordStorage, moveCollection, storageRecordId } from "pstdio-sync/records";
import { createRecordStreamSync } from "pstdio-sync/relay";
import { createDb } from "../../db/connection.pglite";
import { projects, records, storage_ordered_operations, owners as storageOwners } from "../../db/schemas.pg";
import { captureDocumentFiles, restoreDocumentBackup } from "./document-history.fixture";
import { createDocumentStorageDBService } from "./document-storage";
import { createRelay } from "./record-stream-relay.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

const peers = async (count = 2, options: { checkpoints?: boolean } = {}) => {
  const projectId = crypto.randomUUID();
  const owner = { workbenchId: projectId, extensionId: "example.tickets" };
  const space = await createSyncSpace({
    projectId,
    spaceOwner: null,
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const documentId = await space.documentId(JSON.stringify([owner.extensionId, "record-stream"]));
  const wire = createRelay();
  const { relay } = wire;
  const device = async () => {
    const { db, close } = await createDb({ path: ":memory:" });
    cleanup.push(close);
    const now = new Date().toISOString();
    await db
      .insert(projects)
      .values({ id: projectId, name: "Tickets", shorthand: "T", created_at: now, updated_at: now });
    const service = createDocumentStorageDBService(db);
    const records = service.open({ owner }).records;
    const sync = createRecordStreamSync({
      space,
      documentId,
      relay,
      store: service.documents.recordStream(owner),
      // Compacting after every update makes a returning device adopt a checkpoint instead of the stream.
      ...(options.checkpoints ? { limits: { bytes: Number.MAX_SAFE_INTEGER, updates: 0 } } : {}),
      quarantine: async (failure) => {
        throw new Error(`Unexpected quarantine: ${JSON.stringify(failure)}`);
      },
    });
    const tickets = createLegacyRecordStorage({ records }).scope("project", projectId).collection("tickets");
    const move = (keyPrefix = "ticket:", pageSize?: number) =>
      moveCollection(records, { scopeType: "project", scopeId: projectId, name: "tickets", keyPrefix, pageSize });
    const record = (id: string, keyPrefix = "ticket:") =>
      records.read(storageRecordId(["project", projectId, "kv"], `${keyPrefix}${id}`));
    const moved = async (id: string) => (await record(id)).value;
    const itemId = (id: string) => storageRecordId(["project", projectId, "collection", "tickets"], id);
    const old = (id: string) => records.read(itemId(id));
    return { db, records, sync, tickets, move, record, moved, old, itemId };
  };
  return Object.assign(await Promise.all(Array.from({ length: count }, device)), { wire });
};
type Device = Awaited<ReturnType<typeof peers>>[number];
const syncAll = async (devices: Device[], rounds = 2) => {
  for (let round = 0; round < rounds; round++) for (const device of devices) await device.sync.synchronize();
};

test("an offline device's old-format write after a synced move reaches the moved record", async () => {
  const [mover, offline] = await peers();
  await mover.tickets.set("a", { title: "A" });
  await mover.sync.synchronize();
  await offline.sync.synchronize();

  await mover.move();
  await offline.tickets.update("a", { title: "A offline" });
  await mover.sync.synchronize();
  // Relay order refuses the offline write at the old address; its author saves it again on the record.
  await offline.sync.synchronize();
  await offline.sync.synchronize();
  await mover.sync.synchronize();

  for (const device of [mover, offline]) {
    expect(await device.moved("a")).toEqual({ title: "A offline" });
    expect(await device.tickets.get("a")).toMatchObject({ value: { title: "A offline" } });
  }
});

test("a move that relay order refuses after a concurrent edit runs again with the edit", async () => {
  const [editor, mover] = await peers();
  await editor.tickets.set("a", { title: "A" });
  await editor.sync.synchronize();
  await mover.sync.synchronize();

  await editor.tickets.update("a", { title: "A edited" });
  await mover.move();
  await editor.sync.synchronize();
  await mover.sync.synchronize();
  await mover.sync.synchronize();
  await editor.sync.synchronize();

  for (const device of [editor, mover]) {
    expect(await device.moved("a")).toEqual({ title: "A edited" });
    expect(await device.tickets.get("a")).toMatchObject({ value: { title: "A edited" } });
  }
});

test("a stale offline write loses to an edit saved on the moved record after the move", async () => {
  const [mover, offline] = await peers();
  await mover.tickets.set("a", { title: "A" });
  await mover.tickets.set("b", { title: "B" });
  await syncAll([mover, offline]);
  await offline.tickets.update("a", { title: "A offline" });
  await offline.tickets.delete("b");
  await mover.move();
  await mover.tickets.update("a", { title: "A after the move" });
  await mover.tickets.update("b", { title: "B after the move" });
  await syncAll([mover, offline], 3);

  for (const device of [mover, offline]) {
    expect(await device.moved("a")).toEqual({ title: "A after the move" });
    expect(await device.moved("b")).toEqual({ title: "B after the move" });
  }
});

test("an item created in the old format by a device that missed the move is moved too", async () => {
  const [mover, offline] = await peers();
  await mover.tickets.set("a", { title: "A" });
  await syncAll([mover, offline]);
  await mover.move();
  await offline.tickets.set("z", { title: "Z offline" });
  await syncAll([mover, offline], 3);

  for (const device of [mover, offline]) {
    expect(await device.moved("z")).toEqual({ title: "Z offline" });
    expect((await device.old("z")).deleted).toBe(true);
  }
});

test("a move by a device that missed another device's marker still moves its items", async () => {
  const [first, second] = await peers();
  await syncAll([first, second]);
  await first.tickets.set("a", { title: "A" });
  await second.move();
  await second.sync.synchronize();
  await first.move();
  await syncAll([first, second], 3);

  for (const device of [first, second]) {
    expect(await device.moved("a")).toEqual({ title: "A" });
    expect((await device.old("a")).deleted).toBe(true);
  }
});

test("a refused first page does not lose writes to items on later pages", async () => {
  const [editor, mover, offline] = await peers(3);
  for (const id of ["a", "b", "c"]) await editor.tickets.set(id, { title: id });
  await syncAll([editor, mover, offline]);
  await editor.tickets.update("a", { title: "a edited" });
  // Pages of two put "c" in a second group that relay order accepts after refusing the first.
  await mover.move("ticket:", 2);
  await offline.tickets.update("c", { title: "c offline" });
  await editor.sync.synchronize();
  await syncAll([mover, offline, editor], 3);

  for (const device of [editor, mover, offline]) {
    expect(await device.moved("a")).toEqual({ title: "a edited" });
    expect(await device.moved("b")).toEqual({ title: "b" });
    expect(await device.moved("c")).toEqual({ title: "c offline" });
  }
});

test("a move whose target another device took leaves the item in place and keeps syncing", async () => {
  const [editor, mover] = await peers();
  await editor.tickets.set("x", { title: "X" });
  await syncAll([editor, mover]);
  // An unrelated record takes the address the move would use.
  await editor.records.commit({
    operationId: crypto.randomUUID(),
    edits: [{ recordId: (await editor.record("x")).recordId, replace: { title: "Other record" } }],
  });
  await editor.sync.synchronize();
  await mover.move();
  await syncAll([mover, editor], 3);

  for (const device of [editor, mover]) {
    expect(await device.moved("x")).toEqual({ title: "Other record" });
    expect((await device.old("x")).value).toEqual({ value: { title: "X" }, sortOrder: null });
    expect(await device.tickets.get("x")).toMatchObject({ value: { title: "X" } });
  }
});

test("a write to the record a refused move created follows the item to its moved record", async () => {
  const [editor, mover] = await peers();
  await editor.tickets.set("x", { title: "X" });
  await syncAll([editor, mover]);
  await editor.tickets.update("x", { title: "X edited" });
  await editor.sync.synchronize();
  await mover.move();
  await mover.records.commit({
    operationId: crypto.randomUUID(),
    edits: [{ recordId: (await mover.record("x")).recordId, replace: { title: "X new code" } }],
  });
  await syncAll([mover, editor], 3);

  for (const device of [editor, mover]) {
    expect(await device.moved("x")).toEqual({ title: "X new code" });
    expect((await device.old("x")).deleted).toBe(true);
  }
});

test("two devices that move under different key prefixes end with every item under the winning prefix", async () => {
  const [first, second] = await peers();
  await first.tickets.set("a", { title: "A" });
  await first.tickets.set("b", { title: "B" });
  await syncAll([first, second]);
  await first.move("ticket:");
  await second.move("item:");
  await syncAll([first, second], 3);

  for (const device of [first, second]) {
    for (const id of ["a", "b"]) {
      expect((await device.record(id, "ticket:")).value).toEqual({ title: id.toUpperCase() });
      expect(await device.tickets.get(id)).toMatchObject({ value: { title: id.toUpperCase() } });
    }
    expect((await device.record("a", "item:")).exists && !(await device.record("a", "item:")).deleted).toBe(false);
  }
});

// Copies a device's ordered storage, without receipts, as a backup taken before its pending save uploaded.
const tables = [records, storage_ordered_operations] as const;
const copyStorage = async (from: Device["db"], to: Device["db"]) => {
  const files = await captureDocumentFiles(from);
  await to.transaction(async (tx) => {
    const ownerIds = new Map<number, number>();
    for (const { id, ...fields } of await from.select().from(storageOwners)) {
      const [copied] = await tx.insert(storageOwners).values(fields).returning({ id: storageOwners.id });
      ownerIds.set(id, copied!.id);
    }
    for (const table of tables)
      for (const row of await from.select().from(table)) {
        const copy = "owner_id" in row ? { ...row, owner_id: ownerIds.get(row.owner_id) } : row;
        // This backup predates receipt capture, even though the facts now share one row.
        if (table === storage_ordered_operations)
          Object.assign(copy, { receipt: {}, receipt_epoch: null, receipt_indexed: true });
        await tx.insert(table).values(copy as never);
      }
    await restoreDocumentBackup(tx, files, ownerIds);
  });
};

test("an offline write that a compacted checkpoint refuses still reaches the moved record", async () => {
  const devices = await peers(3, { checkpoints: true });
  const [mover, offline, restored] = devices;
  await mover.tickets.set("a", { title: "A" });
  await syncAll([mover, offline]);
  await offline.tickets.update("a", { title: "A offline" });
  await copyStorage(offline.db, restored.db);
  await mover.move();
  await mover.sync.synchronize();
  // The offline device uploads its save, which relay order refuses.
  await offline.sync.synchronize();
  devices.wire.trim();
  // A copy from before the upload learns that refusal only from the compacted checkpoint, which
  // settles it without the stream path, and must forward the write itself.
  const copied = new Set((await restored.db.select().from(storage_ordered_operations)).map((row) => row.operation_id));
  await restored.sync.synchronize();
  const authored = (await restored.db.select().from(storage_ordered_operations)).filter(
    (row) => !copied.has(row.operation_id) && !row.operation_id.startsWith("move:"),
  );
  expect(authored.length).toBeGreaterThan(0);
  await syncAll([restored, mover], 3);

  for (const device of [mover, restored]) expect(await device.moved("a")).toEqual({ title: "A offline" });
});

test("edits a device makes to items it moved itself survive when another device's move wins", async () => {
  const [first, second] = await peers();
  await first.tickets.set("a", { title: "A" });
  await syncAll([first, second]);
  // Offline from each other: the second device creates two items, then both devices move.
  await second.tickets.set("d", { title: "D" });
  await second.tickets.set("e", { title: "E", status: "open" });
  await first.move();
  await second.move();
  const d = await second.record("d");
  await second.records.commitIfCurrent({
    operationId: crypto.randomUUID(),
    edits: [{ recordId: d.recordId, expectedRevision: d.revision, replace: { title: "D edited" } }],
  });
  const e = await second.record("e");
  await second.records.commit({
    operationId: crypto.randomUUID(),
    edits: [{ recordId: e.recordId, observedRevision: e.revision, replace: { title: "E edited", status: "open" } }],
  });
  await syncAll([first, second], 4);

  for (const device of [first, second]) {
    expect(await device.moved("a")).toEqual({ title: "A" });
    expect(await device.moved("d")).toEqual({ title: "D edited" });
    expect(await device.moved("e")).toEqual({ title: "E edited", status: "open" });
    // The item lives at one address: the old-format API sees the moved, edited record.
    expect((await device.old("e")).deleted).toBe(true);
    expect(await device.tickets.get("e")).toMatchObject({ value: { title: "E edited", status: "open" } });
  }
});
