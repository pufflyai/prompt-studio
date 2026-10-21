import type { DbClient } from "pstdio-db";
import { collectCascadeDeletes } from "../features/sync/cascade-deletes";
import { getFullState } from "../features/sync/get-full-state";

export { SYNCED_TABLES } from "../features/sync/get-full-state";

export type SyncServiceDeps = { db: DbClient; personalState?: () => Promise<Record<string, unknown[]>> };

export const createSyncService = (deps: SyncServiceDeps) => ({
  getFullState: async () => {
    const state = await getFullState(deps.db);
    const personal = await deps.personalState?.();
    for (const [table, rows] of Object.entries(personal ?? {})) state[table] = [...state[table], ...rows];
    return state;
  },
  cascadeDeletes: (table: Parameters<typeof collectCascadeDeletes>[1], id: string) =>
    collectCascadeDeletes(deps.db, table, id),
});
