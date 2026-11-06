import { afterEach, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createSyncSpace, openBlob, openUpdate } from "pstdio-sync/encryption";
import { createRecordStreamSync, decodeOrderedEntry, decodeRecordFrame, recordFrameLimit } from "pstdio-sync/relay";
import type { Json } from "pstdio-sync-contracts";
import * as Y from "yjs";
import { createDb } from "../../db/connection.pglite";
import { native_document_rooms, projects } from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { createNativeDocumentRoomsDBService } from "./native-document-rooms";
import { createRelay } from "./record-stream-relay.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

const peers = async (textFields: { prefix: string; fields: string[] }[] = []) => {
  const projectId = crypto.randomUUID();
  const owner = { workbenchId: projectId, extensionId: "example.board" };
  const space = await createSyncSpace({
    projectId,
    spaceOwner: null,
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const documentId = await space.documentId(JSON.stringify([owner.extensionId, "record-stream"]));
  const wire = createRelay();
  const { relay } = wire;
  const device = async () => {
    const { db, close } = await createDb({ path: ":memory:" });
    cleanup.push(close);
    const now = new Date().toISOString();
    await db
      .insert(projects)
      .values({ id: projectId, name: "Board", shorthand: "B", created_at: now, updated_at: now });
    const service = createDocumentStorageDBService(db);
    const records = service.open({ owner, textFields }).records;
    const failures: unknown[] = [];
    const store = service.documents.recordStream(owner);
    const sync = createRecordStreamSync({
      space,
      documentId,
      relay,
      store,
      quarantine: async (failure) => {
        failures.push(failure);
      },
    });
    return { records, sync, failures, service, db, owner, wire, space, documentId, store };
  };
  return [await device(), await device()] as const;
};

test("later joined saves retain peer edits and other local handles after optimistic projection reuse", async () => {
  const [first, second] = await peers();
  await first.records.commit({ operationId: "cache-seed", edits: [{ recordId: "card", replace: { local: 1 } }] });
  await first.sync.synchronize();
  await second.sync.synchronize();
  await first.records.commit({ operationId: "cache-local", edits: [{ recordId: "card", set: { "/local": 2 } }] });
  await first.sync.synchronize();
  await second.sync.synchronize();
  await second.records.commit({ operationId: "cache-peer", edits: [{ recordId: "card", set: { "/remote": true } }] });
  await second.sync.synchronize();
  await first.sync.synchronize();
  await first.records.commit({ operationId: "cache-after-peer", edits: [{ recordId: "card", set: { "/local": 3 } }] });
  const other = first.service.open({ owner: first.owner }).records;
  await other.commit({
    operationId: "cache-other-handle",
    edits: [{ recordId: "card", set: { "/other": "retained" } }],
  });
  await first.records.commit({
    operationId: "cache-after-handle",
    edits: [{ recordId: "card", set: { "/local": 4 } }],
  });
  expect((await first.records.read("card")).value).toEqual({ local: 4, remote: true, other: "retained" });
  await first.sync.synchronize();
  await second.sync.synchronize();
  expect((await second.records.read("card")).value).toEqual({ local: 4, remote: true, other: "retained" });
  expect(first.failures).toEqual([]);
  expect(second.failures).toEqual([]);
});

test("a rolled-back callback cannot become the baseline of the next optimistic save", async () => {
  const [first, second] = await peers();
  await first.records.commit({ operationId: "rollback-seed", edits: [{ recordId: "card", replace: { kept: 1 } }] });
  await first.sync.synchronize();
  await first.records.commit({ operationId: "rollback-local", edits: [{ recordId: "card", set: { "/kept": 2 } }] });
  await expect(
    first.records.transaction(async (records) => {
      await records.commit({ operationId: "rolled-back", edits: [{ recordId: "card", set: { "/discard": true } }] });
      throw new Error("Roll back the callback");
    }),
  ).rejects.toThrow("Roll back the callback");
  await first.records.commit({ operationId: "after-rollback", edits: [{ recordId: "card", set: { "/next": true } }] });
  expect((await first.records.read("card")).value).toEqual({ kept: 2, next: true });
  expect(await first.records.outcome("rolled-back")).toBeUndefined();
  await first.sync.synchronize();
  await second.sync.synchronize();
  expect((await second.records.read("card")).value).toEqual({ kept: 2, next: true });
});

test("ready saves share a bounded transport batch while keeping their individual atomic outcomes", async () => {
  const started = performance.now();
  const phases: { phase: string; elapsedMs: number }[] = [];
  const phase = (name: string) => {
    if (!process.env.CI) return;
    phases.push({ phase: name, elapsedMs: performance.now() - started });
    mkdirSync("test-results", { recursive: true });
    writeFileSync(
      `test-results/ready-upload-batch-phases-${process.pid}.json`,
      JSON.stringify({ bun: Bun.version, groups: 126, recordsPerGroup: 8, phases }, null, 2),
    );
  };
  const [first, second] = await peers();
  phase("fixtures-ready");
  await first.records.commit({
    operationId: "batch-seed",
    edits: [
      ...Array.from({ length: 8 }, (_, index) => ({ recordId: `large-${index}`, replace: 0 })),
      { recordId: "atomic-a", replace: 0 },
      { recordId: "atomic-b", replace: 0 },
    ],
  });
  await first.sync.synchronize();
  await second.sync.synchronize();
  phase("seed-synced");
  const before = first.wire.requests.updates;
  const observed = await first.records.read("atomic-a");
  for (let tick = 0; tick < 126; tick++) {
    await first.records.commit({
      operationId: `batch-marker-${tick}`,
      edits: Array.from({ length: 8 }, (_, index) => ({
        recordId: `large-${index}`,
        shared: [{ kind: "map.set" as const, key: "compactionTick", value: tick }],
      })),
    });
    if (tick % 32 === 31) phase(`markers-${tick + 1}`);
  }
  phase("markers-126");
  await first.records.commit({
    operationId: "batch-conditional",
    edits: [
      { recordId: "atomic-a", expectedRevision: observed.revision, replace: 2 },
      { recordId: "atomic-b", replace: 2 },
    ],
  });
  await second.records.commit({ operationId: "batch-peer", edits: [{ recordId: "atomic-a", replace: 1 }] });
  await second.sync.synchronize();
  phase("peer-synced");
  await first.sync.synchronize();
  phase("first-drained");
  await second.sync.synchronize();
  phase("second-drained");
  for (const device of [first, second]) {
    expect((await device.records.read("large-7")).shared).toMatchObject({
      kind: "map",
      value: { compactionTick: 125 },
    });
    expect((await device.records.read("atomic-a")).value).toBe(1);
    expect((await device.records.read("atomic-b")).value).toBe(0);
    expect(device.failures).toEqual([]);
  }
  for (let tick = 0; tick < 126; tick++)
    expect(await first.records.outcome(`batch-marker-${tick}`)).toMatchObject({ state: "synced" });
  expect(await first.records.outcome("batch-conditional")).toMatchObject({ state: "refused" });
  phase("outcomes-read");
  // The original 126 authored marker saves remain distinct. A bounded wire frame can carry
  // several complete admissions, without one network round trip for each tiny save.
  expect(first.wire.requests.updates - before).toBeLessThan(126);
});

test("a page of small shared edits keeps large record values and refuses a stale conditional group", async () => {
  const started = performance.now();
  const phase = (phase: string) => console.log(JSON.stringify({ phase, elapsedMs: performance.now() - started }));
  const [first, second] = await peers();
  phase("large-marker-fixtures");
  const value = "x".repeat(200_000);
  await first.records.commit({
    operationId: "large-marker-seed",
    edits: Array.from({ length: 8 }, (_, index) => ({ recordId: `large-${index}`, replace: value })),
  });
  await first.sync.synchronize();
  await second.sync.synchronize();
  phase("large-marker-seed-synced");
  const observed = await second.records.read("large-0");
  for (let tick = 0; tick < 126; tick++) {
    await first.records.commit({
      operationId: `large-marker-${tick}`,
      edits: Array.from({ length: 8 }, (_, index) => ({
        recordId: `large-${index}`,
        shared: [{ kind: "map.set" as const, key: "compactionTick", value: tick }],
      })),
    });
    if (tick % 32 === 31) phase(`large-markers-${tick + 1}`);
  }
  phase("large-marker-authored");
  // A stale condition must still refuse the whole group after the small edits order.
  await second.records.commit({
    operationId: "large-marker-stale",
    edits: [
      {
        recordId: "large-0",
        expectedRevision: observed.revision,
        shared: [{ kind: "map.set", key: "compactionTick", value: 999 }],
      },
      { recordId: "atomic-sibling", replace: "discard" },
    ],
  });
  await first.sync.synchronize();
  phase("large-marker-first-drained");
  await second.sync.synchronize();
  phase("large-marker-second-drained");
  await first.sync.synchronize();
  for (const device of [first, second]) {
    expect(await device.records.read("large-7")).toMatchObject({
      value,
      shared: { kind: "map", value: { compactionTick: 125 } },
    });
    expect((await device.records.read("atomic-sibling")).exists).toBe(false);
    expect(device.failures).toEqual([]);
  }
  // Save outcomes belong to the author; the peer observes the resulting records.
  expect(await second.records.outcome("large-marker-stale")).toMatchObject({ state: "refused" });
}, 10_000);

test("a save larger than the transport batch stays whole through blob upload before the next save", async () => {
  const [first, second] = await peers();
  await first.records.commit({ operationId: "blob-batch-seed", edits: [{ recordId: "seed", replace: true }] });
  await first.sync.synchronize();
  await second.sync.synchronize();
  const before = first.wire.updates().length;
  const edits = Array.from({ length: 8 }, (_, index) => ({ recordId: `large-${index}`, replace: "x".repeat(200_000) }));
  await first.records.commit({ operationId: "blob-batch-large", edits });
  await first.records.commit({ operationId: "blob-batch-next", edits: [{ recordId: "after", replace: true }] });
  const outbox = await first.store.outbox(recordFrameLimit);
  expect(outbox).toHaveLength(1);
  expect(outbox[0]!.records).toHaveLength(1);
  expect(outbox[0]!.records[0]!.bytes.length).toBeGreaterThan(recordFrameLimit);
  await first.sync.synchronize();
  await second.sync.synchronize();
  const updates = first.wire.updates().slice(before);
  expect(updates).toHaveLength(2);
  const frame = decodeRecordFrame(await openUpdate(first.space, first.documentId, updates[0]!));
  expect(frame.records).toEqual([]);
  expect(frame.blob).toBeDefined();
  const body = decodeRecordFrame(
    await openBlob(first.space, frame.blob!.blobId, await first.wire.relay.blobs.get(frame.blob!.blobId)),
  );
  expect(body.records).toHaveLength(1);
  const entry = await decodeOrderedEntry(body.records[0]!.bytes);
  expect(entry.type).toBe("admission");
  if (entry.type !== "admission") throw new Error("Expected one complete admission");
  expect(entry.admission.operation.operationId).toBe("blob-batch-large");
  expect(entry.admission.operation.edits).toHaveLength(8);
  for (const device of [first, second]) {
    for (const edit of edits) expect((await device.records.read(edit.recordId)).value).toBe(edit.replace);
    expect((await device.records.read("after")).value).toBe(true);
    expect(device.failures).toEqual([]);
  }
  expect(await first.records.outcome("blob-batch-large")).toMatchObject({ state: "synced" });
  expect(await first.records.outcome("blob-batch-next")).toMatchObject({ state: "synced" });
});

const scenarios: { name: string; initial: Json; firstValue: Json; lastValue: Json }[] = [
  {
    name: "multiline strings",
    initial: "Initial\ntitle",
    firstValue: "Release checklist\nLaptop",
    lastValue: "Ship list\nDesktop",
  },
  { name: "arrays", initial: ["seed"], firstValue: ["laptop"], lastValue: ["desktop"] },
];
for (const { name, initial, firstValue, lastValue } of scenarios) {
  test(`the later-ordered offline save replaces plain ${name} whole on every device`, async () => {
    const [first, second] = await peers();
    await first.records.commit({ operationId: "seed", edits: [{ recordId: "card", replace: { value: initial } }] });
    await first.sync.synchronize();
    await second.sync.synchronize();
    await first.records.commit({ operationId: "first", edits: [{ recordId: "card", replace: { value: firstValue } }] });
    await second.records.commit({ operationId: "last", edits: [{ recordId: "card", replace: { value: lastValue } }] });
    await first.sync.synchronize();
    await second.sync.synchronize();
    await first.sync.synchronize();
    for (const peer of [first, second]) {
      expect((await peer.records.read("card")).value).toEqual({ value: lastValue });
      expect(peer.failures).toEqual([]);
    }
  });
}

for (const changeBack of [false, true]) {
  test(`a conditional group is refused whole after an earlier overlapping change${changeBack ? " and ABA" : ""}`, async () => {
    const [first, second] = await peers();
    await first.records.commit({
      operationId: "seed",
      edits: [
        { recordId: "setting", replace: { model: "small", theme: "light" } },
        { recordId: "audit", replace: "not changed" },
      ],
    });
    await first.sync.synchronize();
    await second.sync.synchronize();
    const observed = await second.records.read("setting");
    await second.records.commit({
      operationId: "careful",
      edits: [
        {
          recordId: "setting",
          expectedRevision: observed.revision,
          replace: { model: "careful", theme: "light" },
        },
        { recordId: "audit", replace: "conditional side effect" },
      ],
    });
    await first.records.commit({
      operationId: "earlier",
      edits: [{ recordId: "setting", replace: { model: "large", theme: "light" } }],
    });
    if (changeBack)
      await first.records.commit({
        operationId: "back",
        edits: [{ recordId: "setting", replace: { model: "small", theme: "light" } }],
      });
    await first.sync.synchronize();
    await second.sync.synchronize();
    await first.sync.synchronize();
    for (const peer of [first, second]) {
      expect((await peer.records.read("audit")).value).toBe("not changed");
      expect((await peer.records.read("setting")).value).toEqual({
        model: changeBack ? "small" : "large",
        theme: "light",
      });
      expect(peer.failures).toEqual([]);
    }
    expect(await second.records.outcome("careful")).toMatchObject({ operationId: "careful", state: "refused" });
  });
}

test("refusing a group removes its new optimistic record from reads and queries", async () => {
  const [first, second] = await peers();
  await first.records.commit({ operationId: "seed", edits: [{ recordId: "setting", replace: { model: "small" } }] });
  await first.sync.synchronize();
  await second.sync.synchronize();
  const observed = await second.records.read("setting");
  await second.records.commit({
    operationId: "conditional-new",
    edits: [
      { recordId: "setting", expectedRevision: observed.revision, replace: { model: "careful" } },
      { recordId: "new-audit", replace: "conditional side effect" },
    ],
  });
  expect((await second.records.read("new-audit")).exists).toBe(true);
  await first.records.commit({ operationId: "earlier", edits: [{ recordId: "setting", replace: { model: "large" } }] });
  await first.sync.synchronize();
  await second.sync.synchronize();
  await first.sync.synchronize();
  for (const peer of [first, second]) {
    expect((await peer.records.read("new-audit")).exists).toBe(false);
    expect((await peer.records.list()).map((record) => record.recordId)).toEqual(["setting"]);
  }
  expect(await second.records.outcome("conditional-new")).toMatchObject({ state: "refused" });
});

test("individually valid concurrent fields refuse the oversized group without blocking ordered progress", async () => {
  const [first, second] = await peers();
  const large = "x".repeat(150 * 1024);
  await first.records.commit({ operationId: "seed-limit", edits: [{ recordId: "card", replace: { a: "", b: "" } }] });
  await first.sync.synchronize();
  await second.sync.synchronize();
  await first.records.commit({
    operationId: "first-limit",
    edits: [{ recordId: "card", replace: { a: large, b: "" } }],
  });
  await second.records.commit({
    operationId: "last-limit",
    edits: [
      { recordId: "card", replace: { a: "", b: large } },
      { recordId: "side-effect", replace: true },
    ],
  });
  await first.sync.synchronize();
  await second.sync.synchronize();
  await first.sync.synchronize();
  for (const peer of [first, second]) {
    expect((await peer.records.read("card")).value).toEqual({ a: large, b: "" });
    expect((await peer.records.read("side-effect")).exists).toBe(false);
    expect(peer.failures).toEqual([]);
  }
  expect(await second.records.outcome("last-limit")).toMatchObject({ state: "refused" });
  await second.records.commit({ operationId: "after-refusal", edits: [{ recordId: "after", replace: true }] });
  await second.sync.synchronize();
  await first.sync.synchronize();
  expect((await first.records.read("after")).value).toBe(true);
});

test("a refused optimistic parent suppresses its conditional descendant while canonical input advances", async () => {
  const [first, second] = await peers();
  await first.records.commit({ operationId: "seed-chain", edits: [{ recordId: "card", replace: { model: "small" } }] });
  await first.sync.synchronize();
  await second.sync.synchronize();
  const original = await second.records.read("card");
  await second.records.commit({
    operationId: "parent-chain",
    edits: [{ recordId: "card", replace: { model: "parent" }, expectedRevision: original.revision }],
  });
  const pending = await second.records.read("card");
  await second.records.commit({
    operationId: "child-chain",
    edits: [{ recordId: "card", replace: { model: "child" }, expectedRevision: pending.revision }],
  });
  await first.records.commit({
    operationId: "peer-chain",
    edits: [{ recordId: "card", replace: { model: "remote" } }],
  });
  await first.sync.synchronize();
  await second.sync.synchronize();
  await first.sync.synchronize();
  expect((await second.records.read("card")).value).toEqual({ model: "remote" });
  for (const id of ["parent-chain", "child-chain"])
    expect(await second.records.outcome(id)).toMatchObject({ state: "refused" });
  expect(second.failures).toEqual([]);
});

test("a conditional child can use its pending observation after the parent receives an exact acceptance", async () => {
  const [first, second] = await peers();
  await first.records.commit({
    operationId: "parent-accepted",
    edits: [{ recordId: "card", replace: { model: "parent" } }],
  });
  const pending = await first.records.read("card");
  await first.sync.synchronize();
  await second.sync.synchronize();
  await first.records.commit({
    operationId: "child-after-acceptance",
    edits: [{ recordId: "card", replace: { model: "child" }, expectedRevision: pending.revision }],
  });
  await first.sync.synchronize();
  await second.sync.synchronize();
  expect((await second.records.read("card")).value).toEqual({ model: "child" });
  expect(await first.records.outcome("child-after-acceptance")).toMatchObject({ state: "synced" });
});

test("declared record text merges both devices typing while an undeclared multiline field remains whole", async () => {
  const [first, second] = await peers([{ prefix: "card:", fields: ["/description"] }]);
  const initial = { title: "Initial\ntitle", description: "first\nlast" };
  await first.records.commit({ operationId: "seed-text", edits: [{ recordId: "card:one", replace: initial }] });
  await first.sync.synchronize();
  await second.sync.synchronize();
  await first.records.commit({
    operationId: "first-text",
    edits: [{ recordId: "card:one", replace: { title: "Laptop\ntitle", description: "FIRSTfirst\nlast" } }],
  });
  await second.records.commit({
    operationId: "last-text",
    edits: [{ recordId: "card:one", replace: { title: "Desktop\ntitle", description: "first\nLASTlast" } }],
  });
  await first.sync.synchronize();
  await second.sync.synchronize();
  await first.sync.synchronize();
  for (const peer of [first, second]) {
    expect((await peer.records.read("card:one")).value).toEqual({
      title: "Desktop\ntitle",
      description: "FIRSTfirst\nLASTlast",
    });
    expect(peer.failures).toEqual([]);
  }
});

test("refused conditional text preserves private work and fences stale native delta and full-state sources", async () => {
  const [first, second] = await peers([{ prefix: "card:", fields: ["/description"] }]);
  await first.records.commit({
    operationId: "seed-native-refusal",
    edits: [{ recordId: "card:one", replace: { model: "small", description: "first\nlast" } }],
  });
  await first.sync.synchronize();
  await second.sync.synchronize();
  const key = "e".repeat(64);
  await second.records.bindText({ recordId: "card:one", field: "/description", documentKey: key });
  await second.sync.synchronize();
  await first.sync.synchronize();
  const native = second.service.openNativeTextDocument({ owner: second.owner, fileId: key });
  const before = await native.snapshot();
  const observed = await second.records.read("card:one");
  await second.records.commit({
    operationId: "careful-native-refusal",
    edits: [
      {
        recordId: "card:one",
        expectedRevision: observed.revision,
        replace: { model: "careful", description: "LOCAL first\nlast" },
      },
    ],
  });
  const optimistic = await native.snapshot();
  const rooms = createNativeDocumentRoomsDBService(second.db);
  const room = await rooms.create({
    owner: second.owner,
    documentKey: key,
    target: { fileRendererId: "example.board.view.note", resource: undefined },
    state: optimistic.state,
    generation: optimistic.generation,
  });
  await first.records.commit({
    operationId: "peer-native-refusal",
    edits: [{ recordId: "card:one", set: { "/model": "remote" } }],
  });
  await first.sync.synchronize();
  await second.sync.synchronize();
  const current = await native.snapshot();
  expect(current.generation).toBeDefined();
  expect(current.generation).not.toBe(before.generation);
  expect(await native.read()).toBe("first\nlast");
  const stale = new Y.Doc();
  try {
    Y.applyUpdate(stale, optimistic.state);
    await expect(native.applySource(stale, { generation: optimistic.generation })).rejects.toMatchObject({
      code: "native_source_recovery",
    });
    await expect(native.applySource(stale)).rejects.toMatchObject({ code: "native_source_recovery" });
  } finally {
    stale.destroy();
  }
  const retained = await rooms.read({ owner: second.owner, roomId: room.id });
  expect(retained.document.getText("content").toString()).toBe("LOCAL first\nlast");
  retained.document.destroy();
  expect(await second.records.outcome("careful-native-refusal")).toMatchObject({ state: "refused" });
});

test("a native full-state relay cannot launder an unsettled conditional group's text", async () => {
  const [first, second] = await peers([{ prefix: "card:", fields: ["/description"] }]);
  await first.records.commit({
    operationId: "seed-forwarded",
    edits: [{ recordId: "card:one", replace: { model: "small", description: "canonical" } }],
  });
  await first.sync.synchronize();
  await second.sync.synchronize();
  const key = "f".repeat(64);
  await first.records.bindText({ recordId: "card:one", field: "/description", documentKey: key });
  await first.sync.synchronize();
  await second.sync.synchronize();
  const observed = await first.records.read("card:one");
  await first.records.commit({
    operationId: "forwarded-conditional",
    edits: [
      {
        recordId: "card:one",
        expectedRevision: observed.revision,
        replace: { model: "careful", description: "PRIVATE canonical" },
      },
    ],
  });
  const source = first.service.openNativeTextDocument({ owner: first.owner, fileId: key });
  const receiver = second.service.openNativeTextDocument({ owner: second.owner, fileId: key });
  const receiverBefore = await receiver.snapshot();
  const snapshot = await source.snapshot();
  const document = new Y.Doc();
  try {
    Y.applyUpdate(document, snapshot.state);
    document.getText("content").insert(document.getText("content").length, " forwarded");
    await receiver.applySource(document, { generation: snapshot.generation });
  } finally {
    document.destroy();
  }
  await second.records.commit({
    operationId: "earlier-forwarded",
    edits: [{ recordId: "card:one", set: { "/model": "remote" } }],
  });
  // The foreign child waits for its parent receipt while the independent model save passes it.
  await second.sync.synchronize();
  await first.sync.synchronize();
  await second.sync.synchronize();
  for (const peer of [first, second]) {
    expect((await peer.records.read("card:one")).value).toEqual({ model: "remote", description: "canonical" });
    expect(peer.failures).toEqual([]);
  }
  expect(await first.records.outcome("forwarded-conditional")).toMatchObject({ state: "refused" });
  expect((await receiver.snapshot()).generation).not.toBe(receiverBefore.generation);
  const retained = [];
  for (const room of await second.db.select().from(native_document_rooms)) {
    if (room.document_key !== key) continue;
    const copy = new Y.Doc();
    try {
      Y.applyUpdate(copy, room.state);
      retained.push(copy.getText("content").toString());
    } finally {
      copy.destroy();
    }
  }
  expect(retained).toContain("PRIVATE canonical forwarded");
});

test("binding an offline plain field cannot overwrite an earlier peer save of its source", async () => {
  const [first, second] = await peers();
  await first.records.commit({
    operationId: "bind-race-base",
    edits: [{ recordId: "note", replace: { content: "original" } }],
  });
  await first.sync.synchronize();
  await second.sync.synchronize();
  const key = "6".repeat(64);
  await second.records.bindText({ recordId: "note", field: "/content", documentKey: key, content: "original" });
  await first.records.commit({
    operationId: "bind-race-peer",
    edits: [{ recordId: "note", set: { "/content": "peer saved" } }],
  });
  await first.sync.synchronize();
  await second.sync.synchronize();
  await first.sync.synchronize();
  for (const peer of [first, second]) {
    expect((await peer.records.read("note")).value).toEqual({ content: "peer saved" });
    expect(peer.failures).toEqual([]);
  }
});
