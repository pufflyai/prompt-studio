import type { JsonObject, WorkspaceProviderRef, WorkspaceProviderResult } from "pstdio-api-contracts/extension-kernel";
import type { WorkspacesRouteDeps } from "./deps";
import { getAcceptedProviderOperation, getLiveProviderWorkspace } from "./workspace-provider-accepted-operation";
import { finalizeWorkspaceDelete } from "./workspace-provider-lifecycle";
import { missingProviderPatch, projectionBase, type WorkspaceRecord } from "./workspace-provider-projection";
import {
  pendingStateFor,
  recordProviderRecoveryFailure,
  updateReconciledProjection,
} from "./workspace-provider-recovery-projection";
import {
  findWorkspaceProvider,
  runWorkspaceProviderOperation,
  type WorkspaceProviderHandle,
} from "./workspace-provider-runtime";
import { isBuiltInProviderId, normalizeResult } from "./workspace-provider-service";

type ReconciliationOptions = {
  workspaceId?: string;
  signal?: AbortSignal;
  providerTimeoutMs?: number;
  retryUntilReadyMs?: number;
  retryDelayMs?: number;
};

const listReconciliationWorkspaces = async (deps: WorkspacesRouteDeps, projectId: string, workspaceId?: string) => {
  const workspaces = await deps.workspaceService.listForProviderReconciliation(projectId);
  return workspaceId ? workspaces.filter((workspace) => workspace.id === workspaceId) : workspaces;
};

const updateResult = async (deps: WorkspacesRouteDeps, workspace: WorkspaceRecord, result: WorkspaceProviderResult) => {
  const updated = await updateReconciledProjection(deps, workspace, {
    ...normalizeResult(workspace.provider_id, result, {
      providerRef: workspace.provider_ref_json as unknown as WorkspaceProviderRef,
    }),
    ...(result.state === "cancelled" ? { root_path: null, branch: null, display_path: null } : {}),
  });
  if (updated?.provider_state === "archived") await finalizeWorkspaceDelete(deps, updated);
};

const settleWithoutProviderMethod = async (
  deps: WorkspacesRouteDeps,
  workspace: WorkspaceRecord,
  state: "cancelled" | "archived",
) => {
  const updated = await updateReconciledProjection(deps, workspace, {
    ...projectionBase(workspace),
    provider_state: state,
    provider_operation_id: null,
    provider_operation_kind: null,
    provider_error_json: null,
    ...(state === "cancelled" ? { root_path: null, branch: null, display_path: null } : {}),
  });
  if (updated && state === "archived") await finalizeWorkspaceDelete(deps, updated);
};

const reconcileCancellation = async (
  deps: WorkspacesRouteDeps,
  workspace: WorkspaceRecord,
  handle: WorkspaceProviderHandle,
  operationId: string,
  options: ReconciliationOptions,
) => {
  if (!handle.provider.cancel) {
    if (!handle.provider.delete) {
      throw new Error(`Workspace provider cannot clean up its cancelled create: ${workspace.provider_id}`);
    }
    await runWorkspaceProviderOperation(
      handle,
      (ctx) =>
        handle.provider.delete!(ctx, {
          operationId,
          projectId: workspace.project_id,
          workspaceId: workspace.id,
          providerRef: workspace.provider_ref_json as WorkspaceProviderRef,
        }),
      { signal: options.signal, timeoutMs: options.providerTimeoutMs },
    );
    await settleWithoutProviderMethod(deps, workspace, "cancelled");
    return;
  }
  const result = await runWorkspaceProviderOperation(
    handle,
    (ctx) =>
      handle.provider.cancel!(ctx, {
        operationId,
        projectId: workspace.project_id,
        workspaceId: workspace.id,
        providerRef: workspace.provider_ref_json as WorkspaceProviderRef,
      }),
    { signal: options.signal, timeoutMs: options.providerTimeoutMs },
  );
  await updateResult(deps, workspace, result);
};

