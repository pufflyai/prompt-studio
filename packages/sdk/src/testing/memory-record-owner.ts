import {
  createDocumentStorage,
  createLegacyRecordStorage,
  createMemoryDocumentStore,
  type DocumentStore,
  scopeRecordStorage,
} from "pstdio-sync";
import type { createMemoryAssets } from "./memory-assets";

export interface MemoryStorageSeed {
  kv?: Record<string, unknown>;
  collections?: Record<string, Record<string, unknown>>;
}

export const createMemoryRecordOwner = (
  assets: ReturnType<typeof createMemoryAssets>,
  seed: MemoryStorageSeed = {},
  identity: { workbenchId?: string; extensionId?: string } = {},
) => {
  const owner = { workbenchId: crypto.randomUUID(), extensionId: "test-extension", ...identity };
  const baseStore = createMemoryDocumentStore();
  const seedStorage = createLegacyRecordStorage({ store: baseStore, owner }).scope("project", owner.workbenchId);
  const initialized = Promise.all([
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
  const legacy = createLegacyRecordStorage({ store, owner });
  return {
    workbenchId: owner.workbenchId,
    extensionId: owner.extensionId,
    dataVersion: storage.dataVersion,
    setDataVersion: storage.setDataVersion,
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
