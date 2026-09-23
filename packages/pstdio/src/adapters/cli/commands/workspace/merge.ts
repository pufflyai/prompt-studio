import type { Arguments, Argv } from "yargs";
import { findProjectRoot, readConfig } from "@/features/config/config";
import { mergeWorkspace as defaultMergeWorkspace } from "@/features/workspaces/merge-workspace";

export const command = "merge";
export const describe = "Squash-merge workspace changes into the current branch";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", demandOption: true, describe: "Workspace shorthand (e.g. PS-1_A1)" })
    .option("delete-workspace", { type: "boolean", describe: "Delete workspace after merge" });

type MergeArgs = {
  id: string;
  "delete-workspace"?: boolean;
};

type Deps = {
  cwd: () => string;
  findProjectRoot: typeof findProjectRoot;
  readConfig: typeof readConfig;
  mergeWorkspace: typeof defaultMergeWorkspace;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findProjectRoot,
  readConfig,
  mergeWorkspace: defaultMergeWorkspace,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<MergeArgs>) => {
    const root = deps.findProjectRoot(deps.cwd());
    if (!root) throw new Error("Not inside a pstdio project.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    await deps.mergeWorkspace({
      projectId: config.project_id,
      workspaceShorthand: argv.id,
      deleteAfter: argv["delete-workspace"],
    });
  };

export const handler = createHandler();
