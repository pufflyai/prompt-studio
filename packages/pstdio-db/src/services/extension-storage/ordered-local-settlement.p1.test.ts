import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isNotNull, sql } from "drizzle-orm";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createRecordStreamSync } from "pstdio-sync/relay";
import * as Y from "yjs";
import { createDb } from "../../db/connection.pglite";
import {
  projects,
  storage_ordered_operations,
  storage_ordered_touches,
  storage_record_sync,
} from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { createAssets, createRelay } from "./record-stream-relay.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const peers = async (path = ":memory:", single = false) => {
  const projectId = crypto.randomUUID();
  const owner = { workbenchId: projectId, extensionId: "example.board" };
  const space = await createSyncSpace({
    projectId,
    spaceOwner: null,
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const documentId = await space.documentId(JSON.stringify([owner.extensionId, "record-stream"]));
  const { relay } = createRelay();
  const device = async (path = ":memory:") => {
    const { db, close } = await createDb({ path });
    cleanup.push(close);
    const now = new Date().toISOString();
    await db
      .insert(projects)
      .values({ id: projectId, name: "Board", shorthand: "B", created_at: now, updated_at: now })
      .onConflictDoNothing();
    const service = createDocumentStorageDBService(db);
    const assets = createAssets();
    const records = service.open({
      owner,
      assets: assets.store,
      textFields: [{ prefix: "card", fields: ["/description"] }],
    }).records;
    const store = service.documents.recordStream(owner);
    const failures: unknown[] = [];
    const sync = createRecordStreamSync({
      space,
      documentId,
      relay,
      store,
      assets: assets.store,
      quarantine: async (failure) => {
        failures.push(failure);
      },
    });
    return {
      db,
      assets,
      records,
      store,
      sync,
      failures,
      service,
      owner,
      space,
      relay,
      reopen: () => device(path),
      close: async () => {
        cleanup.splice(cleanup.indexOf(close), 1);
        await service.flushStatistics();
        await close();
      },
    };
  };
  const first = await device(path);
  return [first, single ? first : await device()] as const;
};

test("pending progress isolates every project and extension including unrelated legacy admission", async () => {
  const [first] = await peers(":memory:", true);
  const emptyOwner = { ...first.owner, extensionId: "example.empty" };
  const empty = first.service.documents.recordStream(emptyOwner);
  const otherProjectId = crypto.randomUUID();
  const now = new Date().toISOString();
  await first.db
    .insert(projects)
    .values({ id: otherProjectId, name: "Other", shorthand: "O", created_at: now, updated_at: now });
  const crossProject = first.service.documents.recordStream({ ...first.owner, workbenchId: otherProjectId });
  expect(await empty.pending()).toBe(false);
  expect(await crossProject.pending()).toBe(false);
  await first.records.commit({ operationId: "isolation-local", edits: [{ recordId: "card", replace: 1 }] });
  expect(await first.store.pending()).toBe(true);
  expect(await empty.pending()).toBe(false);
  expect(await crossProject.pending()).toBe(false);
  await first.sync.synchronize();
  expect(await first.store.pending()).toBe(false);
  await first.records.commit({ operationId: "isolation-queued", edits: [{ recordId: "card", replace: 2 }] });
  expect(await first.store.pending()).toBe(true);
  expect(await empty.pending()).toBe(false);
  expect(await crossProject.pending()).toBe(false);
  await first.sync.synchronize();
  const localOwner = { ...first.owner, extensionId: "example.prejoin" };
  const local = first.service.open({ owner: localOwner }).records;
  const localStream = first.service.documents.recordStream(localOwner);
  await local.commit({ operationId: "prejoin-isolation", edits: [{ recordId: "local", replace: true }] });
  expect(await localStream.pending()).toBe(true);
  // A historical cursor belongs only to its own project/extension, like canonical and pending rows.
  await first.db
    .insert(storage_record_sync)
    .values({ workbench_id: otherProjectId, extension_id: "example.legacy", joined: true });
  expect(await localStream.pending()).toBe(true);
  expect(await empty.pending()).toBe(false);
  expect(await crossProject.pending()).toBe(false);
});

test("pending progress reads stay read-only after initialization across local and Cloud settlement", async () => {
  const [first, second] = await peers();
  expect(await first.store.pending()).toBe(false);
  const pendingRead = async () => {
    await first.db.execute(sql`SET default_transaction_read_only = on`);
    try {
      return await first.store.pending();
    } finally {
      await first.db.execute(sql`SET default_transaction_read_only = off`);
    }
  };
  await first.records.commit({ operationId: "status-local", edits: [{ recordId: "card", replace: 1 }] });
  expect(await pendingRead()).toBe(true);
  await first.sync.synchronize();
  await second.sync.synchronize();
  expect(await pendingRead()).toBe(false);
  await first.records.commit({ operationId: "status-offline", edits: [{ recordId: "card", replace: 2 }] });
  expect(await pendingRead()).toBe(true);
  await first.sync.synchronize();
  await second.sync.synchronize();
  expect(await pendingRead()).toBe(false);
  await first.store.apply([], { ...(await first.store.open()), joined: false });
  expect(await pendingRead()).toBe(false);
  expect((await second.records.read("card")).value).toBe(2);
});

test("never-joined saves settle immediately without retaining envelopes; exact retries keep their outcome", async () => {
  const [first] = await peers(":memory:", true);
  const initial = { operationId: "seed", edits: [{ recordId: "card", replace: { count: 0 } }] };
  await first.records.commit(initial);
  const observed = await first.records.read("card");
  for (let count = 1; count <= 100; count++)
    await first.records.commit({
      operationId: `save-${count}`,
      edits: [{ recordId: "card", set: { "/count": count } }],
    });
  expect(
    await first.db.select().from(storage_ordered_operations).where(isNotNull(storage_ordered_operations.envelope)),
  ).toEqual([]);
  expect(await first.db.select().from(storage_ordered_touches)).toEqual([]);
  expect(await first.records.commit(initial)).toMatchObject({ state: "saved-locally" });
  await expect(
    first.records.commit({ ...initial, edits: [{ recordId: "card", replace: { count: -1 } }] }),
  ).rejects.toThrow("identity");
  await first.records.commit({
    operationId: "stale",
    edits: [{ recordId: "card", replace: { count: -1 }, expectedRevision: observed.revision }],
  });
  expect(await first.records.outcome("stale")).toMatchObject({ state: "refused" });
  expect((await first.records.read("card")).value).toEqual({ count: 100 });
  await first.sync.synchronize();
  expect((await first.store.open()).joined).toBe(true);
  expect(await first.records.outcome("seed")).toMatchObject({ state: "synced" });
  await first.records.commit({ operationId: "joined-offline", edits: [{ recordId: "card", set: { "/count": 101 } }] });
  expect(
    await first.db.select().from(storage_ordered_operations).where(isNotNull(storage_ordered_operations.envelope)),
  ).toHaveLength(1);
});

test("first adoption submits the local canonical records unconditionally after the remote tail", async () => {
  const [first, second] = await peers();
  await first.records.commit({
    operationId: "remote-seed",
    edits: [
      { recordId: "card", replace: { model: "remote", description: "remote text" } },
      { recordId: "gone", replace: true },
    ],
  });
  await first.sync.synchronize();
  await first.records.commit({
    operationId: "remote-tail",
    edits: [{ recordId: "card", set: { "/model": "later remote" } }],
  });
  await first.sync.synchronize();
  await second.records.commit({
    operationId: "local-seed",
    edits: [
      { recordId: "card", replace: { model: "local", description: "local text" } },
      { recordId: "gone", replace: true },
    ],
  });
  const observed = await second.records.read("card");
  await second.records.commit({
    operationId: "prejoin-condition",
    edits: [
      { recordId: "card", set: { "/model": "local conditional" }, expectedRevision: observed.revision },
      { recordId: "gone", deleted: true },
    ],
  });
  await second.sync.synchronize();
  await first.sync.synchronize();
  for (const peer of [first, second]) {
    expect((await peer.records.read("card")).value).toEqual({ model: "local conditional", description: "local text" });
    expect((await peer.records.read("gone")).deleted).toBe(true);
    expect(peer.failures).toEqual([]);
  }
  expect(await second.records.outcome("prejoin-condition")).not.toMatchObject({ state: "refused" });
});

test("a local save after capturing a founding state survives publication", async () => {
  const [first, second] = await peers();
  await first.records.commit({ operationId: "before-snapshot", edits: [{ recordId: "card", replace: { count: 1 } }] });
  await first.store.connect!(first.space, first.relay);
  const snapshot = await first.store.snapshot({ found: true, relayEmpty: true });
  await first.records.commit({ operationId: "during-upload", edits: [{ recordId: "card", set: { "/count": 2 } }] });
  await first.store.published(
    { joined: true, after: 0, stateId: "staged", through: 0, pendingBytes: 0, stateBytes: 1, skipped: false },
    snapshot.outbox,
  );
  expect((await first.records.read("card")).value).toEqual({ count: 2 });
  expect(await first.store.pending()).toBe(true);
  expect(second.failures).toEqual([]);
});

test("local receipt identity and atomic refusal survive a database restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ordered-local-settlement-"));
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  const [first] = await peers(join(directory, "database"), true);
  const seed = { operationId: "restart-seed", edits: [{ recordId: "card", replace: { count: 0 } }] };
  await first.records.commit(seed);
  const observed = await first.records.read("card");
  await first.records.commit({ operationId: "away", edits: [{ recordId: "card", set: { "/count": 1 } }] });
  await first.records.commit({ operationId: "back", edits: [{ recordId: "card", set: { "/count": 0 } }] });
  await first.close();
  const reopened = await first.reopen();
  await reopened.records.commit({
    operationId: "stale-after-restart",
    edits: [
      { recordId: "card", set: { "/count": 9 }, expectedRevision: observed.revision },
      { recordId: "side-effect", replace: true },
    ],
  });
  expect(await reopened.records.outcome("restart-seed")).toMatchObject({ state: "saved-locally" });
  expect(await reopened.records.outcome("stale-after-restart")).toMatchObject({ state: "refused" });
  expect((await reopened.records.read("side-effect")).exists).toBe(false);
  expect(await reopened.records.commit(seed)).toMatchObject({ state: "saved-locally" });
  await expect(
    reopened.records.commit({ ...seed, edits: [{ recordId: "card", replace: { count: -1 } }] }),
  ).rejects.toThrow("identity");
});

