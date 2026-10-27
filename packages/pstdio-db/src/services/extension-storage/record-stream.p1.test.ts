import { afterEach, expect, test } from "bun:test";
import {
  createSyncSpace,
  editResourceDocument,
  NativeSourceRecoveryError,
  openUpdate,
  readDocumentRecord,
  recordTextBindingUpdate,
  sealUpdate,
} from "pstdio-sync";
import {
  createRecordStreamSync,
  decodeRecordFrame,
  encodeRecordFrame,
  type RecordStreamStore,
  type SyncFailure,
} from "pstdio-sync/relay";
import type { UpdateEnvelope } from "pstdio-sync-contracts";
import * as Y from "yjs";
import { createDb } from "../../db/connection.pglite";
import { projects, storage_record_sync } from "../../db/schemas.pg";
import { dataMigrationContext } from "./data-migration-context";
import { createDocumentStorageDBService } from "./document-storage";
import { createAssets, createRelay } from "./record-stream-relay.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

const projectId = crypto.randomUUID();
const owner = { workbenchId: projectId, extensionId: "ext.notes" };
const space = await createSyncSpace({ projectId, spaceOwner: null, keys: [{ generation: 1, secret: "A".repeat(43) }] });
const documentId = await space.documentId(JSON.stringify([owner.extensionId, "record-stream"]));

const device = async (
  relay: ReturnType<typeof createRelay>["relay"],
  limits?: { bytes: number; updates: number },
  wrap: (store: RecordStreamStore) => RecordStreamStore = (store) => store,
) => {
  const { db, close } = await createDb({ path: ":memory:" });
  cleanup.push(close);
  const timestamp = new Date().toISOString();
  await db
    .insert(projects)
    .values({ id: projectId, name: "Notes", shorthand: "N", created_at: timestamp, updated_at: timestamp });
  const service = createDocumentStorageDBService(db);
  const assets = createAssets();
  const failures: unknown[] = [];
  const start = (startLimits = limits) =>
    createRecordStreamSync({
      space,
      documentId,
      relay,
      store: wrap(service.documents.recordStream(owner)),
      assets: assets.store,
      limits: startLimits,
      quarantine: async (failure) => {
        failures.push(failure);
      },
    });
  const records = service.open({ owner, assets: assets.store }).records;
  const value = async (recordId: string) => (await records.read(recordId)).value;
  // `restart` starts a new sync over the same database, as after an app restart or a reconnect.
  return { db, records, service, sync: start(), restart: start, assets, failures, value };
};

test("a saved pre-binding record keeps its outbox and a recoverable remote copy when adoption needs a decision", async () => {
  const { relay } = createRelay();
  const initial = await editResourceDocument(
    [],
    { recordId: "ticket", replace: { content: "Saved remotely before binding" } },
    true,
  );
  const bytes = Y.mergeUpdates([
    initial.checkpoint!,
    recordTextBindingUpdate("ticket", "a".repeat(64), {
      field: "/content",
      original: "Saved remotely before binding",
      lifetime: initial.record.recordLifetime!,
    }),
  ]);
  await relay.update(
    await sealUpdate(
      space,
      documentId,
      encodeRecordFrame({ records: [{ recordId: "ticket", bytes }], assets: [] }),
      [],
    ),
  );
  const second = await device(relay);
  const stream = second.service.documents.recordStream(owner);
  await stream.open();
  await second.records.commit({
    operationId: "second",
    edits: [{ recordId: "ticket", replace: { content: "Saved locally before binding" } }],
  });
  await expect(second.sync.synchronize()).rejects.toBeInstanceOf(NativeSourceRecoveryError);
  expect(await second.value("ticket")).toEqual({ content: "Saved locally before binding" });
  expect(await stream.pending()).toBe(true);
  expect(await stream.open()).toMatchObject({ joined: false, after: 0 });
  expect(await second.sync.status()).toMatchObject({ pending: true, needsAttention: true });
  const failure = second.failures[0] as SyncFailure;
  expect(JSON.stringify(failure)).not.toContain("Saved remotely before binding");
  const frame = decodeRecordFrame(
    await openUpdate(space, documentId, (failure.envelope as { update: UpdateEnvelope }).update),
  );
  const document = new Y.Doc();
  for (const record of frame.records) if (record.recordId === "ticket") Y.applyUpdate(document, record.bytes);
  expect((await readDocumentRecord(document, "ticket")).value).toEqual({ content: "Saved remotely before binding" });
  document.destroy();
});

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
  await first.records.commit({ operationId: "seed", edits: [{ recordId: "seed", replace: 1 }] });
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
  await first.records.commit({ operationId: "seed", edits: [{ recordId: "seed", replace: 1 }] });
  for (const peer of [first, second]) await peer.sync.synchronize();
  // Together the records are larger than one relay frame; each stays under the record limit.
  const large = (seed: string) => `${seed}\n${"y".repeat(250_000)}`;
  const ids = ["left", "right", "top", "bottom"];
  await first.records.commit({
    operationId: "large",
    edits: ids.map((id) => ({ recordId: id, replace: large(id) })),
  });
  const before = fixture.updates().length;
  await first.sync.synchronize();
  expect(fixture.updates().length).toBe(before + 1);
  await second.sync.synchronize();
  for (const id of ids) expect(await second.value(id)).toBe(large(id));
});

