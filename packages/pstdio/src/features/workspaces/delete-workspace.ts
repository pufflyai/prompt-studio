import type { HookName, HookPayload, HookResult, RunHookOptions } from "pstdio-wt";
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
  runHook: (hookName: HookName, payload: HookPayload, options: RunHookOptions) => Promise<HookResult>;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  getWorkspace: defaultGetWorkspace,
  deleteWorkspace: defaultDeleteWorkspaceApi,
  removeWorktreeAndBranch: defaultRemoveWorktreeAndBranch,
  runHook: defaultRunHook,
  log: console.log,
};

const parseTicketShorthand = (workspaceShorthand: string) => {
  const match = workspaceShorthand.match(/^(.+)_A\d+$/);
  return match?.[1] ?? undefined;
};

export const deleteWorkspaceWithWorktree = async (input: DeleteWorkspaceInput, deps: Deps = defaultDeps) => {
  const { repoRoot, projectId, workspaceShorthand } = input;

  const workspace = await deps.getWorkspace(API_URL, projectId, workspaceShorthand);
  if (!workspace) throw new Error(`Workspace not found: ${workspaceShorthand}`);

  const branch = workspace.branch ?? `workspace/${workspace.workspace_shorthand}`;
  const ticketShorthand = parseTicketShorthand(workspace.workspace_shorthand);
  const payload: HookPayload = {
    repo_path: repoRoot,
    worktree_path: workspace.worktree_path,
    branch,
    workspace: workspace.workspace_shorthand,
    workspace_id: workspace.id,
    ticket: ticketShorthand ?? null,
    project_id: projectId,
  };

  if (workspace.worktree_path) {
    const preResult = await deps.runHook("pre-worktree-remove", payload, { repoPath: repoRoot });
    if (!preResult.skipped && preResult.exitCode !== 0) {
      throw new Error(
        `HOOK pre-worktree-remove FAILED (exit ${preResult.exitCode})\n${preResult.stderr || preResult.stdout}`,
      );
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
  const postPayload: HookPayload = { ...payload, worktree_path: null };
  void deps.runHook("post-worktree-remove", postPayload, { repoPath: repoRoot, cwd: repoRoot }).catch(() => {});

  deps.log(`Deleted workspace ${workspaceShorthand}`);
};
