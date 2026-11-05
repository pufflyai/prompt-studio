import { eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { sessions, workspace_sessions } from "../../db/schemas.pg";
import { sessionColumns } from "../legacy-resource-links";

export const createSessionImportOperations = (db: DbClient) => ({
  importHistorical: async (input: { record: typeof sessions.$inferSelect; workspaceId?: string }) =>
    db.transaction(async (tx) => {
      const [created] = await tx
        .insert(sessions)
        .values({ ...input.record, agent_session_id: null })
        .onConflictDoNothing()
        .returning(sessionColumns);
      if (!created) {
        const [session] = await tx.select(sessionColumns).from(sessions).where(eq(sessions.id, input.record.id));
        return { session: session!, created: false, workspaceLink: undefined };
      }
      let workspaceLink: typeof workspace_sessions.$inferSelect | undefined;
      if (input.workspaceId) {
        [workspaceLink] = await tx
          .insert(workspace_sessions)
          .values({
            id: crypto.randomUUID(),
            workspace_id: input.workspaceId,
            session_id: created.id,
            created_at: created.created_at,
          })
          .returning();
      }
      return { session: created, created: true, workspaceLink };
    }),
});
