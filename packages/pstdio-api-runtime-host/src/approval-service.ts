import type { ApprovalRequest, ApprovalResponse } from "pstdio-api-contracts";

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

type PendingEntry = {
  request: ApprovalRequest;
  resolve: (response: ApprovalResponse) => void;
  timer: ReturnType<typeof setTimeout>;
};

type Options = {
  timeoutMs?: number;
  onChange?: () => void;
};

export const createApprovalService = (send: (request: ApprovalRequest) => void, options?: Options) => {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pending = new Map<string, PendingEntry>();

  const requestApproval = (request: ApprovalRequest) =>
    new Promise<ApprovalResponse>((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(request.id);
        options?.onChange?.();
        resolve({ id: request.id, decision: "timeout" });
      }, timeoutMs);

      pending.set(request.id, { request, resolve, timer });
      options?.onChange?.();
      send(request);
    });

  const handleResponse = (response: ApprovalResponse) => {
    const entry = pending.get(response.id);
    if (!entry) return;

    clearTimeout(entry.timer);
    pending.delete(response.id);
    options?.onChange?.();
    entry.resolve(response);
  };

  const dispose = () => {
    for (const [id, entry] of pending) {
      clearTimeout(entry.timer);
      entry.resolve({ id, decision: "timeout" });
    }
    const changed = pending.size > 0;
    pending.clear();
    if (changed) options?.onChange?.();
  };

  return {
    requestApproval,
    handleResponse,
    dispose,
    pendingRequests: () => [...pending.values()].map((entry) => entry.request),
    hasPending: () => pending.size > 0,
  };
};
