import type { createWorkspaceSessionsDBService } from "pstdio-db";
import type { EventBus } from "../features/sync/event-bus";

export type WorkspaceSessionServiceDeps = {
  workspaceSessionsDBService: ReturnType<typeof createWorkspaceSessionsDBService>;
  eventBus: EventBus;
};

export const createWorkspaceSessionService = (deps: WorkspaceSessionServiceDeps) => {
  const raw = deps.workspaceSessionsDBService;

  const link = async (workspaceId: string, sessionId: string) => {
    const record = await raw.link(workspaceId, sessionId);
    deps.eventBus.emit("workspace_sessions", "set", record);
    return record;
  };

  return {
    ...raw,
    link,
  };
};
