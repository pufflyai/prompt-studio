import type { JsonObject, WorkspaceProviderRef, WorkspaceProviderResult } from "pstdio-api-contracts/extension-kernel";
import type { WorkspacesRouteDeps } from "./deps";
import { finalizeWorkspaceArchive } from "./workspace-provider-lifecycle";
import {
  failedOperationPatch,
  missingProviderPatch,
  projectionBase,
  type WorkspaceProviderOperationKind,
  type WorkspaceRecord,
} from "./workspace-provider-projection";
import {
  findWorkspaceProvider,
  runWorkspaceProviderCall,
  type WorkspaceProviderHandle,
} from "./workspace-provider-runtime";
import { isBuiltInProviderId, normalizeResult } from "./workspace-provider-service";

type ReconciliationOptions = { signal?: AbortSignal; providerTimeoutMs?: number };

const pendingStateFor = (kind: WorkspaceProviderOperationKind) => {
  if (kind === "archive") return "archiving" as const;
  if (kind === "delete") return "deleting" as const;
  if (kind === "create") return "failed" as const;
  return "provisioning" as const;
};

const updateResult = async (deps: WorkspacesRouteDeps, workspace: WorkspaceRecord, result: WorkspaceProviderResult) => {
  const updated =
    (await deps.workspaceService.updateProviderProjection(
      workspace.id,
      normalizeResult(workspace.provider_id, result, {
        providerRef: workspace.provider_ref_json as unknown as WorkspaceProviderRef,
      }),
    )) ?? workspace;
  if (updated.provider_state === "archived") await finalizeWorkspaceArchive(deps, updated);
};

const settleWithoutProviderMethod = async (
  deps: WorkspacesRouteDeps,
  workspace: WorkspaceRecord,
  state: "cancelled" | "archived",
) => {
  const updated =
    (await deps.workspaceService.updateProviderProjection(workspace.id, {
      ...projectionBase(workspace),
      provider_state: state,
      provider_operation_id: null,
      provider_operation_kind: null,
      provider_error_json: null,
    })) ?? workspace;
  if (state === "archived") await finalizeWorkspaceArchive(deps, updated);
};

const reconcileStoredOperation = async (
  deps: WorkspacesRouteDeps,
  workspace: WorkspaceRecord,
  handle: WorkspaceProviderHandle,
  options: ReconciliationOptions,
) => {
  const kind = workspace.provider_operation_kind;
  const operationId = workspace.provider_operation_id;
  if (!kind || !operationId) return false;

  if (kind === "create" && !workspace.provider_ref_json) {
    const result = await runWorkspaceProviderCall(
      () =>
        handle.provider.create(handle.context, {
          operationId,
          projectId: workspace.project_id,
          workspaceId: workspace.id,
          params: workspace.provider_params_json as JsonObject,
        }),
      { signal: options.signal, timeoutMs: options.providerTimeoutMs },
    );
    await updateResult(deps, workspace, result);
    return true;
  }

  if (kind === "cancel") {
    if (!handle.provider.cancel || !workspace.provider_ref_json) {
      await settleWithoutProviderMethod(deps, workspace, "cancelled");
      return true;
    }
    const result = await runWorkspaceProviderCall(
      () =>
        handle.provider.cancel!(handle.context, {
          operationId,
          projectId: workspace.project_id,
          workspaceId: workspace.id,
          providerRef: workspace.provider_ref_json as WorkspaceProviderRef,
        }),
      { signal: options.signal, timeoutMs: options.providerTimeoutMs },
    );
    await updateResult(deps, workspace, result);
    return true;
  }

  if (kind === "archive") {
    if (!handle.provider.archive || !workspace.provider_ref_json) {
      await settleWithoutProviderMethod(deps, workspace, "archived");
      return true;
    }
    const result = await runWorkspaceProviderCall(
      () =>
        handle.provider.archive!(handle.context, {
          operationId,
          projectId: workspace.project_id,
          workspaceId: workspace.id,
          providerRef: workspace.provider_ref_json as WorkspaceProviderRef,
        }),
      { signal: options.signal, timeoutMs: options.providerTimeoutMs },
    );
    await updateResult(deps, workspace, result);
    return true;
  }

  if (kind !== "delete") return false;
  if (handle.provider.delete && workspace.provider_ref_json) {
    await runWorkspaceProviderCall(
      () =>
        handle.provider.delete!(handle.context, {
          operationId,
          projectId: workspace.project_id,
          workspaceId: workspace.id,
          providerRef: workspace.provider_ref_json as WorkspaceProviderRef,
        }),
      { signal: options.signal, timeoutMs: options.providerTimeoutMs },
    );
  }
  await deps.workspaceService.softDelete(workspace.id);
  return true;
};

const reconcileWorkspace = async (
  deps: WorkspacesRouteDeps,
  workspace: WorkspaceRecord,
  options: ReconciliationOptions,
) => {
  const handle = await findWorkspaceProvider(deps, {
    projectId: workspace.project_id,
    providerId: workspace.provider_id,
    workspaceId: workspace.id,
    workspaceDir: workspace.execution_kind === "local" ? (workspace.worktree_path ?? undefined) : undefined,
  });
  if (!handle) {
    if (workspace.provider_operation_kind === "delete") await deps.workspaceService.softDelete(workspace.id);
    else await deps.workspaceService.updateProviderProjection(workspace.id, missingProviderPatch(workspace));
    return;
  }

  if (await reconcileStoredOperation(deps, workspace, handle, options)) return;
  if (!workspace.provider_ref_json) return;
  const result = await runWorkspaceProviderCall(
    () =>
      handle.provider.resolve(handle.context, {
        projectId: workspace.project_id,
        workspaceId: workspace.id,
        providerRef: workspace.provider_ref_json as WorkspaceProviderRef,
      }),
    { signal: options.signal, timeoutMs: options.providerTimeoutMs },
  );
  await updateResult(deps, workspace, result);
};

export const reconcileProviderWorkspaces = async (
  deps: WorkspacesRouteDeps,
  projectId: string,
  options: ReconciliationOptions = {},
) => {
  const workspaces = await deps.workspaceService.listForProviderReconciliation(projectId);
  const pending = workspaces.filter(
    (workspace) =>
      !isBuiltInProviderId(workspace.provider_id) &&
      (workspace.provider_operation_id !== null ||
        workspace.provider_state === "provisioning" ||
        workspace.provider_state === "archiving" ||
        workspace.provider_state === "deleting" ||
        (workspace.provider_error_json?.retryable === true &&
          (workspace.provider_state === "failed" || workspace.provider_state === "provider_missing"))),
  );

  await Promise.allSettled(
    pending.map(async (workspace) => {
      if (options.signal?.aborted) return;
      try {
        await reconcileWorkspace(deps, workspace, options);
      } catch (error) {
        const kind = workspace.provider_operation_kind ?? "create";
        await deps.workspaceService.updateProviderProjection(
          workspace.id,
          failedOperationPatch(workspace, {
            kind,
            operationId: workspace.provider_operation_id ?? crypto.randomUUID(),
            state: pendingStateFor(kind),
            error,
          }),
        );
      }
    }),
  );
};
