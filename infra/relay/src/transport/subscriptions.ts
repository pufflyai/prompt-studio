import type { ServerWebSocket } from "bun";
import type { Scope } from "pstdio-sync-contracts";
import type { RelayOwners } from "./owners";

export const createRelaySubscription = async (
  owners: RelayOwners,
  scope: Scope,
  expiresAt: string,
  requestSignal?: AbortSignal,
) => {
  const expiry = new Date(expiresAt).getTime();
  let socket: Pick<ServerWebSocket, "send" | "close"> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let scheduled = false;
  let dirty = false;
  let ready = false;
  let unsubscribe = () => {};
  const close = (code = 1000) => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    unsubscribe();
    socket?.close(code, code === 1008 ? "Authorization ended" : "Subscription ended");
  };
  const expired = () => {
    if (Date.now() < expiry) return false;
    close(1008);
    return true;
  };
  const scheduleExpiry = () => {
    if (stopped || expired()) return;
    // Node/Bun timers use a signed32-bit delay; longer access still follows its original expiry.
    timer = setTimeout(scheduleExpiry, Math.min(expiry - Date.now(), 2_147_483_647));
  };
  const send = (type: "ready" | "changed") => {
    // A hint has no payload queue. Disconnect a slow consumer when the socket cannot accept it.
    if (socket!.send(JSON.stringify({ protocolVersion: 2, type })) <= 0) close(1013);
  };
  const deliver = () => {
    scheduled = false;
    if (stopped || !socket || expired()) return;
    if (!ready) {
      ready = true;
      send("ready");
    }
    if (dirty && !stopped) {
      dirty = false;
      send("changed");
    }
  };
  const owner = owners.storage.owner(scope);
  const interrupted = () => close();
  requestSignal?.addEventListener("abort", interrupted, { once: true });
  try {
    requestSignal?.throwIfAborted();
    unsubscribe = await owner.watch(
      () => {
        dirty = true;
        if (!scheduled && socket) {
          scheduled = true;
          queueMicrotask(deliver);
        }
      },
      () => close(1011),
    );
    if (stopped) {
      unsubscribe();
      throw new Error("Subscription ended");
    }
    await owner.checkpoint(requestSignal);
    if (stopped || expired()) throw new Error("Relay change listener unavailable");
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
      scheduleExpiry();
      deliver();
    },
  };
};
export type RelaySubscription = Awaited<ReturnType<typeof createRelaySubscription>>;
