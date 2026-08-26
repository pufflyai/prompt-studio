import type { JsonObject, WorkspaceProviderRef, WorkspaceTypeProvider } from "pstdio-api-contracts/extension-kernel";
import type { WorkspacesRouteDeps } from "./deps";
import { findExtensionProvider, isBuiltInProviderId, normalizeResult } from "./workspace-provider-service";
import { cleanupWorkspaceWorktree } from "./worktree-cleanup";

type WorkspaceRecord = NonNullable<Awaited<ReturnType<WorkspacesRouteDeps["workspaceService"]["get"]>>>;
type OperationKind = "cancel" | "archive" | "delete";

// Deps needed by lifecycle mutations. Narrower than WorkspacesRouteDeps so
// flows like the archive cascade can call in without the full route bundle.
export type WorkspaceProviderLifecycleDeps = Pick<
  WorkspacesRouteDeps,
  "workspaceService" | "repoService" | "extensionRuntimeCatalog"
>;

// Snapshot of the fields updateProviderProjection would otherwise reset.
const projectionBase = (workspace: WorkspaceRecord) => ({
  branch: workspace.branch,
  worktree_path: workspace.worktree_path,
  provider_ref_json: workspace.provider_ref_json,
  execution_kind: workspace.execution_kind,
  provider_capabilities_json: workspace.provider_capabilities_json,
  display_path: workspace.display_path,
});

const missingProviderProjection = (deps: WorkspaceProviderLifecycleDeps, workspace: WorkspaceRecord) =>
  deps.workspaceService.updateProviderProjection(workspace.id, {
    ...projectionBase(workspace),
    provider_state: "provider_missing",
    provider_error_json: {
      code: "provider_unavailable",
      message: `Workspace provider is not available: ${workspace.provider_id}`,
      retryable: true,
      occurred_at: new Date().toISOString(),
    },
  });

// Persist the operation before the provider call so a lost response can be
// retried with the same idempotency key. A stored operation of the same kind
// is reused instead of minting a new key.
const persistOperation = async (
  deps: WorkspaceProviderLifecycleDeps,
  workspace: WorkspaceRecord,
  kind: OperationKind,
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
  });
  return operationId;
};

const failedOperationProjection = (
  deps: WorkspaceProviderLifecycleDeps,
  workspace: WorkspaceRecord,
  input: {
    kind: OperationKind | "create";
    operationId: string;
    state: "provisioning" | "archiving" | "deleting";
    error: unknown;
  },
) =>
  deps.workspaceService.updateProviderProjection(workspace.id, {
    ...projectionBase(workspace),
    provider_state: input.state,
    provider_operation_id: input.operationId,
    provider_operation_kind: input.kind,
    provider_error_json: {
      code: `provider_${input.kind}_failed`,
      message: input.error instanceof Error ? input.error.message : String(input.error),
      retryable: true,
      occurred_at: new Date().toISOString(),
    },
  });

const runProviderMutation = async (
  deps: WorkspaceProviderLifecycleDeps,
  workspace: WorkspaceRecord,
  input: {
    kind: OperationKind;
    pendingState: "provisioning" | "archiving" | "deleting";
    mutate: (mutationInput: {
      operationId: string;
      projectId: string;
      workspaceId: string;
      providerRef: WorkspaceProviderRef;
    }) => ReturnType<WorkspaceTypeProvider["resolve"]> | Promise<void>;
    fallbackState: "cancelled" | "archived";
  },
) => {
  const providerRef = workspace.provider_ref_json as WorkspaceProviderRef;
  const operationId = await persistOperation(deps, workspace, input.kind, input.pendingState);
  try {
    const result = await input.mutate({
      operationId,
      projectId: workspace.project_id,
      workspaceId: workspace.id,
      providerRef,
    });
    const normalized = result
      ? normalizeResult(workspace.provider_id, result)
      : { ...projectionBase(workspace), provider_state: input.fallbackState };
    return (await deps.workspaceService.updateProviderProjection(workspace.id, normalized)) ?? workspace;
  } catch (error) {
    return (
      (await failedOperationProjection(deps, workspace, {
        kind: input.kind,
        operationId,
        state: input.pendingState,
        error,
      })) ?? workspace
    );
  }
};

export const archiveProviderBackedWorkspace = async (
  deps: WorkspaceProviderLifecycleDeps,
  workspace: WorkspaceRecord,
) => {
  if (isBuiltInProviderId(workspace.provider_id)) {
    await cleanupWorkspaceWorktree(deps, workspace);
    return (
      (await deps.workspaceService.updateProviderProjection(workspace.id, {
        ...projectionBase(workspace),
        provider_state: "archived",
      })) ?? workspace
    );
  }

  const provider = await findExtensionProvider(
    deps as WorkspacesRouteDeps,
    workspace.project_id,
    workspace.provider_id,
  );
  if (!provider) return (await missingProviderProjection(deps, workspace)) ?? workspace;
  if (!provider.archive || !workspace.provider_ref_json) {
    return (
      (await deps.workspaceService.updateProviderProjection(workspace.id, {
        ...projectionBase(workspace),
        provider_state: "archived",
      })) ?? workspace
    );
  }

  return runProviderMutation(deps, workspace, {
    kind: "archive",
    pendingState: "archiving",
    mutate: (mutationInput) => provider.archive!({} as never, mutationInput),
    fallbackState: "archived",
  });
};

