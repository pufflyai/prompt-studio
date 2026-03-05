import type { Arguments, Argv } from "yargs";
import { findGitRoot, readConfig } from "@/features/config/config";
import { createWorkspaceForTicket } from "@/features/workspaces/create-workspace-for-ticket";

export const command = "create";
export const describe = "Create a workspace for a ticket";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", demandOption: true, describe: "Ticket shorthand (e.g. PS-12)" })
    .option("base", { type: "string", describe: "Base branch/ref. Defaults to HEAD" })
    .option("target", { type: "string", default: "worktree", describe: "Workspace target (only 'worktree')" });

type CreateArgs = {
  id: string;
  base?: string;
  target: string;
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  createWorkspaceForTicket: typeof createWorkspaceForTicket;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  createWorkspaceForTicket,
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

    await deps.createWorkspaceForTicket({
      projectId: config.project_id,
      repoRoot: root,
      ticketShorthand: argv.id,
      base: argv.base,
    });
  };

export const handler = createHandler();
