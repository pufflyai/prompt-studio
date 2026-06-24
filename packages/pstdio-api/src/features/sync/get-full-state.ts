import { isNull } from "drizzle-orm";
import type { DbClient } from "pstdio-db";
import {
  extension_instances,
  files,
  installed_extension_sources,
  notifications,
  project_repos,
  projects,
  repos,
  sessions,
  templates,
  workspace_sessions,
  workspaces,
} from "pstdio-db";
import { toNotification } from "../notifications/notifications-service";

const tableMap = {
  projects,
  repos,
  project_repos,
  installed_extension_sources,
  extension_instances,
  sessions,
  workspaces,
  files,
  workspace_sessions,
  templates,
  notifications,
} as const;

const ROW_NORMALIZERS: Partial<Record<keyof typeof tableMap, (row: unknown) => unknown>> = {
  notifications: (row) => toNotification(row as Parameters<typeof toNotification>[0]),
};

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
      const normalize = ROW_NORMALIZERS[name];
      return [name, normalize ? rows.map(normalize) : rows] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<string, unknown[]>;
};
