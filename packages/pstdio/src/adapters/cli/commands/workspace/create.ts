import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import type { Arguments, Argv } from "yargs";
import { findGitRoot, readConfig } from "@/features/config/config";
import { createWorkspaceForExistingWorktree } from "@/features/workspaces/create-workspace-for-existing-worktree";
import { createWorkspaceForTicket } from "@/features/workspaces/create-workspace-for-ticket";

export const command = "create";
export const describe = "Create a workspace for a ticket";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", demandOption: true, describe: "Ticket shorthand (e.g. PS-12)" })
    .option("base", { type: "string", describe: "Base branch/ref. Defaults to HEAD" })
    .option("branch", { type: "string", describe: "Branch name when linking an existing worktree" })
    .option("worktree-path", {
      type: "string",
      describe: "Existing worktree path to link instead of creating a new worktree",
    })
    .option("target", { type: "string", default: "worktree", describe: "Workspace target (only 'worktree')" });

type CreateArgs = {
  id: string;
  base?: string;
  branch?: string;
  target: string;
  worktreePath?: string;
};

const resolveCurrentBranch = (worktreePath: string) =>
  execFileSync("git", ["branch", "--show-current"], { cwd: worktreePath, encoding: "utf8" }).trim();

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  createWorkspaceForTicket: typeof createWorkspaceForTicket;
  createWorkspaceForExistingWorktree: typeof createWorkspaceForExistingWorktree;
  resolveCurrentBranch: typeof resolveCurrentBranch;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  createWorkspaceForTicket,
  createWorkspaceForExistingWorktree,
  resolveCurrentBranch,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<CreateArgs>) => {
    if (argv.target !== "worktree") {
      throw new Error(`Invalid target: ${argv.target}. Must be 'worktree'.`);
    }

    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    if (argv.worktreePath) {
      if (argv.base) throw new Error("Cannot use --base when linking an existing worktree.");

      const requestedWorktreePath = resolve(deps.cwd(), argv.worktreePath);
      const worktreeRoot = deps.findGitRoot(requestedWorktreePath);
      if (!worktreeRoot) throw new Error("Worktree path is not inside a git repository.");

      const branch = argv.branch ?? deps.resolveCurrentBranch(worktreeRoot);
      if (!branch) throw new Error("Could not resolve branch for existing worktree. Pass --branch.");

      await deps.createWorkspaceForExistingWorktree({
        projectId: config.project_id,
        ticketShorthand: argv.id,
        branch,
        worktreePath: worktreeRoot,
      });
      return;
    }

    await deps.createWorkspaceForTicket({
      projectId: config.project_id,
      repoRoot: root,
      ticketShorthand: argv.id,
      base: argv.base,
    });
  };

export const handler = createHandler();
