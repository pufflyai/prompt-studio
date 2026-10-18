import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "../db/connection.pglite";
import { projects, sessions, workspaces } from "../db/schemas.pg";
import type { CanonicalResource } from "./resource-links";

export const lockResourceLinkSource = async (db: Pick<DbClient, "select" | "update">, resource: CanonicalResource) => {
  // Extension-owned records and their timestamps belong to the owner's validation command.
  if (resource.extensionId !== "pstdio") return async () => {};
  if (resource.type === "project") {
    const [row] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, resource.id), eq(projects.id, resource.projectId)))
      .for("update");
    if (!row) throw new Error("Resource source not found in this project.");
    return async () => {
      await db.update(projects).set({ updated_at: new Date().toISOString() }).where(eq(projects.id, resource.id));
    };
  }
  if (resource.type !== "workspace" && resource.type !== "session")
    throw new Error(`Unknown host resource kind "${resource.type}".`);
  const table = resource.type === "workspace" ? workspaces : sessions;
  const [row] = await db
    .select()
    .from(table)
    .where(
      and(
        eq(table.id, resource.id),
        eq(table.project_id, resource.projectId),
        resource.type === "workspace" ? isNull(workspaces.deleted_at) : undefined,
      ),
    )
    .for("update");
  if (!row) throw new Error("Resource source not found in this project.");
  return async () => {
    await db.update(table).set({ updated_at: new Date().toISOString() }).where(eq(table.id, resource.id));
  };
};
