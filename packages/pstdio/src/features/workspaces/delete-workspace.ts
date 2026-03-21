import type { HookContext, HookResult } from "pstdio-wt";
import { removeWorktreeAndBranch as defaultRemoveWorktreeAndBranch, runHook as defaultRunHook } from "pstdio-wt";
import { API_URL } from "@/features/api-url";
import { deleteWorkspace as defaultDeleteWorkspaceApi } from "./api/delete-workspace";
import { getWorkspace as defaultGetWorkspace } from "./api/get-workspace";

type DeleteWorkspaceInput = {
  repoRoot: string;
  projectId: string;
  workspaceShorthand: string;
};

type Deps = {
  getWorkspace: typeof defaultGetWorkspace;
  deleteWorkspace: typeof defaultDeleteWorkspaceApi;
  removeWorktreeAndBranch: (opts: { repoRoot: string; path: string; branch: string; force?: boolean }) => Promise<void>;
  runHook: (hookName: "pre-remove" | "post-remove", context: HookContext, repoPath: string) => Promise<HookResult>;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  getWorkspace: defaultGetWorkspace,
  deleteWorkspace: defaultDeleteWorkspaceApi,
  removeWorktreeAndBranch: defaultRemoveWorktreeAndBranch,
  runHook: defaultRunHook,
  log: console.log,
};

export const deleteWorkspaceWithWorktree = async (input: DeleteWorkspaceInput, deps: Deps = defaultDeps) => {
  const { repoRoot, projectId, workspaceShorthand } = input;

  const workspace = await deps.getWorkspace(API_URL, projectId, workspaceShorthand);
  if (!workspace) throw new Error(`Workspace not found: ${workspaceShorthand}`);

  const branch = workspace.branch ?? `workspace/${workspace.workspace_shorthand}`;
  const hookContext: HookContext = {
    repoPath: repoRoot,
    worktreePath: workspace.worktree_path ?? undefined,
    branch,
    workspace: workspace.workspace_shorthand,
    projectId,
  };

  if (workspace.worktree_path) {
    const preResult = await deps.runHook("pre-remove", hookContext, repoRoot);
    if (!preResult.skipped && preResult.exitCode !== 0) {
      throw new Error(`HOOK pre-remove FAILED (exit ${preResult.exitCode})\n${preResult.stderr || preResult.stdout}`);
    }
  }

  await deps.deleteWorkspace(API_URL, workspace.id);

  if (workspace.worktree_path) {
    try {
      await deps.removeWorktreeAndBranch({
        repoRoot,
        path: workspace.worktree_path,
        branch,
        force: true,
      });
    } catch {
      // Worktree/branch may already be removed
    }
  }

  // post-remove runs in repo root since worktree is already deleted
  void deps.runHook("post-remove", { ...hookContext, worktreePath: undefined }, repoRoot).catch(() => {});

  deps.log(`Deleted workspace ${workspaceShorthand}`);
};
