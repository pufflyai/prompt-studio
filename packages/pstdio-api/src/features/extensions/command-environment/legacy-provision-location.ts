import type { ExtensionWorkspace, RepoContext } from "pstdio-api-contracts/extension-kernel";
import { workspaceEvents } from "pstdio-api-contracts/extension-kernel";
import { resolveWorkspaceLocation } from "../../workspaces/workspace-provider-execution-target";
import { rootProviderId } from "../../workspaces/workspace-provider-identity";
import type { ExtensionsRouteDeps } from "../deps";

// ADR 0030: alpha.10 root provisioning visits each linked repository. Remove at the host cutover.
export const resolveProvisionLocation = async <W extends ExtensionWorkspace>(
  deps: Pick<ExtensionsRouteDeps, "repoService">,
  workspace: W,
  input: { eventId?: string; repo?: RepoContext },
) => {
  const lifecycle = input.eventId === workspaceEvents.provision.id || input.eventId === workspaceEvents.ready.id;
  if (
    lifecycle &&
    input.repo &&
    workspace.project_id &&
    workspace.execution_kind !== "remote" &&
    !workspace.worktree_path &&
    (workspace.provider_id === rootProviderId || workspace.is_default)
  ) {
    const repos = await deps.repoService.listByProject(workspace.project_id);
    const repo = repos.find((candidate) => candidate.id === input.repo?.repoId);
    if (!repo) throw new Error("The provisioning repository is no longer linked to this project.");
    return { workspace, root: repo.path };
  }
  return resolveWorkspaceLocation(deps, workspace);
};
