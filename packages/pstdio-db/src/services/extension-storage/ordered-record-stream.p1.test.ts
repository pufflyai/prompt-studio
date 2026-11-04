import { afterEach, expect, test } from "bun:test";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createRecordStreamSync } from "pstdio-sync/relay";
import type { Json } from "pstdio-sync-contracts";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { createRelay } from "./record-stream-relay.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

const peers = async () => {
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
    const records = service.open({ owner }).records;
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
    return { records, sync, failures };
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
