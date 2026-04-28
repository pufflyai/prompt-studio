import { and, eq, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { type ActivityResourceRef, attempt_statuses, workspaces } from "../../db/schemas.pg";

type WorkspaceRecord = typeof workspaces.$inferSelect;

type CreateInput = {
  project_id: string;
  name?: string;
  anchors?: ActivityResourceRef[];
  branch?: string;
  worktree_path?: string;
};

const nowTimestamp = () => new Date().toISOString();

const nextWorkspaceShorthand = (existingCount: number) => `WS-${existingCount + 1}`;

export const createWorkspacesDBService = (db: DbClient) => {
  const create = async (input: CreateInput) => {
    // Count all workspaces ever created for this ticket (including deleted) to avoid shorthand reuse
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(workspaces)
      .where(eq(workspaces.project_id, input.project_id));

    const shorthand = input.name ?? nextWorkspaceShorthand(countResult.count);
    const timestamp = nowTimestamp();

    const record: WorkspaceRecord = {
      id: crypto.randomUUID(),
      project_id: input.project_id,
      name: shorthand,
      branch: input.branch ?? null,
      worktree_path: input.worktree_path ?? null,
      attempt_status_id: null,
      archived: false,
      workspace_shorthand: shorthand,
      anchors_json: input.anchors ?? [],
      initializing: false,
      setup_error: null,
      startup_log_file_id: null,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    };

    await db.insert(workspaces).values(record);

    return record;
  };

  const list = async (projectId: string) => {
    const rows = await db
      .select({
        workspace: workspaces,
        attempt_status_name: attempt_statuses.name,
      })
      .from(workspaces)
      .leftJoin(attempt_statuses, eq(workspaces.attempt_status_id, attempt_statuses.id))
      .where(
        and(
          eq(workspaces.project_id, projectId),
          eq(workspaces.archived, false),
          sql`${workspaces.deleted_at} is null`,
        ),
      )
      .orderBy(workspaces.created_at);

    return rows.map((r) => ({
      ...r.workspace,
      ticket_shorthand: null,
      attempt_status_name: r.attempt_status_name,
    }));
  };

  const get = async (id: string) => {
    const [row] = await db.select().from(workspaces).where(eq(workspaces.id, id));
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
          sql`${workspaces.deleted_at} is null`,
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

  const archive = async (id: string) => {
    const timestamp = nowTimestamp();
    const [updated] = await db
      .update(workspaces)
      .set({ archived: true, updated_at: timestamp })
      .where(eq(workspaces.id, id))
      .returning();
    return updated ?? null;
  };

  const updateAttemptStatusId = async (id: string, attemptStatusId: string) => {
    const [updated] = await db
      .update(workspaces)
      .set({ attempt_status_id: attemptStatusId, updated_at: nowTimestamp() })
      .where(eq(workspaces.id, id))
      .returning();
    return updated ?? null;
  };

  const setStartupLogFileId = async (id: string, fileId: string) => {
    await db
      .update(workspaces)
      .set({ startup_log_file_id: fileId, updated_at: nowTimestamp() })
      .where(eq(workspaces.id, id));
  };

  const setInitializing = async (id: string, initializing: boolean) => {
    const [updated] = await db
      .update(workspaces)
      .set({ initializing, updated_at: nowTimestamp() })
      .where(eq(workspaces.id, id))
      .returning();
    return updated ?? null;
  };

  const setSetupError = async (id: string, error: string | null) => {
    const [updated] = await db
      .update(workspaces)
      .set({ setup_error: error, initializing: false, updated_at: nowTimestamp() })
      .where(eq(workspaces.id, id))
      .returning();
    return updated ?? null;
  };

  const updateGitMetadata = async (id: string, input: { branch: string | null; worktree_path: string | null }) => {
    const [updated] = await db
      .update(workspaces)
      .set({ branch: input.branch, worktree_path: input.worktree_path, updated_at: nowTimestamp() })
      .where(eq(workspaces.id, id))
      .returning();
    return updated ?? null;
  };

  return {
    create,
    get,
    list,
    getByShorthand,
    softDelete,
    archive,
    updateAttemptStatusId,
    setInitializing,
    setSetupError,
    setStartupLogFileId,
    updateGitMetadata,
  };
};
