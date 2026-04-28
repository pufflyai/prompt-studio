import { isNull } from "drizzle-orm";
import type { DbClient } from "pstdio-db";
import {
  activity_events,
  agent_configs,
  extension_collection_items,
  extension_instances,
  extension_kv,
  extension_skill_preferences,
  extension_template_preferences,
  files,
  project_repos,
  projects,
  repos,
  sessions,
  skills,
  templates,
  workspace_sessions,
  workspaces,
} from "pstdio-db";

const tableMap = {
  projects,
  repos,
  project_repos,
  agent_configs,
  activity_events,
  extension_instances,
  extension_kv,
  extension_collection_items,
  extension_template_preferences,
  extension_skill_preferences,
  sessions,
  workspaces,
  files,
  workspace_sessions,
  templates,
  skills,
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
      return [name, rows] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<string, unknown[]>;
};
