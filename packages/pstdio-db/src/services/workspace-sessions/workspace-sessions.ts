import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { resource_anchors, sessions, workspaces } from "../../db/schemas.pg";
import { sessionColumns, workspaceColumns } from "../legacy-resource-links";

// The public link resource is a projection of the session's current workspace.
export const workspaceSessionColumns = {
  id: sessions.id,
  session_id: sessions.id,
  workspace_id: sql<string>`${sessions.workspace_id}`.as("workspace_id"),
  created_at: sessions.created_at,
};
export const workspaceSessionLink = (session: { id: string; workspace_id: string | null; created_at: string }) =>
  session.workspace_id
    ? { id: session.id, session_id: session.id, workspace_id: session.workspace_id, created_at: session.created_at }
    : null;
export const retainSessionWorkspaceContext = (
  db: Pick<DbClient, "insert">,
  session: { id: string; project_id: string | null; title: string },
  workspace: { id: string; project_id: string; name: string; workspace_shorthand: string },
) =>
  db
    .insert(resource_anchors)
    .values({
      project_id: workspace.project_id,
      source_owner: "pstdio",
      source_kind: "session",
      source_id: session.id,
      target_owner: "pstdio",
      target_kind: "workspace",
      target_id: workspace.id,
      role: "context",
      details: {
        type: "workspace",
        id: workspace.id,
        label: workspace.name,
        shorthand: workspace.workspace_shorthand,
        sourceRef: { label: session.title },
      },
    })
    .onConflictDoNothing();

export const createWorkspaceSessionsDBService = (db: DbClient) => {
  const link = (workspaceId: string, sessionId: string) =>
    db.transaction(async (tx) => {
      const [session] = await tx.select().from(sessions).where(eq(sessions.id, sessionId)).for("update");
      const [workspace] = await tx.select().from(workspaces).where(eq(workspaces.id, workspaceId));
      if (!session || !workspace || workspace.project_id !== session.project_id)
        throw new Error("Workspace does not belong to the session project.");
      if (session.workspace_id === workspaceId) throw new Error("Session is already linked to this workspace.");
      if (session.workspace_id) {
        const [previous] = await tx
          .select()
          .from(workspaces)
          .where(and(eq(workspaces.id, session.workspace_id), eq(workspaces.project_id, workspace.project_id)));
        if (previous) await retainSessionWorkspaceContext(tx, session, previous);
      }
      await tx.update(sessions).set({ workspace_id: workspaceId }).where(eq(sessions.id, sessionId));
      return workspaceSessionLink({ ...session, workspace_id: workspaceId })!;
    });
  const getWorkspaceBySessionId = async (sessionId: string) => {
    const [row] = await db
      .select({ workspace: workspaceColumns })
      .from(sessions)
      .innerJoin(
        workspaces,
        and(eq(sessions.workspace_id, workspaces.id), eq(sessions.project_id, workspaces.project_id)),
      )
      .where(eq(sessions.id, sessionId));
    return row?.workspace ?? null;
  };
  const listByWorkspace = async (workspaceId: string) =>
    db
      .select(sessionColumns)
      .from(sessions)
      .innerJoin(
        workspaces,
        and(eq(sessions.workspace_id, workspaces.id), eq(sessions.project_id, workspaces.project_id)),
      )
      .where(eq(sessions.workspace_id, workspaceId))
      .orderBy(sessions.created_at, sessions.id);
  const listLinks = async (projectId: string) =>
    db
      .select(workspaceSessionColumns)
      .from(sessions)
      .innerJoin(workspaces, eq(sessions.workspace_id, workspaces.id))
      .where(
        and(eq(workspaces.project_id, projectId), eq(sessions.project_id, projectId), isNull(workspaces.deleted_at)),
      );
  const listAllLinks = async () =>
    db.select(workspaceSessionColumns).from(sessions).where(isNotNull(sessions.workspace_id));
  const listSessionLinks = (sessionId: string) =>
    db
      .select(workspaceSessionColumns)
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), isNotNull(sessions.workspace_id)));
  const activeWorkspaceIds = async () =>
    (
      await db
        .selectDistinct({ id: sessions.workspace_id })
        .from(sessions)
        .where(and(isNotNull(sessions.workspace_id), inArray(sessions.status, ["in_progress", "awaiting_input"])))
    ).map((row) => row.id!);
  return {
    link,
    getWorkspaceBySessionId,
    listByWorkspace,
    listLinks,
    listAllLinks,
    listSessionLinks,
    activeWorkspaceIds,
  };
};
