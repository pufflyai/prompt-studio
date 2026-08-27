import type { createWorkspacesDBService } from "pstdio-db";
import type { EventBus } from "../features/sync/event-bus";
import { apiLogger } from "../lib/logger";

export type WorkspaceServiceDeps = {
  workspacesDb: ReturnType<typeof createWorkspacesDBService>;
  eventBus: EventBus;
};

export const createWorkspaceService = (deps: WorkspaceServiceDeps) => {
  const raw = deps.workspacesDb;

  // Transition-seam contract: every state-changing method either emits a single
  // `workspaces` set/delete event or logs `sync_emit_skipped` for the no-op so a
  // missing UI update can never silently slip past the seam.
  const emitOrLog = <T extends { id: string } | null | undefined>(op: "set", id: string, row: T) => {
    if (!row) {
      apiLogger.warn(
        { event: "sync_emit_skipped", table: "workspaces", op, id, reason: "no_row_updated" },
        "Sync emit skipped: no row updated",
      );
      return null;
    }
    deps.eventBus.emit("workspaces", op, row);
    return row;
  };

  // --- reads (pass-through) ---
  const get = raw.get;
  const getByShorthand = raw.getByShorthand;
  const getDefault = raw.getDefault;
  const list = raw.list;
  const listForProviderReconciliation = raw.listForProviderReconciliation;

  // --- mutations (orchestrated) ---
  const create = async (input: Parameters<typeof raw.create>[0]) => {
    const workspace = await raw.create(input);
    deps.eventBus.emit("workspaces", "set", workspace);
    return workspace;
  };

  const createStandalone = async (input: Parameters<typeof raw.createStandalone>[0]) => {
    const workspace = await raw.createStandalone(input);
    deps.eventBus.emit("workspaces", "set", workspace);
    return workspace;
  };

  // Idempotent: a project has at most one default workspace (root repo, current
  // branch). Returns the existing one or creates and announces a new one.
  const ensureDefault = async (input: Parameters<typeof raw.createDefault>[0]) => {
    const existing = await raw.getDefault(input.project_id);
    if (existing) return existing;

    const workspace = await raw.createDefault(input);
    deps.eventBus.emit("workspaces", "set", workspace);
    return workspace;
  };

  const archive = async (id: string) => {
    const updated = await raw.archive(id);
    if (!updated) return null;

    deps.eventBus.emit("workspaces", "set", updated);
    return updated;
  };

  const softDelete = async (id: string) => {
    await raw.softDelete(id);
    deps.eventBus.emit("workspaces", "delete", { id });
  };

  const rename = async (id: string, name: string) => {
    const updated = await raw.rename(id, name);
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

  const updateProviderProjection = async (id: string, patch: Parameters<typeof raw.updateProviderProjection>[1]) =>
    emitOrLog("set", id, await raw.updateProviderProjection(id, patch));

  const updateProviderOperationProjection = async (
    id: string,
    input: Parameters<typeof raw.updateProviderOperationProjection>[1],
  ) => emitOrLog("set", id, await raw.updateProviderOperationProjection(id, input));

  const beginProviderOperation = async (id: string, input: Parameters<typeof raw.beginProviderOperation>[1]) =>
    emitOrLog("set", id, await raw.beginProviderOperation(id, input));

  return {
    get,
    getByShorthand,
    getDefault,
    list,
    listForProviderReconciliation,
    create,
    createStandalone,
    ensureDefault,
    archive,
    softDelete,
    setInitializing,
    setSetupError,
    setStartupLogFileId,
    updateProviderProjection,
    updateProviderOperationProjection,
    beginProviderOperation,
    rename,
  };
};
