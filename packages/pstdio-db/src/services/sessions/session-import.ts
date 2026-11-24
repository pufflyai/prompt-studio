import { eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { sessions, workspaces } from "../../db/schemas.pg";
import { sessionColumns } from "../legacy-resource-links";
import { workspaceSessionLink } from "../workspace-sessions/workspace-sessions";

const validateWorkspace = async (db: Pick<DbClient, "select">, projectId: string | null, workspaceId: string) => {
  const [workspace] = await db
    .select({ project_id: workspaces.project_id })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));
  if (!workspace || workspace.project_id !== projectId)
    throw new Error("Workspace does not belong to the session project.");
};

export const createSessionImportOperations = (db: DbClient) => ({
  importHistorical: async (input: {
    record: Omit<typeof sessions.$inferSelect, "workspace_id">;
    workspaceId?: string;
  }) =>
    db.transaction(async (tx) => {
      const [existing] = await tx.select(sessionColumns).from(sessions).where(eq(sessions.id, input.record.id));
      if (existing) return { session: existing, created: false, workspaceLink: undefined };
      if (input.workspaceId) await validateWorkspace(tx, input.record.project_id, input.workspaceId);
      const [created] = await tx
        .insert(sessions)
        .values({ ...input.record, agent_session_id: null, workspace_id: input.workspaceId ?? null })
        .onConflictDoNothing()
        .returning(sessionColumns);
      if (!created) {
        const [session] = await tx.select(sessionColumns).from(sessions).where(eq(sessions.id, input.record.id));
        return { session: session!, created: false, workspaceLink: undefined };
      }
      return {
        session: created,
        created: true,
        workspaceLink: workspaceSessionLink({ ...created, workspace_id: input.workspaceId ?? null }) ?? undefined,
      };
    }),
});
