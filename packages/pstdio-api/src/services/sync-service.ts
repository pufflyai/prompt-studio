import { boardDefaultSyncRow } from "pstdio-api-contracts";
import { board_default_views, board_views, type DbClient, eq, files, notifications, sql, workspaces } from "pstdio-db";
import type { EventBus } from "../features/sync/event-bus";
import { getFullState, tableMap } from "../features/sync/get-full-state";

export { SYNCED_TABLES } from "../features/sync/get-full-state";

type SupportedTable = Exclude<keyof typeof tableMap, "board_default_views">;
export type SyncServiceDeps = { db: DbClient; eventBus: EventBus };

// Emit cascade deletes for all project dependents (children first, parent last)
const emitProjectDependents = async (db: DbClient, projectId: string, bus: EventBus) => {
  const views = await db.select().from(board_views).where(eq(board_views.project_id, projectId));
  for (const row of views) bus.emit("board_views", "delete", { id: row.id });
  const defaults = await db.select().from(board_default_views).where(eq(board_default_views.project_id, projectId));
  for (const row of defaults) bus.emit("board_default_views", "delete", { id: boardDefaultSyncRow(row).id });
  const ws = await db.select().from(workspaces).where(eq(workspaces.project_id, projectId));
  for (const row of ws) bus.emit("workspaces", "delete", { id: row.id });

  const projectFiles = await db.select().from(files).where(eq(files.project_id, projectId));
  for (const row of projectFiles) bus.emit("files", "delete", { id: row.id });

  const projectNotifications = await db.select().from(notifications).where(eq(notifications.project_id, projectId));
  for (const row of projectNotifications) bus.emit("notifications", "delete", { id: row.id });
};

export const createSyncService = (deps: SyncServiceDeps) => {
  const { db, eventBus } = deps;

  const emitCascadeDeletes = async (table: SupportedTable, id: string) => {
    const tableRef = tableMap[table];
    const [row] = await db.select().from(tableRef).where(sql`id = ${id}`);

    if (!row) return;

    if (table === "projects") {
      await emitProjectDependents(db, id, eventBus);
    }

    eventBus.emit(table, "delete", { id });
  };

  return { getFullState: () => getFullState(db), emitCascadeDeletes };
};
