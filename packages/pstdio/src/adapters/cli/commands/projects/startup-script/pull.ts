import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { getStartupScript } from "@/features/projects/api/get-startup-script";
import {
  localStartupScriptRelativePath,
  removeLocalStartupScript,
  writeLocalStartupScript,
} from "@/features/projects/local-startup-script";

export const command = "pull";
export const describe = "Pull remote startup script into .pstdio/startup.sh";

const defaultDeps = {
  cwd: process.cwd,
  findGitRoot,
  readConfig,
  getStartupScript,
  writeLocalScript: writeLocalStartupScript,
  removeLocalScript: removeLocalStartupScript,
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
      deps.removeLocalScript(root);
      console.log(`Pulled empty startup script and removed ${localStartupScriptRelativePath}`);
      return;
    }

    deps.writeLocalScript(root, script);
    console.log(`Pulled startup script to ${localStartupScriptRelativePath}`);
  };

export const handler = createHandler();
