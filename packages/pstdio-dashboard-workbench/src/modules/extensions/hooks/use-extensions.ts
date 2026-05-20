import { asSyncedRows, getCollection, type SyncedRow, useLiveQuery } from "@/lib/sync/collections";
import { bool, isNotDeleted, str } from "@/lib/sync/row";

export interface DashboardExtension {
  id: string;
  displayName: string;
  namespace: string;
  enabled: boolean;
}

const toExtension = (row: SyncedRow): DashboardExtension => ({
  id: row.id,
  displayName: str(row.display_name_override) ?? str(row.namespace) ?? row.id,
  namespace: str(row.namespace) ?? row.id,
  enabled: bool(row.enabled),
});

export const toVisibleExtensions = (rows: SyncedRow[]): DashboardExtension[] =>
  rows.filter(isNotDeleted).map(toExtension);

export const useExtensionInstances = (): DashboardExtension[] => {
  const { data } = useLiveQuery((q) =>
    q.from({ e: getCollection("extension_instances") }).select(({ e }) => ({ ...e })),
  );
  return toVisibleExtensions(asSyncedRows(data) ?? []);
};
