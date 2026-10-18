import { type Collection, createCollection } from "@tanstack/react-db";
import { apiClientOptions } from "@/lib/api";
import { updateCollectionIndexes } from "./collection-indexes";

export { eq, useLiveQuery } from "@tanstack/react-db";

export const SYNCED_TABLES = [
  "board_views",
  "board_default_views",
  "settings",
  "projects",
  "installed_extension_sources",
  "notifications",
  "extension_instances",
  "sessions",
  "workspaces",
  "files",
  "workspace_sessions",
] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];

export type SyncedRow = { id: string; [key: string]: unknown };
export interface CollectionRowChange {
  key: string;
  value?: SyncedRow;
  previousValue?: SyncedRow;
}
export type CollectionChange = {
  type: "snapshot" | "row";
  table: SyncedTable;
  changes: readonly CollectionRowChange[];
};

export interface CollectionWriter {
  truncateAndWrite: (rows: SyncedRow[]) => void;
  upsert: (row: SyncedRow) => void;
  remove: (id: string) => void;
}

let nextOwnerId = 0;
export const createRuntimeCollections = (connection = apiClientOptions()) => {
  const ownerId = ++nextOwnerId;
  let disposed = false;
  const disposeHandlers = new Set<() => void>();
  const collections = new Map<string, Collection<SyncedRow, string>>();
  const writers = new Map<string, CollectionWriter>();
  const listeners = new Set<(change?: CollectionChange) => void>();
  const syncedTableSet = new Set<string>(SYNCED_TABLES);
  const indexes = new Map<SyncedTable, Map<string, Map<unknown, Set<string>>>>();
  let collectionsVersion = 0;
  let initialCollectionsSyncComplete = false;

  const notifyCollectionsChanged = (change?: CollectionChange) => {
    if (change) updateCollectionIndexes(indexes.get(change.table), change);
    collectionsVersion += 1;
    for (const listener of listeners) listener(change);
  };

  const getCollectionsVersion = () => collectionsVersion;

  const isInitialCollectionsSyncComplete = () => initialCollectionsSyncComplete;

  const markInitialCollectionsSyncComplete = () => {
    if (initialCollectionsSyncComplete) return;
    initialCollectionsSyncComplete = true;
    notifyCollectionsChanged();
  };

  const subscribeCollections = (listener: (change?: CollectionChange) => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const getOrCreate = (table: string) => {
    let col = collections.get(table);
    if (col) return col;

    col = createCollection<SyncedRow, string>({
      id: `runtime-${ownerId}:${table}`,
      getKey: (item) => item.id,
      // Dashboard collections mirror the backend sync stream and are read directly by route
      // selectors, so they must survive periods with no live-query subscribers.
      gcTime: 0,
      sync: {
        sync: ({ begin, write, commit, markReady }) => {
          const syncedIds = new Set<string>();

          writers.set(table, {
            truncateAndWrite: (rows) => {
              if (disposed) return;
              const next = new Map(rows.map((row) => [row.id, row]));
              const changes: CollectionRowChange[] = [...syncedIds].map((key) => ({
                key,
                previousValue: collections.get(table)?.get(key),
                value: next.get(key),
              }));
              changes.push(...rows.filter((row) => !syncedIds.has(row.id)).map((row) => ({ key: row.id, value: row })));
              begin();
              for (const id of syncedIds) write({ type: "delete", key: id });
              syncedIds.clear();
              for (const row of rows) {
                write({ type: "insert", value: row });
                syncedIds.add(row.id);
              }
              commit();
              notifyCollectionsChanged({ type: "snapshot", table: table as SyncedTable, changes });
            },
            upsert: (row) => {
              if (disposed) return;
              const previousValue = collections.get(table)?.get(row.id);
              begin({ immediate: true });
              const type = syncedIds.has(row.id) ? "update" : "insert";
              write({ type, value: row });
              syncedIds.add(row.id);
              commit();
              notifyCollectionsChanged({
                type: "row",
                table: table as SyncedTable,
                changes: [{ key: row.id, previousValue, value: row }],
              });
            },
            remove: (id) => {
              if (disposed) return;
              const previousValue = collections.get(table)?.get(id);
              begin({ immediate: true });
              write({ type: "delete", key: id });
              syncedIds.delete(id);
              commit();
              notifyCollectionsChanged({
                type: "row",
                table: table as SyncedTable,
                changes: [{ key: id, previousValue }],
              });
            },
          });

          markReady();

          return () => {
            writers.delete(table);
          };
        },
      },
    });
    collections.set(table, col);
    col.preload();
    return col;
  };

  const getCollection = (table: SyncedTable) => getOrCreate(table);

  const getIndexedRows = (table: SyncedTable, field: string, value: unknown) => {
    const collection = getCollection(table);
    let fields = indexes.get(table);
    if (!fields) {
      fields = new Map();
      indexes.set(table, fields);
    }
    let index = fields.get(field);
    if (!index) {
      index = new Map();
      fields.set(field, index);
      for (const row of collection.values()) {
        const ids = index.get(row[field]) ?? new Set<string>();
        ids.add(row.id);
        index.set(row[field], ids);
      }
    }
    return [...(index.get(value) ?? [])].flatMap((id) => {
      const row = collection.get(id);
      return row ? [row] : [];
    });
  };

  const getWriter = (table: string): CollectionWriter | undefined => {
    if (disposed || !syncedTableSet.has(table)) return undefined;
    getOrCreate(table);
    return writers.get(table);
  };

  const getAllCollections = () => {
    for (const table of SYNCED_TABLES) getOrCreate(table);
    return collections;
  };

  const dispose = async () => {
    disposed = true;
    for (const handler of disposeHandlers) handler();
    disposeHandlers.clear();
    listeners.clear();
    indexes.clear();
    writers.clear();
    await Promise.all([...collections.values()].map((collection) => collection.cleanup()));
    collections.clear();
  };
  return {
    id: ownerId,
    connection: { ...connection },
    getCollection,
    getWriter,
    getAllCollections,
    getIndexedRows,
    getCollectionsVersion,
    isInitialCollectionsSyncComplete,
    markInitialCollectionsSyncComplete,
    subscribeCollections,
    dispose,
    isDisposed: () => disposed,
    onDispose: (handler: () => void) => {
      disposeHandlers.add(handler);
      return () => {
        disposeHandlers.delete(handler);
      };
    },
  };
};
export type RuntimeCollections = ReturnType<typeof createRuntimeCollections>;

const stores = new Map<string, { collections: ReturnType<typeof createRuntimeCollections>; connections: number }>();
const runtimeStore = (connection: ReturnType<typeof apiClientOptions>) => {
  const key = JSON.stringify(connection);
  let store = stores.get(key);
  if (!store) {
    store = { collections: createRuntimeCollections(connection), connections: 0 };
    stores.set(key, store);
  }
  return store;
};
export const getRuntimeCollections = (connection = apiClientOptions()) => runtimeStore(connection).collections;
export const retainRuntimeCollections = (connection: ReturnType<typeof apiClientOptions>) => {
  const store = runtimeStore(connection);
  store.connections += 1;
  return store.collections;
};
export const releaseRuntimeCollections = async (connection: ReturnType<typeof apiClientOptions>) => {
  const key = JSON.stringify(connection);
  const store = stores.get(key);
  if (!store) return;
  store.connections -= 1;
  // React can clean up and immediately remount an effect. Keep the same collection
  // objects for that remount so live queries do not retain a disposed collection.
  await Promise.resolve();
  if (store.connections !== 0 || stores.get(key) !== store) return;
  stores.delete(key);
  await store.collections.dispose();
};
export const getCollection = (table: SyncedTable) => getRuntimeCollections().getCollection(table);
export const getWriter = (table: string) => getRuntimeCollections().getWriter(table);
export const getIndexedRows = (table: SyncedTable, field: string, value: unknown) =>
  getRuntimeCollections().getIndexedRows(table, field, value);
export const getCollectionsVersion = () => getRuntimeCollections().getCollectionsVersion();
export const isInitialCollectionsSyncComplete = () => getRuntimeCollections().isInitialCollectionsSyncComplete();
export const markInitialCollectionsSyncComplete = () => getRuntimeCollections().markInitialCollectionsSyncComplete();
export const subscribeCollections = (listener: (change?: CollectionChange) => void) =>
  getRuntimeCollections().subscribeCollections(listener);

// TanStack DB's proxy-based query builder loses our SyncedRow index signature,
// returning `{ [x: string]: {} | undefined }` instead. Cast data with this helper.
export const asSyncedRows = (data: unknown[] | undefined) => data as SyncedRow[] | undefined;
