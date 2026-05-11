import type { PstdioClient } from "@pstdio/sdk/client";
import { loadPluginRuntime } from "pstdio-plugins/hooks";
import { removeWorktreeAndBranch as defaultRemoveWorktreeAndBranch } from "pstdio-wt";
import { deleteWorkspace as defaultDeleteWorkspaceApi } from "./api/delete-workspace";
import { getWorkspace as defaultGetWorkspace } from "./api/get-workspace";

type HookDispatch = {
  firePreHook(hookName: string, ctx: unknown): Promise<{ rejected: boolean; reason?: string }>;
  firePostHook(hookName: string, ctx: unknown): Promise<void>;
};

type DeleteWorkspaceInput = {
  repoRoot: string;
  projectId: string;
  workspaceShorthand: string;
};

type Deps = {
  getWorkspace: typeof defaultGetWorkspace;
  deleteWorkspace: typeof defaultDeleteWorkspaceApi;
  removeWorktreeAndBranch: (opts: { repoRoot: string; path: string; branch: string; force?: boolean }) => Promise<void>;
  dispatch?: HookDispatch;
  log: (msg: string) => void;
};

const createDispatchForRepo = async (repoRoot: string): Promise<HookDispatch> => {
  const runtime = await loadPluginRuntime({
    repoPath: repoRoot,
    client: {} as PstdioClient,
  });
  return {
    firePreHook: (hookName, ctx) => runtime.hooks.firePre(hookName as never, ctx as never),
    firePostHook: (hookName, ctx) => runtime.hooks.firePost(hookName as never, ctx as never),
  };
};

const defaultDeps: Deps = {
  getWorkspace: defaultGetWorkspace,
  deleteWorkspace: defaultDeleteWorkspaceApi,
  removeWorktreeAndBranch: defaultRemoveWorktreeAndBranch,
  log: console.log,
};

const parseTicketShorthand = (workspaceShorthand: string) => {
  const match = workspaceShorthand.match(/^(.+)_A\d+$/);
  return match?.[1] ?? undefined;
};

export const deleteWorkspaceWithWorktree = async (input: DeleteWorkspaceInput, deps: Deps = defaultDeps) => {
  const { repoRoot, projectId, workspaceShorthand } = input;
  const dispatch = deps.dispatch ?? (await createDispatchForRepo(repoRoot));

  const workspace = await deps.getWorkspace(projectId, workspaceShorthand);
  if (!workspace) throw new Error(`Workspace not found: ${workspaceShorthand}`);

  const branch = workspace.branch ?? `workspace/${workspace.workspace_shorthand}`;
  const ticketShorthand = parseTicketShorthand(workspace.workspace_shorthand);
  const payload: Record<string, unknown> = {
    repo_path: repoRoot,
    worktree_path: workspace.worktree_path,
    branch,
    workspace: workspace.workspace_shorthand,
    workspace_id: workspace.id,
    ticket: ticketShorthand ?? null,
    project_id: projectId,
  };

  if (workspace.worktree_path && dispatch) {
    const preResult = await dispatch.firePreHook("preWorktreeRemove", payload);
    if (preResult.rejected) {
      throw new Error(`HOOK preWorktreeRemove FAILED\n${preResult.reason ?? ""}`);
    }
  }

  await deps.deleteWorkspace(workspace.id);

  if (workspace.worktree_path) {
    try {
      await deps.removeWorktreeAndBranch({
        repoRoot,
        path: workspace.worktree_path,
        branch,
        force: true,
      });
    } catch (error) {
      // Worktree/branch may already be removed; surface the error so operators can investigate.
      deps.log(`removeWorktreeAndBranch failed for ${workspaceShorthand}: ${(error as Error).message}`);
    }
  }

  if (dispatch) {
    try {
      await dispatch.firePostHook("postWorktreeRemove", { ...payload, worktree_path: null });
    } catch (error) {
      // Workspace is already deleted; log so post-hook failures are not silently lost.
      deps.log(`postWorktreeRemove hook failed for ${workspaceShorthand}: ${(error as Error).message}`);
    }
  }

  deps.log(`Deleted workspace ${workspaceShorthand}`);
};
