import type { DbClient } from "pstdio-db";
import { collectCascadeDeletes } from "../features/sync/cascade-deletes";
import { getFullState } from "../features/sync/get-full-state";

export { SYNCED_TABLES } from "../features/sync/get-full-state";

export type SyncServiceDeps = { db: DbClient };

export const createSyncService = (deps: SyncServiceDeps) => ({
  getFullState: () => getFullState(deps.db),
  cascadeDeletes: (table: Parameters<typeof collectCascadeDeletes>[1], id: string) =>
    collectCascadeDeletes(deps.db, table, id),
});
