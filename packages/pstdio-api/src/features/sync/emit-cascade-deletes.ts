import { type DbClient, eq, files, project_repos, projects, repos, sessions, sql, workspaces } from "pstdio-db";
import type { EventBus } from "./event-bus";

// FK cascade graph: parent → children that cascade-delete through their foreign keys.
// Order matters: emit children first, parent last.
const projectDependents = async (db: DbClient, projectId: string, bus: EventBus) => {
  const ws = await db.select().from(workspaces).where(eq(workspaces.project_id, projectId));
  for (const row of ws) bus.emit("workspaces", "delete", { id: row.id });

  // Project repos
  const pr = await db.select().from(project_repos).where(eq(project_repos.project_id, projectId));
  for (const row of pr) bus.emit("project_repos", "delete", { id: row.id });

  const projectFiles = await db.select().from(files).where(eq(files.project_id, projectId));
  for (const row of projectFiles) bus.emit("files", "delete", { id: row.id });
};

type SupportedTable = "projects" | "repos" | "sessions" | "workspaces" | "files" | "project_repos";

const tableRefs = {
  projects,
  repos,
  sessions,
  workspaces,
  files,
  project_repos,
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
