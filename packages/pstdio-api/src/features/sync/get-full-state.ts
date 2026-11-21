import { isNull } from "drizzle-orm";
import { boardDefaultSyncRow, boardViewSyncRow } from "pstdio-api-contracts";
import type { DbClient } from "pstdio-db";
import {
  board_views,
  createBoardViewsDBService,
  createSettingsDBService,
  createWorkspaceSessionsDBService,
  extension_instances,
  files,
  installed_extension_sources,
  notifications,
  projects,
  sessionColumns,
  sessions,
  workspaceColumns,
  workspaces,
} from "pstdio-db";

export const tableMap = {
  board_views,
  projects,
  installed_extension_sources,
  notifications,
  extension_instances,
  sessions,
  workspaces,
  files,
} as const;

export const PHYSICAL_SYNCED_TABLES = Object.keys(tableMap) as (keyof typeof tableMap)[];
export const SYNCED_TABLES = [
  ...PHYSICAL_SYNCED_TABLES,
  "settings",
  "board_default_views",
  "workspace_sessions",
] as const;

const hasDeletedAt = (table: unknown): table is Record<string, unknown> & { deleted_at: unknown } =>
  typeof table === "object" && table !== null && "deleted_at" in table;

export const getFullState = async (db: DbClient) => {
  const entries = await Promise.all(
    SYNCED_TABLES.map(async (name) => {
      if (name === "settings") {
        const settings = await createSettingsDBService(db).getStored();
        return [name, settings ? [settings] : []] as const;
      }
      if (name === "board_default_views")
        return [name, (await createBoardViewsDBService(db).listDefaults()).map(boardDefaultSyncRow)] as const;
      if (name === "workspace_sessions")
        return [name, await createWorkspaceSessionsDBService(db).listAllLinks()] as const;
      const table = tableMap[name];
      if (name === "workspaces")
        return [name, await db.select(workspaceColumns).from(workspaces).where(isNull(workspaces.deleted_at))] as const;
      if (name === "sessions") return [name, await db.select(sessionColumns).from(sessions)] as const;
      const query = db.select().from(table);
      const rows = hasDeletedAt(table)
        ? await query.where(isNull(table.deleted_at as Parameters<typeof isNull>[0]))
        : await query;
      return [
        name,
        name === "board_views"
          ? rows.map((row) => {
              return boardViewSyncRow(row as typeof board_views.$inferSelect);
            })
          : rows,
      ] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<string, unknown[]>;
};
