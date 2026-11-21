import type { ResourceAnchor, ResourceRef } from "pstdio-api-contracts/extension-kernel";
import type { createWorkspacesDBService } from "pstdio-db";
import type { EventBus } from "../features/sync/event-bus";
import { catalogProviderId } from "../features/workspaces/workspace-provider-identity";
import { apiLogger } from "../lib/logger";
import {
  publishCreatedResourceAnchors,
  publishResourceAnchorChanges,
  refreshResourceAnchorEndpoints,
} from "./resource-anchor-events";
import { createWorkspaceMaintenance } from "./workspace-maintenance";

const canonicalWorkspace = <T extends object | null | undefined>(row: T) => {
  if (!row || !("provider_id" in row) || typeof row.provider_id !== "string") return row;
  const providerId = catalogProviderId(row.provider_id);
  return providerId === row.provider_id ? row : { ...row, provider_id: providerId };
};

type WorkspaceRecord = NonNullable<Awaited<ReturnType<ReturnType<typeof createWorkspacesDBService>["get"]>>>;

export type WorkspaceServiceDeps = {
  sessionsDb: { get: (id: string) => Promise<{ id: string } | null> };
  workspacesDb: ReturnType<typeof createWorkspacesDBService>;
  eventBus: EventBus;
  maintenancePath?: string;
  onCreated?: (workspace: WorkspaceRecord) => void;
  onDeleted?: (workspace: WorkspaceRecord) => void;
  validateCreatedAnchors?: (source: ResourceRef & { projectId: string }, anchors: ResourceAnchor[]) => Promise<void>;
};

