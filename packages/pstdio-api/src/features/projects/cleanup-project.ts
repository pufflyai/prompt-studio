import fs from "node:fs";
import { type DbClient, eq, workspaces } from "pstdio-db";

export const cleanupProjectArtifacts = async (
  db: DbClient,
  projectId: string,
  deps: {
    removeProjectStorage: (projectId: string) => void;
  },
) => {
  const projectWorkspaces = await db
    .select({ worktree_path: workspaces.worktree_path })
    .from(workspaces)
    .where(eq(workspaces.project_id, projectId));

  for (const ws of projectWorkspaces) {
    if (ws.worktree_path && fs.existsSync(ws.worktree_path)) {
      fs.rmSync(ws.worktree_path, { recursive: true, force: true });
    }
  }

  deps.removeProjectStorage(projectId);
};
