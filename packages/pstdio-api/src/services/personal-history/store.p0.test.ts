import { expect, test } from "bun:test";
import { createMemoryDocumentStore } from "pstdio-sync";
import { createPersonalHistoryStore } from "./store";

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

test("personal history retains each device's records and gives each transcript its own document", async () => {
  const store = createPersonalHistoryStore({ ...identity, documents: documents() });
  const messages = [{ id: "message", role: "assistant" as const, parts: [{ type: "text" as const, text: "Private" }] }];
  await store.writeTranscript("session-a", messages);
  expect(await store.readTranscript("session-a")).toEqual(messages);
  expect(await store.transcriptNames()).toEqual([]);
  await store.writeRecords("sessions", device, [{ id: "session-a", title: "Private session" }]);
  await store.writeRecords("sessions", { ...device, id: "device-b" }, [{ id: "session-b", title: "Other device" }]);
  await store.writeRecords("sessions", device, []);
  expect(await store.readRecords("sessions")).toEqual([
    { id: "session-b", title: "Other device", device: { ...device, id: "device-b" } },
  ]);
  expect(await store.transcriptNames()).toEqual(["session-b"]);
});

test("local personal history is partitioned by account and manager, including after logout", () => {
  const local = documents();
  const alice = createPersonalHistoryStore({ ...identity, documents: local });
  const bob = createPersonalHistoryStore({ ...identity, accountId: "bob", documents: local });
  const otherManager = createPersonalHistoryStore({
    ...identity,
    managerOrigin: "https://other.example",
    documents: local,
  });
  expect(alice.owner).not.toEqual(bob.owner);
  expect(alice.owner).not.toEqual(otherManager.owner);
});
