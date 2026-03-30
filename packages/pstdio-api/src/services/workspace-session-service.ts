import type { createWorkspaceSessionsDBService } from "pstdio-db";

export type WorkspaceSessionServiceDeps = {
  workspaceSessionsDBService: ReturnType<typeof createWorkspaceSessionsDBService>;
};

export const createWorkspaceSessionService = (deps: WorkspaceSessionServiceDeps) => ({
  ...deps.workspaceSessionsDBService,
});
