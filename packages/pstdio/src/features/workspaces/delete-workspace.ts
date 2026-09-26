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
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  getWorkspace: defaultGetWorkspace,
  deleteWorkspace: defaultDeleteWorkspaceApi,
  log: console.log,
};

export const deleteWorkspaceWithWorktree = async (input: DeleteWorkspaceInput, deps: Deps = defaultDeps) => {
  const { projectId, workspaceShorthand } = input;
  const workspace = await deps.getWorkspace(projectId, workspaceShorthand);
  if (!workspace) throw new Error(`Workspace not found: ${workspaceShorthand}`);
  // The provider owns cleanup, including recorded branches and remote resources.
  await deps.deleteWorkspace(workspace.id);
  deps.log(`Deleted workspace ${workspace.workspace_shorthand}`);
};
