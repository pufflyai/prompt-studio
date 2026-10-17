import { relayEventSchema, relayPath, type Scope } from "pstdio-sync-contracts";
import { relayOrigin } from "./http";

const NativeWebSocket = globalThis.WebSocket as { new (url: string | URL, options?: Bun.WebSocketOptions): WebSocket };

export const createRelayConnection = (input: {
  origin: string;
  scope: Scope;
  access: () => Promise<{ token: string; expiresAt: string }>;
  synchronize: (signal: AbortSignal) => Promise<unknown>;
  signal: AbortSignal;
  onError?: () => void;
}) => {
  const origin = relayOrigin(input.origin);
  let socket: WebSocket | undefined;
  let dirty = false;
  let running: Promise<void> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let retryDone: (() => void) | undefined;
  let connected = false;
  let attempt: AbortController | undefined;
  const drain = async () => {
    const signal = AbortSignal.any([input.signal, attempt!.signal]);
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
    }
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
      try {
        const access = await input.access();
        if (input.signal.aborted) break;
        const url = new URL(relayPath(input.scope, "changes"), origin);
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
        const closed = Promise.withResolvers<void>();
        const connection = new NativeWebSocket(url, {
          headers: { authorization: `Bearer ${access.token}` },
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
          const parsed = relayEventSchema.safeParse(body);
          if (!parsed.success) {
            connection.close();
            return;
          }
          if (parsed.data.type === "ready") {
            connected = true;
            failures = 0;
          }
          wake();
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
      connected = false;
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
  return { wake, done };
};
