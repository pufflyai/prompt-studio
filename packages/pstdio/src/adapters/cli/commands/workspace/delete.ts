import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { deleteWorkspace as defaultDeleteWorkspace } from "@/features/workspaces/api/delete-workspace";
import { getWorkspace as defaultGetWorkspace } from "@/features/workspaces/api/get-workspace";
import {
  checkoutBranch as defaultCheckoutBranch,
  deleteBranch as defaultDeleteBranch,
  removeWorktree as defaultRemoveWorktree,
} from "@/features/workspaces/git-ops";
import {
  readSwapState as defaultReadSwapState,
  removeSwapState as defaultRemoveSwapState,
} from "@/features/workspaces/swap-state";

export const command = "delete";
export const describe = "Force-remove a workspace";

export const builder = (yargs: Argv) =>
  yargs.option("id", { type: "string", demandOption: true, describe: "Workspace shorthand (e.g. PS-1/A1)" });

type DeleteArgs = {
  id: string;
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  getWorkspace: typeof defaultGetWorkspace;
  deleteWorkspace: typeof defaultDeleteWorkspace;
  removeWorktree: (repoRoot: string, path: string) => Promise<void>;
  deleteBranch: (repoRoot: string, branch: string) => Promise<void>;
  readSwapState: typeof defaultReadSwapState;
  removeSwapState: typeof defaultRemoveSwapState;
  checkoutBranch: (repoRoot: string, branch: string) => Promise<void>;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  getWorkspace: defaultGetWorkspace,
  deleteWorkspace: defaultDeleteWorkspace,
  removeWorktree: defaultRemoveWorktree,
  deleteBranch: async (root, branch) => {
    try {
      await defaultDeleteBranch(root, branch);
    } catch {
      // Branch may already be deleted
    }
  },
  readSwapState: defaultReadSwapState,
  removeSwapState: defaultRemoveSwapState,
  checkoutBranch: defaultCheckoutBranch,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<DeleteArgs>) => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const workspace = await deps.getWorkspace(API_URL, config.project_id, argv.id);
    if (!workspace) throw new Error(`Workspace not found: ${argv.id}`);

    // If currently swapped to this workspace, swap back first
    const swap = deps.readSwapState(root);
    if (swap && swap.workspace_shorthand === argv.id) {
      await deps.checkoutBranch(root, swap.original_branch);
      try {
        await deps.deleteBranch(root, swap.preview_branch);
      } catch {
        // Preview branch may not exist
      }
      deps.removeSwapState(root);
    }

    // Soft-delete in DB
    await deps.deleteWorkspace(API_URL, workspace.id);

    // Force-remove git worktree and directory
    if (workspace.worktree_path) {
      try {
        await deps.removeWorktree(root, workspace.worktree_path);
      } catch {
        // Worktree may already be removed
      }
    }

    // Force-delete workspace branch
    if (workspace.branch) {
      await deps.deleteBranch(root, workspace.branch);
    }

    deps.log(`Deleted workspace ${argv.id}`);
  };

export const handler = createHandler();
