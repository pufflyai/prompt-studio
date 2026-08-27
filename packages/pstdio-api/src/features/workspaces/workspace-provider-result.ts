import type { WorkspaceProviderRef, WorkspaceProviderResult } from "pstdio-api-contracts/extension-kernel";
import type { WorkspacesRouteDeps } from "./deps";
import { isBuiltInProviderId, remoteReadOnlyCapabilities } from "./workspace-provider-identity";
import { operationSettlementPatch, providerError, resultError } from "./workspace-provider-projection";

const MAX_PROVIDER_VALUE_DEPTH = 32;
const MAX_PROVIDER_REF_BYTES = 64 * 1024;
const MAX_PROVIDER_CAPABILITIES_BYTES = 4 * 1024;
const MAX_PROVIDER_DISPLAY_PATH_BYTES = 2 * 1024;
const textEncoder = new TextEncoder();
type ProviderProjectionPatch = Parameters<WorkspacesRouteDeps["workspaceService"]["updateProviderProjection"]>[1];

const containsSensitiveKey = (key: string) => {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (["authorization", "password", "passwd", "secret", "token", "credential", "credentials"].includes(normalized)) {
    return true;
  }
  if (normalized.includes("secret") || normalized.includes("password") || normalized.includes("privatekey"))
    return true;
  if (/(?:access|auth|bearer|identity|refresh|session)token/.test(normalized)) return true;
  if (/(?:api|auth|access)key/.test(normalized)) return true;
  return normalized.includes("credential") && !normalized.endsWith("credentialid");
};

const inspectProviderValue = (root: unknown, maxBytes: number) => {
  const seen = new WeakSet<object>();
  const pending = [{ value: root, depth: 0 }];

  while (pending.length > 0) {
    const entry = pending.pop()!;
    if (!entry.value || typeof entry.value !== "object") continue;
    if (entry.depth > MAX_PROVIDER_VALUE_DEPTH || seen.has(entry.value)) return "invalid" as const;
    seen.add(entry.value);

    for (const [key, child] of Object.entries(entry.value)) {
      if (containsSensitiveKey(key)) return "secret" as const;
      pending.push({ value: child, depth: entry.depth + 1 });
    }
  }

  try {
    return textEncoder.encode(JSON.stringify(root)).byteLength > maxBytes ? ("too_large" as const) : null;
  } catch {
    return "invalid" as const;
  }
};

const invalidResult = (executionKind: WorkspaceProviderResult["executionKind"], inspection: string) => ({
  provider_state: "failed" as const,
  execution_kind: executionKind,
  worktree_path: null,
  provider_error_json: providerError(
    inspection === "secret"
      ? {
          code: "provider_result_contains_secret",
          message: "Provider result contains secret fields.",
          retryable: false,
        }
      : {
          code: inspection === "too_large" ? "provider_result_too_large" : "provider_result_invalid",
          message:
            inspection === "too_large"
              ? "Provider result exceeds the supported size."
              : "Provider result is inconsistent, cyclic, or exceeds the supported depth.",
          retryable: false,
        },
  ),
  provider_capabilities_json: remoteReadOnlyCapabilities,
  display_path: null,
});

const inspectProviderResult = (result: WorkspaceProviderResult) => {
  const target = result.executionTarget;
  return (
    inspectProviderValue(result.providerRef, MAX_PROVIDER_REF_BYTES) ??
    inspectProviderValue(target?.kind === "remote" ? target.providerRef : null, MAX_PROVIDER_REF_BYTES) ??
    inspectProviderValue(result.capabilities, MAX_PROVIDER_CAPABILITIES_BYTES) ??
    inspectProviderValue(result.error, MAX_PROVIDER_DISPLAY_PATH_BYTES) ??
    (textEncoder.encode(result.displayPath ?? "").byteLength > MAX_PROVIDER_DISPLAY_PATH_BYTES ? "too_large" : null)
  );
};

const hasInconsistentExecutionTarget = (
  providerId: string,
  result: WorkspaceProviderResult,
  providerRef: WorkspaceProviderRef | null | undefined,
) => {
  const target = result.executionTarget;
  if (target && target.kind !== result.executionKind) return true;
  if (target?.kind === "remote" && target.providerId !== providerId) return true;
  if (result.executionKind === "local" && result.state === "ready") {
    if (target?.kind !== "local" || !target.rootPath.trim()) return true;
    if (!isBuiltInProviderId(providerId) && !providerRef) return true;
  }
  return false;
};

export const normalizeResult = (
  providerId: string,
  result: WorkspaceProviderResult,
  options: { providerRef?: WorkspaceProviderRef | null } = {},
): ProviderProjectionPatch => {
  const target = result.executionTarget;
  const inspection = inspectProviderResult(result);
  if (inspection) {
    return invalidResult(result.executionKind, inspection);
  }

  const localRoot = target?.kind === "local" ? target.rootPath : null;
  const providerRef = result.providerRef ?? (target?.kind === "remote" ? target.providerRef : options.providerRef);
  if (hasInconsistentExecutionTarget(providerId, result, providerRef)) {
    return invalidResult(result.executionKind, "invalid");
  }
  if (
    result.executionKind === "remote" &&
    !providerRef &&
    result.state !== "cancelled" &&
    result.state !== "archived"
  ) {
    return {
      provider_state: "failed" as const,
      execution_kind: "remote" as const,
      worktree_path: null,
      provider_error_json: providerError({
        code: "provider_ref_missing",
        message: "Remote workspace provider result is missing its provider reference.",
        retryable: true,
      }),
      provider_capabilities_json: result.capabilities,
      display_path: result.displayPath ?? null,
    };
  }
  const displayPath =
    result.displayPath ??
    target?.displayPath ??
    (target?.kind === "remote" ? `${providerId} remote workspace` : localRoot);
  const normalized: ProviderProjectionPatch = {
    ...(result.branch !== undefined ? { branch: result.branch } : {}),
    ...(providerRef ? { provider_ref_json: providerRef } : {}),
    provider_state: result.state,
    execution_kind: result.executionKind,
    ...(target ? { worktree_path: localRoot } : {}),
    provider_error_json: resultError(result.error),
    provider_capabilities_json: result.capabilities,
    ...(displayPath ? { display_path: displayPath } : {}),
    ...operationSettlementPatch(result),
  };
  return normalized;
};