test("losing a founding CAS adopts the winner before resubmitting local records", async () => {
  const [first, second] = await peers();
  await first.records.commit({ operationId: "loser-local", edits: [{ recordId: "card", replace: { count: 1 } }] });
  await second.records.commit({ operationId: "winner-local", edits: [{ recordId: "card", replace: { count: 2 } }] });
  const replace = first.relay.replace;
  let raced = false;
  first.relay.replace = async (state) => {
    if (!raced) {
      raced = true;
      await second.sync.synchronize();
    }
    return replace(state);
  };
  await first.sync.synchronize();
  await second.sync.synchronize();
  for (const peer of [first, second]) {
    expect((await peer.records.read("card")).value).toEqual({ count: 1 });
    expect(peer.failures).toEqual([]);
  }
});

test("first adoption preserves a local native field and revives a remotely deleted record", async () => {
  const [first, second] = await peers();
  await first.records.commit({
    operationId: "remote",
    edits: [
      { recordId: "card", replace: { description: "remote" } },
      { recordId: "card-revive", replace: { description: "old" } },
    ],
  });
  await first.sync.synchronize();
  await first.records.commit({ operationId: "remote-delete", edits: [{ recordId: "card-revive", deleted: true }] });
  await first.sync.synchronize();
  await second.records.commit({
    operationId: "local",
    edits: [
      { recordId: "card", replace: { description: "local" } },
      { recordId: "card-revive", replace: { description: "new" } },
    ],
  });
  const key = "7".repeat(64);
  await second.records.bindText({ recordId: "card", field: "/description", documentKey: key });
  const native = second.service.openNativeTextDocument({ owner: second.owner, fileId: key });
  expect(await native.read()).toBe("local");
  const old = await native.snapshot();
  await second.sync.synchronize();
  await first.sync.synchronize();
  expect(await native.read()).toBe("local");
  const editor = new Y.Doc();
  try {
    Y.applyUpdate(editor, old.state);
    editor.getText("content").insert(5, "!");
    await native.applySource(editor, { generation: old.generation });
  } finally {
    editor.destroy();
  }
  expect(await native.read()).toBe("local!");
  await second.sync.synchronize();
  await first.sync.synchronize();
  for (const peer of [first, second]) {
    expect((await peer.records.read("card-revive")).value).toEqual({ description: "new" });
    expect((await peer.records.read("card-revive")).deleted).toBe(false);
    expect((await peer.records.read("card")).value).toEqual({ description: "local!" });
    expect(peer.failures).toEqual([]);
  }
});

