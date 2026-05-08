import { isNull } from "drizzle-orm";
import type { DbClient } from "pstdio-db";
import {
  agent_configs,
  attempt_statuses,
  extension_instances,
  files,
  installed_extension_sources,
  project_repos,
  projects,
  repos,
  sessions,
  templates,
  ticket_files,
  ticket_statuses,
  ticket_tag_assignments,
  ticket_tag_options,
  ticket_tags,
  ticket_workspaces,
  tickets,
  workspace_artifacts,
  workspace_sessions,
  workspaces,
} from "pstdio-db";

const tableMap = {
  projects,
  repos,
  project_repos,
  agent_configs,
  attempt_statuses,
  installed_extension_sources,
  extension_instances,
  ticket_statuses,
  tickets,
  ticket_tags,
  ticket_tag_options,
  ticket_tag_assignments,
  sessions,
  workspaces,
  ticket_workspaces,
  files,
  ticket_files,
  workspace_artifacts,
  workspace_sessions,
  templates,
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
