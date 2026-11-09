import type { createWorkspaceSessionsDBService } from "pstdio-db";
import type { EventBus } from "../features/sync/event-bus";
import type { createWorkspaceMaintenance } from "./workspace-maintenance";

export type WorkspaceSessionServiceDeps = {
  workspaceSessionsDBService: ReturnType<typeof createWorkspaceSessionsDBService>;
  eventBus: EventBus;
  maintenance: ReturnType<typeof createWorkspaceMaintenance>;
};

export const createWorkspaceSessionService = (deps: WorkspaceSessionServiceDeps) => {
  const raw = deps.workspaceSessionsDBService;

  const link = async (workspaceId: string, sessionId: string) => {
    const record = await raw.link(workspaceId, sessionId);
    deps.eventBus.emit("workspace_sessions", "set", record);
    return record;
  };

  return {
    link,
    getWorkspaceBySessionId: async (sessionId: string) => {
      const workspace = await raw.getWorkspaceBySessionId(sessionId);
      return workspace && (await deps.maintenance.isRunning(workspace.id))
        ? { ...workspace, initializing: true }
        : workspace;
    },
    listByWorkspace: raw.listByWorkspace,
    listLinks: raw.listLinks,
    activeWorkspaceIds: raw.activeWorkspaceIds,
  };
};
