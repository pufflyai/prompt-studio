import { expect, test } from "bun:test";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createRecordStreamSync } from "pstdio-sync/relay";
import { compactOrderedTombstones } from "./compact-tombstones";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { withOrderedOwner } from "./ordered-journal";
import { createAssets, createRelay } from "./record-stream-relay.fixture";
import { createRetainedPages } from "./retained-pages";

const fixture = async () => {
  const f = await createExtensionStorageFixture();
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  const space = await createSyncSpace({
    projectId: owner.workbenchId,
    spaceOwner: null,
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const documentId = await space.documentId(JSON.stringify([owner.extensionId, "record-stream"]));
  const { relay } = createRelay();
  const services: ReturnType<typeof createDocumentStorageDBService>[] = [];
  const device = () => {
    const service = createDocumentStorageDBService(f.db);
    services.push(service);
    const assets = createAssets().store;
    const records = service.open({ owner, assets }).records;
    const store = service.documents.recordStream(owner);
    const sync = createRecordStreamSync({
      space,
      documentId,
      relay,
      store,
      assets,
      quarantine: async (error) => {
        throw new Error(JSON.stringify(error));
      },
    });
    return { service, records, store, sync };
  };
  return {
    ...f,
    owner,
    device,
    close: async () => {
      for (const service of services) await service.flushStatistics();
      await f.svc.flushStatistics();
      await f.close();
    },
  };
};

test("a founding checkpoint carries a compacted deleted value so another database can restore it", async () => {
  const first = await fixture();
  const second = await createExtensionStorageFixture();
  const device = first.device();
  const value = { old: "checkpoint 日本語", nested: { z: 1, a: 2 } };
  try {
    await device.records.commit({ operationId: "seed-checkpoint", edits: [{ recordId: "card", replace: value }] });
    await device.records.commit({ operationId: "delete-checkpoint", edits: [{ recordId: "card", deleted: true }] });
    await compactOrderedTombstones(first.db, first.owner);
    // The checkpoint API returns the exact relay record encoding, including retained values.
    const space = await createSyncSpace({
      projectId: first.owner.workbenchId,
      spaceOwner: null,
      keys: [{ generation: 1, secret: "A".repeat(43) }],
    });
    const { relay } = createRelay();
    await device.store.connect!(space, relay);
    const snapshot = await device.store.snapshot({ found: true, relayEmpty: true });
    const targetOwner = { workbenchId: second.projectAId, extensionId: first.owner.extensionId };
    const target = createDocumentStorageDBService(second.db);
    try {
      const store = target.documents.recordStream(targetOwner);
      await store.connect!(space, relay);
      await store.merge(new Map(snapshot.records.map((record) => [record.recordId, [record.bytes]])), "adopt", {
        joined: true,
        after: 0,
        stateId: "checkpoint",
        through: 0,
        pendingBytes: 0,
        stateBytes: 1,
        skipped: false,
      });
      const records = target.open({ owner: targetOwner }).records;
      expect((await records.read("card")).deleted).toBe(true);
      await records.commit({ operationId: "restore-checkpoint", edits: [{ recordId: "card", deleted: false }] });
      expect((await records.read("card")).value).toEqual(value);
    } finally {
      await target.flushStatistics();
    }
  } finally {
    await first.close();
    await second.svc.flushStatistics();
    await second.close();
  }
});

test("replacing a checkpoint removes obsolete private recovery pages before adopting its records", async () => {
  const f = await fixture();
  const device = f.device();
  try {
    await device.records.commit({ operationId: "seed-replaced", edits: [{ recordId: "card", replace: "obsolete" }] });
    await device.sync.synchronize();
    const before = await device.store.snapshot({ found: false });
    await device.records.commit({ operationId: "delete-replaced", edits: [{ recordId: "card", deleted: true }] });
    await device.sync.synchronize();
    await compactOrderedTombstones(f.db, f.owner);
    await device.store.merge(new Map(before.records.map((record) => [record.recordId, [record.bytes]])), "adopt", {
      ...(await device.store.open()),
      stateId: "replacement",
    });
    await withOrderedOwner(f.db, f.owner, async (_journal, tx) => {
      expect(await createRetainedPages(tx, f.owner, "tombstones").get("card")).toBeUndefined();
    });
  } finally {
    await f.close();
  }
});