test("a network error while joining is retried instead of skipping the founding records", async () => {
  const fixture = createRelay();
  const first = await device(fixture.relay);
  await first.records.commit({ operationId: "seed", edits: [{ recordId: "note", replace: { title: "Draft" } }] });
  await first.sync.synchronize();
  let failing = true;
  const flaky = {
    ...fixture.relay,
    state: async () => {
      if (failing) {
        failing = false;
        throw new Error("Network unavailable");
      }
      return fixture.relay.state();
    },
  };
  const second = await device(flaky);
  await expect(second.sync.synchronize()).rejects.toThrow("Network unavailable");
  await second.sync.synchronize();
  expect(await second.value("note")).toEqual({ title: "Draft" });
  expect(second.failures).toEqual([]);
});

test("a device catches up without looping when another device founds a stream the relay lost", async () => {
  const fixture = createRelay();
  const first = await device(fixture.relay);
  const second = await device(fixture.relay);
  for (let index = 0; index < 3; index++) {
    await first.records.commit({
      operationId: `save-${index}`,
      edits: [{ recordId: `note-${index}`, replace: index }],
    });
    await first.sync.synchronize();
  }
  await second.sync.synchronize();
  fixture.lose();
  await first.records.commit({ operationId: "after-loss", edits: [{ recordId: "late", replace: "written later" }] });
  await first.sync.synchronize();
  await second.sync.synchronize();
  expect(await second.value("late")).toBe("written later");
  expect(await second.value("note-2")).toBe(2);
});

test("a frame with a record that cannot be merged is skipped whole", async () => {
  const fixture = createRelay();
  const first = await device(fixture.relay);
  await first.records.commit({ operationId: "seed", edits: [{ recordId: "seed", replace: 1 }] });
  await first.sync.synchronize();
  const valid = await editResourceDocument([], { recordId: "a", replace: "half of a save" }, true);
  const frame = encodeRecordFrame({
    records: [
      { recordId: "a", bytes: valid.update! },
      { recordId: "b", bytes: new Uint8Array([255, 1, 2, 3]) },
    ],
    assets: [],
  });
  const update = await sealUpdate(space, documentId, frame, []);
  await fixture.relay.update(update);
  const second = await device(fixture.relay);
  await second.sync.synchronize();
  expect((await second.records.read("a")).exists).toBe(false);
  expect(second.failures).toContainEqual(expect.objectContaining({ id: update.updateId }));
  expect((await second.sync.status()).needsAttention).toBe(true);
});

test("a device that joins again with history it already shares merges instead of overwriting", async () => {
  const fixture = createRelay();
  const first = await device(fixture.relay);
  const second = await device(fixture.relay);
  await first.records.commit({ operationId: "seed", edits: [{ recordId: "note", replace: { title: "W", body: "" } }] });
  await first.sync.synchronize();
  await second.sync.synchronize();
  await first.records.commit({
    operationId: "body",
    edits: [{ recordId: "note", replace: { title: "W", body: "from first" } }],
  });
  await first.sync.synchronize();
  await second.records.commit({
    operationId: "title",
    edits: [{ recordId: "note", replace: { title: "Y", body: "" } }],
  });
  // The second device lost its place in the stream, for example after its owner data was reset.
  await second.db.delete(storage_record_sync);
  await second.sync.synchronize();
  await first.sync.synchronize();
  for (const peer of [first, second]) expect(await peer.value("note")).toEqual({ title: "Y", body: "from first" });
});

