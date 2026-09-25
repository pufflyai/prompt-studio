import { eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { type ResourceRef, workspaces } from "../../db/schemas.pg";
import { mergeResourceAnchors, removeResourceAnchors } from "../resource-anchors";

export const createWorkspaceAnchorMutations = (db: DbClient) => ({
  addAnchors: async (id: string, anchors: ResourceRef[]) => {
    const [updated] = await db
      .update(workspaces)
      .set({
        anchors_json: mergeResourceAnchors(workspaces.anchors_json, anchors),
        updated_at: new Date().toISOString(),
      })
      .where(eq(workspaces.id, id))
      .returning();
    return updated ?? null;
  },
  removeAnchors: async (id: string, refs: Pick<ResourceRef, "type" | "id">[]) => {
    const [updated] = await db
      .update(workspaces)
      .set({
        anchors_json: removeResourceAnchors(workspaces.anchors_json, refs),
        updated_at: new Date().toISOString(),
      })
      .where(eq(workspaces.id, id))
      .returning();
    return updated ?? null;
  },
});
