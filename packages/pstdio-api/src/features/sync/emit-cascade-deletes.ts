import {
  agent_configs,
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
  ticket_tags,
  ticket_workspaces,
  tickets,
  workspace_artifacts,
  workspaces,
} from "pstdio-db";
import type { EventBus } from "./event-bus";

// FK cascade graph: parent → children that cascade-delete via project_id, ticket_id, etc.
// Order matters: emit children first, parent last.
const projectDependents = async (db: DbClient, projectId: string, bus: EventBus) => {
  // Leaf-level first: join tables that reference tickets
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

  // Tickets themselves
  for (const ticket of projectTickets) bus.emit("tickets", "delete", { id: ticket.id });

  // Ticket tags (their tag_assignments already emitted above via tickets)
  const tags = await db.select().from(ticket_tags).where(eq(ticket_tags.project_id, projectId));
  for (const row of tags) bus.emit("ticket_tags", "delete", { id: row.id });

  // Ticket statuses
  const statuses = await db.select().from(ticket_statuses).where(eq(ticket_statuses.project_id, projectId));
  for (const row of statuses) bus.emit("ticket_statuses", "delete", { id: row.id });

  // Workspaces (ticket_workspaces already emitted via tickets)
  const ws = await db.select().from(workspaces).where(eq(workspaces.project_id, projectId));
  for (const row of ws) bus.emit("workspaces", "delete", { id: row.id });

  // Project repos
  const pr = await db.select().from(project_repos).where(eq(project_repos.project_id, projectId));
  for (const row of pr) bus.emit("project_repos", "delete", { id: row.id });

  // Files (ticket_files & workspace_artifacts already emitted)
  const projectFiles = await db.select().from(files).where(eq(files.project_id, projectId));
  for (const row of projectFiles) bus.emit("files", "delete", { id: row.id });

  // Templates (cascade-delete via project_id)
  const tmpl = await db.select().from(templates).where(eq(templates.project_id, projectId));
  for (const row of tmpl) bus.emit("templates", "delete", { id: row.id });
};

type SupportedTable =
  | "projects"
  | "repos"
  | "agent_configs"
  | "tickets"
  | "ticket_tags"
  | "sessions"
  | "workspaces"
  | "files"
  | "templates"
  | "project_repos"
  | "ticket_statuses"
  | "ticket_tag_assignments"
  | "ticket_workspaces"
  | "ticket_files"
  | "workspace_artifacts";

const tableRefs = {
  projects,
  repos,
  agent_configs,
  tickets,
  ticket_tags,
  sessions,
  workspaces,
  files,
  templates,
  project_repos,
  ticket_statuses,
  ticket_tag_assignments,
  ticket_workspaces,
  ticket_files,
  workspace_artifacts,
} as const;

export const emitCascadeDeletes = async (bus: EventBus, db: DbClient, table: SupportedTable, id: string) => {
  const tableRef = tableRefs[table];
  const [row] = await db.select().from(tableRef).where(sql`id = ${id}`);

  if (!row) return;

  if (table === "projects") {
    await projectDependents(db, id, bus);
  }

  bus.emit(table, "delete", { id });
};
