import { createWorkspace as defaultCreateWorkspace } from "@/features/workspaces/api/create-workspace";

type CreateStandaloneWorkspaceInput = {
  projectId: string;
  providerId: string;
  params?: Record<string, unknown>;
};

type Deps = {
  createWorkspace: typeof defaultCreateWorkspace;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  createWorkspace: defaultCreateWorkspace,
  log: console.log,
};

export const createStandaloneWorkspace = async (input: CreateStandaloneWorkspaceInput, deps: Deps = defaultDeps) => {
  const workspace = await deps.createWorkspace({
    project_id: input.projectId,
    provider_id: input.providerId,
    params: input.params,
  });

  const location = workspace.root_path ?? workspace.display_path ?? `(${workspace.provider_state})`;
  deps.log(`Created workspace ${workspace.workspace_shorthand} at ${location}`);

  return workspace;
};
