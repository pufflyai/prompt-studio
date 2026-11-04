import { afterEach, expect, test } from "bun:test";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createRecordStreamSync } from "pstdio-sync/relay";
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
  const { relay } = createRelay();
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
    const sync = createRecordStreamSync({
      space,
      documentId,
      relay,
      store: service.documents.recordStream(owner),
      quarantine: async (failure) => {
        failures.push(failure);
      },
    });
    return { records, sync, failures, service, db, owner };
  };
  return [await device(), await device()] as const;
};

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
