import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { clearStartupScript } from "@/features/projects/api/clear-startup-script";
import { setStartupScript } from "@/features/projects/api/set-startup-script";
import { localStartupScriptRelativePath, readLocalStartupScript } from "@/features/projects/local-startup-script";

export const command = "save";
export const describe = "Save .pstdio/startup.sh to the project startup script";

const defaultDeps = {
  cwd: process.cwd,
  findGitRoot,
  readConfig,
  readLocalScript: readLocalStartupScript,
  setStartupScript,
  clearStartupScript,
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

    const script = deps.readLocalScript(root);
    if (script === null) {
      throw new Error(`Local startup script not found: ${localStartupScriptRelativePath}`);
    }

    if (script.trim().length === 0) {
      await deps.clearStartupScript(API_URL, config.project_id);
      console.log(`Saved empty ${localStartupScriptRelativePath} and cleared project startup script`);
      return;
    }

    await deps.setStartupScript(API_URL, config.project_id, script);
    console.log(`Saved ${localStartupScriptRelativePath} to project startup script`);
  };

export const handler = createHandler();
