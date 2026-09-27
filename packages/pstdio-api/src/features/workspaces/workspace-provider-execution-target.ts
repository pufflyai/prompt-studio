import type { ExtensionWorkspace } from "pstdio-api-contracts/extension-kernel";
import type { WorkspacesRouteDeps } from "./deps";
import { workspaceGitPaths } from "./worktree-cleanup";

type WorkspaceLocation = Pick<ExtensionWorkspace, "root_path" | "execution_kind">;

export const resolveWorkspaceLocation = async <W extends WorkspaceLocation>(_deps: unknown, workspace: W) =>
  workspace.execution_kind === "local" && workspace.root_path ? { workspace, root: workspace.root_path } : undefined;

export const resolveWorkspaceExecutionTarget = async (
  deps: Pick<WorkspacesRouteDeps, "workspaceService">,
  workspaceId: string,
  access?: "files:read" | "files:write" | "diff",
) => {
  const workspace = await deps.workspaceService.get(workspaceId);
  if (
    !workspace ||
    workspace.deleted_at ||
    workspace.provider_state !== "ready" ||
    workspace.initializing ||
    workspace.setup_error
  )
    return undefined;
  if (workspace.execution_kind !== "local" || !workspace.root_path) return undefined;
  const capabilities = workspace.provider_capabilities_json;
  if (access === "files:read" && capabilities.files === "none") return undefined;
  if (access === "files:write" && capabilities.files !== "write") return undefined;
  if (access === "diff" && !capabilities.diff) return undefined;
  return {
    workspace,
    root: access === "diff" ? (workspaceGitPaths(workspace)?.worktreeRoot ?? workspace.root_path) : workspace.root_path,
  };
};
