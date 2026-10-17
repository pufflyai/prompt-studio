import {
  createLegacyRecordStorage,
  createRecordStorage,
  type GroupedState,
  type GroupedStore,
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
) => {
  const owner = { workbenchId: crypto.randomUUID(), extensionId: "test-extension" };
  const environmentId = crypto.randomUUID();
  let state: GroupedState = { owner, accepted: null, journal: [] };
  let previous = Promise.resolve();
  const baseStore: GroupedStore = {
    transaction: async (_owner, action) => {
      const pending = previous;
      let release = () => {};
      previous = new Promise<void>((resolve) => {
        release = resolve;
      });
      await pending;
      try {
        const draft = structuredClone(state);
        const result = await action(draft);
        state = draft;
        return result;
      } finally {
        release();
      }
    },
  };
  const seedStorage = createLegacyRecordStorage({ store: baseStore, owner, environmentId }).scope(
    "project",
    owner.workbenchId,
  );
  const initialized = Promise.all([
    ...Object.entries(seed.kv ?? {}).map(([key, value]) => seedStorage.kv.set(key, value as never)),
    ...Object.entries(seed.collections ?? {}).flatMap(([name, items]) =>
      Object.entries(items).map(([id, value]) => seedStorage.collection(name).set(id, value as never)),
    ),
  ]);
  const store: GroupedStore = {
    transaction: async (target, action) => {
      await initialized;
      return baseStore.transaction(target, action);
    },
  };
  const storage = createRecordStorage({
    store,
    owner,
    environmentId,
    assets: {
      verifyComplete: assets.verifyComplete,
      read: assets.read,
      receive: async () => {
        throw new Error("Test storage has no relay adapter");
      },
    },
  });
  const legacy = createLegacyRecordStorage({ store, owner, environmentId });
  return {
    workbenchId: owner.workbenchId,
    scope: (type: string, id: string) => ({
      records: scopeRecordStorage(storage.records, [type, id, "kv"]),
      legacy: legacy.scope(type, id),
    }),
  };
};
