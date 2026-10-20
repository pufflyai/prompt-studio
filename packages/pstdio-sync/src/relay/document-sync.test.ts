import { expect, test } from "bun:test";
import type { ReadResult, StateEnvelope, StateInfo, StoredUpdate, UpdateEnvelope } from "pstdio-sync-contracts";
import * as Y from "yjs";
import { decodeBytes } from "../encoding";
import { createSyncId, createSyncSpace, openState, sealState, sealUpdate } from "../encryption";
import { createMemoryDocumentStore } from "../memory-document-store";
import { createDocumentSync } from "./document-sync";

const owner = { workbenchId: "project", extensionId: "notes" };
const space = await createSyncSpace({
  projectId: owner.workbenchId,
  spaceOwner: null,
  keys: [{ generation: 1, secret: "A".repeat(43) }],
});
const documentId = await space.documentId("notes");
const relayFixture = () => {
  let latest: (StateEnvelope & StateInfo) | null = null;
  let sequence = 0;
  let updates: StoredUpdate[] = [];
  const writes: UpdateEnvelope[] = [];
  const states: StateEnvelope[] = [];
  const relay = {
    read: async (after: number): Promise<ReadResult> => ({
      status: "updates",
      state: latest,
      lastSequence: sequence,
      updates: updates.filter((update) => update.sequence > after),
      more: false,
    }),
    state: async () => decodeBytes(latest!.payload),
    update: async (update: UpdateEnvelope) => {
      writes.push(update);
      updates.push({ ...update, sequence: ++sequence, deviceId: "device", createdAt: new Date().toISOString() });
      return { sequence, duplicate: false };
    },
    replace: async (state: StateEnvelope) => {
      if (state.baseStateId !== (latest?.stateId ?? null)) return false;
      states.push(state);
      latest = {
        ...state,
        byteLength: decodeBytes(state.payload).length,
        deviceId: "device",
        createdAt: new Date().toISOString(),
      };
      return true;
    },
  };
  return {
    relay,
    writes,
    states,
    trim: () => {
      updates = updates.filter((update) => update.sequence > (latest?.through ?? 0));
    },
  };
};
const device = (relay: ReturnType<typeof relayFixture>["relay"], limits?: { bytes: number; updates: number }) => {
  const store = createMemoryDocumentStore();
  const rejected: string[] = [];
  const sync = createDocumentSync({
    owner,
    store,
    space,
    documentId,
    relay,
    limits,
    quarantine: async (failure) => {
      rejected.push(failure.id);
    },
  });
  return {
    sync,
    store,
    rejected,
    set: (key: string, value: unknown) =>
      store.transaction(owner, async ({ document }) => {
        document.getMap("values").set(key, value);
      }),
    remove: (key: string) =>
      store.transaction(owner, async ({ document }) => {
        document.getMap("values").delete(key);
      }),
    values: () => store.transaction(owner, async ({ document }) => document.getMap("values").toJSON()),
  };
};

test("a device offline across several latest states keeps its edits and catches up", async () => {
  const f = relayFixture();
  const online = device(f.relay, { bytes: 1_048_576, updates: 1 });
  const offline = device(f.relay);
  await online.set("initial", true);
  await online.sync.synchronize();
  await offline.sync.synchronize();
  await offline.set("offline", "kept");
  for (let i = 0; i < 8; i++) {
    await online.set(`edit-${i}`, i);
    await online.sync.synchronize();
    f.trim();
  }
  expect(f.states.length).toBeGreaterThan(2);
  await offline.sync.synchronize();
  await online.sync.synchronize();
  expect(await offline.values()).toEqual(await online.values());
  expect(await online.values()).toMatchObject({ offline: "kept", "edit-7": 7 });
  online.sync.close();
  offline.sync.close();
});

test("another device repairs an incomplete latest state without a new local save", async () => {
  const f = relayFixture();
  const first = device(f.relay);
  await first.set("kept", true);
  await first.sync.synchronize();
  const incomplete = new Y.Doc();
  await f.relay.replace(
    await sealState(space, documentId, {
      baseStateId: null,
      through: 1,
      state: Y.encodeStateAsUpdate(incomplete),
      summary: Y.encodeStateVector(incomplete),
      blobIds: [],
    }),
  );
  f.trim();
  await first.sync.synchronize();
  const newcomer = device(f.relay);
  await newcomer.sync.synchronize();
  expect(await newcomer.values()).toEqual({ kept: true });
  first.sync.close();
  newcomer.sync.close();
  incomplete.destroy();
});

test("delete-only repairs are sent once and a quiet document generates no updates", async () => {
  const f = relayFixture();
  const first = device(f.relay);
  await first.set("removed", true);
  await first.sync.synchronize();
  await first.remove("removed");
  await first.sync.synchronize();
  const count = f.writes.length;
  await first.sync.synchronize();
  await first.sync.synchronize();
  expect(f.writes.length).toBe(count);
  const second = device(f.relay);
  await second.sync.synchronize();
  expect(await second.values()).toEqual({});
  first.sync.close();
  second.sync.close();
});

