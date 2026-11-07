import { afterEach, expect, test } from "bun:test";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createRecordStreamSync } from "pstdio-sync/relay";
import type { Json } from "pstdio-sync-contracts";
import { createDb } from "../../db/connection.pglite";
import { storage_ordered_operations as operations, projects } from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { createOrderedCloudReturn } from "./ordered-cloud-return";
import { orderedReturnLimits, readOrderedReturnState } from "./ordered-return";
import { createRelay } from "./record-stream-relay.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

const network = async (count: number) => {
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
    const sync = createRecordStreamSync({
      space,
      documentId,
      relay,
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
    const save = (recordId: string, edit: { set?: Record<string, Json>; deleted?: boolean; replace?: Json }) =>
      records.commit({ operationId: crypto.randomUUID(), edits: [{ recordId, ...edit }] });
    const value = async (recordId: string) => {
      const record = await records.read(recordId);
      return record.deleted || !record.exists ? undefined : record.value;
    };
    return { db, service, sync, failures, pending, save, value, state: () => readOrderedReturnState(db, owner) };
  };
  const devices: Awaited<ReturnType<typeof device>>[] = [];
  for (let index = 0; index < count; index += 1) devices.push(await device());
  const syncAll = async () => {
    for (let round = 0; round < 2; round += 1) for (const each of devices) await each.sync.synchronize();
  };
  return { devices, syncAll, projectId, owner };
};

const snapshot = async (device: { value: (id: string) => Promise<unknown> }, ids: string[]) =>
  Object.fromEntries(await Promise.all(ids.map(async (id) => [id, (await device.value(id)) ?? null])));

test("three devices with interleaved away edits and deletions converge and keep in-sync work", async () => {
  const { devices, syncAll } = await network(3);
  const [away, offline, online] = devices as [(typeof devices)[0], (typeof devices)[0], (typeof devices)[0]];
  const seed: Record<string, Json> = { R1: { t: "0", s: "0" }, R2: { t: "0" }, R3: { t: "0" }, R4: { t: "0" } };
  for (const [id, value] of Object.entries(seed))
    await online.save(id, { replace: value });
  await syncAll();

  // Away signs out and keeps editing.
  await away.service.cloudReturn.signOut();
  await away.save("R1", { set: { "/t": "A" } });
  await away.save("R2", { deleted: true });
  await away.save("R3", { set: { "/t": "A" } });
  await away.save("R4", { set: { "/s": "A" } });
  // Offline stays signed in but does not sync.
  await offline.save("R1", { set: { "/t": "B", "/s": "B" } });
  await offline.save("R3", { deleted: true });
  await offline.save("R2", { set: { "/t": "B" } });
  // Online keeps working.
  await online.save("R1", { set: { "/s": "C" } });
  await online.sync.synchronize();
  // Offline returns first, then Away.
  await offline.sync.synchronize();
  await online.sync.synchronize();
  await away.sync.synchronize();
  await syncAll();

  const ids = ["R1", "R2", "R3", "R4"];
  const expected = { R1: { t: "B", s: "C" }, R2: { t: "B" }, R3: null, R4: { t: "0", s: "A" } };
  for (const device of devices) {
    expect(await snapshot(device, ids)).toEqual(expected);
    expect(device.failures).toEqual([]);
  }
});

test("re-signing into the original account after a release never overrides in-sync devices", async () => {
  const { devices, syncAll, projectId } = await network(2);
  const [laptop, desktop] = devices as [(typeof devices)[0], (typeof devices)[0]];
  await desktop.save("PS-1", { replace: { title: "A", status: "Todo" } });
  await desktop.save("PS-2", { replace: { title: "Two" } });
  await syncAll();
  // Laptop signs in to another account whose project list lacks this project: it becomes local.
  await laptop.service.cloudReturn.release([crypto.randomUUID()]);
  // Desktop keeps working meanwhile.
  await desktop.save("PS-1", { set: { "/status": "Done" } });
  await desktop.save("PS-2", { deleted: true });
  await desktop.sync.synchronize();
  // Laptop signs back in to the original account, which still syncs this project. It touched nothing.
  await laptop.service.cloudReturn.release([projectId]);
  await syncAll();
  // Both devices, read together, so a divergence and an override are told apart.
  expect({
    laptop: await snapshot(laptop, ["PS-1", "PS-2"]),
    desktop: await snapshot(desktop, ["PS-1", "PS-2"]),
  }).toEqual({
    laptop: { "PS-1": { title: "A", status: "Done" }, "PS-2": null },
    desktop: { "PS-1": { title: "A", status: "Done" }, "PS-2": null },
  });
  for (const device of [laptop, desktop]) {
    expect(await device.value("PS-1")).toEqual({ title: "A", status: "Done" });
    expect(await device.value("PS-2")).toBeUndefined();
  }
});

test("a crash between sign-out fold pages loses nothing and the next sign-out finishes folding", async () => {
  const { devices, syncAll, owner } = await network(2);
  const [laptop, desktop] = devices as [(typeof devices)[0], (typeof devices)[0]];
  await desktop.save("seed", { replace: { title: "seed" } });
  await syncAll();
  // 450 unsent single-record saves span three fold pages of 200 records; two saves per record for 50 of them.
  const count = 450;
  for (let index = 0; index < count; index += 1) await laptop.save(`R${index}`, { replace: { n: index } });
  for (let index = 0; index < 50; index += 1) await laptop.save(`R${index}`, { set: { "/n": index + 1000 } });
  expect(await laptop.pending()).toBe(count + 50);
  // Crash on the third transaction: marker + first page commit, the second page never does.
  let transactions = 0;
  const crashing = new Proxy(laptop.db, {
    get(target, key, receiver) {
      if (key === "transaction")
        return (...args: unknown[]) => {
          transactions += 1;
          if (transactions === 3) throw new Error("Simulated crash");
          return (target.transaction as (...input: unknown[]) => unknown)(...args);
        };
      return Reflect.get(target, key, receiver);
    },
  });
  await expect(createOrderedCloudReturn(crashing as never, { changed: () => {} }).signOut()).rejects.toThrow();
  expect(await laptop.state()).toBe("signed-out");
  const partial = await laptop.pending();
  expect(partial).toBeLessThan(count + 50);
  expect(partial).toBeGreaterThan(count);
  for (const index of [0, 49, 50, 449])
    expect(await laptop.value(`R${index}`)).toEqual({ n: index < 50 ? index + 1000 : index });
  // Restart: still signed out, so the account refresh signs out again.
  await laptop.service.cloudReturn.signOut();
  expect(await laptop.pending()).toBe(count);
  for (const index of [0, 49, 50, 449])
    expect(await laptop.value(`R${index}`)).toEqual({ n: index < 50 ? index + 1000 : index });
  // Signing back in: 450 created records exceed the hold limit, so apply first.
  await laptop.service.cloudReturn.release([owner.workbenchId]);
  await syncAll();
  if ((await laptop.state()) === "held") await laptop.service.cloudReturn.apply(owner.workbenchId);
  await syncAll();
  expect(await laptop.pending()).toBe(0);
  for (const index of [0, 49, 50, 449])
    expect(await desktop.value(`R${index}`)).toEqual({ n: index < 50 ? index + 1000 : index });
}, 120_000);

test("a device that never left is not held for review after a burst of saves", async () => {
  const { devices, syncAll } = await network(2);
  const [laptop, desktop] = devices as [(typeof devices)[0], (typeof devices)[0]];
  await desktop.save("seed", { replace: { title: "seed" } });
  await syncAll();
  const limits = { ...orderedReturnLimits };
  // Same ratio as production (fold 1,000 saves, hold over 500 records), scaled down.
  orderedReturnLimits.fold = 10;
  orderedReturnLimits.records = 5;
  try {
    // An online, signed-in device imports records faster than its uploader drains them.
    for (let index = 0; index < 12; index += 1) await laptop.save(`import-${index}`, { replace: { n: index } });
    await syncAll();
    expect(await laptop.state()).toBeNull();
    expect(await desktop.value("import-11")).toEqual({ n: 11 });
  } finally {
    Object.assign(orderedReturnLimits, limits);
  }
});

test("production limits: 1,001 quick saves on an online device are not held for review", async () => {
  const { devices, syncAll } = await network(2);
  const [laptop, desktop] = devices as [(typeof devices)[0], (typeof devices)[0]];
  await desktop.save("seed", { replace: { title: "seed" } });
  await syncAll();
  for (let index = 0; index <= orderedReturnLimits.fold; index += 1)
    await laptop.save(`import-${index}`, { replace: { n: index } });
  await laptop.sync.synchronize();
  expect(await laptop.state()).toBeNull();
}, 300_000);
