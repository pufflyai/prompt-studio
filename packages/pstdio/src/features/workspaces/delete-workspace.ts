import { removeWorktreeAndBranch as defaultRemoveWorktreeAndBranch } from "pstdio-wt";
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
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  getWorkspace: defaultGetWorkspace,
  deleteWorkspace: defaultDeleteWorkspaceApi,
  removeWorktreeAndBranch: defaultRemoveWorktreeAndBranch,
  log: console.log,
};

export const deleteWorkspaceWithWorktree = async (input: DeleteWorkspaceInput, deps: Deps = defaultDeps) => {
  const { repoRoot, projectId, workspaceShorthand } = input;

  const workspace = await deps.getWorkspace(projectId, workspaceShorthand);
  if (!workspace) throw new Error(`Workspace not found: ${workspaceShorthand}`);

  const branch = workspace.branch ?? `workspace/${workspace.workspace_shorthand}`;
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

  deps.log(`Deleted workspace ${workspaceShorthand}`);
};
