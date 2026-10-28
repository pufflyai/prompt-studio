import { expect, test } from "bun:test";
import type { ReadResult, StateEnvelope, StateInfo, StoredUpdate, UpdateEnvelope } from "pstdio-sync-contracts";
import * as Y from "yjs";
import { createSyncId, createSyncSpace, openState, openUpdate, sealState, sealUpdate } from "../encryption/index";
import { type DocumentStore, memoryDocumentState } from "../shared/document-types";
import { decodeBytes } from "../shared/encoding";
import { createMemoryDocumentStore } from "../shared/memory-document-store";
import { mergeTextDocuments, prepareTextDocumentAdoption } from "../text/text-document-adoption";
import { readTextDocumentSeed, seedTextDocument } from "../text/text-document-seed";
import { importTextSource } from "../text/text-source-import";
import { createDocumentSync } from "./document-sync";
import type { SyncFailure } from "./document-sync-types";

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

const textDevice = async (relay: ReturnType<typeof relayFixture>["relay"], source?: string) => {
  const state = memoryDocumentState(new Y.Doc());
  const store: DocumentStore = { transaction: async (_owner, action) => action(state) };
  Object.assign(store, {
    initialHistory: {
      validate: readTextDocumentSeed,
      prepare: (_owner: unknown, remote: Y.Doc) => prepareTextDocumentAdoption(state.document, remote),
      merge: async (_owner: unknown, remote: Y.Doc) => {
        const pending = await prepareTextDocumentAdoption(state.document, remote);
        if (pending) {
          pending.destroy();
          return null;
        }
        const merged = await mergeTextDocuments(state.document, remote);
        state.document.destroy();
        state.document = merged;
        const snapshot = new Y.Doc();
        Y.applyUpdate(snapshot, Y.encodeStateAsUpdate(merged));
        return snapshot;
      },
    },
  });
  if (source !== undefined) await seedTextDocument(state.document, source);
  const rejected: unknown[] = [];
  const sync = createDocumentSync({
    owner,
    store,
    space,
    documentId,
    relay,
    quarantine: async (f) => void rejected.push(f),
  });
  return {
    sync,
    rejected,
    text: () => state.document.getText("content"),
    exportState: () => Y.encodeStateAsUpdate(state.document),
    importState: (update: Uint8Array) => Y.applyUpdate(state.document, update),
    close: () => {
      sync.close();
      state.document.destroy();
    },
  };
};

test("different imported histories retain an encrypted recovery copy and keep local text pending", async () => {
  const f = relayFixture();
  const first = await textDevice(f.relay);
  const second = await textDevice(f.relay);
  const remote = new Y.Doc();
  const local = new Y.Doc();
  await importTextSource(remote, "a".repeat(64), "Saved remotely before binding");
  await importTextSource(local, "a".repeat(64), "Saved locally before binding");
  first.importState(Y.encodeStateAsUpdate(remote));
  second.importState(Y.encodeStateAsUpdate(local));
  try {
    await first.sync.synchronize();
    await expect(second.sync.synchronize()).rejects.toThrow("pre-binding");
    expect(second.text().toString()).toBe("Saved locally before binding");
    expect(await second.sync.status()).toMatchObject({ pending: true, needsAttention: true, downloaded: false });
    const failure = second.rejected[0] as SyncFailure;
    expect(JSON.stringify(failure)).not.toContain("Saved remotely before binding");
    const envelope = failure.envelope as { update: UpdateEnvelope };
    const saved = new Y.Doc();
    Y.applyUpdate(saved, await openUpdate(space, documentId, envelope.update));
    expect(saved.getText("content").toString()).toBe("Saved remotely before binding");
    saved.destroy();
  } finally {
    first.close();
    second.close();
    remote.destroy();
    local.destroy();
  }
});

test("two hosts with the same retired history serialize its adoption without duplicating shared edits", async () => {
  const f = relayFixture();
  const canonical = await textDevice(f.relay, "abc");
  await canonical.sync.synchronize();
  const first = await textDevice(f.relay, "abc");
  first.text().insert(0, "X");
  const second = await textDevice(f.relay);
  second.importState(first.exportState());
  await Promise.all([first.sync.synchronize(), second.sync.synchronize()]);
  await canonical.sync.synchronize();
  expect(canonical.text().toString()).toBe("Xabc");
  expect(first.text().toString()).toBe("Xabc");
  expect(second.text().toString()).toBe("Xabc");
  canonical.close();
  first.close();
  second.close();
});

