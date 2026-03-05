import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { deleteWorkspace as defaultDeleteWorkspace } from "@/features/workspaces/api/delete-workspace";
import { getWorkspace as defaultGetWorkspace } from "@/features/workspaces/api/get-workspace";
import {
  abortMerge as defaultAbortMerge,
  deleteBranch as defaultDeleteBranch,
  isCleanWorkingTree as defaultIsCleanWorkingTree,
  removeWorktree as defaultRemoveWorktree,
  squashMerge as defaultSquashMerge,
} from "@/features/workspaces/git-ops";

export const command = "merge";
export const describe = "Squash-merge workspace changes into the current branch";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", demandOption: true, describe: "Workspace shorthand (e.g. PS-1/A1)" })
    .option("delete-workspace", { type: "boolean", describe: "Delete workspace after merge" });

type MergeArgs = {
  id: string;
  "delete-workspace"?: boolean;
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  getWorkspace: typeof defaultGetWorkspace;
  deleteWorkspace: typeof defaultDeleteWorkspace;
  isCleanWorkingTree: (repoRoot: string) => Promise<boolean>;
  squashMerge: (repoRoot: string, branch: string, message: string) => Promise<void>;
  abortMerge: (repoRoot: string) => Promise<void>;
  removeWorktree: (repoRoot: string, path: string) => Promise<void>;
  deleteBranch: (repoRoot: string, branch: string) => Promise<void>;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  getWorkspace: defaultGetWorkspace,
  deleteWorkspace: defaultDeleteWorkspace,
  isCleanWorkingTree: defaultIsCleanWorkingTree,
  squashMerge: defaultSquashMerge,
  abortMerge: defaultAbortMerge,
  removeWorktree: defaultRemoveWorktree,
  deleteBranch: defaultDeleteBranch,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<MergeArgs>) => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const clean = await deps.isCleanWorkingTree(root);
    if (!clean) throw new Error("Branch has uncommitted changes");

    const workspace = await deps.getWorkspace(API_URL, config.project_id, argv.id);
    if (!workspace) throw new Error(`Workspace not found: ${argv.id}`);

    const branch = workspace.branch ?? `workspace/${workspace.workspace_shorthand}`;
    const message = `workspace(${workspace.workspace_shorthand}): squash merge`;

    try {
      await deps.squashMerge(root, branch, message);
    } catch {
      await deps.abortMerge(root);
      throw new Error("Merge conflict");
    }

    if (argv["delete-workspace"]) {
      await deps.deleteWorkspace(API_URL, workspace.id);
      if (workspace.worktree_path) {
        try {
          await deps.removeWorktree(root, workspace.worktree_path);
        } catch {
          // Already removed
        }
      }
      try {
        await deps.deleteBranch(root, branch);
      } catch {
        // Already deleted
      }
      deps.log(`Merged workspace ${argv.id} and deleted workspace.`);
    } else {
      deps.log(`Merged workspace ${argv.id} as a squash commit.`);
    }
  };

export const handler = createHandler();
