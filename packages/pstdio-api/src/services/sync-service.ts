import { isNull } from "drizzle-orm";
import {
  agent_configs,
  type DbClient,
  eq,
  extension_instances,
  files,
  installed_extension_sources,
  project_repos,
  projects,
  repos,
  sessions,
  sql,
  templates,
  workspace_sessions,
  workspaces,
} from "pstdio-db";
import type { EventBus } from "../features/sync/event-bus";

const tableMap = {
  projects,
  repos,
  project_repos,
  agent_configs,
  installed_extension_sources,
  extension_instances,
  sessions,
  workspaces,
  files,
  workspace_sessions,
  templates,
} as const;

export const SYNCED_TABLES = Object.keys(tableMap) as (keyof typeof tableMap)[];

type SupportedTable = keyof typeof tableMap;

const hasDeletedAt = (table: unknown): table is Record<string, unknown> & { deleted_at: unknown } =>
  typeof table === "object" && table !== null && "deleted_at" in table;

export type SyncServiceDeps = {
  db: DbClient;
  eventBus: EventBus;
};

// Emit cascade deletes for all project dependents (children first, parent last)
const emitProjectDependents = async (db: DbClient, projectId: string, bus: EventBus) => {
  const ws = await db.select().from(workspaces).where(eq(workspaces.project_id, projectId));
  for (const row of ws) bus.emit("workspaces", "delete", { id: row.id });

  const pr = await db.select().from(project_repos).where(eq(project_repos.project_id, projectId));
  for (const row of pr) bus.emit("project_repos", "delete", { id: row.id });

  const projectFiles = await db.select().from(files).where(eq(files.project_id, projectId));
  for (const row of projectFiles) bus.emit("files", "delete", { id: row.id });

  const tmpl = await db.select().from(templates).where(eq(templates.project_id, projectId));
  for (const row of tmpl) bus.emit("templates", "delete", { id: row.id });
};

export const createSyncService = (deps: SyncServiceDeps) => {
  const { db, eventBus } = deps;

  const getFullState = async () => {
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

  const emitCascadeDeletes = async (table: SupportedTable, id: string) => {
    const tableRef = tableMap[table];
    const [row] = await db.select().from(tableRef).where(sql`id = ${id}`);

    if (!row) return;

    if (table === "projects") {
      await emitProjectDependents(db, id, eventBus);
    }

    eventBus.emit(table, "delete", { id });
  };

  return { getFullState, emitCascadeDeletes };
};
