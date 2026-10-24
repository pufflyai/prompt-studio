import { afterEach, expect, test } from "bun:test";
import { createSyncSpace } from "pstdio-sync";
import { createRecordStreamSync } from "pstdio-sync/relay";
import type { Asset, ReadResult, StateEnvelope, StateInfo, StoredUpdate, UpdateEnvelope } from "pstdio-sync-contracts";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { dataMigrationContext } from "./data-migration-context";
import { createDocumentStorageDBService } from "./document-storage";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

const projectId = crypto.randomUUID();
const owner = { workbenchId: projectId, extensionId: "ext.notes" };
const space = await createSyncSpace({ projectId, spaceOwner: null, keys: [{ generation: 1, secret: "A".repeat(43) }] });
const documentId = await space.documentId(JSON.stringify([owner.extensionId, "record-stream"]));

const decode = (payload: string) => Uint8Array.from(Buffer.from(payload, "base64"));

/** An in-memory relay with the blind relay's document and blob rules. */
const createRelay = () => {
  let latest: (StateEnvelope & StateInfo) | null = null;
  let sequence = 0;
  let updates: StoredUpdate[] = [];
  const blobs = new Map<string, Uint8Array>();
  const requests = { reads: 0, blobs: 0, updates: 0, states: 0 };
  const relay = {
    read: async (after: number): Promise<ReadResult> => {
      requests.reads++;
      const newer = updates.filter((update) => update.sequence > after);
      if (newer.length !== sequence - after) return { status: "state-required", state: latest, lastSequence: sequence };
      return { status: "updates", state: latest, lastSequence: sequence, updates: newer, more: false };
    },
    state: async () => decode(latest!.payload),
    update: async (update: UpdateEnvelope) => {
      requests.updates++;
      updates.push({ ...update, sequence: ++sequence, deviceId: "device", createdAt: new Date().toISOString() });
      return { sequence, duplicate: false };
    },
    replace: async (state: StateEnvelope) => {
      if (state.baseStateId !== (latest?.stateId ?? null)) return false;
      requests.states++;
      for (const blobId of state.blobIds) if (!blobs.has(blobId)) throw new Error("Missing blob");
      latest = {
        ...state,
        byteLength: decode(state.payload).length,
        deviceId: "device",
        createdAt: new Date().toISOString(),
      };
      return true;
    },
    blobs: {
      put: async (blobId: string, bytes: Uint8Array) => {
        blobs.set(blobId, bytes);
      },
      get: async (blobId: string) => {
        requests.blobs++;
        return blobs.get(blobId)!;
      },
    },
  };
  return {
    relay,
    requests,
    updates: () => updates,
    // The relay removes updates a latest state covers once their grace period ends.
    trim: () => {
      updates = updates.filter((update) => update.sequence > (latest?.through ?? 0));
    },
  };
};

const createAssets = () => {
  const files = new Map<string, Uint8Array>();
  return {
    files,
    store: {
      verifyComplete: async (assets: Asset[]) => {
        for (const asset of assets) if (!files.has(asset.sha256)) throw new Error("Asset missing");
      },
      read: async (asset: Asset) => new Blob([files.get(asset.sha256)! as Uint8Array<ArrayBuffer>]).stream(),
      receive: async (
        asset: Asset,
        source: (offset: number, signal: AbortSignal) => Promise<ReadableStream<Uint8Array>>,
      ) => {
        files.set(
          asset.sha256,
          new Uint8Array(await new Response(await source(0, new AbortController().signal)).arrayBuffer()),
        );
      },
    },
  };
};

const device = async (relay: ReturnType<typeof createRelay>["relay"], limits?: { bytes: number; updates: number }) => {
  const { db, close } = await createDb({ path: ":memory:" });
  cleanup.push(close);
  const timestamp = new Date().toISOString();
  await db
    .insert(projects)
    .values({ id: projectId, name: "Notes", shorthand: "N", created_at: timestamp, updated_at: timestamp });
  const service = createDocumentStorageDBService(db);
  const assets = createAssets();
  const failures: unknown[] = [];
  const sync = createRecordStreamSync({
    space,
    documentId,
    relay,
    store: service.documents.recordStream(owner),
    assets: assets.store,
    limits,
    quarantine: async (failure) => {
      failures.push(failure);
    },
  });
  const records = service.open({ owner, assets: assets.store }).records;
  const value = async (recordId: string) => (await records.read(recordId)).value;
  return { records, sync, assets, failures, value };
};

test("records saved offline on two devices reach both, and a multi-record save arrives whole", async () => {
  const { relay, updates } = createRelay();
  const first = await device(relay);
  const second = await device(relay);
  await first.records.commit({ operationId: "seed", edits: [{ recordId: "note", replace: { title: "Draft" } }] });
  await first.sync.synchronize();
  await second.sync.synchronize();
  expect(await second.value("note")).toEqual({ title: "Draft" });

  await first.records.commit({
    operationId: "pair",
    edits: [
      { recordId: "ticket", replace: { title: "Ticket" } },
      { recordId: "link", replace: { from: "ticket" } },
    ],
  });
  await second.records.commit({
    operationId: "edit",
    edits: [{ recordId: "note", replace: { title: "Draft", body: "B" } }],
  });
  const before = updates().length;
  await first.sync.synchronize();
  // The two-record save is one relay update.
  expect(updates().length).toBe(before + 1);
  await second.sync.synchronize();
  await first.sync.synchronize();
  for (const peer of [first, second]) {
    expect(await peer.value("ticket")).toEqual({ title: "Ticket" });
    expect(await peer.value("link")).toEqual({ from: "ticket" });
    expect(await peer.value("note")).toEqual({ title: "Draft", body: "B" });
    expect(await peer.sync.status()).toEqual({ downloaded: true, pending: false, needsAttention: false });
  }
});

