import type { TextEditingError, TextEditingErrorCode, TextWireSnapshot } from "pstdio-api-contracts/extension-kernel";

export const encodeTextBytes = (bytes: Uint8Array) => {
  let value = "";
  for (let offset = 0; offset < bytes.length; offset += 32768)
    value += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  return btoa(value);
};
export const decodeTextBytes = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
export const decodeTextSnapshot = (value: TextWireSnapshot) => ({
  ...value,
  state: decodeTextBytes(value.state),
  sourceState: value.sourceState ? decodeTextBytes(value.sourceState) : undefined,
});
export const textEditingFailure = (code: TextEditingErrorCode, message: string, retryable = false) =>
  Object.assign(new Error(message), { code, retryable });
export const textEditingError = (error: unknown): TextEditingError => {
  const value = error as {
    code?: string;
    retryable?: boolean;
    data?: { retryable?: boolean; cancelledBarrierId?: string };
    cancelledBarrierId?: string;
    message?: string;
  };
  const cancelledBarrierId = value?.cancelledBarrierId ?? value?.data?.cancelledBarrierId;
  const code = value?.code?.replace(/^native_document_/, "").replace(/^native_/, "");
  const known = new Set<TextEditingErrorCode>([
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
    code: known.has(code as TextEditingErrorCode) ? (code as TextEditingErrorCode) : "source_unavailable",
    message: value?.message ?? String(error),
    retryable: value?.retryable ?? value?.data?.retryable ?? !known.has(code as TextEditingErrorCode),
  };
};
