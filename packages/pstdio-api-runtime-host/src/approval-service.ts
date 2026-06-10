import type { ApprovalRequest, ApprovalResponse, ApprovalService } from "pstdio-api-contracts";

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

type PendingEntry = {
  resolve: (response: ApprovalResponse) => void;
  timer: ReturnType<typeof setTimeout>;
};

type Options = {
  timeoutMs?: number;
};

export const createApprovalService = (send: (request: ApprovalRequest) => void, options?: Options): ApprovalService => {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pending = new Map<string, PendingEntry>();

  const requestApproval = (request: ApprovalRequest) =>
    new Promise<ApprovalResponse>((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(request.id);
        resolve({ id: request.id, decision: "timeout" });
      }, timeoutMs);

      pending.set(request.id, { resolve, timer });
      send(request);
    });

  const handleResponse = (response: ApprovalResponse) => {
    const entry = pending.get(response.id);
    if (!entry) return;

    clearTimeout(entry.timer);
    pending.delete(response.id);
    entry.resolve(response);
  };

  const dispose = () => {
    for (const [id, entry] of pending) {
      clearTimeout(entry.timer);
      entry.resolve({ id, decision: "timeout" });
    }
    pending.clear();
  };

  return { requestApproval, handleResponse, dispose };
};
