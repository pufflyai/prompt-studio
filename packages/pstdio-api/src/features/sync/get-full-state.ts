import { isNull } from "drizzle-orm";
import { boardDefaultSyncRow, boardViewSyncRow } from "pstdio-api-contracts";
import type { DbClient } from "pstdio-db";
import {
  board_views,
  createBoardViewsDBService,
  createExtensionInstancesDBService,
  createSettingsDBService,
  createWorkspaceSessionsDBService,
  fileColumns,
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
  "extension_instances",
] as const;

const hasDeletedAt = (table: unknown): table is Record<string, unknown> & { deleted_at: unknown } =>
  typeof table === "object" && table !== null && "deleted_at" in table;

const physicalRows = async (db: DbClient, name: keyof typeof tableMap) => {
  if (name === "files") return db.select(fileColumns).from(files);
  if (name === "workspaces") return db.select(workspaceColumns).from(workspaces).where(isNull(workspaces.deleted_at));
  if (name === "sessions") return db.select(sessionColumns).from(sessions);
  const table = tableMap[name];
  const query = db.select().from(table);
  const rows = hasDeletedAt(table)
    ? await query.where(isNull(table.deleted_at as Parameters<typeof isNull>[0]))
    : await query;
  return name === "board_views" ? rows.map((row) => boardViewSyncRow(row as typeof board_views.$inferSelect)) : rows;
};

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
      if (name === "extension_instances") return [name, await createExtensionInstancesDBService(db).list()] as const;
      return [name, await physicalRows(db, name)] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<string, unknown[]>;
};
