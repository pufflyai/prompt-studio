import type { WorkspaceProviderRef, WorkspaceProviderResult } from "pstdio-api-contracts/extension-kernel";
import type { WorkspacesRouteDeps } from "./deps";
import {
  failedOperationPatch,
  missingProviderPatch,
  projectionBase,
  type WorkspaceProviderOperationKind,
  type WorkspaceRecord,
} from "./workspace-provider-projection";
import { findWorkspaceProvider, runWorkspaceProviderCall } from "./workspace-provider-runtime";
import { isBuiltInProviderId, normalizeResult } from "./workspace-provider-service";
import { cleanupWorkspaceWorktree } from "./worktree-cleanup";

export type WorkspaceProviderLifecycleDeps = WorkspacesRouteDeps;

const updateMissingProvider = (deps: WorkspaceProviderLifecycleDeps, workspace: WorkspaceRecord) =>
  deps.workspaceService.updateProviderProjection(workspace.id, missingProviderPatch(workspace));

const persistOperation = async (
  deps: WorkspaceProviderLifecycleDeps,
  workspace: WorkspaceRecord,
  kind: WorkspaceProviderOperationKind,
  state: "provisioning" | "archiving" | "deleting",
) => {
  const operationId =
    workspace.provider_operation_kind === kind && workspace.provider_operation_id
      ? workspace.provider_operation_id
      : crypto.randomUUID();
  await deps.workspaceService.updateProviderProjection(workspace.id, {
    ...projectionBase(workspace),
    provider_state: state,
    provider_operation_id: operationId,
    provider_operation_kind: kind,
    provider_error_json: null,
  });
  return operationId;
};

const updateFailedOperation = (
  deps: WorkspaceProviderLifecycleDeps,
  workspace: WorkspaceRecord,
  input: {
    kind: WorkspaceProviderOperationKind;
    operationId: string;
    state: "failed" | "provisioning" | "archiving" | "deleting";
    error: unknown;
  },
) => deps.workspaceService.updateProviderProjection(workspace.id, failedOperationPatch(workspace, input));

const providerHandle = (deps: WorkspaceProviderLifecycleDeps, workspace: WorkspaceRecord) =>
  findWorkspaceProvider(deps, {
    projectId: workspace.project_id,
    providerId: workspace.provider_id,
    workspaceId: workspace.id,
    workspaceDir: workspace.execution_kind === "local" ? (workspace.worktree_path ?? undefined) : undefined,
  });

const runProviderMutation = async (
  deps: WorkspaceProviderLifecycleDeps,
  workspace: WorkspaceRecord,
  input: {
    kind: Exclude<WorkspaceProviderOperationKind, "create" | "delete">;
    pendingState: "provisioning" | "archiving";
    mutate: (input: {
      operationId: string;
      projectId: string;
      workspaceId: string;
      providerRef: WorkspaceProviderRef;
    }) => Promise<WorkspaceProviderResult> | WorkspaceProviderResult;
    fallbackState: "cancelled" | "archived";
    operationId?: string;
  },
) => {
  const operationId = input.operationId ?? (await persistOperation(deps, workspace, input.kind, input.pendingState));
  try {
    const result = await runWorkspaceProviderCall(() =>
      input.mutate({
        operationId,
        projectId: workspace.project_id,
        workspaceId: workspace.id,
        providerRef: workspace.provider_ref_json as WorkspaceProviderRef,
      }),
    );
    const normalized = result
      ? normalizeResult(workspace.provider_id, result, {
          providerRef: workspace.provider_ref_json as unknown as WorkspaceProviderRef,
        })
      : {
          ...projectionBase(workspace),
          provider_state: input.fallbackState,
          provider_operation_id: null,
          provider_operation_kind: null,
          provider_error_json: null,
        };
    return (await deps.workspaceService.updateProviderProjection(workspace.id, normalized)) ?? workspace;
  } catch (error) {
    return (
      (await updateFailedOperation(deps, workspace, {
        kind: input.kind,
        operationId,
        state: input.pendingState,
        error,
      })) ?? workspace
    );
  }
};

