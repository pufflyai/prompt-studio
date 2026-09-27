import type { JsonObject, WorkspaceProviderRef, WorkspaceProviderResult } from "pstdio-api-contracts/extension-kernel";
import { defaultLocalWorkspaceCapabilities, folderWorkspaceCapabilities } from "pstdio-db";
import type { WorkspacesRouteDeps } from "./deps";
import {
  isBuiltInProviderId,
  remoteReadOnlyCapabilities,
  rootProviderId,
  worktreeProviderId,
} from "./workspace-provider-identity";
import { handOffLateCreateProjection, updateCreateProjection } from "./workspace-provider-operation-projection";
import {
  cancelledProviderPatch,
  failedOperationPatch,
  missingProviderPatch,
  pendingCreateCancellationPatch,
  providerError,
  type WorkspaceRecord,
} from "./workspace-provider-projection";
import { normalizeResult } from "./workspace-provider-result";
import { findWorkspaceProvider, runWorkspaceProviderCall } from "./workspace-provider-runtime";
import type { setupWorkspaceWorktree } from "./worktree-setup";

const asString = (value: unknown) => (typeof value === "string" && value.trim() ? value : undefined);

const safeProviderRef = (providerId: string, data: JsonObject) => ({
  version: 1 as const,
  data: { providerId, ...data },
});

const builtInCreate = async (input: {
  providerId: string;
  workspace: WorkspaceRecord;
  params: JsonObject;
  sourcePath: string;
  setupWorktree: typeof setupWorkspaceWorktree;
}) => {
  if (input.providerId === rootProviderId) {
    return {
      providerRef: safeProviderRef(rootProviderId, {}),
      state: "ready",
      executionKind: "local",
      executionTarget: { kind: "local", rootPath: input.sourcePath, displayPath: input.sourcePath },
      displayPath: input.sourcePath,
      capabilities: folderWorkspaceCapabilities,
    } satisfies WorkspaceProviderResult;
  }
  const result = await input.setupWorktree({
    repoPath: input.sourcePath,
    workspaceShorthand: input.workspace.workspace_shorthand,
    workspaceId: input.workspace.id,
    base: asString(input.params.base) ?? "HEAD",
  });
  return {
    providerRef: safeProviderRef(worktreeProviderId, {
      sourceRoot: result.sourceRoot,
      worktreeRoot: result.worktreePath,
      relativePath: result.relativePath,
    }),
    branch: result.branch,
    state: "ready",
    executionKind: "local",
    executionTarget: { kind: "local", rootPath: result.rootPath, displayPath: result.rootPath },
    displayPath: result.rootPath,
    capabilities: defaultLocalWorkspaceCapabilities,
  } satisfies WorkspaceProviderResult;
};

const persistCancelledCreate = (deps: WorkspacesRouteDeps, workspace: WorkspaceRecord) =>
  deps.workspaceService.updateProviderProjection(workspace.id, cancelledProviderPatch(workspace));

const cleanUpAcceptedCreate = async (
  deps: WorkspacesRouteDeps,
  input: {
    handle: NonNullable<Awaited<ReturnType<typeof findWorkspaceProvider>>>;
    projectId: string;
    providerId: string;
    createOperationId: string;
    workspace: WorkspaceRecord;
  },
) => {
  const providerRef = input.workspace.provider_ref_json as WorkspaceProviderRef | null;
  if (!providerRef) {
    const patch = pendingCreateCancellationPatch(
      input.workspace,
      input.workspace.provider_operation_id ?? input.createOperationId,
      new Error("The accepted provider create did not return a reference."),
    );
    return (await updateCreateProjection(deps, input.workspace, input.createOperationId, patch)).workspace;
  }

  const operationKind = input.handle.provider.delete && !input.handle.provider.cancel ? "delete" : "cancel";
  const pendingState = operationKind === "cancel" ? "provisioning" : "deleting";
  const pending = await deps.workspaceService.beginProviderOperation(input.workspace.id, {
    operationId: crypto.randomUUID(),
    kind: operationKind,
    state: pendingState,
  });
  if (!pending) return input.workspace;
  if (pending.provider_operation_kind !== operationKind || !pending.provider_operation_id) return pending;
  const operationId = pending.provider_operation_id;

  try {
    if (input.handle.provider.cancel) {
      const cancelled = await runWorkspaceProviderCall(() =>
        input.handle.provider.cancel!(input.handle.context, {
          operationId,
          projectId: input.projectId,
          workspaceId: input.workspace.id,
          providerRef,
        }),
      );
      const patch = cancelled
        ? normalizeResult(input.providerId, cancelled, { providerRef })
        : cancelledProviderPatch(pending);
      return (await deps.workspaceService.updateProviderProjection(input.workspace.id, patch)) ?? pending;
    }
    if (input.handle.provider.delete) {
      await runWorkspaceProviderCall(() =>
        input.handle.provider.delete!(input.handle.context, {
          operationId,
          projectId: input.projectId,
          workspaceId: input.workspace.id,
          providerRef,
        }),
      );
    } else {
      throw new Error(`Workspace provider cannot clean up its accepted create: ${input.providerId}`);
    }
    return (await persistCancelledCreate(deps, pending)) ?? pending;
  } catch (error) {
    return (
      (await deps.workspaceService.updateProviderProjection(
        pending.id,
        failedOperationPatch(pending, { kind: operationKind, operationId, state: pendingState, error }),
      )) ?? pending
    );
  }
};

export const PROVIDER_READY_TIMEOUT_MS = 60_000;
const PROVIDER_READY_POLL_MS = 250;

