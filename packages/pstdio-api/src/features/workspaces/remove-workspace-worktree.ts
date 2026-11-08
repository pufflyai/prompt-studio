import { type ExtensionWorkspace, worktreeEvents } from "pstdio-api-contracts/extension-kernel";
import { fireExtensionEventAsync } from "../extensions/extension-event-runtime";
import type { WorkspacesRouteDeps } from "./deps";
import { deleteProviderBackedWorkspace } from "./workspace-provider-lifecycle";

type WorkspaceRecord = NonNullable<Awaited<ReturnType<WorkspacesRouteDeps["workspaceService"]["get"]>>>;

const toWorkspaceEventPayload = (workspace: WorkspaceRecord) => {
  const { anchors_json: _anchors, ...payload } = workspace;
  return payload as ExtensionWorkspace;
};

export const removeWorkspaceWorktree = async (
  deps: WorkspacesRouteDeps,
  workspace: WorkspaceRecord,
  overrides: {
    cleanup?: typeof deleteProviderBackedWorkspace;
    fireEvent?: typeof fireExtensionEventAsync;
  } = {},
) => {
  const worktreePath = workspace.root_path;
  if (!worktreePath) return false;
  const cleanup = overrides.cleanup ?? deleteProviderBackedWorkspace;
  const removed = await cleanup(deps, workspace);
  if (!removed || !worktreePath) return false;

  await deps.workspaceService.clearWorktree(workspace.id);
  const fireEvent = overrides.fireEvent ?? fireExtensionEventAsync;
  fireEvent(deps, workspace.project_id, worktreeEvents.removed, {
    projectId: workspace.project_id,
    worktreePath,
    workspace: toWorkspaceEventPayload(workspace),
    workspaceId: workspace.id,
  });
  return true;
};
