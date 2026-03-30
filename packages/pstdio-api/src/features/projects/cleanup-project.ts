import fs from "node:fs";
import type { RouteDeps } from "../deps";

export const cleanupProjectArtifacts = async (
  workspaceService: RouteDeps["workspaceService"],
  projectId: string,
  deps: {
    removeProjectStorage: (projectId: string) => void;
  },
) => {
  const projectWorkspaces = await workspaceService.list(projectId);

  for (const ws of projectWorkspaces) {
    if (ws.worktree_path && fs.existsSync(ws.worktree_path)) {
      fs.rmSync(ws.worktree_path, { recursive: true, force: true });
    }
  }

  deps.removeProjectStorage(projectId);
};
