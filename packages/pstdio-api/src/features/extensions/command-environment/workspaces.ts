import {
  type CreateExtensionWorkspaceInput,
  type ExtensionWorkspace,
  type WorkspaceProviderRef,
  worktreeEvents,
} from "pstdio-api-contracts/extension-kernel";
import { type CommandRunnerEnvironment, createReadBoundary } from "pstdio-extensions";
import { removeWorkspaceWorktree } from "../../workspaces/remove-workspace-worktree";
import { listWorkspaceProviders } from "../../workspaces/workspace-provider-catalog";
import {
  assertWorkspaceDeleteAllowed,
  cancelProviderBackedWorkspace,
  deleteProviderBackedWorkspace,
  finalizeWorkspaceDelete,
} from "../../workspaces/workspace-provider-lifecycle";
import {
  createProviderBackedWorkspace,
  resolveWorkspaceExecutionTarget,
} from "../../workspaces/workspace-provider-service";
import { cleanupWorkspaceWorktree } from "../../workspaces/worktree-cleanup";
import type { ExtensionsRouteDeps } from "../deps";
import { fireExtensionEventAsync } from "../extension-event-runtime";
import type { CommandEnvironmentRuntimeDeps } from "./types";

type WorkspaceRecord = NonNullable<Awaited<ReturnType<ExtensionsRouteDeps["workspaceService"]["get"]>>>;
type LocalExecutionTarget = Awaited<ReturnType<typeof resolveWorkspaceExecutionTarget>>;

const projectedExecutionTarget = (
  workspace: WorkspaceRecord,
  localTarget: LocalExecutionTarget,
  providerRef: WorkspaceProviderRef | null,
) => {
  if (workspace.execution_kind === "local") {
    if (!localTarget) return undefined;
    return {
      kind: "local" as const,
      rootPath: localTarget.root,
      displayPath: workspace.display_path ?? undefined,
    };
  }
  if (!providerRef) return undefined;
  return {
    kind: "remote" as const,
    providerId: workspace.provider_id,
    providerRef,
    displayPath: workspace.display_path ?? undefined,
  };
};

export const createExtensionWorkspace = async (
  deps: ExtensionsRouteDeps,
  input: {
    projectId: string;
    workspaceInput: CreateExtensionWorkspaceInput;
    signal?: AbortSignal;
  },
  runtimeDeps: CommandEnvironmentRuntimeDeps,
) => {
  if (input.workspaceInput.project_id && input.workspaceInput.project_id !== input.projectId) {
    throw new Error("Workspace project must match the command project.");
  }
  const projectId = input.projectId;
  const anchors = input.workspaceInput.anchors ?? [];
  const shorthandBase = input.workspaceInput.shorthand_base;
  if (!shorthandBase) throw new Error("Workspace creation requires shorthand_base");

  const workspace = await createProviderBackedWorkspace(deps, {
    projectId,
    shorthandBase,
    anchors,
    providerId: input.workspaceInput.provider_id ?? "pstdio.worktree",
    params: input.workspaceInput.params,
    setupWorktree: runtimeDeps.setupWorkspaceWorktree,
    provision: (workspace, repoPath) => runtimeDeps.runWorkspaceProvisioning(deps, { projectId, workspace, repoPath }),
    signal: input.signal,
  });
  return workspace as ExtensionWorkspace;
};

