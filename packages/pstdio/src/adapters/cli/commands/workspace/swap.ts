import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { getWorkspace as defaultGetWorkspace } from "@/features/workspaces/api/get-workspace";
import {
  checkoutBranch as defaultCheckoutBranch,
  deleteBranch as defaultDeleteBranch,
  getCommitHash as defaultGetCommitHash,
  getCurrentBranchOrCommit as defaultGetCurrentBranchOrCommit,
  isCleanWorkingTree as defaultIsCleanWorkingTree,
} from "@/features/workspaces/git-ops";
import {
  readSwapState as defaultReadSwapState,
  removeSwapState as defaultRemoveSwapState,
  writeSwapState as defaultWriteSwapState,
} from "@/features/workspaces/swap-state";

export const command = "swap";
export const describe = "Preview workspace changes in the main checkout";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", describe: "Workspace shorthand to preview" })
    .option("status", { type: "boolean", describe: "Print active swap state" })
    .option("back", { type: "boolean", describe: "Restore original checkout" });

type SwapArgs = {
  id?: string;
  status?: boolean;
  back?: boolean;
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  getWorkspace: typeof defaultGetWorkspace;
  readSwapState: typeof defaultReadSwapState;
  writeSwapState: typeof defaultWriteSwapState;
  removeSwapState: typeof defaultRemoveSwapState;
  isCleanWorkingTree: (repoRoot: string) => Promise<boolean>;
  getCurrentBranchOrCommit: (repoRoot: string) => Promise<string>;
  getCommitHash: (repoRoot: string, ref: string) => Promise<string>;
  checkoutBranch: (repoRoot: string, branch: string, ref?: string) => Promise<void>;
  deleteBranch: (repoRoot: string, branch: string) => Promise<void>;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  getWorkspace: defaultGetWorkspace,
  readSwapState: defaultReadSwapState,
  writeSwapState: defaultWriteSwapState,
  removeSwapState: defaultRemoveSwapState,
  isCleanWorkingTree: defaultIsCleanWorkingTree,
  getCurrentBranchOrCommit: defaultGetCurrentBranchOrCommit,
  getCommitHash: defaultGetCommitHash,
  checkoutBranch: defaultCheckoutBranch,
  deleteBranch: defaultDeleteBranch,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<SwapArgs>) => {
    const flags = [argv.id, argv.status, argv.back].filter(Boolean).length;
    if (flags !== 1) throw new Error("Exactly one of --id, --status, --back is required");

    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    if (argv.status) {
      const swap = deps.readSwapState(root);
      if (!swap) {
        deps.log("No active swap.");
        return;
      }
      deps.log(`Swap active: workspace ${swap.workspace_shorthand} on branch ${swap.preview_branch}`);
      return;
    }

    if (argv.back) {
      const swap = deps.readSwapState(root);
      if (!swap) throw new Error("No active swap");

      const clean = await deps.isCleanWorkingTree(root);
      if (!clean) throw new Error("Branch has uncommitted changes");

      await deps.checkoutBranch(root, swap.original_branch);
      try {
        await deps.deleteBranch(root, swap.preview_branch);
      } catch {
        // Preview branch may not exist
      }
      deps.removeSwapState(root);
      deps.log("Restored original branch and cleared swap state.");
      return;
    }

    // swap --id
    const swap = deps.readSwapState(root);
    if (swap) throw new Error("Already swapped - run 'workspace swap --back' first");

    const clean = await deps.isCleanWorkingTree(root);
    if (!clean) throw new Error("Branch has uncommitted changes");

    const workspace = await deps.getWorkspace(API_URL, config.project_id, argv.id!);
    if (!workspace) throw new Error(`Workspace not found: ${argv.id}`);

    const currentBranch = await deps.getCurrentBranchOrCommit(root);
    const currentCommit = await deps.getCommitHash(root, "HEAD");
    const previewBranch = `preview/${workspace.workspace_shorthand}`;
    const workspaceBranch = workspace.branch ?? `workspace/${workspace.workspace_shorthand}`;

    // Get the tip of the workspace branch
    const wsCommit = await deps.getCommitHash(root, workspaceBranch);

    deps.writeSwapState(root, {
      workspace_shorthand: workspace.workspace_shorthand,
      original_branch: currentBranch,
      original_commit: currentCommit,
      preview_branch: previewBranch,
    });

    await deps.checkoutBranch(root, previewBranch, wsCommit);
    deps.log(`Swapped to workspace ${workspace.workspace_shorthand}`);
  };

export const handler = createHandler();
