import { and, eq, isNull, or, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import {
  type WorkspaceCapabilities,
  type WorkspaceProviderError,
  type WorkspaceProviderRef,
  type WorkspaceProviderState,
  workspaces,
} from "../../db/schemas.pg";
import { renameWorkspace } from "./rename-workspace";
import {
  buildWorkspaceRecord,
  type CreateInput,
  insertDefaultWorkspace,
  type JsonObject,
  nextStandaloneWorkspaceShorthand,
  nextWorkspaceShorthand,
  nowTimestamp,
  selectDefaultWorkspace,
  standalonePrefix,
} from "./workspace-record";

const updateProviderProjection = async (
  db: DbClient,
  id: string,
  input: {
    branch?: string | null;
    worktree_path?: string | null;
    provider_ref_json?: WorkspaceProviderRef | null;
    provider_state: WorkspaceProviderState;
    execution_kind: "local" | "remote";
    provider_operation_id?: string | null;
    provider_operation_kind?: "create" | "cancel" | "archive" | "delete" | null;
    provider_error_json?: WorkspaceProviderError | null;
    provider_capabilities_json: WorkspaceCapabilities;
    display_path?: string | null;
  },
) => {
  const [updated] = await db
    .update(workspaces)
    .set({
      ...(Object.hasOwn(input, "branch") ? { branch: input.branch } : {}),
      ...(Object.hasOwn(input, "worktree_path") ? { worktree_path: input.worktree_path } : {}),
      ...(Object.hasOwn(input, "provider_ref_json") ? { provider_ref_json: input.provider_ref_json } : {}),
      provider_state: input.provider_state,
      execution_kind: input.execution_kind,
      ...(Object.hasOwn(input, "provider_operation_id") ? { provider_operation_id: input.provider_operation_id } : {}),
      ...(Object.hasOwn(input, "provider_operation_kind")
        ? { provider_operation_kind: input.provider_operation_kind }
        : {}),
      ...(Object.hasOwn(input, "provider_error_json") ? { provider_error_json: input.provider_error_json } : {}),
      provider_capabilities_json: input.provider_capabilities_json,
      ...(Object.hasOwn(input, "display_path") ? { display_path: input.display_path } : {}),
      updated_at: nowTimestamp(),
    })
    .where(eq(workspaces.id, id))
    .returning();
  return updated ?? null;
};

const beginProviderOperation = async (
  db: DbClient,
  id: string,
  input: {
    operationId: string;
    kind: "cancel" | "archive" | "delete";
    state: "provisioning" | "archiving" | "deleting";
  },
) => {
  const [updated] = await db
    .update(workspaces)
    .set({
      provider_state: input.state,
      provider_operation_id: sql`case
        when ${workspaces.provider_operation_kind} = 'create' and ${workspaces.provider_ref_json} is not null
          then ${input.operationId}
        else coalesce(${workspaces.provider_operation_id}, ${input.operationId})
      end`,
      provider_operation_kind: input.kind,
      provider_error_json: null,
      updated_at: nowTimestamp(),
    })
    .where(
      and(
        eq(workspaces.id, id),
        or(
          isNull(workspaces.provider_operation_kind),
          eq(workspaces.provider_operation_kind, input.kind),
          eq(workspaces.provider_operation_kind, "create"),
        ),
      ),
    )
    .returning();
  if (updated) return updated;

  const [current] = await db.select().from(workspaces).where(eq(workspaces.id, id));
  return current ?? null;
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
      provider_id: input.provider_id,
      provider_params_json: input.provider_params_json,
      provider_state: input.provider_state,
      provider_operation_id: input.provider_operation_id,
      provider_operation_kind: input.provider_operation_kind,
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
    provider_id?: string;
    provider_params_json?: JsonObject;
    provider_state?: WorkspaceProviderState;
    provider_operation_id?: string;
    provider_operation_kind?: "create" | "cancel" | "archive" | "delete";
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
      provider_id: input.provider_id,
      provider_params_json: input.provider_params_json,
      provider_state: input.provider_state,
      provider_operation_id: input.provider_operation_id,
      provider_operation_kind: input.provider_operation_kind,
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

  const listForProviderReconciliation = (projectId: string) =>
    db
      .select()
      .from(workspaces)
      .where(and(eq(workspaces.project_id, projectId), sql`${workspaces.deleted_at} is null`))
      .orderBy(workspaces.created_at);

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
    const [updated] = await db
      .update(workspaces)
      .set({ startup_log_file_id: fileId, updated_at: nowTimestamp() })
      .where(eq(workspaces.id, id))
      .returning();
    return updated ?? null;
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

  const rename = (id: string, name: string) => renameWorkspace(db, id, name);

  return {
    create,
    createStandalone,
    createDefault: (input: { project_id: string; name: string; branch: string | null }) =>
      insertDefaultWorkspace(db, input),
    getDefault: (projectId: string) => selectDefaultWorkspace(db, projectId),
    get,
    list,
    listForProviderReconciliation,
    getByShorthand,
    softDelete,
    archive,
    setInitializing,
    setSetupError,
    setStartupLogFileId,
    updateProviderProjection: (id: string, input: Parameters<typeof updateProviderProjection>[2]) =>
      updateProviderProjection(db, id, input),
    beginProviderOperation: (id: string, input: Parameters<typeof beginProviderOperation>[2]) =>
      beginProviderOperation(db, id, input),
    rename,
  };
};
