import { afterAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryDocumentStore } from "pstdio-sync";
import { memoryPersonalIndexFixture } from "./index.fixture";
import { createSessionLogFiles } from "./log-files";
import { createPersonalHistoryStore } from "./store";

const root = await mkdtemp(join(tmpdir(), "history-store-"));
afterAll(() => rm(root, { recursive: true, force: true }));
const files = createSessionLogFiles(root);
const documents = () => {
  const stores = new Map<string, ReturnType<typeof createMemoryDocumentStore>>();
  return {
    open(name: string) {
      let store = stores.get(name);
      if (!store) {
        store = createMemoryDocumentStore();
        stores.set(name, store);
      }
      return store;
    },
  };
};
const identity = { projectId: "project", accountId: "alice", managerOrigin: "https://manager.example" };
const device = { ownerId: "alice", id: "device-a", name: "Laptop" };

test("personal history retains each device's records", async () => {
  const store = createPersonalHistoryStore({ ...identity, documents: documents(), ...memoryPersonalIndexFixture() });
  await store.writeRecords("sessions", device, [{ id: "session-a", title: "Private session" }]);
  await store.writeRecords("sessions", { ...device, id: "device-b" }, [{ id: "session-b", title: "Other device" }]);
  await store.writeRecords("sessions", device, []);
  expect(await store.readRecords("sessions")).toEqual([
    { id: "session-b", title: "Other device", device: { ...device, id: "device-b" } },
  ]);
});

test("local personal history is partitioned by account and manager, including after logout", () => {
  const local = documents();
  const index = memoryPersonalIndexFixture();
  const alice = createPersonalHistoryStore({ ...identity, documents: local, ...index });
  const bob = createPersonalHistoryStore({ ...identity, accountId: "bob", documents: local, ...index });
  const otherManager = createPersonalHistoryStore({
    ...identity,
    files,
    managerOrigin: "https://other.example",
    documents: local,
    ...index,
  });
  expect(alice.owner).not.toEqual(bob.owner);
  expect(alice.owner).not.toEqual(otherManager.owner);
});
