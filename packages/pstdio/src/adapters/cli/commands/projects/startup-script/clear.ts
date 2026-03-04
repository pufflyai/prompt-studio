import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { clearStartupScript } from "@/features/projects/api/clear-startup-script";
import { getProject } from "@/features/projects/api/get-project";

export const command = "clear";
export const describe = "Clear the project startup script";

const defaultDeps = {
  cwd: process.cwd,
  findGitRoot,
  readConfig,
  clearStartupScript,
  getProject,
};

export const createHandler =
  (deps = defaultDeps) =>
  async () => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) {
      throw new Error("Not inside a git repository.");
    }

    const config = deps.readConfig(root);
    if (!config) {
      throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");
    }

    await deps.clearStartupScript(API_URL, config.project_id);

    const project = await deps.getProject(API_URL, config.project_id);
    console.log(`Startup script cleared for project "${project?.name ?? config.project_id}".`);
  };

export const handler = createHandler();
