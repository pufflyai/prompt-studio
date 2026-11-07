import { afterEach, expect, test } from "bun:test";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createRecordStreamSync } from "pstdio-sync/relay";
import type { Json } from "pstdio-sync-contracts";
import { createDb } from "../../db/connection.pglite";
import { storage_ordered_operations as operations, projects } from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { orderedReturnLimits, readOrderedReturnState } from "./ordered-return";
import { createRelay } from "./record-stream-relay.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

/** Laptop leaves and returns; Desktop stays signed in and online. */
const devices = async () => {
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
      .values({ id: projectId, name: "Tickets", shorthand: "PS", created_at: now, updated_at: now });
    const service = createDocumentStorageDBService(db);
    const records = service.open({ owner }).records;
    const failures: unknown[] = [];
    // Simulates a relay that accepts an upload but whose answer, or the next read, never arrives.
    const network = { loseAcknowledgement: false, failReads: false, failReadsAfterUpload: false };
    const sync = createRecordStreamSync({
      space,
      documentId,
      relay: {
        ...relay,
        read: async (...input: Parameters<typeof relay.read>) => {
          if (network.failReads) throw new Error("Offline");
          return relay.read(...input);
        },
        update: async (...input: Parameters<typeof relay.update>) => {
          const result = await relay.update(...input);
          if (network.loseAcknowledgement) throw new Error("Acknowledgement lost");
          network.failReads = network.failReadsAfterUpload;
          return result;
        },
      },
      store: service.documents.recordStream(owner),
      quarantine: async (failure) => {
        failures.push(failure);
      },
    });
    const pending = async () => {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(operations)
        .where(
          and(eq(operations.workbench_id, projectId), isNotNull(operations.envelope), isNull(operations.settled_epoch)),
        );
      return row!.count;
    };
    const state = () => readOrderedReturnState(db, owner);
    const save = (recordId: string, edit: { set?: Record<string, Json>; deleted?: boolean; replace?: Json }) =>
      records.commit({ operationId: crypto.randomUUID(), edits: [{ recordId, ...edit }] });
    const value = async (recordId: string) => {
      const record = await records.read(recordId);
      return record.deleted || !record.exists ? undefined : record.value;
    };
    return {
      db,
      service,
      records,
      sync,
      failures,
      network,
      pending,
      state,
      save,
      value,
      status: () => service.cloudReturn.status(projectId),
    };
  };
  const laptop = await device();
  const desktop = await device();
  const sync = async () => {
    await laptop.sync.synchronize();
    await desktop.sync.synchronize();
    await laptop.sync.synchronize();
  };
  return { laptop, desktop, sync, projectId };
};

const seeded = async (tickets: Record<string, Json>) => {
  const pair = await devices();
  for (const [id, value] of Object.entries(tickets)) await pair.desktop.save(id, { replace: value });
  await pair.desktop.sync.synchronize();
  await pair.laptop.sync.synchronize();
  return pair;
};

test("signing out keeps every edit, folds unsent saves and keeps one pending save per record", async () => {
  const { laptop, desktop, sync } = await seeded({
    "PS-1": { title: "Seed", status: "Todo" },
    "PS-3": { title: "Three" },
  });
  // An edit still waiting to upload when the laptop signs out.
  await laptop.save("PS-3", { set: { "/title": "Renamed" } });
  await laptop.service.cloudReturn.signOut();
  expect(await laptop.state()).toBe("signed-out");
  for (let index = 0; index < 30; index += 1) await laptop.save("PS-1", { set: { "/title": `Laptop ${index}` } });
  await laptop.save("PS-3", { set: { "/assignee": "Ben" } });
  expect(await laptop.pending()).toBe(2);
  expect(await laptop.value("PS-1")).toEqual({ title: "Laptop 29", status: "Todo" });
  const away = await laptop.status();
  expect(away.state).toBe("signed-out");
  expect(away.changed.total).toBe(2);
  expect(away.changed.records.map((record) => [record.recordId, record.fields])).toEqual(
    expect.arrayContaining([
      ["PS-1", ["/title"]],
      ["PS-3", ["/assignee", "/title"]],
    ]),
  );
  // Signing back in: the device connects, nothing is held, and only changed fields upload.
  await desktop.save("PS-1", { set: { "/status": "Done" } });
  await desktop.sync.synchronize();
  await sync();
  for (const device of [laptop, desktop]) {
    expect(await device.value("PS-1")).toEqual({ title: "Laptop 29", status: "Done" });
    expect(await device.value("PS-3")).toEqual({ title: "Renamed", assignee: "Ben" });
    expect(device.failures).toEqual([]);
  }
  expect(await laptop.state()).toBeNull();
  expect(await laptop.pending()).toBe(0);
});

