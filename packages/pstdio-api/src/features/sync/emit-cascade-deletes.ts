import { type DbClient, eq, files, projects, sessions, sql, workspaces } from "pstdio-db";
import type { EventBus } from "./event-bus";

// FK cascade graph: parent → children that cascade-delete through their foreign keys.
// Order matters: emit children first, parent last.
const projectDependents = async (db: DbClient, projectId: string, bus: EventBus) => {
  const ws = await db.select().from(workspaces).where(eq(workspaces.project_id, projectId));
  for (const row of ws) bus.emit("workspaces", "delete", { id: row.id });

  // Project repos

  const projectFiles = await db.select().from(files).where(eq(files.project_id, projectId));
  for (const row of projectFiles) bus.emit("files", "delete", { id: row.id });
};

type SupportedTable = "projects" | "sessions" | "workspaces" | "files";

const tableRefs = {
  projects,
  sessions,
  workspaces,
  files,
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