test("shared-root recovery serializes provenance repairs before ordinary updates resume", async () => {
  const root = new Y.Doc();
  await seedTextDocument(root, "abc");
  const source = new Y.Doc();
  await seedTextDocument(source, "abc");
  source.getText("content").insert(0, "X");
  const beforeLoss = await mergeTextDocuments(source, root);
  const afterLoss = await mergeTextDocuments(source, root);
  const f = relayFixture();
  const canonical = await textDevice(f.relay);
  canonical.importState(Y.encodeStateAsUpdate(afterLoss));
  await canonical.sync.synchronize();
  const returning = await textDevice(f.relay);
  returning.importState(Y.encodeStateAsUpdate(beforeLoss));
  await returning.sync.synchronize();
  await canonical.sync.synchronize();
  expect(returning.text().toString()).toBe("Xabc");
  expect(canonical.text().toString()).toBe("Xabc");
  const writes = f.writes.length;
  const states = f.states.length;
  await returning.sync.synchronize();
  await canonical.sync.synchronize();
  expect(f.writes).toHaveLength(writes);
  expect(f.states).toHaveLength(states);
  canonical.close();
  returning.close();
  for (const doc of [root, source, beforeLoss, afterLoss]) doc.destroy();
});

test("a canonical edit appended while another history is adopted remains in the uncovered tail", async () => {
  const f = relayFixture();
  const canonical = await textDevice(f.relay, "abc");
  await canonical.sync.synchronize();
  const source = await textDevice(f.relay, "abc");
  source.text().insert(0, "X");
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const replace = f.relay.replace;
  f.relay.replace = async (state) => {
    entered.resolve();
    await release.promise;
    return replace(state);
  };
  const joining = source.sync.synchronize();
  await entered.promise;
  canonical.text().insert(3, "Y");
  await canonical.sync.synchronize();
  source.text().insert(source.text().length, "Z");
  release.resolve();
  await joining;
  await canonical.sync.synchronize();
  expect(source.text().toString()).toBe("XabcYZ");
  expect(canonical.text().toString()).toBe("XabcYZ");
  canonical.close();
  source.close();
});

test("a discovered text document waits for its source instead of founding an empty unseeded history", async () => {
  const f = relayFixture();
  const waiting = await textDevice(f.relay);
  await waiting.sync.synchronize();
  expect(f.states).toHaveLength(0);
  expect(f.writes).toHaveLength(0);
  expect(await waiting.sync.status()).toEqual({ downloaded: false, pending: false, needsAttention: false });
  const source = await textDevice(f.relay, "source arrived");
  await source.sync.synchronize();
  await waiting.sync.synchronize();
  expect(waiting.text().toString()).toBe("source arrived");
  waiting.close();
  source.close();
});

test("independent text histories found one state before sending their offline edits", async () => {
  const f = relayFixture();
  const first = await textDevice(f.relay, "first\nlast");
  const second = await textDevice(f.relay, "first\nlast");
  first.text().insert(0, "A ");
  second.text().insert(second.text().length, " B");
  await Promise.all([first.sync.synchronize(), second.sync.synchronize()]);
  await first.sync.synchronize();
  await second.sync.synchronize();
  expect(first.text().toString()).toBe("A first\nlast B");
  expect(second.text().toString()).toBe(first.text().toString());
  expect(f.states[0]?.through).toBe(0);
  const active = new Y.Doc();
  Y.applyUpdate(active, first.exportState());
  const canonicalSeed = await readTextDocumentSeed(active);
  active.destroy();
  for (const state of f.states) {
    const snapshot = new Y.Doc();
    Y.applyUpdate(snapshot, await openState(space, documentId, state, decodeBytes(state.payload)));
    expect((await readTextDocumentSeed(snapshot)).id).toBe(canonicalSeed.id);
    snapshot.destroy();
  }
  expect(first.rejected).toEqual([]);
  expect(second.rejected).toEqual([]);
  first.close();
  second.close();
});

