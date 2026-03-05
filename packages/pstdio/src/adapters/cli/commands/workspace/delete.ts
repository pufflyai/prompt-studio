import type { Arguments, Argv } from "yargs";
import { findGitRoot, readConfig } from "@/features/config/config";
import { deleteWorkspaceWithWorktree as defaultDeleteWorkspace } from "@/features/workspaces/delete-workspace";

export const command = "delete";
export const describe = "Force-remove a workspace";

export const builder = (yargs: Argv) =>
  yargs.option("id", { type: "string", demandOption: true, describe: "Workspace shorthand (e.g. PS-1_A1)" });

type DeleteArgs = {
  id: string;
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  deleteWorkspace: typeof defaultDeleteWorkspace;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  deleteWorkspace: defaultDeleteWorkspace,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<DeleteArgs>) => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    await deps.deleteWorkspace({
      repoRoot: root,
      projectId: config.project_id,
      workspaceShorthand: argv.id,
    });
  };

export const handler = createHandler();
