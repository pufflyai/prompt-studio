import { isNull } from "drizzle-orm";
import { boardDefaultSyncRow } from "pstdio-api-contracts";
import type { DbClient } from "pstdio-db";
import {
  board_default_views,
  board_views,
  extension_instances,
  files,
  installed_extension_sources,
  notifications,
  projects,
  sessions,
  settings,
  workspace_sessions,
  workspaces,
} from "pstdio-db";

export const tableMap = {
  board_views,
  board_default_views,
  settings,
  projects,
  installed_extension_sources,
  notifications,
  extension_instances,
  sessions,
  workspaces,
  files,
  workspace_sessions,
} as const;

export const SYNCED_TABLES = Object.keys(tableMap) as (keyof typeof tableMap)[];

const hasDeletedAt = (table: unknown): table is Record<string, unknown> & { deleted_at: unknown } =>
  typeof table === "object" && table !== null && "deleted_at" in table;

export const getFullState = async (db: DbClient) => {
  const entries = await Promise.all(
    SYNCED_TABLES.map(async (name) => {
      const table = tableMap[name];
      const query = db.select().from(table);
      const rows = hasDeletedAt(table)
        ? await query.where(isNull(table.deleted_at as Parameters<typeof isNull>[0]))
        : await query;
      return [
        name,
        name === "board_default_views"
          ? rows.map((row) => boardDefaultSyncRow(row as typeof board_default_views.$inferSelect))
          : rows,
      ] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<string, unknown[]>;
};