test("typing while the initial state is being published survives the following merge", async () => {
  const f = relayFixture();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const original = f.relay.replace;
  f.relay.replace = async (state) => {
    entered.resolve();
    await release.promise;
    return original(state);
  };
  const first = await textDevice(f.relay, "start");
  const running = first.sync.synchronize();
  await entered.promise;
  first.text().insert(first.text().length, " typed during publish");
  release.resolve();
  await running;
  const second = await textDevice(f.relay, "start");
  await second.sync.synchronize();
  expect(second.text().toString()).toBe("start typed during publish");
  first.close();
  second.close();
});

test("a complete seeded update tail is founded before an unrelated local seed is adopted", async () => {
  const f = relayFixture();
  const original = new Y.Doc();
  await seedTextDocument(original, "canonical source");
  await f.relay.update(await sealUpdate(space, documentId, Y.encodeStateAsUpdate(original), []));
  const next = await textDevice(f.relay, "older source");
  await next.sync.synchronize();
  expect(next.text().toString()).toBe("canonical source");
  expect(f.states[0]?.through).toBe(1);
  expect(f.states.every((state) => state.through >= 1)).toBe(true);
  expect(next.rejected).toEqual([]);
  next.close();
  original.destroy();
});

test("ambiguous initial histories are quarantined without overwriting the tail or local edits", async () => {
  const f = relayFixture();
  const first = new Y.Doc();
  const second = new Y.Doc();
  await seedTextDocument(first, "one");
  await seedTextDocument(second, "two");
  Y.applyUpdate(first, Y.encodeStateAsUpdate(second));
  await f.relay.update(await sealUpdate(space, documentId, Y.encodeStateAsUpdate(first), []));
  const local = await textDevice(f.relay, "local draft");
  await local.sync.synchronize();
  expect(local.text().toString()).toBe("local draft");
  expect(f.states).toHaveLength(0);
  expect(f.writes).toHaveLength(1);
  expect(local.rejected).toHaveLength(1);
  expect(await local.sync.status()).toEqual({ downloaded: false, pending: true, needsAttention: true });
  local.close();
  first.destroy();
  second.destroy();
});

test("a one-time document download reads encrypted latest state and updates without publishing local edits", async () => {
  const f = relayFixture();
  const online = device(f.relay, { bytes: 1_048_576, updates: 1 });
  const reader = device(f.relay);
  try {
    await online.set("first", 1);
    await online.sync.synchronize();
    await online.set("second", 2);
    await online.sync.synchronize();
    await online.set("third", 3);
    await online.sync.synchronize();
    await reader.set("local", "must stay local");
    const writes = f.writes.length;
    const states = f.states.length;
    const downloaded = await reader.sync.download();
    try {
      expect(downloaded.getMap("values").toJSON()).toEqual({ first: 1, second: 2, third: 3 });
      expect(await reader.values()).toEqual({ local: "must stay local" });
      expect(f.writes).toHaveLength(writes);
      expect(f.states).toHaveLength(states);
    } finally {
      downloaded.destroy();
    }
  } finally {
    online.sync.close();
    reader.sync.close();
  }
});

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

test("sync status waits for a full download and detects durable edits after a sync", async () => {
  const f = relayFixture();
  const first = device(f.relay);
  expect(await first.sync.status()).toEqual({ downloaded: false, pending: false, needsAttention: false });
  await first.sync.synchronize();
  expect(await first.sync.status()).toEqual({ downloaded: true, pending: false, needsAttention: false });
  await first.set("draft", "Saved on this device");
  expect(await first.sync.status()).toEqual({ downloaded: true, pending: true, needsAttention: false });
  await first.sync.synchronize();
  expect((await first.sync.status()).pending).toBe(false);
  first.sync.close();
});

