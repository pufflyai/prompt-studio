import { and, eq, isNull, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { workspaces } from "../../db/schemas.pg";
import {
  createLegacyAnchorMutations,
  hostResourceRef,
  workspaceColumns,
  writeLegacyResourceLinks,
} from "../legacy-resource-links";
import { createResourceLinksDBService } from "../resource-links";
import {
  beginProviderOperation,
  updateProviderOperationProjection,
  updateProviderProjection,
} from "./provider-operations";
import { renameWorkspace } from "./rename-workspace";
import { attachInitialProvider, findByPath } from "./workspace-location";
import {
  buildWorkspaceRecord,
  type CreateInput,
  type DefaultWorkspaceInput,
  insertDefaultWorkspace,
  nextStandaloneWorkspaceShorthand,
  nextWorkspaceShorthand,
  nowTimestamp,
  selectDefaultWorkspace,
  standalonePrefix,
} from "./workspace-record";

type BeforeInsert = (row: { id: string; project_id: string | null }) => Promise<void>;

export const createWorkspacesDBService = (db: DbClient) => {
  const create = async (input: CreateInput, beforeInsert?: BeforeInsert) => {
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
      root_path: input.root_path,
      anchors: input.anchors,
      provider_id: input.provider_id,
      provider_params_json: input.provider_params_json,
      provider_state: input.provider_state,
      provider_operation_id: input.provider_operation_id,
      provider_operation_kind: input.provider_operation_kind,
    });

    await beforeInsert?.(record);
    const created = await db.transaction(async (tx) => {
      await tx.insert(workspaces).values(record);
      await writeLegacyResourceLinks(tx, "workspace", record, input.anchors ?? []);
      const [row] = await tx.select(workspaceColumns).from(workspaces).where(eq(workspaces.id, record.id));
      return row!;
    });
    return created;
  };

  // Standalone workspaces use project-scoped `WS-<n>` shorthands.
  const createStandalone = async (input: Omit<CreateInput, "shorthand_base">, beforeInsert?: BeforeInsert) => {
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
      anchors: input.anchors,
      name: input.name,
      branch: input.branch,
      root_path: input.root_path,
      provider_id: input.provider_id,
      provider_params_json: input.provider_params_json,
      provider_state: input.provider_state,
      provider_operation_id: input.provider_operation_id,
      provider_operation_kind: input.provider_operation_kind,
    });

    await beforeInsert?.(record);
    return db.transaction(async (tx) => {
      await tx.insert(workspaces).values(record);
      await writeLegacyResourceLinks(tx, "workspace", record, input.anchors ?? []);
      const [row] = await tx.select(workspaceColumns).from(workspaces).where(eq(workspaces.id, record.id));
      return row!;
    });
  };

  const list = async (projectId: string) => {
    const rows = await db
      .select(workspaceColumns)
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
      .select(workspaceColumns)
      .from(workspaces)
      .where(and(eq(workspaces.project_id, projectId), sql`${workspaces.deleted_at} is null`))
      .orderBy(workspaces.created_at);

  const get = async (id: string) => {
    const [row] = await db.select(workspaceColumns).from(workspaces).where(eq(workspaces.id, id));
    return row ?? null;
  };

  const getByShorthand = async (projectId: string, shorthand: string) => {
    const [row] = await db
      .select(workspaceColumns)
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

  const softDelete = (id: string) =>
    db.transaction(async (tx) => {
      const timestamp = nowTimestamp();
      const [row] = await tx
        .update(workspaces)
        .set({ deleted_at: timestamp, archived: true, updated_at: timestamp })
        .where(and(eq(workspaces.id, id), isNull(workspaces.deleted_at)))
        .returning();
      if (!row) return [];
      return createResourceLinksDBService(tx).removeResource(hostResourceRef("workspace", row));
    });

  const archive = async (id: string) => {
    const timestamp = nowTimestamp();
    const [updated] = await db
      .update(workspaces)
      .set({ archived: true, updated_at: timestamp })
      .where(eq(workspaces.id, id))
      .returning(workspaceColumns);
    return updated ?? null;
  };

  const setStartupLogFileId = async (id: string, fileId: string) => {
    const [updated] = await db
      .update(workspaces)
      .set({ startup_log_file_id: fileId, updated_at: nowTimestamp() })
      .where(eq(workspaces.id, id))
      .returning(workspaceColumns);
    return updated ?? null;
  };

  const setInitializing = async (id: string, initializing: boolean) => {
    const [updated] = await db
      .update(workspaces)
      .set({ initializing, updated_at: nowTimestamp() })
      .where(eq(workspaces.id, id))
      .returning(workspaceColumns);
    return updated ?? null;
  };

  const setSetupError = async (id: string, error: string | null) => {
    const [updated] = await db
      .update(workspaces)
      .set({ setup_error: error, initializing: false, updated_at: nowTimestamp() })
      .where(eq(workspaces.id, id))
      .returning(workspaceColumns);
    return updated ?? null;
  };

  const clearWorktree = async (id: string) => {
    const [updated] = await db
      .update(workspaces)
      .set({ branch: null, display_path: null, root_path: null, updated_at: nowTimestamp() })
      .where(eq(workspaces.id, id))
      .returning(workspaceColumns);
    return updated ?? null;
  };

  const rename = (id: string, name: string) => renameWorkspace(db, id, name);

  return {
    create,
    createStandalone,
    createDefault: (input: DefaultWorkspaceInput) => insertDefaultWorkspace(db, input),
    attachInitialProvider: (id: string, input: Parameters<typeof attachInitialProvider>[2]) =>
      attachInitialProvider(db, id, input),
    getDefault: (projectId: string) => selectDefaultWorkspace(db, projectId),
    ...createLegacyAnchorMutations(db, "workspace", async (tx, id) => {
      const [row] = await tx.select(workspaceColumns).from(workspaces).where(eq(workspaces.id, id));
      return row!;
    }),
    findByPath: (rootPath: string) => findByPath(db, rootPath),
    get,
    list,
    listForProviderReconciliation,
    getByShorthand,
    softDelete,
    archive,
    clearWorktree,
    setInitializing,
    setSetupError,
    setStartupLogFileId,
    updateProviderProjection: (id: string, input: Parameters<typeof updateProviderProjection>[2]) =>
      updateProviderProjection(db, id, input),
    updateProviderOperationProjection: (id: string, input: Parameters<typeof updateProviderOperationProjection>[2]) =>
      updateProviderOperationProjection(db, id, input),
    beginProviderOperation: (id: string, input: Parameters<typeof beginProviderOperation>[2]) =>
      beginProviderOperation(db, id, input),
    rename,
  };
};
