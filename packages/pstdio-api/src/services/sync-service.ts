import { isNull } from "drizzle-orm";
import {
  agent_configs,
  attempt_statuses,
  type DbClient,
  eq,
  files,
  project_repos,
  projects,
  repos,
  sessions,
  sql,
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
import type { EventBus } from "../features/sync/event-bus";

const tableMap = {
  projects,
  repos,
  project_repos,
  agent_configs,
  ticket_statuses,
  attempt_statuses,
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

type SupportedTable = keyof typeof tableMap;

const hasDeletedAt = (table: unknown): table is Record<string, unknown> & { deleted_at: unknown } =>
  typeof table === "object" && table !== null && "deleted_at" in table;

export type SyncServiceDeps = {
  db: DbClient;
  eventBus: EventBus;
};

// Emit cascade deletes for all project dependents (children first, parent last)
const emitProjectDependents = async (db: DbClient, projectId: string, bus: EventBus) => {
  const projectTickets = await db.select().from(tickets).where(eq(tickets.project_id, projectId));
  for (const ticket of projectTickets) {
    const tagAssignments = await db
      .select()
      .from(ticket_tag_assignments)
      .where(eq(ticket_tag_assignments.ticket_id, ticket.id));
    for (const row of tagAssignments) bus.emit("ticket_tag_assignments", "delete", { id: row.id });

    const tw = await db.select().from(ticket_workspaces).where(eq(ticket_workspaces.ticket_id, ticket.id));
    for (const row of tw) bus.emit("ticket_workspaces", "delete", { id: row.id });

    const tf = await db.select().from(ticket_files).where(eq(ticket_files.ticket_id, ticket.id));
    for (const row of tf) bus.emit("ticket_files", "delete", { id: row.id });

    const wa = await db.select().from(workspace_artifacts).where(eq(workspace_artifacts.ticket_id, ticket.id));
    for (const row of wa) bus.emit("workspace_artifacts", "delete", { id: row.id });
  }

  for (const ticket of projectTickets) bus.emit("tickets", "delete", { id: ticket.id });

  const tags = await db.select().from(ticket_tags).where(eq(ticket_tags.project_id, projectId));
  for (const tag of tags) {
    const options = await db.select().from(ticket_tag_options).where(eq(ticket_tag_options.tag_id, tag.id));
    for (const row of options) bus.emit("ticket_tag_options", "delete", { id: row.id });
  }
  for (const row of tags) bus.emit("ticket_tags", "delete", { id: row.id });

  const statuses = await db.select().from(ticket_statuses).where(eq(ticket_statuses.project_id, projectId));
  for (const row of statuses) bus.emit("ticket_statuses", "delete", { id: row.id });

  const aStatuses = await db.select().from(attempt_statuses).where(eq(attempt_statuses.project_id, projectId));
  for (const row of aStatuses) bus.emit("attempt_statuses", "delete", { id: row.id });

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
