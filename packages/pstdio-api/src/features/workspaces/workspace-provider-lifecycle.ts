import type { WorkspaceProviderRef, WorkspaceProviderResult } from "pstdio-api-contracts/extension-kernel";
import type { WorkspacesRouteDeps } from "./deps";
import {
  cancelledProviderPatch,
  failedOperationPatch,
  missingProviderPatch,
  pendingCreateCancellationPatch,
  projectionBase,
  type WorkspaceProviderOperationKind,
  type WorkspaceRecord,
} from "./workspace-provider-projection";
import { findWorkspaceProvider, runWorkspaceProviderCall } from "./workspace-provider-runtime";
import { isBuiltInProviderId, normalizeResult } from "./workspace-provider-service";
import { cleanupWorkspaceWorktree } from "./worktree-cleanup";

export type WorkspaceProviderLifecycleDeps = WorkspacesRouteDeps;

export const assertWorkspaceArchiveAllowed = (workspace: WorkspaceRecord) => {
  if (workspace.is_default) throw new Error("Default workspace cannot be archived.");
  if (!workspace.provider_capabilities_json.archive) {
    throw new Error("Workspace provider does not allow archiving.");
  }
};

export const assertWorkspaceDeleteAllowed = (workspace: WorkspaceRecord) => {
  if (workspace.is_default) throw new Error("Default workspace cannot be deleted.");
  if (!workspace.provider_capabilities_json.delete) {
    throw new Error("Workspace provider does not allow deletion.");
  }
};

const updateMissingProvider = (deps: WorkspaceProviderLifecycleDeps, workspace: WorkspaceRecord) =>
  deps.workspaceService.updateProviderProjection(workspace.id, missingProviderPatch(workspace));

const persistOperation = async (
  deps: WorkspaceProviderLifecycleDeps,
  workspace: WorkspaceRecord,
  kind: Exclude<WorkspaceProviderOperationKind, "create">,
  state: "provisioning" | "archiving" | "deleting",
) => {
  const pending = await deps.workspaceService.beginProviderOperation(workspace.id, {
    operationId: crypto.randomUUID(),
    kind,
    state,
  });
  if (!pending) throw new Error(`Workspace not found: ${workspace.id}`);
  if (pending.provider_operation_kind !== kind || !pending.provider_operation_id) {
    throw new Error(
      `Workspace provider operation already in progress: ${pending.provider_operation_kind ?? "unknown"}`,
    );
  }
  return pending;
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
  const pending = input.operationId
    ? workspace
    : await persistOperation(deps, workspace, input.kind, input.pendingState);
  const operationId = input.operationId ?? pending.provider_operation_id!;
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
  assertWorkspaceArchiveAllowed(workspace);
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
    const pending = await persistOperation(deps, workspace, "archive", "archiving");
    const operationId = pending.provider_operation_id!;
    const handle = await providerHandle(deps, pending);
    if (!handle) return (await updateMissingProvider(deps, pending)) ?? pending;
    if (!pending.provider_ref_json) return pending;
    if (!handle.provider.archive) {
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
  if (builtIn) {
    return (
      (await deps.workspaceService.updateProviderProjection(workspace.id, cancelledProviderPatch(workspace))) ??
      workspace
    );
  }
  if (!workspace.provider_ref_json) {
    const operationId = workspace.provider_operation_id ?? crypto.randomUUID();
    return (
      (await deps.workspaceService.updateProviderProjection(
        workspace.id,
        pendingCreateCancellationPatch(
          workspace,
          operationId,
          new Error("The accepted provider create has not returned a reference yet."),
        ),
      )) ?? workspace
    );
  }

  const pending = await persistOperation(deps, workspace, "cancel", "provisioning");
  const operationId = pending.provider_operation_id!;
  const handle = await providerHandle(deps, pending);
  if (!handle) return (await updateMissingProvider(deps, pending)) ?? pending;

  if (handle.provider.cancel) {
    return runProviderMutation(deps, pending, {
      kind: "cancel",
      pendingState: "provisioning",
      mutate: (input) => handle.provider.cancel!(handle.context, input),
      fallbackState: "cancelled",
      operationId,
    });
  }
  if (!handle.provider.delete) {
    const error = new Error(`Workspace provider cannot clean up its cancelled create: ${workspace.provider_id}`);
    return (
      (await updateFailedOperation(deps, pending, {
        kind: "cancel",
        operationId,
        state: "provisioning",
        error,
      })) ?? pending
    );
  }

  try {
    await runWorkspaceProviderCall(() =>
      handle.provider.delete!(handle.context, {
        operationId,
        projectId: workspace.project_id,
        workspaceId: workspace.id,
        providerRef: workspace.provider_ref_json as WorkspaceProviderRef,
      }),
    );
    return (
      (await deps.workspaceService.updateProviderProjection(workspace.id, cancelledProviderPatch(pending))) ?? pending
    );
  } catch (error) {
    return (
      (await updateFailedOperation(deps, pending, {
        kind: "cancel",
        operationId,
        state: "provisioning",
        error,
      })) ?? pending
    );
  }
};

export const cleanupProviderBackedWorkspace = async (
  deps: WorkspaceProviderLifecycleDeps,
  workspace: WorkspaceRecord,
) => {
  if (isBuiltInProviderId(workspace.provider_id)) return cleanupWorkspaceWorktree(deps, workspace);

  const pending = await persistOperation(deps, workspace, "delete", "deleting");
  const operationId = pending.provider_operation_id!;
  const handle = await providerHandle(deps, pending);
  if (!handle) {
    await updateMissingProvider(deps, pending);
    throw new Error(`Workspace provider is not available: ${workspace.provider_id}`);
  }
  if (!pending.provider_ref_json) {
    const error = new Error(`Workspace provider create reference is not available yet: ${workspace.provider_id}`);
    await updateFailedOperation(deps, pending, { kind: "delete", operationId, state: "deleting", error });
    throw error;
  }
  if (!handle.provider.delete) {
    const error = new Error(`Workspace provider cannot delete its remote resource: ${workspace.provider_id}`);
    await updateFailedOperation(deps, pending, { kind: "delete", operationId, state: "deleting", error });
    throw error;
  }
  try {
    await runWorkspaceProviderCall(() =>
      handle.provider.delete!(handle.context, {
        operationId,
        projectId: workspace.project_id,
        workspaceId: workspace.id,
        providerRef: pending.provider_ref_json as WorkspaceProviderRef,
      }),
    );
    return false;
  } catch (error) {
    await updateFailedOperation(deps, pending, { kind: "delete", operationId, state: "deleting", error });
    throw error;
  }
};

export const deleteProviderBackedWorkspace = async (
  deps: WorkspaceProviderLifecycleDeps,
  workspace: WorkspaceRecord,
) => {
  assertWorkspaceDeleteAllowed(workspace);
  return cleanupProviderBackedWorkspace(deps, workspace);
};
