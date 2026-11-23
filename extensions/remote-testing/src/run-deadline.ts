import { type Api, canRetryControllerRequest, readControllerWithRetry } from "./connection";
import type { RunRecord } from "./runs";

// Source transfer and result collection already share this allowance in the signed URLs.
// The command timer starts after source installation, not at request submission.
export const TRANSFER_ALLOWANCE_SECONDS = 1800;
const RECEIPT_READ_MS = 30_000;

export const runDeadline = (record: RunRecord) =>
  Date.parse(record.startedAt) + (record.timeoutSeconds + TRANSFER_ALLOWANCE_SECONDS) * 1000;

export async function readRunReceipt<T>(
  api: Api,
  path: string,
  record: RunRecord,
  signal: AbortSignal | undefined,
  retryTransient: boolean,
) {
  const remaining = runDeadline(record) - Date.now();
  // An overdue collector still reads once: a completed receipt beats a local timeout.
  const deadline = AbortSignal.timeout(Math.max(1, remaining > 0 ? remaining : RECEIPT_READ_MS));
  const bounded = signal ? AbortSignal.any([signal, deadline]) : deadline;
  try {
    return retryTransient && remaining > 0
      ? await readControllerWithRetry<T>(api, path, bounded)
      : await api<T>({ method: "GET", path, signal: bounded });
  } catch (error) {
    signal?.throwIfAborted();
    if (Date.now() >= runDeadline(record) && (deadline.aborted || canRetryControllerRequest(error))) return null;
    throw error;
  }
}
