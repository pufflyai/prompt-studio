import type { ServerWebSocket } from "bun";
import type { Scope } from "pstdio-sync-contracts";
import type { RelayOwners } from "./owners";

export const createRelaySubscription = async (
  owners: RelayOwners,
  scope: Scope,
  token: string,
  environmentId: string,
  requestSignal?: AbortSignal,
) => {
  let socket: Pick<ServerWebSocket, "send" | "close"> | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let stopped = false;
  let checking = false;
  let dirty = false;
  let ready = false;
  let unsubscribe = () => {};
  const close = (code = 1000) => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    unsubscribe();
    socket?.close(code, code === 1008 ? "Authorization ended" : "Subscription ended");
  };
  const send = (type: "ready" | "changed") => {
    // Disconnect a slow consumer rather than accumulate a per-socket message queue.
    if (socket!.send(JSON.stringify({ protocolVersion: 1, type })) <= 0) close(1013);
  };
  const check = async () => {
    if (stopped || checking || !socket) return;
    checking = true;
    try {
      do {
        const changed = dirty;
        dirty = false;
        const identity = await owners.authority.authorize(token, scope.workbenchId);
        if (stopped) return;
        if (identity?.accountId !== scope.accountId || identity.environmentId !== environmentId) {
          close(1008);
          return;
        }
        deliver(changed);
      } while (dirty && !stopped);
    } catch {
      close(1011);
    } finally {
      checking = false;
    }
  };
  const deliver = (changed: boolean) => {
    if (!ready) {
      ready = true;
      send("ready");
    }
    if (changed && !stopped) send("changed");
  };
  const owner = owners.storage.owner(scope);
  const interrupted = () => close();
  requestSignal?.addEventListener("abort", interrupted, { once: true });
  try {
    requestSignal?.throwIfAborted();
    unsubscribe = await owner.watch(
      () => {
        dirty = true;
        void check();
      },
      () => close(1011),
    );
    if (stopped) {
      unsubscribe();
      throw new Error("Subscription ended");
    }
    await owner.checkpoint(requestSignal);
    if (stopped) throw new Error("Relay change listener unavailable");
  } catch (error) {
    close();
    throw error;
  } finally {
    requestSignal?.removeEventListener("abort", interrupted);
  }
  return {
    close,
    open(connection: Pick<ServerWebSocket, "send" | "close">) {
      socket = connection;
      if (stopped) {
        connection.close(1011, "Subscription ended");
        return;
      }
      timer = setInterval(() => void check(), owners.subscriptionCheckIntervalMs);
      void check();
    },
  };
};
export type RelaySubscription = Awaited<ReturnType<typeof createRelaySubscription>>;
