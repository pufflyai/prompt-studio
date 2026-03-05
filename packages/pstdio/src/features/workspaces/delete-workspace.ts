import { removeWorktreeAndBranch as defaultRemoveWorktreeAndBranch } from "pstdio-wt";
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

  const workspace = await deps.getWorkspace(API_URL, projectId, workspaceShorthand);
  if (!workspace) throw new Error(`Workspace not found: ${workspaceShorthand}`);

  await deps.deleteWorkspace(API_URL, workspace.id);

  const branch = workspace.branch ?? `workspace/${workspace.workspace_shorthand}`;
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

  deps.log(`Deleted workspace ${workspaceShorthand}`);
};
