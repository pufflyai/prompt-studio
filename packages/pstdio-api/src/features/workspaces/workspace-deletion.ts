import { worktreeEvents } from "pstdio-api-contracts/extension-kernel";
import { fireExtensionEventAsync } from "../extensions/extension-event-runtime";
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
  const pending = new Map<string, { forget: boolean; task: Promise<void> }>();

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

  return (
    id: string,
    forget: boolean,
    afterMaintenance: (remove: () => Promise<void>) => Promise<void>,
    remove: () => Promise<void>,
  ) => {
    const existing = pending.get(id);
    if (existing) {
      if (existing.forget !== forget) {
        return Promise.reject(new Error("Workspace deletion is already in progress with a different deletion mode."));
      }
      return existing.task;
    }
    const task = afterMaintenance(() => run(remove)).finally(() => pending.delete(id));
    pending.set(id, { forget, task });
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
  // A maintenance owner must not join an already busy target's deletion queue.
  try {
    deps.workspaceService.maintenance.assertCanDelete(workspace.id);
  } catch (error) {
    return Promise.reject(error);
  }
  let queue = queues.get(deps.workspaceService);
  if (!queue) {
    queue = createDeletionQueue();
    queues.set(deps.workspaceService, queue);
  }
  const removeOwnedWorkspace = async () => {
    // Capabilities and backing fields can change while waiting for the gate or a slot.
    const current = await deps.workspaceService.get(workspace.id);
    if (!current || current.project_id !== workspace.project_id) return;
    if (overrides.forget) {
      if (!current.deleted_at) {
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
      }
      await finalizeWorkspaceDelete(deps, current, { forget: true });
      return;
    }
    if (current.deleted_at) return;
    assertWorkspaceDeleteAllowed(current);
    const remove = overrides.deleteProviderBackedWorkspace ?? deleteProviderBackedWorkspace;
    const removed = await remove(deps, current);
    await finalizeWorkspaceDelete(deps, current);
    if (removed && current.root_path) {
      const { anchors_json: _anchors, ...eventWorkspace } = { ...current, ...toExtensionWorkspace(current) };
      const fireRemoved = overrides.fireExtensionEventAsync ?? fireExtensionEventAsync;
      fireRemoved(deps, current.project_id, worktreeEvents.removed, {
        projectId: current.project_id,
        worktreePath: current.root_path,
        workspace: eventWorkspace,
        workspaceId: current.id,
      });
    }
  };
  return queue(
    workspace.id,
    overrides.forget === true,
    (remove) => deps.workspaceService.maintenance.runExclusive(workspace.id, remove),
    removeOwnedWorkspace,
  );
};
