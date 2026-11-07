import type { InvocationScope } from "pstdio-extensions";
import { createProcessApi } from "../extensions/extension-process-api";
import type { WorkspacesRouteDeps } from "./deps";
import { createWorkspaceProviderDirectory } from "./workspace-provider-directory";

type ProviderProcessInput = { projectId: string; providerId: string; workspaceId?: string };

const ownedWorkspace = async (deps: WorkspacesRouteDeps, input: ProviderProcessInput) => {
  if (!input.workspaceId) return null;
  const workspace = await deps.workspaceService.get(input.workspaceId);
  if (
    !workspace ||
    workspace.deleted_at ||
    workspace.project_id !== input.projectId ||
    workspace.provider_id !== input.providerId
  )
    throw new Error("Workspace provider does not own this workspace.");
  return workspace;
};

export const createWorkspaceProviderProcess = (
  deps: WorkspacesRouteDeps,
  input: ProviderProcessInput,
  scope?: InvocationScope,
) =>
  createProcessApi({
    scope,
    resolveCwd: async () => {
      scope?.signal.throwIfAborted();
      // Preserve the selected local cwd once ready. Preparation and cleanup must
      // also work while the provider target has no usable execution directory.
      const workspace = await ownedWorkspace(deps, input);
      if (workspace?.execution_kind === "local" && workspace.provider_state === "ready" && workspace.root_path)
        return workspace.root_path;
      const home = await deps.workspaceService.getDefault(input.projectId);
      if (home?.execution_kind === "local" && home.root_path) return home.root_path;
      if (input.workspaceId)
        return (
          await createWorkspaceProviderDirectory(
            deps,
            {
              ...input,
              workspaceId: input.workspaceId,
            },
            scope,
          )()
        ).path;
      throw new Error("Workspace provider has no local process directory.");
    },
  });
