import type { DbClient } from "pstdio-db";
import {
  agent_configs,
  files,
  project_repos,
  projects,
  repos,
  sessions,
  templates,
  ticket_files,
  ticket_statuses,
  ticket_tag_assignments,
  ticket_tags,
  ticket_workspaces,
  tickets,
  workspace_artifacts,
  workspaces,
} from "pstdio-db";

const tableMap = {
  projects,
  repos,
  project_repos,
  agent_configs,
  ticket_statuses,
  tickets,
  ticket_tags,
  ticket_tag_assignments,
  sessions,
  workspaces,
  ticket_workspaces,
  files,
  ticket_files,
  workspace_artifacts,
  templates,
} as const;

export const SYNCED_TABLES = Object.keys(tableMap) as (keyof typeof tableMap)[];

export const getFullState = async (db: DbClient) => {
  const entries = await Promise.all(
    SYNCED_TABLES.map(async (name) => {
      const rows = await db.select().from(tableMap[name]);
      return [name, rows] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<string, unknown[]>;
};
