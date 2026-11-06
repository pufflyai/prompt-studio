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
    code?: unknown;
    retryable?: boolean;
    data?: { retryable?: boolean; cancelledBarrierId?: string };
    cancelledBarrierId?: string;
    message?: string;
  };
  const cancelledBarrierId = value?.cancelledBarrierId ?? value?.data?.cancelledBarrierId;
  const code =
    typeof value?.code === "string" ? value.code.replace(/^native_document_/, "").replace(/^native_/, "") : undefined;
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

/** A local refusal can retire a replica while canonical Yjs history keeps the same seed. */
export const assertTextGeneration = (generation: string | undefined, expected: string | undefined) => {
  if (generation !== expected)
    throw textEditingFailure(
      "source_retired",
      "This local text replica has been retired; its edits remain recoverable",
    );
};

export const createTextGenerationFence = (expected: string | undefined) => {
  let retired = false;
  return {
    retire() {
      retired = true;
    },
    accept(snapshot: TextWireSnapshot, failed: (error: unknown) => void) {
      if (retired) return false;
      try {
        assertTextGeneration(snapshot.generation, expected);
        return true;
      } catch (error) {
        retired = true;
        failed(error);
        return false;
      }
    },
  };
};

export const textEditingBlocked = (error: TextEditingError | undefined) =>
  error && !error.retryable && error.code !== "draft_active" && error.code !== "projection_failed";

export const assertTextEditingWrite = (state: { editable: boolean; error?: TextEditingError }, closing: boolean) => {
  if (closing) throw textEditingFailure("session_closed", "This text session is closing");
  if (!state.editable) throw textEditingFailure("source_read_only", "The text source is read only");
  if (textEditingBlocked(state.error)) throw state.error;
};
