import type { createWorkspaceArtifactsDBService } from "pstdio-db";

export type WorkspaceArtifactServiceDeps = {
  workspaceArtifactsDBService: ReturnType<typeof createWorkspaceArtifactsDBService>;
};

export const createWorkspaceArtifactService = (deps: WorkspaceArtifactServiceDeps) => ({
  ...deps.workspaceArtifactsDBService,
});
