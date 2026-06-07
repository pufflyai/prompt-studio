import { and, eq, ne, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { workspaces } from "../../db/schemas.pg";

export const workspaceNameMaxLength = 120;

export class WorkspaceNameValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceNameValidationError";
  }
}

export class WorkspaceNameConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceNameConflictError";
  }
}

export class WorkspaceNotRenameableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceNotRenameableError";
  }
}

export const normalizeWorkspaceName = (name: string) => {
  const trimmed = name.trim();

  if (!trimmed) throw new WorkspaceNameValidationError("Workspace name is required");
  if (trimmed.length > workspaceNameMaxLength) {
    throw new WorkspaceNameValidationError(`Workspace name must be ${workspaceNameMaxLength} characters or less`);
  }

  return trimmed;
};

const isWorkspaceNameConflict = (error: unknown) =>
  error instanceof Error && error.message.includes("workspaces_project_active_name_idx");

export const renameWorkspace = async (db: DbClient, id: string, name: string) => {
  const normalizedName = normalizeWorkspaceName(name);
  const [current] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, id), eq(workspaces.archived, false), sql`${workspaces.deleted_at} is null`));

  if (!current) return null;
  if (current.is_default) throw new WorkspaceNotRenameableError("Default workspace cannot be renamed");

  const [duplicate] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.project_id, current.project_id),
        eq(workspaces.name, normalizedName),
        ne(workspaces.id, id),
        eq(workspaces.archived, false),
        sql`${workspaces.deleted_at} is null`,
      ),
    );

  if (duplicate) throw new WorkspaceNameConflictError("Workspace name already exists");

  const [updated] = await db
    .update(workspaces)
    .set({ name: normalizedName, updated_at: new Date().toISOString() })
    .where(eq(workspaces.id, id))
    .returning()
    .catch((error: unknown) => {
      if (isWorkspaceNameConflict(error)) throw new WorkspaceNameConflictError("Workspace name already exists");
      throw error;
    });

  return updated ?? null;
};
