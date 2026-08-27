import type { WorkspacesRouteDeps } from "./deps";
import { rootProviderId } from "./workspace-provider-identity";

export const resolveWorkspaceExecutionTarget = async (
  deps: WorkspacesRouteDeps,
  workspaceId: string,
  access?: "files:read" | "files:write" | "diff",
) => {
  const workspace = await deps.workspaceService.get(workspaceId);
  if (!workspace) return undefined;
  if (workspace.provider_state && workspace.provider_state !== "ready") return undefined;
  if (workspace.setup_error) return undefined;
  if (workspace.execution_kind === "remote") return undefined;
  const capabilities = workspace.provider_capabilities_json;
  if (access === "files:read" && capabilities?.files === "none") return undefined;
  if (access === "files:write" && capabilities && capabilities.files !== "write") return undefined;
  if (access === "diff" && capabilities && !capabilities.diff) return undefined;
  if (workspace.worktree_path) return { workspace, root: workspace.worktree_path };
  if (workspace.provider_id && workspace.provider_id !== rootProviderId && !workspace.is_default) return undefined;

  const [repo] = await deps.repoService.listByProject(workspace.project_id);
  return repo?.path ? { workspace, root: repo.path } : undefined;
};
