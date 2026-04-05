import { join } from "node:path";
import { createHookDispatcher } from "pstdio-hooks";
import { loadPlugins } from "pstdio-plugins";
import { removeWorktreeAndBranch as defaultRemoveWorktreeAndBranch } from "pstdio-wt";
import { API_URL } from "@/features/api-url";
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
  const pluginsDir = join(repoRoot, ".pstdio", "plugins");
  const plugins = await loadPlugins(pluginsDir);
  const dispatcher = createHookDispatcher();
  for (const plugin of plugins) {
    for (const [hookName, handler] of Object.entries(plugin.definition.hooks ?? {})) {
      if (typeof handler === "function") dispatcher.register(hookName, handler as never);
    }
  }
  return dispatcher;
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

  const workspace = await deps.getWorkspace(API_URL, projectId, workspaceShorthand);
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

  if (dispatch) {
    void dispatch.firePostHook("postWorktreeRemove", { ...payload, worktree_path: null }).catch(() => {});
  }

  deps.log(`Deleted workspace ${workspaceShorthand}`);
};
