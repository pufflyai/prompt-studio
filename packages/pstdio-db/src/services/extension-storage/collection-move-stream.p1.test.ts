import { afterEach, expect, test } from "bun:test";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createLegacyRecordStorage, moveCollection, storageRecordId } from "pstdio-sync/records";
import { createRecordStreamSync } from "pstdio-sync/relay";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { createRelay } from "./record-stream-relay.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

const peers = async (count = 2) => {
  const projectId = crypto.randomUUID();
  const owner = { workbenchId: projectId, extensionId: "example.tickets" };
  const space = await createSyncSpace({
    projectId,
    spaceOwner: null,
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const documentId = await space.documentId(JSON.stringify([owner.extensionId, "record-stream"]));
  const { relay } = createRelay();
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
      quarantine: async (failure) => {
        throw new Error(`Unexpected quarantine: ${JSON.stringify(failure)}`);
      },
    });
    const tickets = createLegacyRecordStorage({ records }).scope("project", projectId).collection("tickets");
    const move = () =>
      moveCollection(records, { scopeType: "project", scopeId: projectId, name: "tickets", keyPrefix: "ticket:" });
    const record = (id: string) => records.read(storageRecordId(["project", projectId, "kv"], `ticket:${id}`));
    const moved = async (id: string) => (await record(id)).value;
    const old = (id: string) => records.read(storageRecordId(["project", projectId, "collection", "tickets"], id));
    return { records, sync, tickets, move, record, moved, old };
  };
  return Promise.all(Array.from({ length: count }, device));
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
  for (let index = 0; index < 101; index++)
    await editor.tickets.set(`a${String(index).padStart(3, "0")}`, { n: index });
  await syncAll([editor, mover, offline]);
  await editor.tickets.update("a000", { n: "edited" });
  await mover.move();
  await offline.tickets.update("a100", { n: "offline" });
  await editor.sync.synchronize();
  await syncAll([mover, offline, editor], 3);

  for (const device of [editor, mover, offline]) {
    expect(await device.moved("a000")).toEqual({ n: "edited" });
    expect(await device.moved("a100")).toEqual({ n: "offline" });
  }
});

test("a refused move whose target was written meanwhile leaves the item in place and keeps syncing", async () => {
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
    expect((await device.old("x")).value).toEqual({ value: { title: "X edited" }, sortOrder: null });
  }
});
