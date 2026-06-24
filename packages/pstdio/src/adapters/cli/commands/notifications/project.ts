import { findGitRoot, readConfig } from "@/features/config/config";

export const resolveProjectId = (projectId?: string) => {
  if (projectId) return projectId;
  const root = findGitRoot(process.cwd());
  const config = root ? readConfig(root) : null;
  if (!config) throw new Error("Missing --project-id and no .pstdio/config.json was found.");
  return config.project_id;
};