test("bad ciphertext and invalid Yjs updates are set aside while healthy edits continue", async () => {
  const f = relayFixture();
  const first = device(f.relay, { bytes: 0, updates: 0 });
  const bad = { updateId: createSyncId(), payload: "AAAA", blobIds: [] };
  await f.relay.update(bad);
  const invalid = await sealUpdate(space, documentId, new Uint8Array([255]), []);
  await f.relay.update(invalid);
  const healthy = new Y.Doc();
  healthy.getMap("values").set("healthy", true);
  await f.relay.update(await sealUpdate(space, documentId, Y.encodeStateAsUpdate(healthy), []));
  await first.sync.synchronize();
  expect(first.rejected).toEqual([bad.updateId, invalid.updateId]);
  expect(await first.values()).toEqual({ healthy: true });
  expect(f.states).toHaveLength(0);
  await first.sync.synchronize();
  expect(first.rejected).toHaveLength(2);
  first.sync.close();
  healthy.destroy();
});

test("a latest state carries the full document and compacts only after the limit", async () => {
  const f = relayFixture();
  const first = device(f.relay, { bytes: 1_048_576, updates: 1 });
  await first.set("one", true);
  await first.sync.synchronize();
  expect(f.states).toHaveLength(0);
  await first.set("two", true);
  await first.sync.synchronize();
  expect(f.states).toHaveLength(1);
  const state = f.states[0];
  const doc = new Y.Doc();
  Y.applyUpdate(doc, await openState(space, documentId, state, decodeBytes(state.payload)));
  expect(doc.getMap("values").toJSON()).toEqual({ one: true, two: true });
  expect(state.through).toBe(2);
  first.sync.close();
  doc.destroy();
});

test("an offline diff larger than an update frame is published as a latest state", async () => {
  const { DocumentUpdateTooLarge } = await import("./document-sync-types");
  const f = relayFixture();
  const first = device({
    ...f.relay,
    update: async () => {
      throw new DocumentUpdateTooLarge();
    },
  });
  await first.set("large", "x".repeat(1_048_576));
  await first.sync.synchronize();
  expect(f.states).toHaveLength(1);
  const next = device(f.relay);
  await next.sync.synchronize();
  expect(await next.values()).toEqual(await first.values());
  first.sync.close();
  next.sync.close();
});

test("invalid asset metadata is set aside before it can block healthy updates", async () => {
  const f = relayFixture();
  const first = device(f.relay);
  const invalid = new Y.Doc();
  invalid.getMap("records").set("bad", "bad-record");
  invalid.getMap("bad-record").set("asset", { sha256: "invalid" });
  const update = await sealUpdate(space, documentId, Y.encodeStateAsUpdate(invalid), []);
  await f.relay.update(update);
  await first.set("healthy", true);
  await first.sync.synchronize();
  expect(first.rejected).toEqual([update.updateId]);
  expect(await first.values()).toEqual({ healthy: true });
  invalid.destroy();
  first.sync.close();
});

test("a latest state behind the current page restarts reading at its own boundary", async () => {
  const document = new Y.Doc();
  const captured: Uint8Array[] = [];
  document.on("update", (update) => captured.push(update));
  document.getMap("values").set("one", 1);
  const snapshot = await sealState(space, documentId, {
    baseStateId: null,
    through: 1,
    state: Y.encodeStateAsUpdate(document),
    summary: Y.encodeStateVector(document),
    blobIds: [],
  });
  document.getMap("values").set("two", 2);
  document.getMap("values").set("three", 3);
  const updates = await Promise.all(
    captured.map(async (update, index) => ({
      ...(await sealUpdate(space, documentId, update, [])),
      sequence: index + 1,
      deviceId: "device",
      createdAt: new Date().toISOString(),
    })),
  );
  let reads = 0;
  const first = device({
    read: async (after) => {
      reads++;
      return {
        status: "updates" as const,
        state:
          reads === 1
            ? null
            : { ...snapshot, byteLength: 100, deviceId: "device", createdAt: new Date().toISOString() },
        updates: reads === 1 ? updates.slice(0, 2) : updates.filter((update) => update.sequence > after),
        lastSequence: 3,
        more: reads === 1,
      };
    },
    state: async () => decodeBytes(snapshot.payload),
    update: async () => {
      throw new Error("No repair should be needed");
    },
    replace: async () => true,
  });
  await first.sync.synchronize();
  expect(await first.values()).toEqual({ one: 1, two: 2, three: 3 });
  expect(reads).toBe(3);
  first.sync.close();
  document.destroy();
});
