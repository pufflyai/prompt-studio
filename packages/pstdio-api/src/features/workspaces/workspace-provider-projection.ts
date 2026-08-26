import type { WorkspaceProviderResult } from "pstdio-api-contracts/extension-kernel";
import type { WorkspacesRouteDeps } from "./deps";

export type WorkspaceRecord = NonNullable<Awaited<ReturnType<WorkspacesRouteDeps["workspaceService"]["get"]>>>;
export type WorkspaceProviderOperationKind = "create" | "cancel" | "archive" | "delete";

export const projectionBase = (workspace: WorkspaceRecord) => ({
  branch: workspace.branch,
  worktree_path: workspace.worktree_path,
  provider_ref_json: workspace.provider_ref_json,
  execution_kind: workspace.execution_kind,
  provider_capabilities_json: workspace.provider_capabilities_json,
  display_path: workspace.display_path,
});

export const providerError = (input: { code: string; message: string; retryable: boolean }) => ({
  ...input,
  occurred_at: new Date().toISOString(),
});

export const resultError = (error: WorkspaceProviderResult["error"]) =>
  error ? providerError({ code: error.code, message: error.message, retryable: error.retryable }) : null;

export const missingProviderPatch = (workspace: WorkspaceRecord) => ({
  ...projectionBase(workspace),
  provider_state: "provider_missing" as const,
  provider_operation_id: workspace.provider_operation_id,
  provider_operation_kind: workspace.provider_operation_kind,
  provider_error_json: providerError({
    code: "provider_unavailable",
    message: `Workspace provider is not available: ${workspace.provider_id}`,
    retryable: true,
  }),
});

export const failedOperationPatch = (
  workspace: WorkspaceRecord,
  input: {
    kind: WorkspaceProviderOperationKind;
    operationId: string;
    state: "failed" | "provisioning" | "archiving" | "deleting";
    error: unknown;
  },
) => ({
  ...projectionBase(workspace),
  provider_state: input.state,
  provider_operation_id: input.operationId,
  provider_operation_kind: input.kind,
  provider_error_json: providerError({
    code: `provider_${input.kind}_failed`,
    message: input.error instanceof Error ? input.error.message : String(input.error),
    retryable: true,
  }),
});

export const operationSettlementPatch = (result: WorkspaceProviderResult) => {
  const retryableFailure = result.state === "failed" && result.error?.retryable === true;
  const pending = result.state === "provisioning" || result.state === "archiving" || result.state === "deleting";
  if (pending || retryableFailure || result.state === "provider_missing") return {};
  return { provider_operation_id: null, provider_operation_kind: null };
};