test("a record whose file cannot be decrypted is set aside instead of stopping the stream", async () => {
  const fixture = createRelay();
  const first = await device(fixture.relay);
  const second = await device(fixture.relay);
  await first.records.commit({ operationId: "seed", edits: [{ recordId: "seed", replace: 1 }] });
  for (const peer of [first, second]) await peer.sync.synchronize();
  const known = new Set(fixture.blobIds());
  const bytes = new TextEncoder().encode("image bytes");
  const hash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
  first.assets.files.set(hash, bytes);
  const asset = { sha256: hash, byteLength: bytes.length, mediaType: "image/png" };
  await first.records.commit({ operationId: "image", edits: [{ recordId: "image", replace: "cover", asset }] });
  await first.sync.synchronize();
  for (const blobId of fixture.blobIds()) if (!known.has(blobId)) fixture.damageBlob(blobId);
  await first.records.commit({ operationId: "after", edits: [{ recordId: "after", replace: "still syncs" }] });
  await first.sync.synchronize();
  await second.sync.synchronize();
  expect((await second.records.read("image")).exists).toBe(false);
  expect(await second.value("after")).toBe("still syncs");
  expect((await second.sync.status()).needsAttention).toBe(true);
});

test("a device does not join while the stream's latest state cannot be read", async () => {
  const fixture = createRelay();
  const first = await device(fixture.relay);
  await first.records.commit({ operationId: "seed", edits: [{ recordId: "note", replace: "line 1\nline 2" }] });
  await first.sync.synchronize();
  fixture.damageState();
  const second = await device(fixture.relay);
  await second.records.commit({ operationId: "own", edits: [{ recordId: "note", replace: "line 1\nline 2" }] });
  await second.sync.synchronize();
  // Uploading its own history of "note" now would duplicate the text once the state is readable.
  expect(fixture.updates()).toEqual([]);
  expect((await second.sync.status()).needsAttention).toBe(true);
});

// Every pass that finds updates after the latest state replaces it.
const compactEveryPass = { bytes: 1_048_576, updates: 0 };

const file = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  const hash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
  return { bytes, asset: { sha256: hash, byteLength: bytes.length, mediaType: "image/png" } };
};

test("a joined device retries a latest state it could not read instead of skipping its records", async () => {
  const fixture = createRelay();
  const first = await device(fixture.relay, compactEveryPass);
  const second = await device(fixture.relay);
  await first.records.commit({ operationId: "seed", edits: [{ recordId: "seed", replace: 1 }] });
  for (const peer of [first, second]) await peer.sync.synchronize();
  await first.records.commit({ operationId: "missed", edits: [{ recordId: "missed", replace: "in the state" }] });
  await first.sync.synchronize();
  // The relay removed the update, so the second device must load the latest state.
  fixture.trim();
  fixture.damageState();
  const updates = fixture.updates().length;
  await second.sync.synchronize();
  // Uploading its records against an unread state would repeat what the stream already holds.
  expect(fixture.updates().length).toBe(updates);
  expect((await second.sync.status()).needsAttention).toBe(true);
  fixture.repairState();
  await second.sync.synchronize();
  expect(await second.value("missed")).toBe("in the state");
});

test("a device that skipped an update does not replace the latest state after a restart", async () => {
  const fixture = createRelay();
  const first = await device(fixture.relay);
  const second = await device(fixture.relay);
  await first.records.commit({ operationId: "seed", edits: [{ recordId: "seed", replace: 1 }] });
  for (const peer of [first, second]) await peer.sync.synchronize();
  const frame = encodeRecordFrame({ records: [{ recordId: "b", bytes: new Uint8Array([255, 1, 2, 3]) }], assets: [] });
  await fixture.relay.update(await sealUpdate(space, documentId, frame, []));
  await second.sync.synchronize();
  const latest = fixture.latest();
  const restarted = second.restart(compactEveryPass);
  await second.records.commit({ operationId: "later", edits: [{ recordId: "later", replace: 2 }] });
  await restarted.synchronize();
  // A latest state from this device would claim to cover the update it never applied.
  expect(fixture.latest()).toBe(latest);
  expect((await restarted.status()).needsAttention).toBe(true);
});

