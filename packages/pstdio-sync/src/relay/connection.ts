import {
  type LiveClientMessage,
  type LiveServerMessage,
  liveClientMessageSchema,
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
  onReady?: () => void;
  onDisconnect?: (reason: "renewal" | "offline") => void;
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
  let failSocket: (() => void) | undefined;
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
      failSocket?.();
    } finally {
      running = undefined;
      input.onStatusChange?.();
    }
  };
  const setConnected = (next: boolean) => {
    const changed = connected !== next;
    connected = next;
    if (changed) input.onStatusChange?.();
    if (changed && next) input.onReady?.();
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
    input.onDisconnect?.("offline");
  };
  input.signal.addEventListener("abort", abort, { once: true });
  const open = async (access: Awaited<ReturnType<typeof input.access>>, onReady: () => void) => {
    let renewal = false;
    const expiresAt = Date.parse(access.expiresAt);
    if (!(expiresAt > Date.now())) throw new Error("Relay access has expired");
    const url = serviceUrl(address, input.path);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const closed = Promise.withResolvers<void>();
    const connection = new NativeWebSocket(url, {
      headers: { ...input.headers, authorization: `Bearer ${access.token}` },
    });
    socket = connection;
    let ready = false;
    let failed = false;
    const fail = () => {
      failed = true;
      renewal = false;
      connection.close();
    };
    failSocket = fail;
    const endAccess = () => {
      const remaining = Date.parse(access.expiresAt) - Date.now();
      if (remaining <= 0) {
        renewal = ready && !failed;
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
        fail();
        return;
      }
      let message: ReturnType<typeof input.message>;
      try {
        message = input.message(body);
      } catch {
        fail();
        return;
      }
      if (message === "ready") {
        ready = true;
        setConnected(true);
        onReady();
      }
      if (message) wake();
    });
    connection.addEventListener("error", () => {
      fail();
      closed.resolve();
    });
    connection.addEventListener("close", (event) => {
      if (event.code === 1008 && ready && !failed && Date.now() >= expiresAt) renewal = true;
      closed.resolve();
    });
    await closed.promise;
    return renewal;
  };
  const done = (async () => {
    let failures = 0;
    while (!input.signal.aborted) {
      if (!attempt) {
        attempt = new AbortController();
        attemptSignal = AbortSignal.any([input.signal, attempt.signal]);
      }
      let renewal = false;
      try {
        const access = await input.access();
        if (input.signal.aborted) break;
        renewal = await open(access, () => {
          failures = 0;
        });
      } catch {
        input.onError?.();
      }
      clearTimeout(expiry);
      setConnected(false);
      if (!input.signal.aborted && renewal) {
        input.onDisconnect?.("renewal");
        continue;
      }
      input.onDisconnect?.("offline");
      attempt.abort();
      await running;
      attempt = undefined;
      if (input.signal.aborted) break;
      await new Promise<void>((resolve) => {
        retryDone = resolve;
        retry = setTimeout(resolve, Math.min(1000 * 2 ** failures++, 30_000));
      });
      retryDone = undefined;
    }
    attempt?.abort();
    await running;
    input.signal.removeEventListener("abort", abort);
  })();
  return {
    wake,
    done,
    status: () => ({ connected, busy: dirty || !!running }),
    send: (data: string) => {
      if (!connected || input.signal.aborted || socket?.readyState !== WebSocket.OPEN) return false;
      socket.send(data);
      return true;
    },
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
  input: Omit<RelaySocketInput, "path" | "message" | "headers"> & {
    projectId: string;
    onLive?: (message: Extract<LiveServerMessage, { type: "live" }>) => void;
  },
) => {
  const connection = createRelaySocket({
    ...input,
    path: syncPath({ kind: "live", projectId: input.projectId }),
    headers: { [syncProtocolHeader]: String(syncProtocolVersion) },
    message: (body) => {
      const event = liveServerMessageSchema.parse(body);
      if (event.type === "ready") {
        if (event.protocolVersion !== syncProtocolVersion) throw new Error("Unsupported sync protocol");
        return "ready";
      }
      if (event.type === "live") input.onLive?.(event);
      return event.type === "changed" ? "changed" : null;
    },
  });
  return {
    ...connection,
    send: (message: LiveClientMessage) => connection.send(JSON.stringify(liveClientMessageSchema.parse(message))),
  };
};