for (const remoteDeleted of [false, true]) {
  test(`first join protects a pre-join native editor with ${remoteDeleted ? "retired" : "equal-byte independent"} text history`, async () => {
    const [first, second] = await peers();
    await first.records.commit({
      operationId: "remote-text",
      edits: [{ recordId: "card", replace: { description: "equal" } }],
    });
    await first.sync.synchronize();
    if (remoteDeleted) {
      await first.records.commit({ operationId: "remote-retire", edits: [{ recordId: "card", deleted: true }] });
      await first.sync.synchronize();
    }
    await second.records.commit({
      operationId: "local-text",
      edits: [{ recordId: "card", replace: { description: "equal" } }],
    });
    const key = "8".repeat(64);
    await second.records.bindText({ recordId: "card", field: "/description", documentKey: key });
    const native = second.service.openNativeTextDocument({ owner: second.owner, fileId: key });
    const old = await native.snapshot();
    await second.sync.synchronize();
    await first.sync.synchronize();
    const editor = new Y.Doc();
    try {
      Y.applyUpdate(editor, old.state);
      editor.getText("content").insert(5, "!");
      if (remoteDeleted) {
        expect((await native.snapshot()).generation).not.toBe(old.generation);
        await expect(native.applySource(editor, { generation: old.generation })).rejects.toMatchObject({
          code: "native_source_recovery",
        });
        const { native_document_rooms } = await import("../../db/schemas.pg");
        const recovered = await second.db.select().from(native_document_rooms);
        expect(recovered.some((room) => room.document_key === key)).toBe(true);
        expect(await native.read()).toBe("equal");
      } else {
        await native.applySource(editor, { generation: old.generation });
        expect(await native.read()).toBe("equal!");
      }
    } finally {
      editor.destroy();
    }
    expect(second.failures).toEqual([]);
  });
}