test("the same field changed on both devices keeps the in-sync value and tells the returning device", async () => {
  const { laptop, desktop, sync } = await seeded({ "PS-2": { title: "Export", assignee: "Ann" } });
  await laptop.service.cloudReturn.signOut();
  await laptop.save("PS-2", { set: { "/assignee": "Cara" } });
  await desktop.save("PS-2", { set: { "/assignee": "Dev" } });
  await desktop.sync.synchronize();
  await sync();
  for (const device of [laptop, desktop])
    expect(await device.value("PS-2")).toEqual({ title: "Export", assignee: "Dev" });
  const back = await laptop.status();
  expect(back.state).toBeNull();
  expect(back.replaced.records).toMatchObject([
    { recordId: "PS-2", fields: ["/assignee"], whole: false, deleted: false },
  ]);
  expect((await desktop.status()).replaced.total).toBe(0);
  await laptop.service.cloudReturn.dismissReplaced((await laptop.db.select().from(projects))[0]!.id);
  expect((await laptop.status()).replaced.total).toBe(0);
});

test("a device that stayed signed in but offline returns under the same rule", async () => {
  const { laptop, desktop, sync } = await seeded({ "PS-2": { assignee: "Ann" } });
  await laptop.save("PS-2", { set: { "/assignee": "Cara" } });
  await desktop.save("PS-2", { set: { "/assignee": "Dev" } });
  await desktop.sync.synchronize();
  await sync();
  for (const device of [laptop, desktop]) expect(await device.value("PS-2")).toEqual({ assignee: "Dev" });
});

test("deletions follow the in-sync devices in both directions", async () => {
  const { laptop, desktop, sync } = await seeded({
    "PS-2": { title: "Two" },
    "PS-3": { title: "Three", status: "Todo" },
  });
  await laptop.service.cloudReturn.signOut();
  await laptop.save("PS-2", { set: { "/title": "Renamed" } });
  await laptop.save("PS-3", { deleted: true });
  await desktop.save("PS-2", { deleted: true });
  await desktop.save("PS-3", { set: { "/status": "Done" } });
  await desktop.sync.synchronize();
  await sync();
  for (const device of [laptop, desktop]) {
    expect(await device.value("PS-2")).toBeUndefined();
    expect(await device.value("PS-3")).toEqual({ title: "Three", status: "Done" });
  }
  expect((await laptop.status()).replaced.records).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ recordId: "PS-2", whole: true, deleted: false }),
      expect.objectContaining({ recordId: "PS-3", whole: true, deleted: true }),
    ]),
  );
});

test("a return with mass deletions waits for review; discarding takes Cloud's copy", async () => {
  const tickets = { "PS-1": { title: "One" }, "PS-2": { title: "Two" }, "PS-3": { title: "Three" } };
  const { laptop, desktop, sync } = await seeded(tickets);
  await laptop.service.cloudReturn.signOut();
  for (const id of Object.keys(tickets)) await laptop.save(id, { deleted: true });
  await desktop.save("PS-1", { set: { "/title": "Edited" } });
  await desktop.sync.synchronize();
  await sync();
  expect(await laptop.state()).toBe("held");
  const held = await laptop.status();
  expect(held.state).toBe("held");
  expect(held.changed).toMatchObject({ total: 3, deletions: 3 });
  // Nothing uploaded: the desktop still has every ticket.
  expect(await desktop.value("PS-2")).toEqual({ title: "Two" });
  // Remote changes still arrive while held. The held deletion of a ticket Desktop edited already loses.
  expect(await laptop.value("PS-1")).toEqual({ title: "Edited" });
  expect(await laptop.value("PS-2")).toBeUndefined();
  await laptop.service.cloudReturn.discard((await laptop.db.select().from(projects))[0]!.id);
  expect(await laptop.state()).toBeNull();
  expect(await laptop.value("PS-1")).toEqual({ title: "Edited" });
  expect(await laptop.value("PS-3")).toEqual({ title: "Three" });
  await laptop.save("PS-3", { set: { "/title": "Synced again" } });
  await sync();
  expect(await desktop.value("PS-3")).toEqual({ title: "Synced again" });
});

test("applying a held return uploads it under the in-sync rule", async () => {
  const tickets = { "PS-1": { title: "One" }, "PS-2": { title: "Two" }, "PS-3": { title: "Three" } };
  const { laptop, desktop, sync, projectId } = await seeded(tickets);
  await laptop.service.cloudReturn.signOut();
  for (const id of Object.keys(tickets)) await laptop.save(id, { deleted: true });
  await desktop.save("PS-1", { set: { "/title": "Edited" } });
  await desktop.sync.synchronize();
  await sync();
  expect(await laptop.state()).toBe("held");
  expect(await laptop.service.cloudReturn.apply(projectId)).toBe(true);
  await sync();
  for (const device of [laptop, desktop]) {
    expect(await device.value("PS-1")).toEqual({ title: "Edited" });
    expect(await device.value("PS-2")).toBeUndefined();
    expect(await device.value("PS-3")).toBeUndefined();
  }
});

