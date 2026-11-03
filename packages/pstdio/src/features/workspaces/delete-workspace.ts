import { deleteWorkspace as defaultDeleteWorkspaceApi } from "./api/delete-workspace";
import { getWorkspace as defaultGetWorkspace } from "./api/get-workspace";

type DeleteWorkspaceInput = {
  projectId: string;
  workspaceShorthand: string;
  forget?: boolean;
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

export const deleteWorkspace = async (input: DeleteWorkspaceInput, deps: Deps = defaultDeps) => {
  const { projectId, workspaceShorthand } = input;

  const workspace = await deps.getWorkspace(projectId, workspaceShorthand);
  if (!workspace) throw new Error(`Workspace not found: ${workspaceShorthand}`);

  if (input.forget) await deps.deleteWorkspace(workspace.id, { forget: true });
  else await deps.deleteWorkspace(workspace.id);

  deps.log(
    input.forget
      ? `Forgot workspace ${workspaceShorthand}; any remote resource was left unchanged.`
      : `Deleted workspace ${workspaceShorthand}`,
  );
};
