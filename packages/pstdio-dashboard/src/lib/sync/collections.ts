import { type Collection, createCollection } from "@tanstack/react-db";

export { eq, useLiveQuery } from "@tanstack/react-db";

export const SYNCED_TABLES = [
  "settings",
  "projects",
  "repos",
  "project_repos",
  "installed_extension_sources",
  "notifications",
  "extension_instances",
  "sessions",
  "workspaces",
  "files",
  "workspace_sessions",
  "templates",
] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];

export type SyncedRow = { id: string; [key: string]: unknown };
export interface CollectionRowChange {
  key: string;
  value?: SyncedRow;
  previousValue?: SyncedRow;
}
export type CollectionChange = { table: SyncedTable; changes: readonly CollectionRowChange[] };

export interface CollectionWriter {
  truncateAndWrite: (rows: SyncedRow[]) => void;
  upsert: (row: SyncedRow) => void;
  remove: (id: string) => void;
}

const collections = new Map<string, Collection<SyncedRow, string>>();
const writers = new Map<string, CollectionWriter>();
const listeners = new Set<(change?: CollectionChange) => void>();
const syncedTableSet = new Set<string>(SYNCED_TABLES);
const indexes = new Map<SyncedTable, Map<string, Map<unknown, Set<string>>>>();
let collectionsVersion = 0;
let initialCollectionsSyncComplete = false;

const notifyCollectionsChanged = (change?: CollectionChange) => {
  if (change) {
    for (const [field, index] of indexes.get(change.table) ?? []) {
      for (const row of change.changes) {
        const previous = row.previousValue?.[field];
        const ids = index.get(previous);
        ids?.delete(row.key);
        if (ids?.size === 0) index.delete(previous);
        if (row.value) {
          const value = row.value[field];
          const next = index.get(value) ?? new Set<string>();
          next.add(row.key);
          index.set(value, next);
        }
      }
    }
  }
  collectionsVersion += 1;
  for (const listener of listeners) listener(change);
};

export const getCollectionsVersion = () => collectionsVersion;

export const isInitialCollectionsSyncComplete = () => initialCollectionsSyncComplete;

export const markInitialCollectionsSyncComplete = () => {
  if (initialCollectionsSyncComplete) return;
  initialCollectionsSyncComplete = true;
  notifyCollectionsChanged();
};

export const subscribeCollections = (listener: (change?: CollectionChange) => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getOrCreate = (table: string) => {
  let col = collections.get(table);
  if (col) return col;

  col = createCollection<SyncedRow, string>({
    id: table,
    getKey: (item) => item.id,
    // Dashboard collections mirror the backend sync stream and are read directly by route
    // selectors, so they must survive periods with no live-query subscribers.
    gcTime: 0,
    sync: {
      sync: ({ begin, write, commit, markReady }) => {
        const syncedIds = new Set<string>();

        writers.set(table, {
          truncateAndWrite: (rows) => {
            const next = new Map(rows.map((row) => [row.id, row]));
            const changes: CollectionRowChange[] = [...syncedIds].map((key) => ({
              key,
              previousValue: collections.get(table)?.get(key),
              value: next.get(key),
            }));
            for (const row of rows) if (!syncedIds.has(row.id)) changes.push({ key: row.id, value: row });
            begin();
            for (const id of syncedIds) write({ type: "delete", key: id });
            syncedIds.clear();
            for (const row of rows) {
              write({ type: "insert", value: row });
              syncedIds.add(row.id);
            }
            commit();
            notifyCollectionsChanged({ table: table as SyncedTable, changes });
          },
          upsert: (row) => {
            const previousValue = collections.get(table)?.get(row.id);
            begin({ immediate: true });
            const type = syncedIds.has(row.id) ? "update" : "insert";
            write({ type, value: row });
            syncedIds.add(row.id);
            commit();
            notifyCollectionsChanged({
              table: table as SyncedTable,
              changes: [{ key: row.id, previousValue, value: row }],
            });
          },
          remove: (id) => {
            const previousValue = collections.get(table)?.get(id);
            begin({ immediate: true });
            write({ type: "delete", key: id });
            syncedIds.delete(id);
            commit();
            notifyCollectionsChanged({ table: table as SyncedTable, changes: [{ key: id, previousValue }] });
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

export const getCollection = (table: SyncedTable) => getOrCreate(table);

export const getIndexedRows = (table: SyncedTable, field: string, value: unknown) => {
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

export const getWriter = (table: string): CollectionWriter | undefined => {
  if (!syncedTableSet.has(table)) return undefined;
  getOrCreate(table);
  return writers.get(table);
};

export const getAllCollections = () => {
  for (const table of SYNCED_TABLES) getOrCreate(table);
  return collections;
};

// TanStack DB's proxy-based query builder loses our SyncedRow index signature,
// returning `{ [x: string]: {} | undefined }` instead. Cast data with this helper.
export const asSyncedRows = (data: unknown[] | undefined) => data as SyncedRow[] | undefined;
