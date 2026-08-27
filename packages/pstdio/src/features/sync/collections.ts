import { type Collection, createCollection } from "@tanstack/react-db";

const SYNCED_TABLES = ["projects", "repos", "project_repos", "sessions", "workspaces", "files"] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];

export type SyncedRow = { id: string; [key: string]: unknown };

export interface CollectionWriter {
  truncateAndWrite: (rows: SyncedRow[]) => void;
  upsert: (row: SyncedRow) => void;
  remove: (id: string) => void;
}

const collections = new Map<string, Collection<SyncedRow, string>>();
const writers = new Map<string, CollectionWriter>();

const getOrCreate = (table: string) => {
  let col = collections.get(table);
  if (col) return col;

  col = createCollection<SyncedRow, string>({
    id: table,
    getKey: (item) => item.id,
    sync: {
      sync: ({ begin, write, commit, markReady }) => {
        const syncedIds = new Set<string>();

        writers.set(table, {
          truncateAndWrite: (rows) => {
            begin();
            // Delete all existing
            for (const id of syncedIds) write({ type: "delete", key: id });
            syncedIds.clear();
            // Insert new
            for (const row of rows) {
              write({ type: "insert", value: row });
              syncedIds.add(row.id);
            }
            commit();
          },
          upsert: (row) => {
            begin({ immediate: true });
            const type = syncedIds.has(row.id) ? "update" : "insert";
            write({ type, value: row });
            syncedIds.add(row.id);
            commit();
          },
          remove: (id) => {
            begin({ immediate: true });
            write({ type: "delete", key: id });
            syncedIds.delete(id);
            commit();
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
  // preload() triggers startSync() which calls our sync callback synchronously,
  // registering the writer. The returned promise resolves after markReady().
  col.preload();
  return col;
};

export const getCollection = (table: SyncedTable) => getOrCreate(table);

export const getWriter = (table: SyncedTable): CollectionWriter | undefined => {
  getOrCreate(table);
  return writers.get(table);
};
