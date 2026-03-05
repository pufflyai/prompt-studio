import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { getStartupLog as defaultGetStartupLog } from "@/features/workspaces/api/get-startup-log";
import { listWorkspaces as defaultListWorkspaces } from "@/features/workspaces/api/list-workspaces";

export const command = "startup-log";
export const describe = "Show the startup script log for a workspace";

export const builder = (yargs: Argv) =>
  yargs.option("id", { type: "string", demandOption: true, describe: "Workspace shorthand (e.g. PS-12_A1)" });

type StartupLogArgs = {
  id: string;
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  listWorkspaces: typeof defaultListWorkspaces;
  getStartupLog: typeof defaultGetStartupLog;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  listWorkspaces: defaultListWorkspaces,
  getStartupLog: defaultGetStartupLog,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<StartupLogArgs>) => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const workspaces = await deps.listWorkspaces(API_URL, config.project_id);
    const workspace = workspaces.find((ws) => ws.workspace_shorthand === argv.id);
    if (!workspace) throw new Error(`Workspace not found: ${argv.id}`);

    const log = await deps.getStartupLog(API_URL, workspace.id);
    if (!log) {
      deps.log(`No startup log for workspace ${argv.id}.`);
      return;
    }

    deps.log(log);
  };

export const handler = createHandler();
