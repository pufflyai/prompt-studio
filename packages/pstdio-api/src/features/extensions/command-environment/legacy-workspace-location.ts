import type { ExtensionWorkspace, RepoContext } from "pstdio-api-contracts/extension-kernel";
import { resolveWorkspaceLocation } from "../../workspaces/workspace-provider-execution-target";
import { rootProviderId } from "../../workspaces/workspace-provider-identity";
import type { ExtensionsRouteDeps } from "../deps";

// ADR 0030: alpha.10 pathless root workspaces can select any linked repository.
// Remove this compatibility projection with repository linking at the host cutover.
export const resolveLegacyWorkspaceLocation = async <W extends ExtensionWorkspace>(
  deps: Pick<ExtensionsRouteDeps, "repoService">,
  workspace: W,
  input: { repo?: RepoContext },
) => {
  if (
    input.repo &&
    workspace.project_id &&
    workspace.execution_kind !== "remote" &&
    !workspace.worktree_path &&
    (workspace.provider_id === rootProviderId || workspace.is_default)
  ) {
    const repos = await deps.repoService.listByProject(workspace.project_id);
    const repo = repos.find(
      (candidate) => candidate.id === input.repo?.repoId && input.repo.projectId === workspace.project_id,
    );
    if (!repo) throw new Error("The selected repository is no longer linked to this project.");
    return { workspace, root: repo.path };
  }
  return resolveWorkspaceLocation(deps, workspace);
};
