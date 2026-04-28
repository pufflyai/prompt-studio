import { isNull } from "drizzle-orm";
import {
  activity_events,
  agent_configs,
  attempt_statuses,
  type DbClient,
  eq,
  extension_collection_items,
  extension_instances,
  extension_kv,
  extension_template_preferences,
  files,
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
  activity_events,
  extension_instances,
  extension_kv,
  extension_collection_items,
  extension_template_preferences,
  attempt_statuses,
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

type RowWithId = { id: string };

const emitDeleteRows = (bus: EventBus, table: string, rows: RowWithId[]) => {
  for (const row of rows) bus.emit(table, "delete", { id: row.id });
};

const emitExtensionDependents = async (db: DbClient, projectId: string, bus: EventBus) => {
  emitDeleteRows(
    bus,
    "extension_kv",
    await db.select().from(extension_kv).where(eq(extension_kv.project_id, projectId)),
  );
  emitDeleteRows(
    bus,
    "extension_collection_items",
    await db.select().from(extension_collection_items).where(eq(extension_collection_items.project_id, projectId)),
  );
  emitDeleteRows(
    bus,
    "extension_template_preferences",
    await db
      .select()
      .from(extension_template_preferences)
      .where(eq(extension_template_preferences.project_id, projectId)),
  );
  emitDeleteRows(
    bus,
    "extension_instances",
    await db.select().from(extension_instances).where(eq(extension_instances.project_id, projectId)),
  );
};

// Emit cascade deletes for all project dependents (children first, parent last)
const emitProjectDependents = async (db: DbClient, projectId: string, bus: EventBus) => {
  emitDeleteRows(
    bus,
    "attempt_statuses",
    await db.select().from(attempt_statuses).where(eq(attempt_statuses.project_id, projectId)),
  );
  const projectWorkspaces = await db.select().from(workspaces).where(eq(workspaces.project_id, projectId));
  for (const workspace of projectWorkspaces) {
    emitDeleteRows(
      bus,
      "workspace_sessions",
      await db.select().from(workspace_sessions).where(eq(workspace_sessions.workspace_id, workspace.id)),
    );
  }
  emitDeleteRows(bus, "workspaces", projectWorkspaces);
  emitDeleteRows(
    bus,
    "project_repos",
    await db.select().from(project_repos).where(eq(project_repos.project_id, projectId)),
  );
  emitDeleteRows(bus, "files", await db.select().from(files).where(eq(files.project_id, projectId)));
  emitDeleteRows(bus, "templates", await db.select().from(templates).where(eq(templates.project_id, projectId)));
  emitDeleteRows(
    bus,
    "activity_events",
    await db.select().from(activity_events).where(eq(activity_events.project_id, projectId)),
  );
  await emitExtensionDependents(db, projectId, bus);
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
