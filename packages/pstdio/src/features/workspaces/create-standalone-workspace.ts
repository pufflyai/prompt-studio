import { createWorkspace as defaultCreateWorkspace } from "@/features/workspaces/api/create-workspace";

type CreateStandaloneWorkspaceInput = {
  projectId: string;
  base?: string;
  providerId?: string;
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
    base: input.base,
    provider_id: input.providerId,
    params: input.params,
  });

  if (
    workspace.provider_state === "failed" ||
    workspace.provider_state === "cancelled" ||
    workspace.provider_state === "provider_missing"
  ) {
    throw new Error(
      `Workspace ${workspace.workspace_shorthand} creation ${workspace.provider_state}: ${workspace.provider_error_json?.message ?? "Provider did not create a usable workspace"}`,
    );
  }
  const location = workspace.worktree_path ?? workspace.display_path ?? `(${workspace.provider_state})`;
  deps.log(`Created workspace ${workspace.workspace_shorthand} at ${location}`);

  return workspace;
};