const recoverProviderReference = async (
  deps: WorkspacesRouteDeps,
  workspace: WorkspaceRecord,
  handle: WorkspaceProviderHandle,
  options: ReconciliationOptions,
) => {
  const current = await getAcceptedProviderOperation(deps, workspace);
  if (!current) return;
  if (current.provider_ref_json) return current;
  const kind = current.provider_operation_kind!;
  const operationId = current.provider_operation_id!;
  const result = await runWorkspaceProviderOperation(
    handle,
    (ctx, signal) =>
      handle.provider.create(ctx, {
        operationId,
        projectId: current.project_id,
        workspaceId: current.id,
        params: current.provider_params_json as JsonObject,
        signal,
      }),
    { signal: options.signal, timeoutMs: options.providerTimeoutMs },
  );
  if (kind === "create") {
    await updateResult(deps, current, result);
    return;
  }
  const normalized = normalizeResult(current.provider_id, result);
  const recoveredReference = normalized.provider_ref_json ?? null;
  return (
    (await deps.workspaceService.updateProviderOperationProjection(current.id, {
      operationId,
      operationKind: kind,
      patch: {
        ...normalized,
        provider_state: pendingStateFor(kind),
        provider_operation_id: recoveredReference ? crypto.randomUUID() : operationId,
        provider_operation_kind: kind,
      },
    })) ?? undefined
  );
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

  if (!workspace.provider_ref_json) {
    const recovered = await recoverProviderReference(deps, workspace, handle, options);
    if (!recovered?.provider_ref_json) return true;
    return reconcileStoredOperation(deps, recovered, handle, options);
  }

  if (kind === "cancel") {
    await reconcileCancellation(deps, workspace, handle, operationId, options);
    return true;
  }

  if (kind !== "delete" && kind !== "archive") return false;
  if (!handle.provider.delete || !workspace.provider_ref_json) {
    throw new Error(`Workspace provider cannot finish remote deletion: ${workspace.provider_id}`);
  }
  await runWorkspaceProviderOperation(
    handle,
    (ctx) =>
      handle.provider.delete!(ctx, {
        operationId,
        projectId: workspace.project_id,
        workspaceId: workspace.id,
        providerRef: workspace.provider_ref_json as WorkspaceProviderRef,
      }),
    { signal: options.signal, timeoutMs: options.providerTimeoutMs },
  );
  await finalizeWorkspaceDelete(deps, workspace);
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
    workspaceDir: workspace.execution_kind === "local" ? (workspace.root_path ?? undefined) : undefined,
  });
  if (!handle) {
    await updateReconciledProjection(deps, workspace, missingProviderPatch(workspace));
    return;
  }

  if (await reconcileStoredOperation(deps, workspace, handle, options)) return;
  if (!workspace.provider_ref_json) return;
  const result = await runWorkspaceProviderOperation(
    handle,
    (ctx) =>
      handle.provider.resolve(ctx, {
        projectId: workspace.project_id,
        workspaceId: workspace.id,
        providerRef: workspace.provider_ref_json as WorkspaceProviderRef,
      }),
    { signal: options.signal, timeoutMs: options.providerTimeoutMs },
  );
  // The provider may have been disabled while its resolve callback was running.
  // A late ready result must not restore execution through that old handle.
  if (
    !(await findWorkspaceProvider(deps, {
      projectId: workspace.project_id,
      providerId: workspace.provider_id,
      workspaceId: workspace.id,
    }))
  ) {
    await updateReconciledProjection(deps, workspace, missingProviderPatch(workspace));
    return;
  }
  await updateResult(deps, workspace, result);
};

const needsRecoveryRetry = (workspace: WorkspaceRecord) =>
  workspace.provider_operation_id !== null ||
  workspace.provider_state === "provisioning" ||
  workspace.provider_state === "archiving" ||
  workspace.provider_state === "deleting" ||
  (workspace.provider_error_json?.retryable === true &&
    (workspace.provider_state === "failed" || workspace.provider_state === "provider_missing"));

const needsProviderReconciliation = (workspace: WorkspaceRecord) =>
  !isBuiltInProviderId(workspace.provider_id) &&
  ((workspace.provider_state === "ready" && workspace.provider_ref_json !== null) || needsRecoveryRetry(workspace));

const waitForRecoveryRetry = (delayMs: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    signal?.addEventListener("abort", onAbort, { once: true });
  });

const reconcileProviderWorkspacePass = async (
  deps: WorkspacesRouteDeps,
  projectId: string,
  options: ReconciliationOptions,
) => {
  const workspaces = await listReconciliationWorkspaces(deps, projectId, options.workspaceId);
  const pending = workspaces.filter(needsProviderReconciliation);

  await Promise.allSettled(
    pending.map((candidate) =>
      deps.workspaceService.maintenance.run(candidate.id, async () => {
        if (options.signal?.aborted) return;
        // Deletion and file provisioning own this same gate. Re-read after waiting so a
        // previously discovered ready target cannot allocate files after its deletion.
        const workspace = await getLiveProviderWorkspace(deps, { id: candidate.id, project_id: projectId });
        if (!workspace || !needsProviderReconciliation(workspace)) return;
        try {
          await reconcileWorkspace(deps, workspace, options);
        } catch (error) {
          await recordProviderRecoveryFailure(deps, workspace, error);
        }
      }),
    ),
  );
};

export const reconcileProviderWorkspaces = async (
  deps: WorkspacesRouteDeps,
  projectId: string,
  options: ReconciliationOptions = {},
) => {
  const deadline = Date.now() + (options.retryUntilReadyMs ?? 0);
  while (!options.signal?.aborted) {
    await reconcileProviderWorkspacePass(deps, projectId, options);
    if (Date.now() >= deadline) return;
    const workspaces = await listReconciliationWorkspaces(deps, projectId, options.workspaceId);
    if (!workspaces.some((workspace) => !isBuiltInProviderId(workspace.provider_id) && needsRecoveryRetry(workspace))) {
      return;
    }
    try {
      await waitForRecoveryRetry(options.retryDelayMs ?? 250, options.signal);
    } catch {
      return;
    }
  }
};
