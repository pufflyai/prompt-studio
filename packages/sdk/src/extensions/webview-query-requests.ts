import type { WebviewCommandQueryDefinition, WebviewCommandQuerySnapshot } from "pstdio-api-contracts/extension-kernel";
import type { GuestHost } from "./guest-host";
import { runQueryCleanup } from "./query-cleanup";

/** Request cancellation also settles locally when a completed RPC reply is delayed in transport. */
export const createWebviewQueryRequests = (host: GuestHost, owner: string, changed: () => void) => {
  let closed = false;
  const pending = new Map<string, (reason: unknown) => void>();
  const begin = () => {
    if (closed) throw new Error("Command query authority is closed");
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
      void host.call("commands.query", { operation: "close", owner, requestId }).catch(() => {});
    } catch {
      /* Local release remains complete if the bridge has already retired. */
    }
  };
  return {
    begin,
    close,
    active: () => pending.size > 0,
    async read<T>(
      definition: WebviewCommandQueryDefinition,
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
        return settle(
          await Promise.race([
            host.call("commands.query", { ...definition, owner, requestId, operation }),
            cancelled.promise,
          ]),
        );
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
