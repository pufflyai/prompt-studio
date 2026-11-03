import { worktreeEvents } from "pstdio-api-contracts/extension-kernel";
import { fireExtensionEventAsync } from "../extensions/extension-event-runtime";
import { cancelWorkspaceSessions } from "./cancel-workspace-sessions";
import type { WorkspacesRouteDeps } from "./deps";
import { toExtensionWorkspace } from "./extension-workspace";
import {
  assertWorkspaceDeleteAllowed,
  deleteProviderBackedWorkspace,
  finalizeWorkspaceDelete,
} from "./workspace-provider-lifecycle";
import type { WorkspaceRecord } from "./workspace-provider-projection";

const createDeletionQueue = () => {
  let active = 0;
  const waiting: (() => void)[] = [];
  const pending = new Map<string, Promise<void>>();

  const run = async (remove: () => Promise<void>) => {
    if (active >= 2) await new Promise<void>((resolve) => waiting.push(resolve));
    else active++;
    try {
      await remove();
    } finally {
      // Transfer the slot directly so a new caller cannot jump ahead of a waiter.
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };

  return (id: string, remove: () => Promise<void>) => {
    const existing = pending.get(id);
    if (existing) return existing;
    const task = run(remove).finally(() => pending.delete(id));
    pending.set(id, task);
    return task;
  };
};

// One queue per host service, shared by HTTP and extension callers across projects.
// Keep session writes and sync publication inside the slot, not just Git deletion.
const queues = new WeakMap<WorkspacesRouteDeps["workspaceService"], ReturnType<typeof createDeletionQueue>>();

export const deleteWorkspace = (
  deps: WorkspacesRouteDeps,
  workspace: WorkspaceRecord,
  overrides: {
    forget?: boolean;
    deleteProviderBackedWorkspace?: typeof deleteProviderBackedWorkspace;
    fireExtensionEventAsync?: typeof fireExtensionEventAsync;
  } = {},
) => {
  let queue = queues.get(deps.workspaceService);
  if (!queue) {
    queue = createDeletionQueue();
    queues.set(deps.workspaceService, queue);
  }
  return queue(workspace.id, async () => {
    // Recheck after waiting for a slot: a provider may have recovered its reference.
    if (overrides.forget) {
      const current = await deps.workspaceService.get(workspace.id);
      if (!current || current.deleted_at) return;
      assertWorkspaceDeleteAllowed(current);
      if (
        current.provider_state !== "provider_missing" ||
        current.execution_kind !== "remote" ||
        current.provider_ref_json ||
        current.root_path
      ) {
        throw new Error(
          "Only a remote workspace with a missing provider and no backing reference or local path can be forgotten.",
        );
      }
      await cancelWorkspaceSessions(deps, current.id);
      await finalizeWorkspaceDelete(deps, current);
      return;
    }
    assertWorkspaceDeleteAllowed(workspace);
    const remove = overrides.deleteProviderBackedWorkspace ?? deleteProviderBackedWorkspace;
    const removed = await remove(deps, workspace);
    await finalizeWorkspaceDelete(deps, workspace);
    if (removed && workspace.root_path) {
      const { anchors_json: _anchors, ...eventWorkspace } = { ...workspace, ...toExtensionWorkspace(workspace) };
      const fireRemoved = overrides.fireExtensionEventAsync ?? fireExtensionEventAsync;
      fireRemoved(deps, workspace.project_id, worktreeEvents.removed, {
        projectId: workspace.project_id,
        worktreePath: workspace.root_path,
        workspace: eventWorkspace,
        workspaceId: workspace.id,
      });
    }
  });
};
