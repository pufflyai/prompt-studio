import type { Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { listWorkspaces as defaultListWorkspaces } from "@/features/workspaces/api/list-workspaces";

export const command = "list";
export const describe = "List active workspaces";

export const builder = (yargs: Argv) => yargs;

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  listWorkspaces: typeof defaultListWorkspaces;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  listWorkspaces: defaultListWorkspaces,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async () => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const workspaces = await deps.listWorkspaces(API_URL, config.project_id);

    if (workspaces.length === 0) {
      deps.log("No active workspaces.");
      return;
    }

    deps.log("Workspace   Ticket   Branch               Path");
    for (const ws of workspaces) {
      deps.log(`${ws.workspace_shorthand}    ${ws.ticket_shorthand}    ${ws.branch}   ${ws.worktree_path}`);
    }
  };

export const handler = createHandler();