test("a long offline period folds the queue at the limit and still keeps in-sync values", async () => {
  const { laptop, desktop, sync } = await seeded({ "PS-1": { status: "In Review" }, "PS-2": { title: "Two" } });
  const limit = orderedReturnLimits.fold;
  orderedReturnLimits.fold = 10;
  try {
    for (let index = 0; index <= 10; index += 1)
      await laptop.save(index % 2 ? "PS-2" : "PS-3", { set: { "/count": index } });
    await laptop.save("PS-1", { set: { "/status": "Done" } });
    expect(await laptop.state()).toBe("folded");
    expect(await laptop.pending()).toBe(3);
    await laptop.save("PS-1", { set: { "/status": "Done again" } });
    expect(await laptop.pending()).toBe(3);
  } finally {
    orderedReturnLimits.fold = limit;
  }
  await desktop.save("PS-1", { set: { "/status": "Todo" } });
  await desktop.sync.synchronize();
  await sync();
  expect(await laptop.state()).toBeNull();
  for (const device of [laptop, desktop]) {
    expect(await device.value("PS-1")).toEqual({ status: "Todo" });
    expect(await device.value("PS-2")).toEqual({ title: "Two", count: 9 });
    expect(await device.value("PS-3")).toEqual({ count: 10 });
  }
});

test("a project the signed-in account does not sync stays local with every edit", async () => {
  const { laptop, desktop, sync, projectId } = await seeded({ "PS-1": { title: "Personal" } });
  await laptop.service.cloudReturn.signOut();
  await laptop.save("PS-1", { set: { "/title": "Edited while signed out" } });
  await laptop.service.cloudReturn.release([crypto.randomUUID()]);
  expect(await laptop.pending()).toBe(0);
  expect(await laptop.state()).toBeNull();
  expect(await laptop.value("PS-1")).toEqual({ title: "Edited while signed out" });
  expect((await laptop.status()).state).toBeNull();
  await laptop.save("PS-1", { set: { "/title": "Local" } });
  expect(await laptop.pending()).toBe(0);
  await desktop.sync.synchronize();
  expect(await desktop.value("PS-1")).toEqual({ title: "Personal" });
  // A project the account still syncs is left alone.
  await desktop.service.cloudReturn.release([projectId]);
  await desktop.save("PS-1", { set: { "/title": "Desktop" } });
  expect(await desktop.pending()).toBe(1);
  await sync();
});

test("reverting a save whose upload reached Cloud without an answer still wins after folding", async () => {
  const { laptop, desktop, sync } = await seeded({ "PS-1": { title: "A" } });
  laptop.network.loseAcknowledgement = true;
  await laptop.save("PS-1", { set: { "/title": "B" } });
  await laptop.sync.synchronize().catch(() => {});
  laptop.network.loseAcknowledgement = false;
  await laptop.save("PS-1", { set: { "/title": "A" } });
  await laptop.service.cloudReturn.signOut();
  await sync();
  for (const device of [laptop, desktop]) expect(await device.value("PS-1")).toEqual({ title: "A" });
});

test("deleting a record whose creation was delivered but not yet confirmed still deletes it", async () => {
  const { laptop, desktop, sync } = await seeded({ "PS-1": { title: "A" } });
  laptop.network.failReadsAfterUpload = true;
  await laptop.save("PS-9", { replace: { title: "New" } });
  await laptop.sync.synchronize().catch(() => {});
  laptop.network.failReadsAfterUpload = false;
  laptop.network.failReads = false;
  await laptop.save("PS-9", { deleted: true });
  await laptop.service.cloudReturn.signOut();
  await sync();
  for (const device of [laptop, desktop]) expect(await device.value("PS-9")).toBeUndefined();
});

test("an edit made while held after seeing another device's change wins over that change", async () => {
  const tickets = { "PS-1": { title: "A" }, "PS-2": { title: "Two" }, "PS-3": { title: "Three" }, "PS-4": {} };
  const { laptop, desktop, sync, projectId } = await seeded(tickets);
  await laptop.service.cloudReturn.signOut();
  await laptop.save("PS-1", { set: { "/title": "Laptop" } });
  for (const id of ["PS-2", "PS-3", "PS-4"]) await laptop.save(id, { deleted: true });
  await desktop.save("PS-1", { set: { "/title": "Desktop" } });
  await desktop.sync.synchronize();
  await sync();
  expect(await laptop.state()).toBe("held");
  expect(await laptop.value("PS-1")).toEqual({ title: "Desktop" });
  await laptop.save("PS-1", { set: { "/title": "Laptop after seeing Desktop" } });
  expect(await laptop.value("PS-1")).toEqual({ title: "Laptop after seeing Desktop" });
  await laptop.service.cloudReturn.apply(projectId);
  await sync();
  for (const device of [laptop, desktop])
    expect(await device.value("PS-1")).toEqual({ title: "Laptop after seeing Desktop" });
});

test("signing in again stops reporting signed-out changes for a project that has not reconnected", async () => {
  const { laptop, projectId } = await seeded({ "PS-1": { title: "A" } });
  await laptop.service.cloudReturn.signOut();
  await laptop.save("PS-1", { set: { "/title": "B" } });
  expect((await laptop.status()).state).toBe("signed-out");
  await laptop.service.cloudReturn.release([projectId]);
  expect(await laptop.state()).toBe("folded");
  expect((await laptop.status()).state).toBeNull();
  await laptop.save("PS-1", { set: { "/title": "C" } });
  expect(await laptop.pending()).toBe(1);
});
