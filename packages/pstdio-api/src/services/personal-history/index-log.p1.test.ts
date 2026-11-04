import { afterAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryDocumentStore } from "pstdio-sync";
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
const device = { ownerId: "alice", id: "laptop", name: "Laptop" };
const store = (folder: string) =>
  createPersonalHistoryStore({
    projectId: "project",
    accountId: "alice",
    managerOrigin: "https://manager.example",
    documents: { open: () => createMemoryDocumentStore() },
    files: createSessionLogFiles(join(root, folder)),
  });

test("a device index appends only changed rows and readers resume from their durable cursor", async () => {
  const source = store("source");
  const peer = logRelayFixture();
  const rows = Array.from({ length: 2000 }, (_, index) => ({ id: String(index), title: "Saved" }));
  await source.writeRecords("sessions", device, rows);
  await source.synchronizeIndex(device.id, true, space, peer.relay);
  const initial = [...peer.updates.values()].flat().length;
  rows[1000] = { id: "1000", title: "Changed" };
  await source.writeRecords("sessions", device, rows);
  await source.synchronizeIndex(device.id, true, space, peer.relay);
  expect([...peer.updates.values()].flat()).toHaveLength(initial + 1);
  const destination = store("reader");
  await destination.synchronizeIndex(device.id, false, space, peer.relay);
  expect(await destination.readRecords("sessions")).toHaveLength(2000);
  expect((await destination.readRecords("sessions")).find((row) => row.id === "1000")?.title).toBe("Changed");
  const restarted = store("reader");
  await restarted.synchronizeIndex(device.id, false, space, peer.relay);
  expect(peer.reads.at(-1)).toBe(initial + 1);
  await source.writeRecords("sessions", device, rows.slice(1));
  await source.writeHeads(new Map([["1000", 7]]));
  await source.synchronizeIndex(device.id, true, space, peer.relay);
  await destination.synchronizeIndex(device.id, false, space, peer.relay);
  expect(await destination.readRecords("sessions")).toHaveLength(1999);
  expect(await destination.readHeads()).toEqual(new Map([["1000", 7]]));
});

test("publishing one device keeps another device's pending rows in its own log", async () => {
  const source = store("partitioned-source");
  const peer = logRelayFixture();
  const other = { ...device, id: "desktop", name: "Desktop" };
  await source.patchRecords("sessions", device, [{ id: "laptop-session", title: "Laptop" }]);
  await source.patchRecords("sessions", other, [{ id: "desktop-session", title: "Desktop" }]);
  await source.synchronizeIndex(device.id, true, space, peer.relay);
  const reader = store("partitioned-reader");
  await reader.synchronizeIndex(device.id, false, space, peer.relay);
  expect((await reader.readRecords("sessions")).map((row) => row.id)).toEqual(["laptop-session"]);
  expect(source.indexPending()).toBe(true);
  await source.synchronizeIndex(other.id, true, space, peer.relay);
  await reader.synchronizeIndex(other.id, false, space, peer.relay);
  expect((await reader.readRecords("sessions")).map((row) => row.id).sort()).toEqual([
    "desktop-session",
    "laptop-session",
  ]);
  expect(source.indexPending()).toBe(false);
  await source.patchRecords("sessions", device, [], ["laptop-session"]);
  await source.synchronizeIndex(device.id, true, space, peer.relay);
  await reader.synchronizeIndex(device.id, false, space, peer.relay);
  expect((await reader.readRecords("sessions")).map((row) => row.id)).toEqual(["desktop-session"]);
});

test("a fresh reader starts from the device snapshot and keeps the newer tail and other devices' rows", async () => {
  const source = store("snapshot-source");
  const peer = logRelayFixture();
  for (let index = 0; index < 1000; index++) {
    await source.patchRecords("sessions", device, [{ id: "session", title: `Edit ${index}` }]);
    await source.synchronizeIndex(device.id, true, space, peer.relay);
  }
  expect(peer.states.size).toBe(1);
  await source.patchRecords("sessions", device, [{ id: "session", title: "After snapshot" }]);
  await source.synchronizeIndex(device.id, true, space, peer.relay);
  const fresh = store("snapshot-reader");
  await fresh.writeRecords("sessions", { ...device, id: "desktop" }, [{ id: "other", title: "Other device" }]);
  await fresh.synchronizeIndex(device.id, false, space, peer.relay);
  expect((await fresh.readRecords("sessions")).map((row) => row.title).sort()).toEqual([
    "After snapshot",
    "Other device",
  ]);
  expect(peer.reads.slice(-2)).toEqual([0, 1000]);
});

test("a local edit during an in-flight publish remains queued and survives the next publish", async () => {
  const source = store("concurrent-source");
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
  expect(source.indexPending()).toBe(true);
  await source.synchronizeIndex(device.id, true, space, peer.relay);
  const fresh = store("concurrent-reader");
  await fresh.synchronizeIndex(device.id, false, space, peer.relay);
  expect((await fresh.readRecords("sessions"))[0]?.title).toBe("Newer edit");
});

test("a lost snapshot acknowledgement reloads its base and the next index change reaches a fresh reader", async () => {
  const source = store("lost-snapshot-source");
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
  const reader = store("lost-snapshot-reader");
  await reader.synchronizeIndex(device.id, false, space, peer.relay);
  expect((await reader.readRecords("sessions"))[0]?.title).toBe("After failure");
  expect(source.indexPending()).toBe(false);
});
