import type { Arguments, Argv } from "yargs";
import { findGitRoot, readConfig } from "@/features/config/config";
import { createStandaloneWorkspace } from "@/features/workspaces/create-standalone-workspace";

export const command = "create";
export const describe = "Create a worktree-backed workspace";

export const builder = (yargs: Argv) =>
  yargs
    .option("base", { type: "string", describe: "Base branch/ref. Defaults to HEAD" })
    .option("target", { type: "string", default: "worktree", describe: "Workspace target (only 'worktree')" });

type CreateArgs = {
  base?: string;
  target: string;
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  createStandaloneWorkspace: typeof createStandaloneWorkspace;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  createStandaloneWorkspace,
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

    await deps.createStandaloneWorkspace({ projectId: config.project_id, base: argv.base });
  };

export const handler = createHandler();
