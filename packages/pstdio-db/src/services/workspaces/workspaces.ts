import { and, eq, isNull, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { ticket_workspaces, tickets, workspaces } from "../../db/schemas.pg";
import { nextWorkspaceShorthand } from "./next-workspace-shorthand";

type WorkspaceRecord = typeof workspaces.$inferSelect;

type CreateInput = {
  project_id: string;
  ticket_id: string;
  ticket_shorthand: string;
  branch?: string;
  worktree_path?: string;
};

const nowTimestamp = () => new Date().toISOString();

export const createWorkspacesService = (db: DbClient) => {
  const create = async (input: CreateInput) => {
    // Count all workspaces ever created for this ticket (including deleted) to avoid shorthand reuse
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(ticket_workspaces)
      .where(eq(ticket_workspaces.ticket_id, input.ticket_id));

    const shorthand = nextWorkspaceShorthand(input.ticket_shorthand, countResult.count);
    const timestamp = nowTimestamp();

    const record: WorkspaceRecord = {
      id: crypto.randomUUID(),
      project_id: input.project_id,
      name: shorthand,
      session_id: null,
      branch: input.branch ?? null,
      worktree_path: input.worktree_path ?? null,
      status: "active",
      archived: false,
      workspace_shorthand: shorthand,
      startup_log_file_id: null,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    };

    await db.insert(workspaces).values(record);

    const linkRecord = {
      id: crypto.randomUUID(),
      ticket_id: input.ticket_id,
      workspace_id: record.id,
      created_at: timestamp,
    };

    await db.insert(ticket_workspaces).values(linkRecord);

    return record;
  };

  const list = async (projectId: string) => {
    const rows = await db
      .select({
        workspace: workspaces,
        ticket_shorthand: tickets.shorthand,
      })
      .from(workspaces)
      .innerJoin(ticket_workspaces, eq(workspaces.id, ticket_workspaces.workspace_id))
      .innerJoin(tickets, eq(ticket_workspaces.ticket_id, tickets.id))
      .where(and(eq(workspaces.project_id, projectId), eq(workspaces.archived, false), isNull(workspaces.deleted_at)))
      .orderBy(workspaces.created_at);

    return rows.map((r) => ({ ...r.workspace, ticket_shorthand: r.ticket_shorthand }));
  };

  const get = async (id: string) => {
    const [row] = await db.select().from(workspaces).where(eq(workspaces.id, id));
    return row ?? null;
  };

  const getBySessionId = async (sessionId: string) => {
    const [row] = await db.select().from(workspaces).where(eq(workspaces.session_id, sessionId));
    return row ?? null;
  };

  const getByShorthand = async (projectId: string, shorthand: string) => {
    const [row] = await db
      .select()
      .from(workspaces)
      .where(
        and(
          eq(workspaces.project_id, projectId),
          eq(workspaces.workspace_shorthand, shorthand),
          isNull(workspaces.deleted_at),
        ),
      );
    return row ?? null;
  };

  const softDelete = async (id: string) => {
    const timestamp = nowTimestamp();
    await db
      .update(workspaces)
      .set({ deleted_at: timestamp, archived: true, updated_at: timestamp })
      .where(eq(workspaces.id, id));
  };

  const updateStatus = async (id: string, status: "active" | "merged" | "rejected") => {
    await db.update(workspaces).set({ status, updated_at: nowTimestamp() }).where(eq(workspaces.id, id));
  };

  const setStartupLogFileId = async (id: string, fileId: string) => {
    await db
      .update(workspaces)
      .set({ startup_log_file_id: fileId, updated_at: nowTimestamp() })
      .where(eq(workspaces.id, id));
  };

  const updateGitMetadata = async (id: string, input: { branch: string | null; worktree_path: string | null }) => {
    const [updated] = await db
      .update(workspaces)
      .set({ branch: input.branch, worktree_path: input.worktree_path, updated_at: nowTimestamp() })
      .where(eq(workspaces.id, id))
      .returning();
    return updated ?? null;
  };

  const setSessionId = async (id: string, sessionId: string | null) => {
    const [updated] = await db
      .update(workspaces)
      .set({ session_id: sessionId, updated_at: nowTimestamp() })
      .where(eq(workspaces.id, id))
      .returning();
    return updated ?? null;
  };

  return {
    create,
    get,
    getBySessionId,
    list,
    getByShorthand,
    softDelete,
    updateStatus,
    setStartupLogFileId,
    updateGitMetadata,
    setSessionId,
  };
};
