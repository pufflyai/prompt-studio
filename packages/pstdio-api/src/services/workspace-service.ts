import type { createWorkspacesDBService } from "pstdio-db";
import type { EventBus } from "../features/sync/event-bus";

export type WorkspaceServiceDeps = {
  workspacesDb: ReturnType<typeof createWorkspacesDBService>;
  eventBus: EventBus;
};

export const createWorkspaceService = (deps: WorkspaceServiceDeps) => {
  const raw = deps.workspacesDb;

  // --- reads (pass-through) ---
  const get = raw.get;
  const getByShorthand = raw.getByShorthand;
  const getDefault = raw.getDefault;
  const list = raw.list;
  /** @deprecated Legacy ticket-workspace lookup. Ticket ownership is moving to the pstdio tickets extension. */
  const listByTicketId = raw.listByTicketId;
  /** @deprecated Legacy ticket-workspace lookup. Ticket ownership is moving to the pstdio tickets extension. */
  const getTicketWorkspaceLink = raw.getTicketWorkspaceLink;

  // --- mutations (orchestrated) ---
  /** @deprecated Requires legacy ticket-workspace linkage. Ticket ownership is moving to the pstdio tickets extension. */
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

  const updateAttemptStatus = async (id: string, attemptStatusId: string) => {
    const updated = await raw.updateAttemptStatusId(id, attemptStatusId);
    deps.eventBus.emit("workspaces", "set", updated);
    return updated;
  };

  const rename = async (id: string, name: string) => {
    const updated = await raw.rename(id, name);
    if (!updated) return null;

    deps.eventBus.emit("workspaces", "set", updated);
    return updated;
  };

  // Pass-through mutations that don't need events (used internally by ticket-attempt setup)
  const setInitializing = raw.setInitializing;
  const setSetupError = raw.setSetupError;
  const setStartupLogFileId = raw.setStartupLogFileId;
  const updateGitMetadata = raw.updateGitMetadata;
  const updateAttemptStatusId = raw.updateAttemptStatusId;

  return {
    get,
    getByShorthand,
    getDefault,
    list,
    listByTicketId,
    getTicketWorkspaceLink,
    create,
    createStandalone,
    ensureDefault,
    archive,
    softDelete,
    updateAttemptStatus,
    setInitializing,
    setSetupError,
    setStartupLogFileId,
    updateGitMetadata,
    updateAttemptStatusId,
    rename,
  };
};
