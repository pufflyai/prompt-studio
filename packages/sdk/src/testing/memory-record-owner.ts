import { resolveCollectionIndexes } from "pstdio-api-contracts";
import { createMemoryDocumentStore, type DocumentStore } from "pstdio-sync";
import {
  createDocumentStorage,
  createLegacyRecordStorage,
  createMemoryRecordQueries,
  type OrderedRecord,
  scopeRecordStorage,
  storageRecordId,
} from "pstdio-sync/records";
import type { StorageRecordIndex, StorageTextDeclaration } from "pstdio-sync-contracts";
import type { createMemoryAssets } from "./memory-assets";
import { createOrderedMemoryRecords, type OrderedMemoryState } from "./ordered-memory-records";

export interface MemoryStorageSeed {
  kv?: Record<string, unknown>;
  collections?: Record<string, Record<string, unknown>>;
  /** Use the extension's storageIndexes declaration to mirror local host installation. */
  indexes?: StorageRecordIndex[];
  /** Mirror the extension's normalized storage.records.text declarations. */
  textFields?: StorageTextDeclaration[];
}

export const createMemoryRecordOwner = (
  assets: ReturnType<typeof createMemoryAssets>,
  seed: MemoryStorageSeed = {},
  identity: { workbenchId?: string; extensionId?: string } = {},
) => {
  const owner = { workbenchId: crypto.randomUUID(), extensionId: "test-extension", ...identity };
  const baseStore = createMemoryDocumentStore();
  const listeners = new Set<(change: { recordIds?: readonly string[] }) => void>();
  const notify = (recordIds?: readonly string[]) => {
    for (const listener of [...listeners]) listener({ recordIds });
  };
  const ordered = createOrderedMemoryRecords(assets, seed.textFields, notify);
  const initial: OrderedRecord[] = [];
  const add = (namespace: string[], id: string, value: unknown) =>
    initial.push({
      recordId: storageRecordId(namespace, id),
      value: { value: JSON.parse(JSON.stringify(value)), asset: null, shared: null },
      deleted: false,
      lifetime: "initial",
      stamps: {},
    });
  for (const [id, value] of Object.entries(seed.kv ?? {})) add(["project", owner.workbenchId, "kv"], id, value);
  for (const [name, items] of Object.entries(seed.collections ?? {}))
    for (const [id, value] of Object.entries(items))
      add(["project", owner.workbenchId, "collection", name], id, { value, sortOrder: null });
  ordered.seed(initial);
  const queries = createMemoryRecordQueries(owner, baseStore, ordered);
  const initialized = queries.defineIndexes(resolveCollectionIndexes(seed.indexes ?? [], "project", owner.workbenchId));
  const store: DocumentStore = {
    transaction: async (target, action) => {
      await initialized;
      return baseStore.transaction(target, action);
    },
  };
  const metadata = createDocumentStorage({ owner, store });
  const locked = {
    ...ordered,
    conflicts: async () => [] as import("pstdio-sync-contracts").StorageConflict[],
    inspect: async () => {
      throw new Error("Records merge automatically; there are no conflicts to inspect");
    },
    resolve: async () => {
      throw new Error("Records merge automatically; there are no conflicts to resolve");
    },
  };
  const records = {
    ...queries,
    read: (id: string) => store.transaction(owner, async () => locked.read(id)),
    list: (prefix = "") => store.transaction(owner, async () => locked.list(prefix)),
    commit: (input: Parameters<typeof ordered.commit>[0]) => {
      const group = structuredClone(input);
      return store.transaction(owner, async () => locked.commit(group));
    },
    outcome: (id: string) => store.transaction(owner, async () => locked.outcome(id)),
    conflicts: locked.conflicts,
    inspect: locked.inspect,
    resolve: locked.resolve,
    transaction: <T>(run: (value: typeof locked) => Promise<T>) => store.transaction(owner, async () => run(locked)),
  };
  const legacy = createLegacyRecordStorage({ records });
  return {
    observe: (listener: (change: { recordIds?: readonly string[] }) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    workbenchId: owner.workbenchId,
    extensionId: owner.extensionId,
    dataVersion: metadata.dataVersion,
    setDataVersion: metadata.setDataVersion,
    exportUpdate: metadata.exportUpdate,
    applyUpdate: metadata.applyUpdate,
    snapshot: () => store.transaction(owner, async () => ordered.snapshot()),
    exportOrdered: () => store.transaction(owner, async () => ordered.exportState()),
    pendingOrdered: () => store.transaction(owner, async () => ordered.pending()),
    installOrdered: async (state: OrderedMemoryState) => {
      await store.transaction(owner, async () => ordered.install(state));
      notify();
    },
    duringMigration: async <T>(key: string, run: () => Promise<T>) => {
      await initialized;
      return baseStore.duringMigration(key, run);
    },
    scope: (type: string, id: string) => ({
      records: scopeRecordStorage(records, [type, id, "kv"]),
      legacy: legacy.scope(type, id),
    }),
  };
};
