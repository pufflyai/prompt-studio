import { findGitRoot, readConfig } from "@/features/config/config";

export const resolveProjectId = (cwd: string) => {
  const root = findGitRoot(cwd);
  if (!root) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

  const config = readConfig(root);
  if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

  return { root, projectId: config.project_id };
};
