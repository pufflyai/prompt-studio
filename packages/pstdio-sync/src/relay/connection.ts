import { relayEventSchema, relayPath, type Scope } from "pstdio-sync-contracts";
import { serviceAddress, serviceUrl } from "./http";

const NativeWebSocket = globalThis.WebSocket as { new (url: string | URL, options?: Bun.WebSocketOptions): WebSocket };

interface RelaySocketInput {
  origin: string;
  path: string;
  headers?: Record<string, string>;
  message: (body: unknown) => "ready" | "changed" | null;
  access: () => Promise<{ token: string; expiresAt: string }>;
  synchronize: (signal: AbortSignal) => Promise<unknown>;
  signal: AbortSignal;
  onError?: () => void;
  onDisconnected?: () => void;
  onHandshakeError?: (access: { token: string; expiresAt: string }, signal: AbortSignal) => Promise<void>;
  /** Runs when the connection opens or closes, or a synchronization run ends. */
  onStatusChange?: () => void;
}

export const createRelaySocket = (input: RelaySocketInput) => {
  const address = serviceAddress(input.origin);
  let socket: WebSocket | undefined;
  let dirty = false;
  let running: Promise<void> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let retryDone: (() => void) | undefined;
  let connected = false;
  let reconnectRequested = false;
  let attempt: AbortController | undefined;
  let attemptSignal: AbortSignal;
  const drain = async () => {
    const signal = attemptSignal;
    try {
      while (dirty && connected && !signal.aborted) {
        dirty = false;
        await input.synchronize(signal);
      }
    } catch {
      if (!signal.aborted) input.onError?.();
      socket?.close();
    } finally {
      running = undefined;
      input.onStatusChange?.();
    }
  };
  const setConnected = (next: boolean) => {
    const changed = connected !== next;
    connected = next;
    if (changed) input.onStatusChange?.();
  };
  const wake = () => {
    dirty = true;
    // Renewal keeps connected true while the old attempt drains. The next ready event must run queued work.
    if (connected && !running && !attemptSignal.aborted) running = drain();
  };
  const abort = () => {
    clearTimeout(retry);
    clearTimeout(expiry);
    retryDone?.();
    socket?.close();
    attempt?.abort();
  };
  input.signal.addEventListener("abort", abort, { once: true });
  const readAccess = async (signal: AbortSignal) => {
    const interrupted = Promise.withResolvers<never>();
    const cancel = () => interrupted.reject(signal.reason);
    signal.addEventListener("abort", cancel, { once: true });
    try {
      signal.throwIfAborted();
      return await Promise.race([input.access(), interrupted.promise]);
    } finally {
      signal.removeEventListener("abort", cancel);
    }
  };
  const done = (async () => {
    let failures = 0;
    while (!input.signal.aborted) {
      attempt = new AbortController();
      attemptSignal = AbortSignal.any([input.signal, attempt.signal]);
      // Access ends on schedule. Renewing a ready connection is not a lost connection, so it keeps its status
      // and reconnects at once; the run after the next "ready" catches up on anything sent in between.
      let renewal = false;
      try {
        const access = await readAccess(attemptSignal);
        input.signal.throwIfAborted();
        const url = serviceUrl(address, input.path);
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
        const closed = Promise.withResolvers<void>();
        const connection = new NativeWebSocket(url, {
          headers: { ...input.headers, authorization: `Bearer ${access.token}` },
        });
        socket = connection;
        const endAccess = () => {
          const remaining = Date.parse(access.expiresAt) - Date.now();
          if (remaining <= 0) {
            renewal = connected;
            attempt?.abort();
            connection.close();
            return;
          }
          expiry = setTimeout(endAccess, Math.min(remaining, 2_147_483_647));
        };
        endAccess();
        connection.addEventListener("message", (event) => {
          let body: unknown;
          try {
            body = JSON.parse(String(event.data));
          } catch {
            connection.close();
            return;
          }
          let message: ReturnType<typeof input.message>;
          try {
            message = input.message(body);
          } catch {
            connection.close();
            return;
          }
          if (message === "ready") {
            setConnected(true);
            failures = 0;
          }
          if (message) wake();
        });
        let handshakeFailure: Promise<void> | undefined;
        connection.addEventListener("error", () => {
          connection.close();
          handshakeFailure = Promise.resolve(input.onHandshakeError?.(access, attemptSignal))
            .catch(() => {})
            .finally(closed.resolve);
        });
        connection.addEventListener("close", () => closed.resolve());
        await closed.promise;
        await handshakeFailure;
      } catch {
        input.onError?.();
      }
      const backoff = Promise.withResolvers<void>();
      retryDone = backoff.resolve;
      clearTimeout(expiry);
      if (!renewal) setConnected(false);
      attempt.abort();
      input.onDisconnected?.();
      await running;
      if (input.signal.aborted) break;
      if (renewal || reconnectRequested) {
        reconnectRequested = false;
        retryDone = undefined;
        continue;
      }
      retry = setTimeout(backoff.resolve, Math.min(1000 * 2 ** failures++, 30_000));
      await backoff.promise;
      clearTimeout(retry);
      retryDone = undefined;
    }
    input.signal.removeEventListener("abort", abort);
  })();
  return {
    reconnect() {
      reconnectRequested = true;
      socket?.close();
    },
    send(message: unknown) {
      if (!connected || socket?.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify(message));
      return true;
    },
    wake,
    retry() {
      clearTimeout(retry);
      retryDone?.();
      wake();
    },
    done,
    status: () => ({ connected, busy: dirty || !!running }),
  };
};

export const createRelayConnection = (
  input: Omit<RelaySocketInput, "path" | "message" | "headers"> & { scope: Scope },
) =>
  createRelaySocket({
    ...input,
    path: relayPath(input.scope, "changes"),
    message: (body) => {
      const event = relayEventSchema.parse(body);
      return event.type === "ready" ? "ready" : "changed";
    },
  });

export { createDocumentRelayConnection } from "./document-connection";
