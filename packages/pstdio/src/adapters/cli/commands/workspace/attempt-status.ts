import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { getWorkspace as defaultGetWorkspace } from "@/features/workspaces/api/get-workspace";
import { updateAttemptStatus as defaultUpdateAttemptStatus } from "@/features/workspaces/api/update-attempt-status";

export const command = "attempt-status";
export const describe = "Update the attempt status for a workspace";

export const builder = (yargs: Argv) =>
  yargs
    .option("workspace", { type: "string", demandOption: true, describe: "Workspace shorthand" })
    .option("session", { type: "string", demandOption: true, describe: "Session ID" })
    .option("status", { type: "string", demandOption: true, describe: "New attempt status" });

type AttemptStatusArgs = {
  workspace: string;
  session: string;
  status: string;
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  getWorkspace: typeof defaultGetWorkspace;
  updateAttemptStatus: typeof defaultUpdateAttemptStatus;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  getWorkspace: defaultGetWorkspace,
  updateAttemptStatus: defaultUpdateAttemptStatus,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<AttemptStatusArgs>) => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const workspace = await deps.getWorkspace(API_URL, config.project_id, argv.workspace);
    if (!workspace) throw new Error(`Workspace not found: ${argv.workspace}`);

    await deps.updateAttemptStatus(API_URL, workspace.id, argv.session, argv.status);

    deps.log(`Updated attempt status to "${argv.status}" for workspace ${argv.workspace}`);
  };

export const handler = createHandler();