export const createWorkspaceService = (deps: WorkspaceServiceDeps) => {
  const raw = deps.workspacesDb;
  const maintenance = createWorkspaceMaintenance(deps.maintenancePath);

  // Transition-seam contract: every state-changing method either emits a single
  // `workspaces` set/delete event or logs `sync_emit_skipped` for the no-op so a
  // missing UI update can never silently slip past the seam. Healthy file maintenance uses the
  // runtime-only admission gate above: it changes no stored lifecycle fields and emits no sync row.
  const emitOrLog = <T extends { id: string } | null | undefined>(op: "set", id: string, row: T) => {
    if (!row) {
      apiLogger.warn(
        { event: "sync_emit_skipped", table: "workspaces", op, id, reason: "no_row_updated" },
        "Sync emit skipped: no row updated",
      );
      return null;
    }
    const workspace = canonicalWorkspace(row);
    deps.eventBus.emit("workspaces", op, workspace);
    return workspace;
  };

  // --- reads (pass-through) ---
  const get = async (...args: Parameters<typeof raw.get>) => canonicalWorkspace(await raw.get(...args));
  const getByShorthand = async (...args: Parameters<typeof raw.getByShorthand>) =>
    canonicalWorkspace(await raw.getByShorthand(...args));
  const getDefault = async (...args: Parameters<typeof raw.getDefault>) =>
    canonicalWorkspace(await raw.getDefault(...args));
  const list = async (...args: Parameters<typeof raw.list>) => (await raw.list(...args)).map(canonicalWorkspace);
  const query = async (...args: Parameters<typeof raw.query>) => {
    const page = await raw.query(...args);
    return { ...page, rows: page.rows.map(canonicalWorkspace) };
  };
  const listForProviderReconciliation = async (...args: Parameters<typeof raw.listForProviderReconciliation>) =>
    (await raw.listForProviderReconciliation(...args)).map(canonicalWorkspace);

  // --- mutations (orchestrated) ---
  const create = async (input: Parameters<typeof raw.create>[0]) => {
    const workspace = canonicalWorkspace(
      await raw.create(
        input,
        (row) =>
          deps.validateCreatedAnchors?.(
            { type: "workspace", id: row.id, projectId: row.project_id!, extensionId: "pstdio" },
            input.anchors ?? [],
          ) ?? Promise.resolve(),
      ),
    );
    deps.eventBus.emit("workspaces", "set", workspace);
    publishCreatedResourceAnchors(deps.eventBus, "workspace", workspace);
    deps.onCreated?.(workspace);
    return workspace;
  };

  const createStandalone = async (input: Parameters<typeof raw.createStandalone>[0]) => {
    const workspace = canonicalWorkspace(
      await raw.createStandalone(
        input,
        (row) =>
          deps.validateCreatedAnchors?.(
            { type: "workspace", id: row.id, projectId: row.project_id!, extensionId: "pstdio" },
            input.anchors ?? [],
          ) ?? Promise.resolve(),
      ),
    );
    deps.eventBus.emit("workspaces", "set", workspace);
    publishCreatedResourceAnchors(deps.eventBus, "workspace", workspace);
    deps.onCreated?.(workspace);
    return workspace;
  };

  // Idempotent: a project has at most one default workspace (root repo, current
  // branch). Returns the existing one or creates and announces a new one.
  const ensureDefault = async (input: Parameters<typeof raw.createDefault>[0]) => {
    const existing = await raw.getDefault(input.project_id);
    if (existing) return canonicalWorkspace(existing);

    const workspace = canonicalWorkspace(await raw.createDefault(input));
    deps.eventBus.emit("workspaces", "set", workspace);
    publishCreatedResourceAnchors(deps.eventBus, "workspace", workspace);
    deps.onCreated?.(workspace);
    return workspace;
  };

  const archive = async (id: string) => {
    const updated = canonicalWorkspace(await raw.archive(id));
    if (!updated) return null;

    deps.eventBus.emit("workspaces", "set", updated);
    return updated;
  };

  const softDelete = async (id: string, options?: Parameters<typeof raw.softDelete>[1]) => {
    const deleted = options ? await raw.softDelete(id, options) : await raw.softDelete(id);
    if (!deleted) return false;
    const { changes, workspace } = deleted;
    publishResourceAnchorChanges(deps.eventBus, changes, "remove");
    await refreshResourceAnchorEndpoints(deps.eventBus, changes, { workspace: raw.get, session: deps.sessionsDb.get });
    deps.eventBus.emit("workspaces", "delete", { id });
    deps.onDeleted?.(workspace);
    return true;
  };

  const rename = async (id: string, name: string) => {
    const updated = canonicalWorkspace(await raw.rename(id, name));
    if (!updated) return null;

    deps.eventBus.emit("workspaces", "set", updated);
    return updated;
  };

  const setInitializing = async (id: string, initializing: Parameters<typeof raw.setInitializing>[1]) =>
    emitOrLog("set", id, await raw.setInitializing(id, initializing));

  const setSetupError = async (id: string, message: Parameters<typeof raw.setSetupError>[1]) =>
    emitOrLog("set", id, await raw.setSetupError(id, message));

  const setStartupLogFileId = async (id: string, fileId: string) =>
    emitOrLog("set", id, await raw.setStartupLogFileId(id, fileId));

  const clearWorktree = async (id: string) => emitOrLog("set", id, await raw.clearWorktree(id));

  const updateProviderProjection = async (id: string, patch: Parameters<typeof raw.updateProviderProjection>[1]) =>
    emitOrLog("set", id, await raw.updateProviderProjection(id, patch));

  const updateProviderOperationProjection = async (
    id: string,
    input: Parameters<typeof raw.updateProviderOperationProjection>[1],
  ) => emitOrLog("set", id, await raw.updateProviderOperationProjection(id, input));

  const beginProviderOperation = async (id: string, input: Parameters<typeof raw.beginProviderOperation>[1]) =>
    emitOrLog("set", id, await raw.beginProviderOperation(id, input));

  return {
    maintenance,
    get,
    getByShorthand,
    getDefault,
    attachInitialProvider: async (id: string, input: Parameters<typeof raw.attachInitialProvider>[1]) =>
      emitOrLog("set", id, await raw.attachInitialProvider(id, input)),
    findByPath: async (...args: Parameters<typeof raw.findByPath>) => canonicalWorkspace(await raw.findByPath(...args)),
    list,
    query,
    listForProviderReconciliation,
    create,
    createStandalone,
    ensureDefault,
    archive,
    clearWorktree,
    softDelete,
    setInitializing,
    setSetupError,
    setStartupLogFileId,
    updateProviderProjection,
    updateProviderOperationProjection,
    beginProviderOperation,
    addAnchors: async (id: string, anchors: Parameters<typeof raw.addAnchors>[1]) => {
      const result = await raw.addAnchors(id, anchors);
      if (result) publishResourceAnchorChanges(deps.eventBus, result.changes, "add");
      return emitOrLog("set", id, result?.record);
    },
    removeAnchors: async (id: string, refs: Parameters<typeof raw.removeAnchors>[1]) => {
      const result = await raw.removeAnchors(id, refs);
      if (result) publishResourceAnchorChanges(deps.eventBus, result.changes, "remove");
      return emitOrLog("set", id, result?.record);
    },
    rename,
  };
};
