import type { TextEditingError, TextEditingErrorCode } from "pstdio-api-contracts/extension-kernel";
export const textFailure = (
  code: TextEditingErrorCode,
  message: string,
  retryable = false,
  cancelledBarrierId?: string,
) =>
  Object.assign(new Error(message), {
    code,
    retryable,
    data: { retryable, ...(cancelledBarrierId ? { cancelledBarrierId } : {}) },
  });
const aliases: Record<string, TextEditingErrorCode> = {
  native_document_source_invalid: "invalid_frame",
  native_document_invalid_frame: "invalid_frame",
  native_document_missing_history: "missing_history",
  native_document_source_unavailable: "source_unavailable",
  native_document_view_unavailable: "source_unavailable",
  native_document_load_failed: "source_unavailable",
  native_document_source_changed: "source_changed",
  native_document_not_editable: "source_read_only",
  storage_revision_changed: "source_changed",
  native_source_retired: "source_retired",
  native_source_recovery: "recovery_required",
  native_source_pending: "source_unavailable",
};
export const textError = (error: unknown): TextEditingError => {
  const value = error as {
    code?: string;
    message?: string;
    retryable?: boolean;
    cancelledBarrierId?: string;
    data?: { cancelledBarrierId?: string };
  };
  const cancelledBarrierId = value?.cancelledBarrierId ?? value?.data?.cancelledBarrierId;
  const code = aliases[value?.code ?? ""] ?? value?.code ?? "source_unavailable";
  const known = new Set([
    "capability_denied",
    "grant_invalid",
    "connection_expired",
    "connection_reset",
    "source_unavailable",
    "source_read_only",
    "source_retired",
    "source_changed",
    "missing_history",
    "recovery_required",
    "invalid_frame",
    "projection_failed",
    "session_closed",
    "draft_active",
  ]);
  return {
    ...(cancelledBarrierId ? { cancelledBarrierId } : {}),
    code: (known.has(code) ? code : "source_unavailable") as TextEditingErrorCode,
    message: value?.message ?? String(error),
    retryable:
      value?.retryable ??
      (code === "source_unavailable" || value?.code === "storage_revision_changed" || code === "projection_failed"),
  };
};
export const throwTextError = (error: unknown): never => {
  const failure = textError(error);
  throw textFailure(failure.code, failure.message, failure.retryable, failure.cancelledBarrierId);
};
