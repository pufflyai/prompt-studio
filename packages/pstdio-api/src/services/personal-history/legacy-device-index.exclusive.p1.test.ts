import { afterAll, afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb, createExtensionStorageDBService, projects } from "pstdio-db";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createSessionLogFiles } from "./log-files";
import { logRelayFixture } from "./log-transport.fixture";
import { createPersonalHistoryStore } from "./store";

const root = await mkdtemp(join(tmpdir(), "index-log-"));
afterAll(() => rm(root, { recursive: true, force: true }));
const space = await createSyncSpace({
  projectId: "project",
  spaceOwner: "alice",
  keys: [{ generation: 1, secret: "A".repeat(43) }],
});
const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
});
const store = async (folder: string) => {
  const path = join(root, folder);
  await mkdir(path, { recursive: true });
  const connection = await createDb({ path: join(path, "database") });
  let closed = false;
  const close = async () => {
    if (!closed) {
      closed = true;
      await connection.close();
    }
  };
  cleanup.push(close);
  const now = new Date().toISOString();
  await connection.db
    .insert(projects)
    .values({ id: "project", name: "Private index", shorthand: "P", created_at: now, updated_at: now })
    .onConflictDoNothing();
  const storage = createExtensionStorageDBService(connection.db);
  const history = createPersonalHistoryStore({
    projectId: "project",
    accountId: "alice",
    managerOrigin: "https://manager.example",
    documents: storage.documents,
    files: createSessionLogFiles(path),
    index: storage.personalHistoryIndex,
    logs: storage.logs,
  });
  return Object.assign(history, {
    device: { ownerId: "alice", id: await storage.logs.writerId(), name: "Laptop" },
    close,
  });
};

test("a device index appends only changed rows and readers resume from their durable cursor", async () => {
  const source = await store("source");
  const device = source.device;
  const peer = logRelayFixture();
  const rows = Array.from({ length: 2000 }, (_, index) => ({ id: String(index), title: "Saved" }));
  await source.writeRecords("sessions", device, rows);
  await source.synchronizeIndex(device.id, true, space, peer.relay);
  const initial = [...peer.updates.values()].flat().length;
  rows[1000] = { id: "1000", title: "Changed" };
  await source.writeRecords("sessions", device, rows);
  await source.synchronizeIndex(device.id, true, space, peer.relay);
  expect([...peer.updates.values()].flat()).toHaveLength(initial + 1);
  const destination = await store("reader");
  await destination.synchronizeIndex(device.id, false, space, peer.relay);
  expect(await destination.readRecords("sessions")).toHaveLength(2000);
  expect((await destination.readRecords("sessions")).find((row) => row.id === "1000")?.title).toBe("Changed");
  await destination.close();
  const restarted = await store("reader");
  await restarted.synchronizeIndex(device.id, false, space, peer.relay);
  expect(peer.reads.at(-1)).toBe(initial + 1);
  await source.writeRecords("sessions", device, rows.slice(1));
  await source.writeHeads(new Map([["1000", 7]]));
  await source.synchronizeIndex(device.id, true, space, peer.relay);
  await restarted.synchronizeIndex(device.id, false, space, peer.relay);
  expect(await restarted.readRecords("sessions")).toHaveLength(1999);
  expect(await restarted.readHeads()).toEqual(new Map([["1000", 7]]));
});

test("publishing one device keeps another device's pending rows in its own log", async () => {
  const source = await store("partitioned-source");
  const second = await store("partitioned-second");
  const peer = logRelayFixture();
  await source.patchRecords("sessions", source.device, [{ id: "laptop-session", title: "Laptop" }]);
  await second.patchRecords("sessions", second.device, [{ id: "desktop-session", title: "Desktop" }]);
  await source.synchronizeIndex(source.device.id, true, space, peer.relay);
  const reader = await store("partitioned-reader");
  await reader.synchronizeIndex(source.device.id, false, space, peer.relay);
  expect((await reader.readRecords("sessions")).map((row) => row.id)).toEqual(["laptop-session"]);
  expect(await second.indexPending()).toBe(true);
  await second.synchronizeIndex(second.device.id, true, space, peer.relay);
  await reader.synchronizeIndex(second.device.id, false, space, peer.relay);
  expect((await reader.readRecords("sessions")).map((row) => row.id).sort()).toEqual([
    "desktop-session",
    "laptop-session",
  ]);
  expect(await source.indexPending()).toBe(false);
  expect(await second.indexPending()).toBe(false);
  await source.patchRecords("sessions", source.device, [], ["laptop-session"]);
  await source.synchronizeIndex(source.device.id, true, space, peer.relay);
  await reader.synchronizeIndex(source.device.id, false, space, peer.relay);
  expect((await reader.readRecords("sessions")).map((row) => row.id)).toEqual(["desktop-session"]);
});

