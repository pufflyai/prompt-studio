import { execSync } from "node:child_process";
import type { Arguments, Argv } from "yargs";
import { findGitRoot, readConfig } from "@/features/config/config";
import { resolveCliSessionId } from "@/features/sessions/resolve-cli-session-id";
import { getWorkspace as defaultGetWorkspace } from "@/features/workspaces/api/get-workspace";
import { updateAttemptStatus as defaultUpdateAttemptStatus } from "@/features/workspaces/api/update-attempt-status";

export const command = "set-status";
export const describe = "Update the attempt status for a workspace";

export const builder = (yargs: Argv) =>
  yargs
    .option("workspace", { type: "string", describe: "Workspace shorthand (auto-detected from branch if omitted)" })
    .option("status", { type: "string", demandOption: true, describe: "New attempt status" })
    .option("session-id", { type: "string", describe: "Session ID for deferred post-attempt-status hooks" })
    .epilog("Run `pstdio workspaces list-statuses` to see available attempt statuses.");

type SetStatusArgs = {
  workspace?: string;
  status: string;
  "session-id"?: string;
};

const WORKSPACE_BRANCH_PREFIX = "workspace/";

type Deps = {
  cwd: () => string;
  env: () => NodeJS.ProcessEnv;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  getWorkspace: typeof defaultGetWorkspace;
  updateAttemptStatus: typeof defaultUpdateAttemptStatus;
  getCurrentBranch: (cwd: string) => string | null;
  log: (msg: string) => void;
};

const getCurrentBranch = (cwd: string) => {
  try {
    return execSync("git symbolic-ref --short HEAD", { cwd, encoding: "utf-8" }).trim() || null;
  } catch {
    return null;
  }
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  env: () => process.env,
  findGitRoot,
  readConfig,
  getWorkspace: defaultGetWorkspace,
  updateAttemptStatus: defaultUpdateAttemptStatus,
  getCurrentBranch,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<SetStatusArgs>) => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const shorthand = argv.workspace ?? detectWorkspaceFromBranch(deps.getCurrentBranch(deps.cwd()));
    if (!shorthand) throw new Error("Could not detect workspace. Pass --workspace or run from a workspace branch.");

    const workspace = await deps.getWorkspace(config.project_id, shorthand);
    if (!workspace) throw new Error(`Workspace not found: ${shorthand}`);

    const sessionId = resolveCliSessionId({
      explicitSessionId: argv["session-id"],
      env: deps.env(),
    });

    await deps.updateAttemptStatus(workspace.id, argv.status, sessionId);

    deps.log(`Updated attempt status to "${argv.status}" for workspace ${shorthand}`);
  };

export const detectWorkspaceFromBranch = (branch: string | null) => {
  if (!branch?.startsWith(WORKSPACE_BRANCH_PREFIX)) return null;
  return branch.slice(WORKSPACE_BRANCH_PREFIX.length) || null;
};

export const handler = createHandler();