const waitForProviderPoll = (signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, PROVIDER_READY_POLL_MS);
    signal?.addEventListener("abort", onAbort, { once: true });
  });

const waitForNextProviderResolution = async (signal?: AbortSignal) => {
  try {
    await waitForProviderPoll(signal);
    return true;
  } catch (error) {
    if (signal?.aborted) return false;
    throw error;
  }
};

const resolveAcceptedCreate = async (
  deps: WorkspacesRouteDeps,
  input: {
    handle: NonNullable<Awaited<ReturnType<typeof findWorkspaceProvider>>>;
    operationId: string;
    projectId: string;
    signal?: AbortSignal;
    workspace: WorkspaceRecord;
  },
) => {
  let current = input.workspace;
  const deadline = Date.now() + PROVIDER_READY_TIMEOUT_MS;
  while (current.provider_state === "provisioning" && current.provider_ref_json && Date.now() < deadline) {
    if (input.signal?.aborted) return current;
    try {
      const result = await runWorkspaceProviderCall(
        () =>
          input.handle.provider.resolve(input.handle.context, {
            projectId: input.projectId,
            workspaceId: current.id,
            providerRef: current.provider_ref_json as WorkspaceProviderRef,
          }),
        { signal: input.signal },
      );
      const projection = await updateCreateProjection(
        deps,
        current,
        input.operationId,
        normalizeResult(current.provider_id, result, {
          providerRef: current.provider_ref_json as WorkspaceProviderRef,
        }),
      );
      current = projection.workspace;
      if (!projection.applied) return current;
    } catch (error) {
      if (input.signal?.aborted) return current;
      return (
        await updateCreateProjection(
          deps,
          current,
          input.operationId,
          failedOperationPatch(current, {
            kind: "create",
            operationId: input.operationId,
            state: "failed",
            error,
          }),
        )
      ).workspace;
    }
    if (current.provider_state === "provisioning") {
      if (!(await waitForNextProviderResolution(input.signal))) return current;
    }
  }
  if (current.provider_state !== "provisioning") return current;
  return (
    await updateCreateProjection(
      deps,
      current,
      input.operationId,
      failedOperationPatch(current, {
        kind: "create",
        operationId: input.operationId,
        state: "failed",
        error: new Error("Workspace provider did not become ready before the deadline."),
      }),
    )
  ).workspace;
};

export const provisionProviderWorkspace = async (
  deps: WorkspacesRouteDeps,
  input: {
    operationId: string;
    projectId: string;
    providerId: string;
    params: JsonObject;
    sourcePath: string | null;
    setupWorktree: typeof setupWorkspaceWorktree;
    signal?: AbortSignal;
    workspace: WorkspaceRecord;
  },
) => {
  try {
    input.signal?.throwIfAborted();
    const builtIn = isBuiltInProviderId(input.providerId);
    const handle = builtIn
      ? null
      : await findWorkspaceProvider(deps, {
          projectId: input.projectId,
          providerId: input.providerId,
          workspaceId: input.workspace.id,
        });
    if (!builtIn && !handle) {
      return (
        await updateCreateProjection(deps, input.workspace, input.operationId, {
          ...missingProviderPatch(input.workspace),
          execution_kind: "remote",
          provider_capabilities_json: remoteReadOnlyCapabilities,
        })
      ).workspace;
    }

    const result = handle
      ? await runWorkspaceProviderCall(() =>
          handle.provider.create(handle.context, {
            operationId: input.operationId,
            projectId: input.projectId,
            workspaceId: input.workspace.id,
            params: input.params,
            signal: input.signal,
          }),
        )
      : await builtInCreate({
          providerId: input.providerId,
          workspace: input.workspace,
          params: input.params,
          sourcePath: input.sourcePath!,
          setupWorktree: input.setupWorktree,
        });

    const normalized = normalizeResult(input.providerId, result);
    const resultPatch = {
      ...normalized,
      branch: normalized.branch ?? input.workspace.branch,
    };
    const projection = await updateCreateProjection(deps, input.workspace, input.operationId, resultPatch);
    if (!projection.applied) return handOffLateCreateProjection(deps, projection.workspace, resultPatch);
    let persisted = projection.workspace;
    if (handle && persisted.provider_state === "provisioning" && persisted.provider_ref_json) {
      persisted = await resolveAcceptedCreate(deps, {
        handle,
        operationId: input.operationId,
        projectId: input.projectId,
        signal: input.signal,
        workspace: persisted,
      });
    }
    if (!input.signal?.aborted || !handle) return persisted;
    return cleanUpAcceptedCreate(deps, {
      ...input,
      createOperationId: input.operationId,
      handle,
      workspace: persisted,
    });
  } catch (error) {
    if (input.signal?.aborted) {
      const patch = pendingCreateCancellationPatch(input.workspace, input.operationId, error);
      return (await updateCreateProjection(deps, input.workspace, input.operationId, patch)).workspace;
    }
    return (
      await updateCreateProjection(deps, input.workspace, input.operationId, {
        ...failedOperationPatch(input.workspace, {
          kind: "create",
          operationId: input.operationId,
          state: "failed",
          error,
        }),
        ...(isBuiltInProviderId(input.providerId)
          ? {
              provider_error_json: providerError({
                code: "provider_create_failed",
                message: error instanceof Error ? error.message : String(error),
                retryable: true,
              }),
            }
          : {}),
        execution_kind: isBuiltInProviderId(input.providerId) ? "local" : "remote",
        provider_capabilities_json: remoteReadOnlyCapabilities,
      })
    ).workspace;
  }
};