test("a latest state lists the files its records point to, even when a file changes while it uploads", async () => {
  const fixture = createRelay();
  const cover = file("first cover");
  const replacement = file("second cover");
  let racing = false;
  let first: Awaited<ReturnType<typeof device>>;
  first = await device(fixture.relay, compactEveryPass, (store) => ({
    ...store,
    async snapshot() {
      const snapshot = await store.snapshot();
      if (racing) {
        racing = false;
        // The user replaces the file after the latest state read its records.
        first.assets.files.set(replacement.asset.sha256, replacement.bytes);
        await first.records.commit({
          operationId: "replace",
          edits: [{ recordId: "image", replace: "cover", asset: replacement.asset }],
        });
        fixture.failUpdates(true);
      }
      return snapshot;
    },
  }));
  first.assets.files.set(cover.asset.sha256, cover.bytes);
  await first.records.commit({
    operationId: "image",
    edits: [{ recordId: "image", replace: "cover", asset: cover.asset }],
  });
  await first.sync.synchronize();
  await first.records.commit({ operationId: "other", edits: [{ recordId: "other", replace: 1 }] });
  racing = true;
  await expect(first.sync.synchronize()).rejects.toThrow("Network unavailable");
  fixture.failUpdates(false);
  const second = await device(fixture.relay);
  await second.sync.synchronize();
  expect((await second.records.read("image")).asset).toEqual(cover.asset);
  expect(second.assets.files.get(cover.asset.sha256)).toEqual(cover.bytes);
});

test("a save with thousands of files still fits in one relay update", async () => {
  const fixture = createRelay();
  const first = await device(fixture.relay);
  const second = await device(fixture.relay);
  await first.records.commit({ operationId: "seed", edits: [{ recordId: "seed", replace: 1 }] });
  for (const peer of [first, second]) await peer.sync.synchronize();
  const edits = Array.from({ length: 4_500 }, (_, index) => {
    const { bytes, asset } = file(`image ${index}`);
    first.assets.files.set(asset.sha256, bytes);
    return { recordId: `image-${index}`, replace: index, asset };
  });
  await first.records.commit({ operationId: "import", edits });
  await first.sync.synchronize();
  await second.sync.synchronize();
  expect((await second.records.read("image-4499")).asset).toEqual(edits[4_499]!.asset);
}, 60_000);

test("devices that ran the same data migration on unrelated histories adopt instead of duplicating text", async () => {
  const { relay } = createRelay();
  const first = await device(relay);
  const second = await device(relay);
  for (const peer of [first, second]) {
    // Each device moved the record into its own document separately.
    await peer.records.commit({
      operationId: "upgrade",
      edits: [{ recordId: "note", replace: { body: "line 1\nline 2" } }],
    });
    // The migration adds the same new field on both devices, written by the same deterministic author.
    await dataMigrationContext.run(
      { key: JSON.stringify([owner.extensionId, "project", projectId, 4]), histories: new Map() },
      () =>
        peer.records.commit({
          operationId: crypto.randomUUID(),
          edits: [{ recordId: "note", replace: { body: "line 1\nline 2", track: "now" } }],
        }),
    );
  }
  await first.sync.synchronize();
  await second.sync.synchronize();
  await first.sync.synchronize();
  for (const peer of [first, second])
    expect(await peer.value("note")).toEqual({ body: "line 1\nline 2", track: "now" });
});

test("a device that skipped an update while joining does not replace the latest state after a restart", async () => {
  const fixture = createRelay();
  const first = await device(fixture.relay);
  await first.records.commit({ operationId: "seed", edits: [{ recordId: "seed", replace: 1 }] });
  await first.sync.synchronize();
  const frame = encodeRecordFrame({ records: [], assets: [] });
  const unreadable = await sealUpdate(space, documentId, frame, []);
  await fixture.relay.update({ ...unreadable, payload: Buffer.from("not a frame").toString("base64") });
  const second = await device(fixture.relay);
  await second.sync.synchronize();
  const latest = fixture.latest();
  const restarted = second.restart(compactEveryPass);
  await second.records.commit({ operationId: "later", edits: [{ recordId: "later", replace: 2 }] });
  await restarted.synchronize();
  // A latest state from this device would claim to cover the update it could not read.
  expect(fixture.latest()).toBe(latest);
  expect((await restarted.status()).needsAttention).toBe(true);
});
