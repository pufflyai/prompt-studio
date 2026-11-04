import { afterEach, expect, test } from "bun:test";
import { createSyncSpace, openUpdate } from "pstdio-sync/encryption";
import {
  createRecordStreamSync,
  decodeOrderedEntry,
  decodeRecordFrame,
  type RecordStreamStore,
} from "pstdio-sync/relay";
import * as Y from "yjs";
import { createDb } from "../../db/connection.pglite";
import {
  native_document_rooms,
  projects,
  storage_ordered_operations,
  storage_ordered_receipts,
} from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { createRelay } from "./record-stream-relay.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const fixture = async () => {
  const projectId = crypto.randomUUID();
  const owner = { workbenchId: projectId, extensionId: "example.native" };
  const space = await createSyncSpace({
    projectId,
    spaceOwner: null,
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const documentId = await space.documentId(JSON.stringify([owner.extensionId, "record-stream"]));
  const relay = createRelay();
  const device = async (wrap: (store: RecordStreamStore) => RecordStreamStore = (store) => store) => {
    const { db, close } = await createDb({ path: ":memory:" });
    cleanup.push(close);
    const now = new Date().toISOString();
    await db
      .insert(projects)
      .values({ id: projectId, name: "Native", shorthand: "N", created_at: now, updated_at: now });
    const service = createDocumentStorageDBService(db);
    const records = service.open({ owner, textFields: [{ prefix: "card:", fields: ["/body"] }] }).records;
    const start = () =>
      createRecordStreamSync({
        space,
        documentId,
        relay: relay.relay,
        store: wrap(service.documents.recordStream(owner)),
        quarantine: async () => {},
      });
    return {
      db,
      service,
      records,
      sync: start(),
      restart: start,
      native: (key: string) => service.openNativeTextDocument({ owner, fileId: key }),
    };
  };
  return { owner, space, documentId, relay, device };
};
const type = async (
  native: ReturnType<Awaited<ReturnType<Awaited<ReturnType<typeof fixture>>["device"]>>["native"]>,
  value: string,
) => {
  const snapshot = await native.snapshot();
  const source = new Y.Doc();
  try {
    Y.applyUpdate(source, snapshot.state);
    source.getText("content").insert(source.getText("content").length, value);
    await native.applySource(source, { generation: snapshot.generation });
  } finally {
    source.destroy();
  }
};

test("native typing uses idempotent text frames without permanent operation receipts per keystroke", async () => {
  const f = await fixture();
  const first = await f.device();
  const second = await f.device();
  await first.records.commit({ operationId: "seed", edits: [{ recordId: "card:one", replace: { body: "base" } }] });
  const key = "f".repeat(64);
  await first.records.bindText({ recordId: "card:one", field: "/body", documentKey: key });
  await first.sync.synchronize();
  await second.sync.synchronize();
  const receipts = (await first.db.select().from(storage_ordered_receipts)).length;
  const before = f.relay.updates().length;
  const native = first.native(key);
  for (let index = 0; index < 12; index++) await type(native, ".");
  await first.sync.synchronize();
  await second.sync.synchronize();
  expect(await second.native(key).read()).toBe(`base${".".repeat(12)}`);
  expect((await first.db.select().from(storage_ordered_receipts)).length).toBe(receipts);
  const frames = [];
  for (const update of f.relay.updates().slice(before))
    for (const record of decodeRecordFrame(await openUpdate(f.space, f.documentId, update)).records)
      frames.push(await decodeOrderedEntry(record.bytes));
  expect(frames.length).toBe(12);
  expect(frames.every((entry) => entry.type === "text")).toBe(true);
  expect(
    (await first.db.select().from(storage_ordered_operations)).some((row) =>
      row.request_fingerprint?.startsWith("native-text:"),
    ),
  ).toBe(false);
});

test("pending native typing and conditional public text saves keep their authored order without native dependencies", async () => {
  const f = await fixture();
  const first = await f.device();
  const second = await f.device();
  await first.records.commit({ operationId: "seed", edits: [{ recordId: "card:one", replace: { body: "base" } }] });
  const key = "e".repeat(64);
  await first.records.bindText({ recordId: "card:one", field: "/body", documentKey: key });
  await first.sync.synchronize();
  await second.sync.synchronize();
  const initial = (await first.db.select().from(storage_ordered_receipts)).length;
  const before = f.relay.updates().length;
  await type(first.native(key), "A");
  const observed = await first.records.read("card:one");
  await first.records.commit({
    operationId: "guarded",
    edits: [
      {
        recordId: "card:one",
        expectedRevision: observed.revision,
        text: { "/body": [{ kind: "text.insert", index: 5, text: "G" }] },
      },
    ],
  });
  await type(first.native(key), "Z");
  await first.sync.synchronize();
  await second.sync.synchronize();
  expect(await second.native(key).read()).toBe("baseAGZ");
  expect((await first.records.outcome("guarded"))?.state).toBe("synced");
  expect((await first.db.select().from(storage_ordered_receipts)).length).toBe(initial + 1);
  const entries = [];
  for (const update of f.relay.updates().slice(before))
    for (const record of decodeRecordFrame(await openUpdate(f.space, f.documentId, update)).records)
      entries.push(await decodeOrderedEntry(record.bytes));
  expect(entries.map((entry) => entry.type)).toEqual(["text", "admission", "text"]);
  const last = entries.at(-1)!;
  if (last.type !== "text") throw new Error("Expected native frame");
  expect(last.admission.dependencies.map((dependency) => dependency.operationId)).toEqual(["guarded"]);
});

test("lost native acknowledgement and later duplicate structs do not create receipts or regress text observations", async () => {
  const f = await fixture();
  const first = await f.device();
  const second = await f.device();
  await first.records.commit({ operationId: "seed", edits: [{ recordId: "card:one", replace: { body: "base" } }] });
  const key = "d".repeat(64);
  await first.records.bindText({ recordId: "card:one", field: "/body", documentKey: key });
  await first.sync.synchronize();
  await second.sync.synchronize();
  const update = f.relay.relay.update;
  let loseAck = true;
  f.relay.relay.update = async (envelope) => {
    const result = await update(envelope);
    if (loseAck) {
      loseAck = false;
      throw new Error("Native ACK lost");
    }
    return result;
  };
  await type(first.native(key), "A");
  await expect(first.sync.synchronize()).rejects.toThrow("Native ACK lost");
  const nativeFrame = f.relay.updates().at(-1)!;
  await first.restart().synchronize();
  await second.sync.synchronize();
  await second.records.commit({
    operationId: "later-public",
    edits: [{ recordId: "card:one", text: { "/body": [{ kind: "text.insert", index: 5, text: "G" }] } }],
  });
  await second.sync.synchronize();
  await first.restart().synchronize();
  const observed = await first.records.read("card:one");
  const receiptCount = (await first.db.select().from(storage_ordered_receipts)).length;
  await f.relay.relay.update({ ...nativeFrame, blobIds: [] });
  await first.restart().synchronize();
  expect(await first.native(key).read()).toBe("baseAG");
  expect((await first.records.read("card:one")).revision).toBe(observed.revision);
  expect((await first.db.select().from(storage_ordered_receipts)).length).toBe(receiptCount);
});

test("a founding native prefix survives crash after CAS through idempotent replay without keystroke receipts", async () => {
  const f = await fixture();
  let crash = true;
  const first = await f.device((store) => ({
    ...store,
    published: async (...args) => {
      if (crash) {
        crash = false;
        throw new Error("Crashed after founding CAS");
      }
      return (await store.published(...args)) ?? args[0];
    },
  }));
  await first.records.commit({ operationId: "seed", edits: [{ recordId: "card:one", replace: { body: "base" } }] });
  const key = "c".repeat(64);
  await first.records.bindText({ recordId: "card:one", field: "/body", documentKey: key });
  await type(first.native(key), "A");
  await expect(first.sync.synchronize()).rejects.toThrow("Crashed after founding CAS");
  expect(f.relay.latest()).not.toBeNull();
  await first.restart().synchronize();
  const second = await f.device();
  await second.sync.synchronize();
  expect(await second.native(key).read()).toBe("baseA");
  expect((await first.db.select().from(storage_ordered_receipts)).length).toBe(2);
  expect(
    (await first.db.select().from(storage_ordered_operations)).some((row) =>
      row.request_fingerprint?.startsWith("native-text:"),
    ),
  ).toBe(false);
});

test("native typing that observed a refused group stays private and creates no descendant receipt", async () => {
  const f = await fixture();
  const first = await f.device();
  const second = await f.device();
  await first.records.commit({
    operationId: "seed",
    edits: [{ recordId: "card:one", replace: { body: "base", model: "small" } }],
  });
  const key = "b".repeat(64);
  await first.records.bindText({ recordId: "card:one", field: "/body", documentKey: key });
  await first.sync.synchronize();
  await second.sync.synchronize();
  const observed = await first.records.read("card:one");
  await first.records.commit({
    operationId: "careful",
    edits: [
      {
        recordId: "card:one",
        expectedRevision: observed.revision,
        set: { "/model": "careful" },
        text: { "/body": [{ kind: "text.insert", index: 0, text: "S" }] },
      },
    ],
  });
  await type(first.native(key), "T");
  await second.records.commit({
    operationId: "competing",
    edits: [{ recordId: "card:one", set: { "/model": "remote" } }],
  });
  await second.sync.synchronize();
  await first.sync.synchronize();
  await second.sync.synchronize();
  for (const peer of [first, second])
    expect((await peer.records.read("card:one")).value).toEqual({ body: "base", model: "remote" });
  expect((await first.records.outcome("careful"))?.state).toBe("refused");
  expect((await first.db.select().from(storage_ordered_receipts)).length).toBe(4);
  expect(
    (await first.db.select().from(storage_ordered_operations)).some((row) =>
      row.request_fingerprint?.startsWith("native-text:"),
    ),
  ).toBe(false);
  const retained = await first.db.select().from(native_document_rooms);
  expect(
    retained.some((room) => {
      const document = new Y.Doc();
      try {
        Y.applyUpdate(document, room.state);
        return document.getText("content").toString() === "SbaseT";
      } finally {
        document.destroy();
      }
    }),
  ).toBe(true);
});

test("a foreign native child waits across restart and relay loss while independent work can found before its parent", async () => {
  const f = await fixture();
  const first = await f.device();
  const second = await f.device();
  await first.records.commit({
    operationId: "seed-foreign",
    edits: [{ recordId: "card:one", replace: { body: "base", model: "small" } }],
  });
  const key = "a".repeat(64);
  await first.records.bindText({ recordId: "card:one", field: "/body", documentKey: key });
  await first.sync.synchronize();
  await second.sync.synchronize();
  await first.records.commit({
    operationId: "foreign-parent",
    edits: [{ recordId: "card:one", text: { "/body": [{ kind: "text.insert", index: 4, text: "A" }] } }],
  });
  const source = await first.native(key).snapshot();
  const oversized = new Y.Doc();
  try {
    Y.applyUpdate(oversized, source.state);
    oversized.getText("content").insert(oversized.getText("content").length, "x".repeat(256 * 1024));
    await expect(second.native(key).applySource(oversized, { generation: source.generation })).rejects.toMatchObject({
      code: "storage_limit_exceeded",
    });
  } finally {
    oversized.destroy();
  }
  const document = new Y.Doc();
  try {
    Y.applyUpdate(document, source.state);
    document.getText("content").insert(document.getText("content").length, "Z");
    await second.native(key).applySource(document, { generation: source.generation });
  } finally {
    document.destroy();
  }
  expect(await second.native(key).read()).toBe("base");
  await second.records.commit({
    operationId: "independent-foreign",
    edits: [{ recordId: "card:one", set: { "/model": "remote" } }],
  });
  f.relay.lose();
  await second.restart().synchronize();
  expect((await second.records.read("card:one")).value).toEqual({ body: "base", model: "remote" });
  expect((await second.records.outcome("independent-foreign"))?.state).toBe("synced");
  expect(
    (await second.db.select().from(storage_ordered_operations)).some(
      (row) => row.request_fingerprint?.startsWith("native-text:") && !row.settled_epoch,
    ),
  ).toBe(true);
  await first.sync.synchronize();
  await second.restart().synchronize();
  await first.sync.synchronize();
  for (const peer of [first, second])
    expect((await peer.records.read("card:one")).value).toEqual({ body: "baseAZ", model: "remote" });
  expect(
    (await second.db.select().from(storage_ordered_operations)).some((row) =>
      row.request_fingerprint?.startsWith("native-text:"),
    ),
  ).toBe(false);
});

test("a recovered full editor state cannot strip a foreign pending group's proof and republish refused text", async () => {
  const f = await fixture();
  const first = await f.device();
  const second = await f.device();
  const key = "a".repeat(64);
  await first.records.commit({
    operationId: "seed",
    edits: [{ recordId: "card:one", replace: { body: "base", model: "small" } }],
  });
  await first.records.bindText({ recordId: "card:one", field: "/body", documentKey: key });
  await first.sync.synchronize();
  await second.sync.synchronize();
  const observed = await first.records.read("card:one");
  await first.records.commit({
    operationId: "careful",
    edits: [
      {
        recordId: "card:one",
        expectedRevision: observed.revision,
        set: { "/model": "careful" },
        text: { "/body": [{ kind: "text.insert", index: 0, text: "REFUSED " }] },
      },
    ],
  });
  const forwarded = await first.native(key).snapshot();
  const forged = new Y.Doc();
  try {
    Y.applyUpdate(forged, forwarded.state);
    forged.getMap("ordered-text-frontier").clear();
    await expect(second.native(key).applySource(forged, { generation: forwarded.generation })).rejects.toMatchObject({
      code: "invalid_frame",
    });
  } finally {
    forged.destroy();
  }
  await second.records.commit({
    operationId: "competing",
    edits: [{ recordId: "card:one", set: { "/model": "remote" } }],
  });
  await second.sync.synchronize();
  await first.sync.synchronize();
  await second.sync.synchronize();
  expect((await first.records.outcome("careful"))?.state).toBe("refused");
  expect(await first.native(key).read()).toBe("base");
  expect(await second.native(key).read()).toBe("base");
});
