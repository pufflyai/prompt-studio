import { and, eq, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { type ResourceRef, workspaces } from "../../db/schemas.pg";
import { renameWorkspace } from "./rename-workspace";

type WorkspaceRecord = typeof workspaces.$inferSelect;

type CreateInput = {
  project_id: string;
  shorthand_base: string;
  anchors?: ResourceRef[];
  name?: string;
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

const nextWorkspaceShorthand = (shorthandBase: string, existingShorthands: string[]) => {
  const maxAttempt = existingShorthands.reduce((max, shorthand) => {
    return Math.max(max, getAttemptNumber(shorthandBase, shorthand) ?? 0);
  }, 0);

  return `${shorthandBase}_A${maxAttempt + 1}`;
};

const standalonePrefix = "WS-";

// Reserved shorthand for the per-project default workspace (root repo, current
// branch). There is at most one per project, so a fixed value stays unique.
const defaultShorthand = "default";

const getStandaloneNumber = (shorthand: string) => {
  if (!shorthand.startsWith(standalonePrefix)) return null;
  const suffix = shorthand.slice(standalonePrefix.length);
  return /^\d+$/.test(suffix) ? Number(suffix) : null;
};

const nextStandaloneWorkspaceShorthand = (existingShorthands: string[]) => {
  const max = existingShorthands.reduce((value, shorthand) => {
    return Math.max(value, getStandaloneNumber(shorthand) ?? 0);
  }, 0);

  return `${standalonePrefix}${max + 1}`;
};

const buildWorkspaceRecord = (input: {
  project_id: string;
  shorthand: string;
  name?: string;
  branch?: string;
  worktree_path?: string;
  is_default?: boolean;
  anchors?: ResourceRef[];
}): WorkspaceRecord => {
  const timestamp = nowTimestamp();
  return {
    id: crypto.randomUUID(),
    project_id: input.project_id,
    name: input.name ?? input.shorthand,
    branch: input.branch ?? null,
    worktree_path: input.worktree_path ?? null,
    is_default: input.is_default ?? false,
    archived: false,
    workspace_shorthand: input.shorthand,
    initializing: false,
    setup_error: null,
    startup_log_file_id: null,
    anchors_json: input.anchors ?? [],
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
  };
};

// The default workspace targets the root repo on its current branch, so it has
// no isolated worktree (worktree_path stays null) and a fixed shorthand.
const insertDefaultWorkspace = async (
  db: DbClient,
  input: { project_id: string; name: string; branch: string | null },
) => {
  const record = buildWorkspaceRecord({
    project_id: input.project_id,
    shorthand: defaultShorthand,
    name: input.name,
    branch: input.branch ?? undefined,
    is_default: true,
  });

  await db.insert(workspaces).values(record);

  return record;
};

const selectDefaultWorkspace = async (db: DbClient, projectId: string) => {
  const [row] = await db
    .select()
    .from(workspaces)
    .where(
      and(eq(workspaces.project_id, projectId), eq(workspaces.is_default, true), sql`${workspaces.deleted_at} is null`),
    );
  return row ?? null;
};

export const createWorkspacesDBService = (db: DbClient) => {
  const create = async (input: CreateInput) => {
    const shorthandBase = input.shorthand_base;
    if (!shorthandBase) throw new Error("Workspace creation requires shorthand_base");

    const existingWorkspaces = await db
      .select({ workspace_shorthand: workspaces.workspace_shorthand })
      .from(workspaces)
      .where(
        and(
          eq(workspaces.project_id, input.project_id),
          sql`${workspaces.workspace_shorthand} like ${`${shorthandBase}_A%`}`,
        ),
      );

    const shorthand = nextWorkspaceShorthand(
      shorthandBase,
      existingWorkspaces.map((workspace) => workspace.workspace_shorthand),
    );

    const record = buildWorkspaceRecord({
      project_id: input.project_id,
      shorthand,
      name: input.name,
      branch: input.branch,
      worktree_path: input.worktree_path,
      anchors: input.anchors,
    });

    await db.insert(workspaces).values(record);
    return record;
  };

  // Ticketless workspaces use project-scoped `WS-<n>` shorthands and no ticket-workspace link.
  const createStandalone = async (input: {
    project_id: string;
    name?: string;
    branch?: string;
    worktree_path?: string;
  }) => {
    const existingWorkspaces = await db
      .select({ workspace_shorthand: workspaces.workspace_shorthand })
      .from(workspaces)
      .where(
        and(
          eq(workspaces.project_id, input.project_id),
          sql`${workspaces.workspace_shorthand} like ${`${standalonePrefix}%`}`,
        ),
      );

    const shorthand = nextStandaloneWorkspaceShorthand(
      existingWorkspaces.map((workspace) => workspace.workspace_shorthand),
    );

    const record = buildWorkspaceRecord({
      project_id: input.project_id,
      shorthand,
      name: input.name,
      branch: input.branch,
      worktree_path: input.worktree_path,
    });

    await db.insert(workspaces).values(record);

    return record;
  };

  const list = async (projectId: string) => {
    const rows = await db
      .select()
      .from(workspaces)
      .where(
        and(
          eq(workspaces.project_id, projectId),
          eq(workspaces.archived, false),
          sql`${workspaces.deleted_at} is null`,
        ),
      )
      .orderBy(workspaces.created_at);

    return rows;
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

  const rename = (id: string, name: string) => renameWorkspace(db, id, name);

  return {
    create,
    createStandalone,
    createDefault: (input: { project_id: string; name: string; branch: string | null }) =>
      insertDefaultWorkspace(db, input),
    getDefault: (projectId: string) => selectDefaultWorkspace(db, projectId),
    get,
    list,
    getByShorthand,
    softDelete,
    archive,
    setInitializing,
    setSetupError,
    setStartupLogFileId,
    updateGitMetadata,
    rename,
  };
};
