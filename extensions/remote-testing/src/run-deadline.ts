import { type Api, canRetryControllerRequest, readControllerWithRetry } from "./connection";
import type { RunRecord } from "./runs";

// Source transfer and result collection already share this allowance in the signed URLs.
// The command timer starts after source installation, not at request submission.
export const TRANSFER_ALLOWANCE_SECONDS = 1800;
const RECEIPT_READ_MS = 30_000;

export const runDeadline = (record: RunRecord) =>
  Date.parse(record.startedAt) + (record.timeoutSeconds + TRANSFER_ALLOWANCE_SECONDS) * 1000;

function boundedSignal(timeout: number, signal?: AbortSignal) {
  const deadline = AbortSignal.timeout(Math.max(1, timeout));
  return { deadline, bounded: signal ? AbortSignal.any([signal, deadline]) : deadline };
}

const missingSubmission = (record: RunRecord, error: unknown) =>
  record.submissionPending && error && typeof error === "object" && "status" in error && error.status === 404;

async function finalRead<T>(api: Api, path: string, record: RunRecord, signal?: AbortSignal, onMissing?: () => void) {
  const { deadline, bounded } = boundedSignal(RECEIPT_READ_MS, signal);
  try {
    return await api<T>({ method: "GET", path, signal: bounded });
  } catch (error) {
    signal?.throwIfAborted();
    if (missingSubmission(record, error)) {
      onMissing?.();
      return null;
    }
    if (deadline.aborted || canRetryControllerRequest(error)) return null;
    throw error;
  }
}

export async function readRunReceipt<T>(
  api: Api,
  path: string,
  record: RunRecord,
  signal: AbortSignal | undefined,
  retryTransient: boolean,
  onMissing?: () => void,
) {
  const remaining = runDeadline(record) - Date.now();
  // A completed receipt wins over a local timeout, including at the boundary.
  if (remaining <= 0) return finalRead<T>(api, path, record, signal, onMissing);
  const { deadline, bounded } = boundedSignal(remaining, signal);
  try {
    return retryTransient
      ? await readControllerWithRetry<T>(api, path, bounded)
      : await api<T>({ method: "GET", path, signal: bounded });
  } catch (error) {
    signal?.throwIfAborted();
    if (missingSubmission(record, error)) {
      onMissing?.();
      return null;
    }
    if (Date.now() >= runDeadline(record) && (deadline.aborted || canRetryControllerRequest(error)))
      return finalRead<T>(api, path, record, signal, onMissing);
    throw error;
  }
}
