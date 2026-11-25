import { and, eq, isNull } from "drizzle-orm";
import { retainSessionWorkspaceContext } from "../services/workspace-sessions/workspace-sessions";
import type { DbClient } from "./connection.pglite";
import { sessions, workspaces } from "./schemas.pg";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

type ReleasedLink = { id: string; session_id: string; workspace_id: string; created_at: string };
export const prepareSessionWorkspaceUpgrade = (db: DbClient, path: string) =>
  prepareUpgradeSnapshot(
    db,
    path,
    {
      table: "workspace_sessions",
      keys: ["session_id", "created_at", "id"],
      name: "session-workspaces",
      archive: "workspace-sessions",
    },
    async (input) => {
      const row = input as ReleasedLink;
      await db.transaction(async (tx) => {
        const [session] = await tx.select().from(sessions).where(eq(sessions.id, row.session_id));
        const [workspace] = await tx.select().from(workspaces).where(eq(workspaces.id, row.workspace_id));
        if (!session || !workspace || session.project_id !== workspace.project_id)
          throw new Error(`Workspace ownership does not match for ${row.id}`);
        if (!session.workspace_id) {
          await tx
            .update(sessions)
            .set({ workspace_id: workspace.id })
            .where(and(eq(sessions.id, session.id), isNull(sessions.workspace_id)));
        } else if (session.workspace_id !== workspace.id) await retainSessionWorkspaceContext(tx, session, workspace);
      });
    },
    async (input) => {
      const row = input as ReleasedLink;
      const [session] = await db
        .select({ project_id: sessions.project_id })
        .from(sessions)
        .where(eq(sessions.id, row.session_id));
      const [workspace] = await db
        .select({ project_id: workspaces.project_id })
        .from(workspaces)
        .where(eq(workspaces.id, row.workspace_id));
      if (!session || !workspace || session.project_id !== workspace.project_id)
        throw new Error(`Workspace ownership does not match for ${row.id}`);
      return row;
    },
  );