test("a device that saved the same records on its own adopts the first device's records and keeps its later edits", async () => {
  const { relay } = createRelay();
  const first = await device(relay);
  const second = await device(relay);
  // Both devices moved the same record into its own document separately, so the histories differ.
  for (const peer of [first, second])
    await peer.records.commit({ operationId: "upgrade", edits: [{ recordId: "note", replace: "line 1\nline 2" }] });
  await second.records.commit({
    operationId: "later",
    edits: [{ recordId: "note", replace: "line 1\nline 2\nline 3" }],
  });
  await second.records.commit({ operationId: "own", edits: [{ recordId: "mine", replace: "only on the second" }] });
  await first.records.commit({ operationId: "gone", edits: [{ recordId: "old", replace: 1 }] });
  await first.records.commit({ operationId: "delete", edits: [{ recordId: "old", deleted: true }] });

  await first.sync.synchronize();
  await second.sync.synchronize();
  await first.sync.synchronize();
  for (const peer of [first, second]) {
    expect(await peer.value("note")).toBe("line 1\nline 2\nline 3");
    expect(await peer.value("mine")).toBe("only on the second");
    expect((await peer.records.read("old")).deleted).toBe(true);
  }
});

test("two devices that run the same data migration offline end with the same records and text", async () => {
  const { relay } = createRelay();
  const first = await device(relay);
  const second = await device(relay);
  for (const peer of [first, second]) await peer.sync.synchronize();
  const migrate = (peer: typeof first) =>
    dataMigrationContext.run(
      { key: JSON.stringify([owner.extensionId, "project", projectId, 2]), histories: new Map() },
      () =>
        peer.records.commit({
          operationId: crypto.randomUUID(),
          edits: [{ recordId: "template", replace: { body: "# Template\n\nFill this in." } }],
        }),
    );
  await migrate(first);
  await migrate(second);
  await first.sync.synchronize();
  await second.sync.synchronize();
  await first.sync.synchronize();
  for (const peer of [first, second])
    expect(await peer.value("template")).toEqual({ body: "# Template\n\nFill this in." });
});

test("a new device downloads a large owner from chunked latest states with a bounded number of requests", async () => {
  const fixture = createRelay();
  const first = await device(fixture.relay, { bytes: 1_048_576, updates: 3 });
  for (let round = 0; round < 5; round++) {
    await first.records.commit({
      operationId: `round-${round}`,
      edits: Array.from({ length: 60 }, (_, index) => ({
        recordId: `record-${round}-${index}`,
        replace: { round, index, text: "x".repeat(2_000) },
      })),
    });
    await first.sync.synchronize();
  }
  expect(fixture.requests.states).toBeGreaterThan(0);
  fixture.trim();
  const reads = fixture.requests.reads;
  const third = await device(fixture.relay);
  await third.sync.synchronize();
  expect((await third.records.list()).length).toBe(300);
  for (const round of [0, 4]) expect(await third.value(`record-${round}-59`)).toMatchObject({ round, index: 59 });
  // 300 records arrive through a few reads and chunk downloads, not one request per record.
  expect(fixture.requests.reads - reads + fixture.requests.blobs).toBeLessThan(20);
});

test("a record's file reaches the other device before the record does", async () => {
  const { relay } = createRelay();
  const first = await device(relay);
  const second = await device(relay);
  const bytes = new TextEncoder().encode("image bytes");
  const hash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
  const asset = { sha256: hash, byteLength: bytes.length, mediaType: "image/png" };
  first.assets.files.set(hash, bytes);
  await first.records.commit({ operationId: "image", edits: [{ recordId: "image", replace: "cover", asset }] });
  await first.sync.synchronize();
  await second.sync.synchronize();
  expect((await second.records.read("image")).asset).toEqual(asset);
  expect(second.assets.files.get(hash)).toEqual(bytes);
});

test("a save larger than one relay update still arrives as one unit", async () => {
  const fixture = createRelay();
  const first = await device(fixture.relay);
  const second = await device(fixture.relay);
  for (const peer of [first, second]) await peer.sync.synchronize();
  const large = (seed: string) => `${seed}\n${"y".repeat(600_000)}`;
  await first.records.commit({
    operationId: "large",
    edits: [
      { recordId: "left", replace: large("left") },
      { recordId: "right", replace: large("right") },
    ],
  });
  const before = fixture.updates().length;
  await first.sync.synchronize();
  expect(fixture.updates().length).toBe(before + 1);
  await second.sync.synchronize();
  expect(await second.value("left")).toBe(large("left"));
  expect(await second.value("right")).toBe(large("right"));
});