export const finalizeWorkspaceArchive = async (deps: WorkspaceProviderLifecycleDeps, workspace: WorkspaceRecord) => {
  const sessions = await deps.workspaceSessionService.listByWorkspace(workspace.id);
  await Promise.all(
    sessions.filter((session) => !session.archived).map((session) => deps.sessionService.archive(session.id)),
  );
  return (await deps.workspaceService.archive(workspace.id)) ?? workspace;
};

export const archiveProviderBackedWorkspace = async (
  deps: WorkspaceProviderLifecycleDeps,
  workspace: WorkspaceRecord,
) => {
  let updated: WorkspaceRecord;
  if (isBuiltInProviderId(workspace.provider_id)) {
    await cleanupWorkspaceWorktree(deps, workspace);
    updated =
      (await deps.workspaceService.updateProviderProjection(workspace.id, {
        ...projectionBase(workspace),
        provider_state: "archived",
        provider_operation_id: null,
        provider_operation_kind: null,
        provider_error_json: null,
      })) ?? workspace;
  } else {
    const operationId = await persistOperation(deps, workspace, "archive", "archiving");
    const pending = {
      ...workspace,
      provider_state: "archiving" as const,
      provider_operation_id: operationId,
      provider_operation_kind: "archive" as const,
      provider_error_json: null,
    };
    const handle = await providerHandle(deps, pending);
    if (!handle) return (await updateMissingProvider(deps, pending)) ?? pending;
    if (!handle.provider.archive || !pending.provider_ref_json) {
      updated =
        (await deps.workspaceService.updateProviderProjection(pending.id, {
          ...projectionBase(pending),
          provider_state: "archived",
          provider_operation_id: null,
          provider_operation_kind: null,
          provider_error_json: null,
        })) ?? pending;
    } else {
      updated = await runProviderMutation(deps, pending, {
        kind: "archive",
        pendingState: "archiving",
        mutate: (input) => handle.provider.archive!(handle.context, input),
        fallbackState: "archived",
        operationId,
      });
    }
  }

  return updated.provider_state === "archived" ? finalizeWorkspaceArchive(deps, updated) : updated;
};

export const cancelProviderBackedWorkspace = async (
  deps: WorkspaceProviderLifecycleDeps,
  workspace: WorkspaceRecord,
) => {
  if (workspace.provider_state !== "provisioning") return workspace;

  const builtIn = isBuiltInProviderId(workspace.provider_id);
  const operationId = builtIn ? null : await persistOperation(deps, workspace, "cancel", "provisioning");
  const pending = operationId
    ? {
        ...workspace,
        provider_operation_id: operationId,
        provider_operation_kind: "cancel" as const,
        provider_error_json: null,
      }
    : workspace;
  const handle = builtIn ? undefined : await providerHandle(deps, pending);
  if (!builtIn && !handle) return (await updateMissingProvider(deps, pending)) ?? pending;
  if (!handle?.provider.cancel || !workspace.provider_ref_json) {
    return (
      (await deps.workspaceService.updateProviderProjection(workspace.id, {
        ...projectionBase(workspace),
        provider_state: "cancelled",
        provider_operation_id: null,
        provider_operation_kind: null,
        provider_error_json: null,
      })) ?? workspace
    );
  }

  return runProviderMutation(deps, pending, {
    kind: "cancel",
    pendingState: "provisioning",
    mutate: (input) => handle.provider.cancel!(handle.context, input),
    fallbackState: "cancelled",
    operationId: operationId ?? undefined,
  });
};

export const deleteProviderBackedWorkspace = async (
  deps: WorkspaceProviderLifecycleDeps,
  workspace: WorkspaceRecord,
) => {
  if (isBuiltInProviderId(workspace.provider_id)) return cleanupWorkspaceWorktree(deps, workspace);

  const handle = await providerHandle(deps, workspace);
  if (!handle?.provider.delete || !workspace.provider_ref_json) return false;

  const operationId = await persistOperation(deps, workspace, "delete", "deleting");
  try {
    await runWorkspaceProviderCall(() =>
      handle.provider.delete!(handle.context, {
        operationId,
        projectId: workspace.project_id,
        workspaceId: workspace.id,
        providerRef: workspace.provider_ref_json as WorkspaceProviderRef,
      }),
    );
    return false;
  } catch (error) {
    await updateFailedOperation(deps, workspace, { kind: "delete", operationId, state: "deleting", error });
    throw error;
  }
};
