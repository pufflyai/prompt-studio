import { findGitRoot, readConfig } from "@/features/config/config";

export const resolveProjectId = (cwd: string, explicitId?: string) => {
  if (explicitId) {
    const root = findGitRoot(cwd);
    const config = root ? readConfig(root) : null;
    return { projectId: explicitId, workspaceId: config?.workspace_id, root };
  }

  const envProjectId = process.env.PSTDIO_PROJECT_ID?.trim();
  const root = findGitRoot(cwd);
  if (!root) {
    if (envProjectId) return { projectId: envProjectId, workspaceId: undefined, root };
    throw new Error("No project specified. Provide --project-id or run inside a linked project.");
  }

  const config = readConfig(root);
  if (!config) {
    if (envProjectId) return { projectId: envProjectId, workspaceId: undefined, root };
    throw new Error("No project specified. Provide --project-id or run inside a linked project.");
  }

  return { projectId: config.project_id, workspaceId: config.workspace_id, root };
};
