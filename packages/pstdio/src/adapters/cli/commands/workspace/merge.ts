import type { Arguments, Argv } from "yargs";
import { findGitRoot, readConfig } from "@/features/config/config";
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
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  mergeWorkspace: typeof defaultMergeWorkspace;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  mergeWorkspace: defaultMergeWorkspace,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<MergeArgs>) => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    await deps.mergeWorkspace({
      repoRoot: root,
      projectId: config.project_id,
      workspaceShorthand: argv.id,
      deleteAfter: argv["delete-workspace"],
    });
  };

export const handler = createHandler();
