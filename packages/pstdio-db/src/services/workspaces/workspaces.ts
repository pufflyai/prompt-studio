import { and, eq, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { attempt_statuses, ticket_workspaces, tickets, workspaces } from "../../db/schemas.pg";

type WorkspaceRecord = typeof workspaces.$inferSelect;

type CreateInput = {
  project_id: string;
  ticket_id: string;
  ticket_shorthand: string;
  branch?: string;
  worktree_path?: string;
};

const nowTimestamp = () => new Date().toISOString();

const getAttemptNumber = (ticketShorthand: string, workspaceShorthand: string) => {
  const prefix = `${ticketShorthand}_A`;
  if (!workspaceShorthand.startsWith(prefix)) return null;

  const suffix = workspaceShorthand.slice(prefix.length);
  if (!/^\d+$/.test(suffix)) return null;

  return Number(suffix);
};

const nextWorkspaceShorthand = (ticketShorthand: string, existingShorthands: string[]) => {
  const maxAttempt = existingShorthands.reduce((max, shorthand) => {
    return Math.max(max, getAttemptNumber(ticketShorthand, shorthand) ?? 0);
  }, 0);

  return `${ticketShorthand}_A${maxAttempt + 1}`;
};

export const createWorkspacesDBService = (db: DbClient) => {
  const create = async (input: CreateInput) => {
    const existingWorkspaces = await db
      .select({ workspace_shorthand: workspaces.workspace_shorthand })
      .from(workspaces)
      .where(
        and(
          eq(workspaces.project_id, input.project_id),
          sql`${workspaces.workspace_shorthand} like ${`${input.ticket_shorthand}_A%`}`,
        ),
      );

    const shorthand = nextWorkspaceShorthand(
      input.ticket_shorthand,
      existingWorkspaces.map((workspace) => workspace.workspace_shorthand),
    );
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
      initializing: false,
      setup_error: null,
      startup_log_file_id: null,
      anchors_json: [],
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
        attempt_status_name: attempt_statuses.name,
      })
      .from(workspaces)
      .innerJoin(ticket_workspaces, eq(workspaces.id, ticket_workspaces.workspace_id))
      .innerJoin(tickets, eq(ticket_workspaces.ticket_id, tickets.id))
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
      ticket_shorthand: r.ticket_shorthand,
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

  const listByTicketId = async (ticketId: string) => {
    const rows = await db
      .select({ workspace: workspaces })
      .from(workspaces)
      .innerJoin(ticket_workspaces, eq(workspaces.id, ticket_workspaces.workspace_id))
      .where(
        and(
          eq(ticket_workspaces.ticket_id, ticketId),
          eq(workspaces.archived, false),
          sql`${workspaces.deleted_at} is null`,
        ),
      )
      .orderBy(workspaces.created_at);

    return rows.map((r) => r.workspace);
  };

  const getTicketWorkspaceLink = async (workspaceId: string) => {
    const [link] = await db.select().from(ticket_workspaces).where(eq(ticket_workspaces.workspace_id, workspaceId));
    return link ?? null;
  };

  return {
    create,
    get,
    list,
    listByTicketId,
    getByShorthand,
    getTicketWorkspaceLink,
    softDelete,
    archive,
    updateAttemptStatusId,
    setInitializing,
    setSetupError,
    setStartupLogFileId,
    updateGitMetadata,
  };
};