export const createWorkspacesApi = (
  deps: ExtensionsRouteDeps,
  input: { projectId: string; signal?: AbortSignal },
  runtimeDeps: CommandEnvironmentRuntimeDeps,
): CommandRunnerEnvironment["workspaces"] => {
  const read = createReadBoundary(input.signal);
  const getScopedWorkspace = async (id: string) => {
    const workspace = await deps.workspaceService.get(id);
    return workspace?.project_id === input.projectId ? workspace : null;
  };
  const requireScopedWorkspace = async (id: string) => {
    const workspace = await getScopedWorkspace(id);
    if (!workspace) throw new Error(`Workspace not found: ${id}`);
    return workspace;
  };
  const projectWorkspace = async (workspace: WorkspaceRecord, _signal?: AbortSignal) => workspace as ExtensionWorkspace;
  const projectOptionalWorkspace = async (workspace: WorkspaceRecord | null) =>
    workspace ? projectWorkspace(workspace, input.signal) : null;

  const deleteWorkspace = async (id: string) => {
    const workspace = await requireScopedWorkspace(id);
    assertWorkspaceDeleteAllowed(workspace);
    const remove = runtimeDeps.deleteProviderBackedWorkspace ?? deleteProviderBackedWorkspace;
    const removed = await remove(deps, workspace);
    await finalizeWorkspaceDelete(deps, workspace);
    if (removed && workspace.root_path) {
      const { anchors_json: _anchors, ...eventWorkspace } = workspace;
      const fireRemoved = runtimeDeps.fireExtensionEventAsync ?? fireExtensionEventAsync;
      fireRemoved(deps, workspace.project_id, worktreeEvents.removed, {
        projectId: workspace.project_id,
        worktreePath: workspace.root_path,
        workspace: eventWorkspace as ExtensionWorkspace,
        workspaceId: workspace.id,
      });
    }
  };

  return {
    listProviders: () => read(() => listWorkspaceProviders(deps, input.projectId)),
    getDefault: async () =>
      read(async () => projectOptionalWorkspace(await read(() => deps.workspaceService.getDefault(input.projectId)))),
    list: async () =>
      read(async () =>
        Promise.all(
          (await read(() => deps.workspaceService.list(input.projectId))).map((workspace) =>
            projectWorkspace(workspace, input.signal),
          ),
        ),
      ),
    get: async (id) => read(async () => projectOptionalWorkspace(await read(() => getScopedWorkspace(id)))),
    getByShorthand: async (shorthand) =>
      read(async () =>
        projectOptionalWorkspace(await read(() => deps.workspaceService.getByShorthand(input.projectId, shorthand))),
      ),
    create: async (workspaceInput) => {
      input.signal?.throwIfAborted();
      const workspace = await createExtensionWorkspace(
        deps,
        { projectId: input.projectId, workspaceInput, signal: input.signal },
        runtimeDeps,
      );
      input.signal?.throwIfAborted();
      return projectWorkspace(workspace as WorkspaceRecord);
    },
    addAnchors: async (id, anchors) => {
      await requireScopedWorkspace(id);
      await deps.workspaceService.addAnchors(id, anchors);
    },
    removeAnchors: async (id, refs) => {
      await requireScopedWorkspace(id);
      await deps.workspaceService.removeAnchors(id, refs);
    },
    resolve: async (id) => {
      const workspace = await read(() => requireScopedWorkspace(id));
      const localTarget = await read(() => resolveWorkspaceExecutionTarget(deps, id));
      const providerRef = workspace.provider_ref_json as WorkspaceProviderRef | null;
      if (workspace.execution_kind === "remote" && !providerRef) {
        throw new Error(`Workspace provider reference not found: ${id}`);
      }
      if (workspace.execution_kind === "local" && workspace.provider_state === "ready" && !localTarget) {
        throw new Error(`Local workspace execution target is not available: ${id}`);
      }
      const executionTarget = projectedExecutionTarget(workspace, localTarget, providerRef);
      return {
        ...(providerRef ? { providerRef } : {}),
        state: workspace.provider_state,
        executionKind: workspace.execution_kind,
        ...(executionTarget ? { executionTarget } : {}),
        displayPath: workspace.display_path ?? undefined,
        capabilities: workspace.provider_capabilities_json,
        error: workspace.provider_error_json
          ? {
              code: workspace.provider_error_json.code,
              message: workspace.provider_error_json.message,
              retryable: workspace.provider_error_json.retryable,
            }
          : undefined,
      };
    },
    cancel: async (id) => {
      const workspace = await requireScopedWorkspace(id);
      return projectWorkspace(await cancelProviderBackedWorkspace(deps, workspace));
    },
    archive: async (id) => {
      const workspace = await requireScopedWorkspace(id);
      await deleteWorkspace(id);
      return { ...workspace, deleted_at: new Date().toISOString() } as ExtensionWorkspace;
    },
    removeWorktree: async (id) => {
      const workspace = await requireScopedWorkspace(id);
      const removed = await removeWorkspaceWorktree(deps, workspace, {
        cleanup: runtimeDeps.cleanupWorkspaceWorktree ?? cleanupWorkspaceWorktree,
        fireEvent: runtimeDeps.fireExtensionEventAsync ?? fireExtensionEventAsync,
      });
      return { removed };
    },
    delete: deleteWorkspace,
  };
};
