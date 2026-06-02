import { createWorkspace as defaultCreateWorkspace } from "@/features/workspaces/api/create-workspace";

type CreateStandaloneWorkspaceInput = {
  projectId: string;
  base?: string;
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
  const workspace = await deps.createWorkspace({ project_id: input.projectId, base: input.base });

  deps.log(`Created workspace ${workspace.workspace_shorthand} at ${workspace.worktree_path ?? "(unavailable)"}`);

  return workspace;
};