test("an interrupted first download never reports complete and unreadable data needs attention", async () => {
  const f = relayFixture();
  let interrupted = true;
  const first = device({
    ...f.relay,
    read: async (after) => {
      if (interrupted) throw new Error("Connection interrupted");
      return f.relay.read(after);
    },
  });
  await expect(first.sync.synchronize()).rejects.toThrow("Connection interrupted");
  expect((await first.sync.status()).downloaded).toBe(false);
  interrupted = false;
  await f.relay.update({ updateId: createSyncId(), payload: "AAAA", blobIds: [] });
  await first.sync.synchronize();
  expect(await first.sync.status()).toMatchObject({ downloaded: false, needsAttention: true });
  first.sync.close();
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

test("an incomplete state ahead of the cursor cannot erase edits from a completed page", async () => {
  const f = relayFixture();
  const document = new Y.Doc();
  for (const key of ["one", "two", "three"]) {
    document.getMap("values").set(key, key);
    await f.relay.update(await sealUpdate(space, documentId, Y.encodeStateAsUpdate(document), []));
  }
  const empty = new Y.Doc();
  const incomplete = await sealState(space, documentId, {
    baseStateId: null,
    through: 3,
    state: Y.encodeStateAsUpdate(empty),
    summary: Y.encodeStateVector(empty),
    blobIds: [],
  });
  let reads = 0;
  const first = device({
    ...f.relay,
    read: async (after) => {
      reads++;
      if (reads === 2) await f.relay.replace(incomplete);
      const result = await f.relay.read(after);
      if (reads === 1 && result.status === "updates")
        return { ...result, updates: result.updates.slice(0, 2), more: true };
      return result;
    },
  });
  await first.sync.synchronize();
  expect(await first.values()).toEqual({ one: "one", two: "two" });
  first.sync.close();
  document.destroy();
  empty.destroy();
});

test("missing asset bytes keep the first download incomplete and a local draft survives retry", async () => {
  const { sealBlob } = await import("../encryption");
  const f = relayFixture();
  const bytes = new TextEncoder().encode("shared picture");
  const asset = {
    sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
    mediaType: "image/png",
  };
  const sealed = await sealBlob(space, bytes);
  const encrypted = {
    sha256: new Bun.CryptoHasher("sha256").update(sealed.bytes).digest("hex"),
    byteLength: sealed.bytes.length,
    mediaType: "application/octet-stream",
  };
  const remote = new Y.Doc();
  remote.getMap("records").set("picture", "picture-record");
  remote.getMap("picture-record").set("asset", asset);
  remote.getMap("sync-blobs").set(asset.sha256, { blobId: sealed.blobId, encrypted });
  await f.relay.update(await sealUpdate(space, documentId, Y.encodeStateAsUpdate(remote), [sealed.blobId]));
  const store = createMemoryDocumentStore();
  await store.transaction(owner, async ({ document }) => {
    document.getMap("values").set("draft", "offline edit");
  });
  const files = new Map<string, Uint8Array>();
  let interrupted = true;
  const sync = createDocumentSync({
    owner,
    store,
    space,
    documentId,
    quarantine: async () => {},
    relay: {
      ...f.relay,
      blobs: {
        get: async () => {
          if (interrupted) throw new Error("Asset download interrupted");
          return sealed.bytes;
        },
        put: async () => {},
      },
    },
    assets: {
      verifyComplete: async (assets) => {
        for (const entry of assets) if (!files.has(entry.sha256)) throw new Error("Missing bytes");
      },
      read: async (entry) => new Blob([files.get(entry.sha256)! as Uint8Array<ArrayBuffer>]).stream(),
      receive: async (entry, read) => {
        files.set(
          entry.sha256,
          new Uint8Array(await new Response(await read(0, new AbortController().signal)).arrayBuffer()),
        );
      },
    },
  });
  try {
    await expect(sync.synchronize()).rejects.toThrow("Asset download interrupted");
    expect((await sync.status()).downloaded).toBe(false);
    interrupted = false;
    await sync.synchronize();
    expect(await sync.status()).toEqual({ downloaded: true, pending: false, needsAttention: false });
    expect(files.get(asset.sha256)).toEqual(bytes);
    expect(await store.transaction(owner, async ({ document }) => document.getMap("values").get("draft"))).toBe(
      "offline edit",
    );
  } finally {
    sync.close();
    remote.destroy();
  }
});
