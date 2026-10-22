import { expect, test } from "bun:test";
import { createMemoryDocumentStore, createSyncSpace, openUpdate } from "pstdio-sync";
import type { DocumentRelay } from "pstdio-sync/relay";
import type { StoredUpdate } from "pstdio-sync-contracts";
import { createPersonalHistoryStore } from "./store";
import { createPersonalDocumentSync } from "./synchronize";

const localDocuments = () => {
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

test("another device downloads full transcripts after the source device stops, using personal keys", async () => {
  const projectId = "project";
  const managerOrigin = "https://manager.example";
  const accountId = "alice";
  const space = await createSyncSpace({
    projectId,
    spaceOwner: accountId,
    keys: [{ generation: 1, secret: "B".repeat(43) }],
  });
  const encrypted = new Map<string, StoredUpdate[]>();
  const relay = (documentId: string): DocumentRelay => {
    const updates = encrypted.get(documentId) ?? [];
    encrypted.set(documentId, updates);
    return {
      read: async (after) => ({
        status: "updates",
        state: null,
        lastSequence: updates.length,
        updates: updates.filter((update) => update.sequence > after),
        more: false,
      }),
      state: async () => {
        throw new Error("No state was published");
      },
      update: async (update) => {
        const sequence = updates.length + 1;
        updates.push({ ...update, sequence, deviceId: "source", createdAt: new Date().toISOString() });
        return { sequence, duplicate: false };
      },
      replace: async () => {
        throw new Error("This workload fits in updates");
      },
    };
  };
  const source = createPersonalHistoryStore({ projectId, managerOrigin, accountId, documents: localDocuments() });
  const destination = createPersonalHistoryStore({ projectId, managerOrigin, accountId, documents: localDocuments() });
  const rejected: unknown[] = [];
  const sync = (history: typeof source) =>
    createPersonalDocumentSync({
      history,
      space,
      relay,
      quarantine: async (_id, failure) => {
        rejected.push(failure);
      },
    });
  const a = sync(source);
  const messages = Array.from({ length: 600 }, (_, index) => ({
    id: `message-${index}`,
    role: "assistant" as const,
    parts: [{ type: "text" as const, text: `Private transcript ${index}` }],
  }));
  await a.synchronize(async () => {
    await source.writeTranscript("session-a", messages);
    await source.writeRecords("sessions", { ownerId: accountId, id: "device-a", name: "Laptop" }, [
      { id: "session-a" },
    ]);
  });
  a.close();
  expect(encrypted.size).toBe(2);
  expect(
    [...encrypted.values()]
      .flat()
      .every((update) => !Buffer.from(update.payload, "base64").toString().includes("Private transcript")),
  ).toBe(true);
  const b = sync(destination);
  await b.synchronize(async () => {});
  expect(await destination.readTranscript("session-a")).toEqual(messages);
  expect(rejected).toEqual([]);
  b.close();
  const wrongKey = await createSyncSpace({
    projectId,
    spaceOwner: "bob",
    keys: [{ generation: 1, secret: "C".repeat(43) }],
  });
  const [privateId, updates] = [...encrypted][0]!;
  expect(openUpdate(wrongKey, privateId, updates[0]!)).rejects.toThrow();
  const bob = createPersonalHistoryStore({ projectId, managerOrigin, accountId: "bob", documents: localDocuments() });
  const c = createPersonalDocumentSync({ history: bob, space: wrongKey, relay, quarantine: async () => {} });
  await c.synchronize(async () => {});
  expect(await bob.readRecords("sessions")).toEqual([]);
  c.close();
});
