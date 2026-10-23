import {
  createDocumentStorage,
  createLegacyRecordStorage,
  createMemoryDocumentStore,
  type DocumentStore,
  scopeRecordStorage,
  snapshotDocumentRecords,
} from "pstdio-sync";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import type { createMemoryAssets } from "./memory-assets";

export interface MemoryStorageSeed {
  kv?: Record<string, unknown>;
  collections?: Record<string, Record<string, unknown>>;
  /** Use the extension's storageIndexes declaration to mirror local host installation. */
  indexes?: StorageRecordIndex[];
}

export const createMemoryRecordOwner = (
  assets: ReturnType<typeof createMemoryAssets>,
  seed: MemoryStorageSeed = {},
  identity: { workbenchId?: string; extensionId?: string } = {},
) => {
  const owner = { workbenchId: crypto.randomUUID(), extensionId: "test-extension", ...identity };
  const baseStore = createMemoryDocumentStore();
  const seedStorage = createLegacyRecordStorage({ records: createDocumentStorage({ store: baseStore, owner }).records }).scope("project", owner.workbenchId);
  const initialized = Promise.all([
    createDocumentStorage({ owner, store: baseStore }).records.defineIndexes(seed.indexes ?? []),
    ...Object.entries(seed.kv ?? {}).map(([key, value]) => seedStorage.kv.set(key, value as never)),
    ...Object.entries(seed.collections ?? {}).flatMap(([name, items]) =>
      Object.entries(items).map(([id, value]) => seedStorage.collection(name).set(id, value as never)),
    ),
  ]);
  const store: DocumentStore = {
    transaction: async (target, action) => {
      await initialized;
      return baseStore.transaction(target, action);
    },
  };
  const storage = createDocumentStorage({
    store,
    owner,
    assets: {
      verifyComplete: assets.verifyComplete,
      read: assets.read,
      receive: async () => {
        throw new Error("Test storage has no relay adapter");
      },
    },
  });
  const legacy = createLegacyRecordStorage({ records: createDocumentStorage({ store, owner }).records });
  return {
    workbenchId: owner.workbenchId,
    extensionId: owner.extensionId,
    dataVersion: storage.dataVersion,
    setDataVersion: storage.setDataVersion,
    exportUpdate: storage.exportUpdate,
    applyUpdate: storage.applyUpdate,
    snapshot: () => store.transaction(owner, async ({ document }) => snapshotDocumentRecords(document)),
    duringMigration: async <T>(key: string, run: () => Promise<T>) => {
      await initialized;
      return baseStore.duringMigration(key, run);
    },
    scope: (type: string, id: string) => ({
      records: scopeRecordStorage(storage.records, [type, id, "kv"]),
      legacy: legacy.scope(type, id),
    }),
  };
};