test("a fresh reader starts from the device snapshot and keeps the newer tail and other devices' rows", async () => {
  const startedAt = performance.now();
  const trace = (phase: string, published?: number) => {
    process.stderr.write(
      `${JSON.stringify({ event: "personal-history.snapshot-test.phase", phase, published, elapsedMs: performance.now() - startedAt })}\n`,
    );
  };
  trace("open-source");
  const source = await store("snapshot-source");
  const device = source.device;
  const peer = logRelayFixture();
  trace("publish", 0);
  for (let index = 0; index < 1000; index++) {
    await source.patchRecords("sessions", device, [{ id: "session", title: `Edit ${index}` }]);
    await source.synchronizeIndex(device.id, true, space, peer.relay);
    if ((index + 1) % 100 === 0) trace("publish", index + 1);
  }
  trace("snapshot-assertion", 1000);
  expect(peer.states.size).toBe(1);
  trace("publish-tail");
  await source.patchRecords("sessions", device, [{ id: "session", title: "After snapshot" }]);
  await source.synchronizeIndex(device.id, true, space, peer.relay);
  trace("open-reader");
  const fresh = await store("snapshot-reader");
  await fresh.writeRecords("sessions", fresh.device, [{ id: "other", title: "Other device" }]);
  trace("synchronize-reader");
  await fresh.synchronizeIndex(device.id, false, space, peer.relay);
  trace("reader-assertions");
  expect((await fresh.readRecords("sessions")).map((row) => row.title).sort()).toEqual([
    "After snapshot",
    "Other device",
  ]);
  expect(peer.reads.slice(-2)).toEqual([0, 1000]);
  trace("complete");
});

test("a local edit during an in-flight publish remains queued and survives the next publish", async () => {
  const source = await store("concurrent-source");
  const device = source.device;
  const peer = logRelayFixture();
  await source.patchRecords("sessions", device, [{ id: "session", title: "First" }]);
  const relay: typeof peer.relay = (id) => {
    const target = peer.relay(id);
    return {
      ...target,
      update: async (update) => {
        await source.patchRecords("sessions", device, [{ id: "session", title: "Newer edit" }]);
        return target.update(update);
      },
    };
  };
  await source.synchronizeIndex(device.id, true, space, relay);
  expect((await source.readRecords("sessions"))[0]?.title).toBe("Newer edit");
  expect(await source.indexPending()).toBe(true);
  await source.synchronizeIndex(device.id, true, space, peer.relay);
  const fresh = await store("concurrent-reader");
  await fresh.synchronizeIndex(device.id, false, space, peer.relay);
  expect((await fresh.readRecords("sessions"))[0]?.title).toBe("Newer edit");
});

test("a lost snapshot acknowledgement reloads its base and the next index change reaches a fresh reader", async () => {
  const source = await store("lost-snapshot-source");
  const device = source.device;
  const peer = logRelayFixture();
  for (let index = 0; index < 999; index++) {
    await source.patchRecords("sessions", device, [{ id: "session", title: `Edit ${index}` }]);
    await source.synchronizeIndex(device.id, true, space, peer.relay);
  }
  let dropped = false;
  const losing: typeof peer.relay = (id) => {
    const target = peer.relay(id);
    return {
      ...target,
      replace: async (snapshot) => {
        const result = await target.replace(snapshot);
        if (!dropped) {
          dropped = true;
          throw new Error("Lost snapshot acknowledgement");
        }
        return result;
      },
    };
  };
  await source.patchRecords("sessions", device, [{ id: "session", title: "Snapshot" }]);
  await expect(source.synchronizeIndex(device.id, true, space, losing)).rejects.toThrow(
    "Lost snapshot acknowledgement",
  );
  await source.patchRecords("sessions", device, [{ id: "session", title: "After failure" }]);
  await source.synchronizeIndex(device.id, true, space, peer.relay);
  const reader = await store("lost-snapshot-reader");
  await reader.synchronizeIndex(device.id, false, space, peer.relay);
  expect((await reader.readRecords("sessions"))[0]?.title).toBe("After failure");
  expect(await source.indexPending()).toBe(false);
});
