import type { AssetStore, StorageObserver, StorageOwner } from "pstdio-sync";
import { createLegacyRecordStorage, scopeRecordStorage, storageRecordId } from "pstdio-sync/records";
import type { Json } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { createArtifactFileProjectionsDBService } from "./artifact-file-projections";
import { createStorageMigrations } from "./data-migrations";
import { createDocumentStorageDBService } from "./document-storage";
import type { CollectionScope, KvScope, SetCollectionItemInput, SetKvInput } from "./legacy-types";
import { createNativeDocumentRoomsDBService } from "./native-document-rooms";
import { createNativeFileProjectionsDBService } from "./native-file-projections";
import { upgradeNativeSourceLifetimes } from "./native-source-upgrade";
import { installRecordIndexes } from "./record-index-installation";
import { createRecoveryPoints } from "./recovery-points";
import { getExtensionStorageOwner } from "./storage-owner";

export type { CollectionScope, KvScope, SetCollectionItemInput, SetKvInput } from "./legacy-types";

export const createExtensionStorageDBService = (
  db: DbClient,
  observer?: StorageObserver,
  options: { freeBytes?: () => Promise<number> } = {},
) => {
  const documents = createDocumentStorageDBService(db, observer);
  const scopeFor = async (scope: KvScope) => {
    const owner = await getExtensionStorageOwner(db, scope.extension_instance_id);
    if (!owner) return null;
    return createLegacyRecordStorage({ records: documents.open({ owner }).records }).scope(
      scope.scope_type,
      scope.scope_id,
    );
  };
  const requireScope = async (scope: KvScope) => {
    const storage = await scopeFor(scope);
    if (!storage) throw new Error("Storage owner not found");
    return storage;
  };
  const collectionFor = async (scope: CollectionScope) => (await requireScope(scope)).collection(scope.collection);
  const getKv = async (scope: KvScope, key: string) => {
    const value = await (await scopeFor(scope))?.kv.get(key);
    return value === undefined ? null : { ...scope, key, value_json: value };
  };
  const getCollectionItem = async (scope: CollectionScope, itemId: string) => {
    const item = await (await scopeFor(scope))?.collection(scope.collection).get(itemId);
    return item ? { ...scope, item_id: item.id, value_json: item.value, sort_order: item.sortOrder } : null;
  };
  return {
    upgradeNativeSources: (options: Parameters<typeof upgradeNativeSourceLifetimes>[1]) =>
      upgradeNativeSourceLifetimes(db, options),
    installIndexes: (owners: Parameters<typeof installRecordIndexes>[1], validate: () => void = () => {}) =>
      installRecordIndexes(db, owners, validate),
    recovery: createRecoveryPoints(db, documents, options),
    watch: documents.watch,
    flushStatistics: documents.flushStatistics,
    documents: documents.documents,
    openTextDocument: documents.openTextDocument,
    openNativeTextDocument: documents.openNativeTextDocument,
    nativeRooms: createNativeDocumentRoomsDBService(db),
    nativeFileProjections: createNativeFileProjectionsDBService(db),
    fileProjections: createArtifactFileProjectionsDBService(db),
    migrate: createStorageMigrations(db, documents),
    recordId: (scopeType: string, scopeId: string, key: string) => storageRecordId([scopeType, scopeId, "kv"], key),
    open: async (input: { owner: StorageOwner; assets?: AssetStore }) => {
      const storage = documents.open(input);
      return {
        ...storage,
        scopedRecords: (type: string, id: string) => scopeRecordStorage(storage.records, [type, id, "kv"]),
      };
    },
    getKv,
    listKv: async (scope: KvScope) =>
      ((await (await scopeFor(scope))?.kv.list()) ?? []).map((record) => ({
        ...scope,
        key: record.recordId,
        value_json: record.value,
      })),
    setKv: async (input: SetKvInput) => {
      await (await requireScope(input)).kv.set(input.key, input.value_json as Json);
      return getKv(input, input.key);
    },
    deleteKv: async (scope: KvScope, key: string) => (await scopeFor(scope))?.kv.delete(key) ?? false,
    getCollectionItem,
    listCollection: async (scope: CollectionScope) =>
      ((await (await scopeFor(scope))?.collection(scope.collection).list()) ?? []).map((item) => ({
        ...scope,
        item_id: item.id,
        value_json: item.value,
        sort_order: item.sortOrder,
      })),
    setCollectionItem: async (input: SetCollectionItemInput) => {
      await (await collectionFor(input)).set(input.item_id, input.value_json as Json, input.sort_order);
      return getCollectionItem(input, input.item_id);
    },
    updateCollectionItem: async (input: SetCollectionItemInput) =>
      (await collectionFor(input)).update(input.item_id, input.value_json as Json),
    createCollectionItemIfAbsent: async (input: SetCollectionItemInput) =>
      (await collectionFor(input)).createIfAbsent(input.item_id, input.value_json as Json, input.sort_order),
    deleteCollectionItem: async (scope: CollectionScope, itemId: string) => (await collectionFor(scope)).delete(itemId),
    deleteCollectionItemIfValue: async (scope: CollectionScope, itemId: string, value: unknown) =>
      (await collectionFor(scope)).deleteIfValue(itemId, value as Json),
  };
};
