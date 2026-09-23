import type { Arguments, Argv } from "yargs";
import { findProjectRoot, readConfig } from "@/features/config/config";
import { deleteWorkspace as defaultDeleteWorkspace } from "@/features/workspaces/delete-workspace";

export const command = "delete";
export const describe = "Force-remove a workspace";

export const builder = (yargs: Argv) =>
  yargs.option("id", { type: "string", demandOption: true, describe: "Workspace shorthand (e.g. PS-1_A1)" });

type DeleteArgs = {
  id: string;
};

type Deps = {
  cwd: () => string;
  findProjectRoot: typeof findProjectRoot;
  readConfig: typeof readConfig;
  deleteWorkspace: typeof defaultDeleteWorkspace;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findProjectRoot,
  readConfig,
  deleteWorkspace: defaultDeleteWorkspace,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<DeleteArgs>) => {
    const root = deps.findProjectRoot(deps.cwd());
    if (!root) throw new Error("Not inside a pstdio project.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    await deps.deleteWorkspace({
      projectId: config.project_id,
      workspaceShorthand: argv.id,
    });
  };

export const handler = createHandler();
