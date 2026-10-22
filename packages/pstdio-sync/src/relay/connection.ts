import {
  liveServerMessageSchema,
  relayEventSchema,
  relayPath,
  type Scope,
  syncPath,
  syncProtocolHeader,
  syncProtocolVersion,
} from "pstdio-sync-contracts";
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
  /** Runs when the connection opens or closes, or a synchronization run ends. */
  onStatusChange?: () => void;
}

const createRelaySocket = (input: RelaySocketInput) => {
  const address = serviceAddress(input.origin);
  let socket: WebSocket | undefined;
  let dirty = false;
  let running: Promise<void> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let retryDone: (() => void) | undefined;
  let connected = false;
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
    if (connected && !running && !input.signal.aborted) running = drain();
  };
  const abort = () => {
    clearTimeout(retry);
    clearTimeout(expiry);
    retryDone?.();
    socket?.close();
    attempt?.abort();
  };
  input.signal.addEventListener("abort", abort, { once: true });
  const done = (async () => {
    let failures = 0;
    while (!input.signal.aborted) {
      attempt = new AbortController();
      attemptSignal = AbortSignal.any([input.signal, attempt.signal]);
      try {
        const access = await input.access();
        if (input.signal.aborted) break;
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
        connection.addEventListener("error", () => {
          connection.close();
          closed.resolve();
        });
        connection.addEventListener("close", () => closed.resolve());
        await closed.promise;
      } catch {
        input.onError?.();
      }
      clearTimeout(expiry);
      setConnected(false);
      attempt.abort();
      await running;
      if (input.signal.aborted) break;
      await new Promise<void>((resolve) => {
        retryDone = resolve;
        retry = setTimeout(resolve, Math.min(1000 * 2 ** failures++, 30_000));
      });
      retryDone = undefined;
    }
    input.signal.removeEventListener("abort", abort);
  })();
  return {
    wake,
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

export const createDocumentRelayConnection = (
  input: Omit<RelaySocketInput, "path" | "message" | "headers"> & { projectId: string },
) =>
  createRelaySocket({
    ...input,
    path: syncPath({ kind: "live", projectId: input.projectId }),
    headers: { [syncProtocolHeader]: String(syncProtocolVersion) },
    message: (body) => {
      const event = liveServerMessageSchema.parse(body);
      if (event.type === "ready") {
        if (event.protocolVersion !== syncProtocolVersion) throw new Error("Unsupported sync protocol");
        return "ready";
      }
      return event.type === "changed" ? "changed" : null;
    },
  });
