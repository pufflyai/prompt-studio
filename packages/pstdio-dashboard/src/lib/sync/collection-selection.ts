import type { RuntimeCollections, SyncedRow, SyncedTable } from "./collections";

export interface CollectionSelection {
  tables: readonly SyncedTable[];
  projectId?: string;
  rowIds?: readonly string[];
  fields?: readonly string[];
}

/** A projection of the replicated rows, not another writable copy of server state. */
export const createCollectionSelection = (owner: RuntimeCollections, input: CollectionSelection) => {
  let versions = "";
  let snapshot: readonly SyncedRow[] = [];
  let stop: (() => void) | undefined;
  const listeners = new Set<() => void>();
  const read = () => {
    const current = [
      ...input.tables.map((table) => owner.getCollectionVersion(table)),
      owner.isInitialCollectionsSyncComplete(),
    ].join(":");
    if (versions === current) return snapshot;
    versions = current;
    const rows = input.tables.flatMap((table) => {
      const collection = owner.getCollection(table);
      const values =
        input.projectId && table !== "projects"
          ? owner.getIndexedRows(table, "project_id", input.projectId)
          : [...collection.state.values()];
      return values.filter(
        (row) =>
          (!input.projectId || table !== "projects" || row.id === input.projectId) &&
          (!input.rowIds || input.rowIds.includes(row.id)),
      );
    });
    const equal =
      rows.length === snapshot.length &&
      rows.every((row, index) => {
        const previous = snapshot[index];
        return input.fields
          ? row.id === previous?.id && input.fields.every((field) => Object.is(row[field], previous[field]))
          : row === previous;
      });
    if (!equal) snapshot = rows;
    return snapshot;
  };
  return {
    get: read,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (!stop) {
        let previous = read();
        stop = owner.subscribeCollections((change) => {
          if (change && !input.tables.includes(change.table)) return;
          const next = read();
          // Initial-sync and reconnect boundaries also drive non-React controllers.
          if (change && next === previous) return;
          previous = next;
          for (const notify of listeners) notify();
        });
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          stop?.();
          stop = undefined;
        }
      };
    },
  };
};
