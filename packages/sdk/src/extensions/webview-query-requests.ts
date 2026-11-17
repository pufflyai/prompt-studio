import type { WebviewCommandQuerySnapshot } from "pstdio-api-contracts/extension-kernel";
import { runQueryCleanup } from "./query-cleanup";
import type { WebviewQueryTransport } from "./webview-query-projection";

/** Request cancellation also settles locally when a completed RPC reply is delayed in transport. */
export const createWebviewQueryRequests = <Definition>(
  request: WebviewQueryTransport<Definition>["request"],
  changed: () => void,
) => {
  let closed = false;
  const pending = new Map<string, (reason: unknown) => void>();
  const begin = () => {
    if (closed) throw new Error("Retained query authority is closed");
    const id = crypto.randomUUID();
    pending.set(id, () => {});
    return id;
  };
  const close = (requestId: string, reason = new Error("Command query request is closed")) => {
    const cancel = pending.get(requestId);
    if (!cancel) return;
    pending.delete(requestId);
    cancel(reason);
    try {
      void request(undefined, "close", requestId).catch(() => {});
    } catch {
      /* Local release remains complete if the bridge has already retired. */
    }
  };
  return {
    begin,
    close,
    active: () => pending.size > 0,
    async read<T>(
      definition: Definition,
      operation: "read" | "refresh",
      signal: AbortSignal | undefined,
      settle: (value: WebviewCommandQuerySnapshot | undefined) => T,
    ) {
      signal?.throwIfAborted();
      const requestId = begin();
      const cancelled = Promise.withResolvers<never>();
      pending.set(requestId, cancelled.reject);
      const aborted = () => close(requestId, signal?.reason);
      signal?.addEventListener("abort", aborted, { once: true });
      try {
        return settle(await Promise.race([request(definition, operation, requestId), cancelled.promise]));
      } finally {
        signal?.removeEventListener("abort", aborted);
        close(requestId);
        changed();
      }
    },
    dispose() {
      closed = true;
      runQueryCleanup([...pending.keys()].map((id) => () => close(id)));
    },
  };
};
