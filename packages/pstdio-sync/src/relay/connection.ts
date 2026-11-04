import { serviceAddress, serviceUrl } from "./http";

const NativeWebSocket = globalThis.WebSocket as unknown as {
  new (url: string | URL, options?: Bun.WebSocketOptions): Bun.WebSocket;
};
type TargetedSync = (signal: AbortSignal) => Promise<boolean>;

interface RelaySocketInput {
  origin: string;
  path: string;
  headers?: Record<string, string>;
  message: (body: unknown) => "ready" | "changed" | TargetedSync | null;
  access: () => Promise<{ token: string; expiresAt: string }>;
  synchronize: (signal: AbortSignal) => Promise<unknown>;
  signal: AbortSignal;
  onError?: () => void;
  onDisconnected?: (reason: "renewal" | "offline") => void;
  onHandshakeError?: (access: { token: string; expiresAt: string }, signal: AbortSignal) => Promise<void>;
  /** Runs when the connection opens or closes, or a synchronization run ends. */
  onStatusChange?: () => void;
  onReady?: () => void;
  onDisconnect?: (reason: "renewal" | "offline") => void;
}

const readAccess = async (input: Pick<RelaySocketInput, "access">, signal: AbortSignal) => {
  const cancelled = Promise.withResolvers<never>();
  const abort = () => cancelled.reject(signal.reason);
  signal.addEventListener("abort", abort, { once: true });
  try {
    signal.throwIfAborted();
    return await Promise.race([input.access(), cancelled.promise]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
};

const watchSocketErrors = (
  connection: Bun.WebSocket,
  handshakeError: () => Promise<void> | undefined,
  failed: () => void,
) => {
  let opened = false;
  let handling: Promise<void> | undefined;
  connection.addEventListener("open", () => {
    opened = true;
  });
  connection.addEventListener("error", () => {
    if (handling) return;
    handling = (async () => {
      try {
        if (!opened) await handshakeError();
      } finally {
        failed();
      }
    })().catch(() => {});
  });
  return () => handling;
};

export const createRelaySocket = (input: RelaySocketInput) => {
  const address = serviceAddress(input.origin);
  let socket: Bun.WebSocket | undefined;
  let socketReady = () => false;
  let dirty = false;
  let running: Promise<void> | undefined;
  const targeted = new Set<Promise<boolean>>();
  let retry: ReturnType<typeof setTimeout> | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let retryDone: (() => void) | undefined;
  let connected = false;
  let failSocket: (() => void) | undefined;
  let reconnectRequested = false;
  let attempt: AbortController | undefined;
  let attemptSignal: AbortSignal = input.signal;
  const drain = async () => {
    const signal = attemptSignal;
    try {
      while (dirty && connected && !signal.aborted && socketReady()) {
        dirty = false;
        await input.synchronize(signal);
      }
    } catch {
      if (!signal.aborted) {
        attempt?.abort();
        input.onDisconnect?.("offline");
        input.onError?.();
      }
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
  };
  const wake = (synchronize?: TargetedSync) => {
    if (synchronize && connected && !input.signal.aborted && !attemptSignal.aborted && socketReady()) {
      const signal = attemptSignal;
      const work = synchronize(signal);
      if (targeted.has(work)) return;
      targeted.add(work);
      void work
        .then(
          (handled) => {
            if (!handled && !signal.aborted) wake();
          },
          () => {
            if (signal.aborted) return;
            attempt?.abort();
            input.onDisconnect?.("offline");
            input.onError?.();
            failSocket?.();
          },
        )
        .finally(() => {
          targeted.delete(work);
          input.onStatusChange?.();
        });
      input.onStatusChange?.();
      return;
    }
    dirty = true;
    // Renewal keeps connected true while the old attempt drains. The next ready event must run queued work.
    if (connected && !running && !attemptSignal.aborted && socketReady()) running = drain();
  };
  const abort = () => {
    clearTimeout(retry);
    clearTimeout(expiry);
    retryDone?.();
    // Cancellation owns the transport locally; a peer may never reply to a closing handshake.
    // The attempt's admitted synchronization work is still drained by done below.
    socket?.terminate();
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
    socketReady = () => ready && connection.readyState === WebSocket.OPEN;
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
        input.onReady?.();
        onReady();
      }
      if (typeof message === "function") wake(message);
      else if (message) wake();
    });
    const errors = watchSocketErrors(
      connection,
      () => input.onHandshakeError?.(access, attemptSignal),
      () => {
        fail();
        closed.resolve();
      },
    );
    connection.addEventListener("close", (event) => {
      if (event.code === 1008 && ready && !failed && Date.now() >= expiresAt) renewal = true;
      closed.resolve();
    });
    await closed.promise;
    // A failed upgrade can close before its authenticated error-body probe finishes.
    await errors();
    return renewal;
  };
  const renewConnection = (renewal: boolean) => {
    if (input.signal.aborted || !renewal) return false;
    input.onDisconnect?.("renewal");
    input.onDisconnected?.("renewal");
    retryDone = undefined;
    return true;
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
        const access = await readAccess(input, attemptSignal);
        if (input.signal.aborted) break;
        attempt.signal.throwIfAborted();
        renewal = await open(access, () => {
          failures = 0;
        });
      } catch {
        input.onError?.();
      }
      const backoff = Promise.withResolvers<void>();
      retryDone = backoff.resolve;
      clearTimeout(expiry);
      if (renewConnection(renewal)) continue;
      setConnected(false);
      input.onDisconnect?.("offline");
      input.onDisconnected?.("offline");
      attempt.abort();
      await running;
      await Promise.allSettled([...targeted]);
      attempt = undefined;
      if (input.signal.aborted) break;
      if (reconnectRequested) {
        reconnectRequested = false;
        retryDone = undefined;
        continue;
      }
      retry = setTimeout(backoff.resolve, Math.min(1000 * 2 ** failures++, 30_000));
      await backoff.promise;
      clearTimeout(retry);
      retryDone = undefined;
    }
    attempt?.abort();
    await running;
    await Promise.allSettled([...targeted]);
    input.signal.removeEventListener("abort", abort);
  })();
  return {
    wake,
    retry() {
      clearTimeout(retry);
      retryDone?.();
      wake();
    },
    reconnect() {
      reconnectRequested = true;
      failSocket?.();
      retryDone?.();
    },
    done,
    status: () => ({ connected, busy: dirty || !!running || targeted.size > 0 }),
    send: (data: unknown) => {
      if (!connected || input.signal.aborted || socket?.readyState !== WebSocket.OPEN) return false;
      socket.send(typeof data === "string" ? data : JSON.stringify(data));
      return true;
    },
  };
};

export { createDocumentRelayConnection } from "./document-connection";
