import { eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { sessions, workspace_sessions, workspaces } from "../../db/schemas.pg";

const nowTimestamp = () => new Date().toISOString();

export const createWorkspaceSessionsDBService = (db: DbClient) => {
  const link = async (workspaceId: string, sessionId: string) => {
    const record = {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      session_id: sessionId,
      created_at: nowTimestamp(),
    };

    await db.insert(workspace_sessions).values(record);
    return record;
  };

  const getWorkspaceBySessionId = async (sessionId: string) => {
    const [row] = await db
      .select({ workspace: workspaces })
      .from(workspace_sessions)
      .innerJoin(workspaces, eq(workspace_sessions.workspace_id, workspaces.id))
      .where(eq(workspace_sessions.session_id, sessionId));

    return row?.workspace ?? null;
  };

  const listByWorkspace = async (workspaceId: string) => {
    const rows = await db
      .select({ session: sessions })
      .from(workspace_sessions)
      .innerJoin(sessions, eq(workspace_sessions.session_id, sessions.id))
      .where(eq(workspace_sessions.workspace_id, workspaceId))
      .orderBy(workspace_sessions.created_at);

    return rows.map((r) => r.session);
  };

  return { link, getWorkspaceBySessionId, listByWorkspace };
};
