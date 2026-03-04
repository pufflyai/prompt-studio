import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { getStartupScript } from "@/features/projects/api/get-startup-script";

export const command = "get";
export const describe = "Print the project startup script";

const defaultDeps = {
  cwd: process.cwd,
  findGitRoot,
  readConfig,
  getStartupScript,
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

    const script = await deps.getStartupScript(API_URL, config.project_id);

    if (script === null) {
      console.log("No startup script configured.");
      return;
    }

    console.log(script);
  };

export const handler = createHandler();
