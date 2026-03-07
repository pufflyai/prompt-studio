import { findGitRoot, readConfig } from "@/features/config/config";

export const resolveProjectId = (cwd: string, explicitId?: string) => {
  if (explicitId) return { projectId: explicitId, root: findGitRoot(cwd) };

  const root = findGitRoot(cwd);
  if (!root) throw new Error("No project specified. Provide --project-id or run inside a linked project.");

  const config = readConfig(root);
  if (!config) throw new Error("No project specified. Provide --project-id or run inside a linked project.");

  return { projectId: config.project_id, root };
};