test("refusing a delayed first-join text save preserves its captured native lineage after peer retirement", async () => {
  const [first, second] = await peers();
  await first.records.commit({
    operationId: "remote-base",
    edits: [{ recordId: "card", replace: { model: "base", description: "base" } }],
  });
  await first.sync.synchronize();
  await first.records.commit({ operationId: "remote-first-retire", edits: [{ recordId: "card", deleted: true }] });
  await first.records.commit({
    operationId: "remote-first-recreate",
    edits: [{ recordId: "card", deleted: false, replace: { model: "remote", description: "remote" } }],
  });
  await first.sync.synchronize();
  await second.records.commit({
    operationId: "local-base",
    edits: [{ recordId: "card", replace: { model: "base", description: "base" } }],
  });
  const key = "9".repeat(64);
  await second.records.bindText({ recordId: "card", field: "/description", documentKey: key });
  const native = second.service.openNativeTextDocument({ owner: second.owner, fileId: key });
  await second.records.commit({
    operationId: "local-kept",
    edits: [{ recordId: "card", set: { "/description": "local" } }],
  });
  const update = second.relay.update;
  second.relay.update = async () => {
    throw new Error("Upload paused");
  };
  await expect(second.sync.synchronize()).rejects.toThrow("Upload paused");
  expect((await native.snapshot()).generation).toBeDefined();
  await native.save("local!");
  second.relay.update = update;
  await first.records.commit({ operationId: "retire-before-upload", edits: [{ recordId: "card", deleted: true }] });
  await first.sync.synchronize();
  await second.sync.synchronize();
  const { native_document_rooms } = await import("../../db/schemas.pg");
  const privateText: string[] = [];
  for (const room of await second.db.select().from(native_document_rooms)) {
    if (room.document_key !== key) continue;
    const copy = new Y.Doc();
    try {
      Y.applyUpdate(copy, room.state);
      privateText.push(copy.getText("content").toString());
    } finally {
      copy.destroy();
    }
  }
  expect(privateText).toContain("local!");
  expect(second.failures).toEqual([]);
});

test("first adoption uploads the asset captured by a locally settled whole-record save", async () => {
  const [first, second] = await peers();
  await first.records.commit({ operationId: "remote-asset-base", edits: [{ recordId: "card", replace: "remote" }] });
  await first.sync.synchronize();
  const bytes = new TextEncoder().encode("local attachment before Cloud");
  const sha256 = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
  const asset = { sha256, byteLength: bytes.length, mediaType: "text/plain" };
  second.assets.files.set(sha256, bytes);
  await second.records.commit({
    operationId: "local-asset",
    edits: [{ recordId: "card", replace: "local", asset }],
  });
  await second.sync.synchronize();
  await first.sync.synchronize();
  expect((await first.records.read("card")).asset).toEqual(asset);
  expect(first.assets.files.get(sha256)).toEqual(bytes);
  expect(first.failures).toEqual([]);
  expect(second.failures).toEqual([]);
});