export const cancelProviderBackedWorkspace = async (
  deps: WorkspaceProviderLifecycleDeps,
  workspace: WorkspaceRecord,
) => {
  const provider = isBuiltInProviderId(workspace.provider_id)
    ? undefined
    : await findExtensionProvider(deps as WorkspacesRouteDeps, workspace.project_id, workspace.provider_id);
  if (!provider?.cancel || !workspace.provider_ref_json) {
    return (
      (await deps.workspaceService.updateProviderProjection(workspace.id, {
        ...projectionBase(workspace),
        provider_state: "cancelled",
      })) ?? workspace
    );
  }

  return runProviderMutation(deps, workspace, {
    kind: "cancel",
    pendingState: "provisioning",
    mutate: (mutationInput) => provider.cancel!({} as never, mutationInput),
    fallbackState: "cancelled",
  });
};

// Returns true when a local worktree was removed so callers can fire the
// worktree-removed extension event.
export const deleteProviderBackedWorkspace = async (
  deps: WorkspaceProviderLifecycleDeps,
  workspace: WorkspaceRecord,
) => {
  if (isBuiltInProviderId(workspace.provider_id)) {
    return cleanupWorkspaceWorktree(deps, workspace);
  }

  const provider = await findExtensionProvider(
    deps as WorkspacesRouteDeps,
    workspace.project_id,
    workspace.provider_id,
  );
  if (!provider) {
    await missingProviderProjection(deps, workspace);
    throw new Error(`Workspace provider is not available: ${workspace.provider_id}`);
  }
  if (!provider.delete || !workspace.provider_ref_json) return false;

  const operationId = await persistOperation(deps, workspace, "delete", "deleting");
  try {
    await provider.delete({} as never, {
      operationId,
      projectId: workspace.project_id,
      workspaceId: workspace.id,
      providerRef: workspace.provider_ref_json as WorkspaceProviderRef,
    });
    return false;
  } catch (error) {
    await failedOperationProjection(deps, workspace, { kind: "delete", operationId, state: "deleting", error });
    throw error;
  }
};

const reconcilableStates = new Set(["provisioning", "archiving", "deleting"]);

const reconcileWorkspace = async (deps: WorkspacesRouteDeps, workspace: WorkspaceRecord) => {
  const provider = await findExtensionProvider(deps, workspace.project_id, workspace.provider_id);
  if (!provider) {
    await missingProviderProjection(deps, workspace);
    return;
  }

  // A pending create with no stored reference means the create response was
  // lost. Repeat it with the same idempotency key instead of resolving.
  if (
    workspace.provider_operation_kind === "create" &&
    workspace.provider_operation_id &&
    !workspace.provider_ref_json
  ) {
    const result = await provider.create({} as never, {
      operationId: workspace.provider_operation_id,
      projectId: workspace.project_id,
      workspaceId: workspace.id,
      params: workspace.provider_params_json as JsonObject,
    });
    await deps.workspaceService.updateProviderProjection(workspace.id, normalizeResult(workspace.provider_id, result));
    return;
  }

  if (!workspace.provider_ref_json) return;
  const result = await provider.resolve({} as never, {
    projectId: workspace.project_id,
    workspaceId: workspace.id,
    providerRef: workspace.provider_ref_json as WorkspaceProviderRef,
  });
  await deps.workspaceService.updateProviderProjection(workspace.id, normalizeResult(workspace.provider_id, result));
};

// Startup reconciliation: retry lost mutations and refresh non-terminal
// provider state. Failures stay on the row for the next pass; they never
// block startup.
export const reconcileProviderWorkspaces = async (deps: WorkspacesRouteDeps, projectId: string) => {
  const workspaces = await deps.workspaceService.list(projectId);
  const pending = workspaces.filter(
    (workspace) =>
      !isBuiltInProviderId(workspace.provider_id) &&
      (workspace.provider_operation_id !== null || reconcilableStates.has(workspace.provider_state)),
  );

  for (const workspace of pending) {
    try {
      await reconcileWorkspace(deps, workspace);
    } catch (error) {
      await failedOperationProjection(deps, workspace, {
        kind: workspace.provider_operation_kind ?? "create",
        operationId: workspace.provider_operation_id ?? crypto.randomUUID(),
        state: reconcilableStates.has(workspace.provider_state)
          ? (workspace.provider_state as "provisioning" | "archiving" | "deleting")
          : "provisioning",
        error,
      });
    }
  }
};
