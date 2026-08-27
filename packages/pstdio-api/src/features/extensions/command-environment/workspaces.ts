import {
  type CreateExtensionWorkspaceInput,
  type ExtensionWorkspace,
  type WorkspaceProviderRef,
  worktreeEvents,
} from "pstdio-api-contracts/extension-kernel";
import type { CommandRunnerEnvironment } from "pstdio-extensions";
import { archiveWorkspaceCascade } from "../../workspaces/archive-workspace-cascade";
import {
  assertWorkspaceDeleteAllowed,
  cancelProviderBackedWorkspace,
  deleteProviderBackedWorkspace,
} from "../../workspaces/workspace-provider-lifecycle";
import {
  createProviderBackedWorkspace,
  resolveWorkspaceExecutionTarget,
} from "../../workspaces/workspace-provider-service";
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
    providerId: input.workspaceInput.provider_id,
    params: input.workspaceInput.params,
    repoId: input.workspaceInput.repo_id,
    base: input.workspaceInput.base,
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
  const getProjectWorkspace = async (id: string) => {
    const workspace = await deps.workspaceService.get(id);
    return workspace?.project_id === input.projectId ? workspace : null;
  };
  return {
    list: async () => (await deps.workspaceService.list(input.projectId)) as ExtensionWorkspace[],
    get: async (id) => (await getProjectWorkspace(id)) as ExtensionWorkspace | null,
    getByShorthand: async (shorthand) =>
      (await deps.workspaceService.getByShorthand(input.projectId, shorthand)) as ExtensionWorkspace | null,
    create: async (workspaceInput) => {
      input.signal?.throwIfAborted();
      const workspace = await createExtensionWorkspace(
        deps,
        { projectId: input.projectId, workspaceInput, signal: input.signal },
        runtimeDeps,
      );
      input.signal?.throwIfAborted();
      return workspace as ExtensionWorkspace;
    },
    resolve: async (id) => {
      const workspace = await getProjectWorkspace(id);
      if (!workspace) throw new Error(`Workspace not found: ${id}`);
      const localTarget = await resolveWorkspaceExecutionTarget(deps, id);
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
      const workspace = await getProjectWorkspace(id);
      if (!workspace) throw new Error(`Workspace not found: ${id}`);
      return (await cancelProviderBackedWorkspace(deps, workspace)) as ExtensionWorkspace;
    },
    archive: async (id) => {
      const workspace = await getProjectWorkspace(id);
      // Cascade archive: also archive the workspace's sessions and remove its worktree.
      if (workspace) return (await archiveWorkspaceCascade(deps, workspace)) as ExtensionWorkspace;
      throw new Error(`Workspace not found: ${id}`);
    },
    delete: async (id) => {
      const workspace = await getProjectWorkspace(id);
      if (!workspace) throw new Error(`Workspace not found: ${id}`);
      assertWorkspaceDeleteAllowed(workspace);
      const remove = runtimeDeps.deleteProviderBackedWorkspace ?? deleteProviderBackedWorkspace;
      const removed = await remove(deps, workspace);
      await deps.workspaceService.softDelete(id);
      if (removed && workspace.worktree_path) {
        const { anchors_json: _anchors, ...eventWorkspace } = workspace;
        const fireRemoved = runtimeDeps.fireExtensionEventAsync ?? fireExtensionEventAsync;
        fireRemoved(deps, workspace.project_id, worktreeEvents.removed, {
          projectId: workspace.project_id,
          worktreePath: workspace.worktree_path,
          workspace: eventWorkspace as ExtensionWorkspace,
          workspaceId: workspace.id,
        });
      }
    },
  };
};
