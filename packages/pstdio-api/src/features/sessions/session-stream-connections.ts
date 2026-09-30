import type { SSEStreamingApi } from "hono/streaming";

export interface SessionEventSink {
  readonly aborted: boolean;
  onAbort(listener: () => void): void;
  sleep(ms: number): Promise<unknown>;
  write(event: string, data: unknown): Promise<void>;
}

interface SessionStreamConnection {
  stream: SSEStreamingApi;
  subscriptions: Map<string, AbortController>;
}

// Browsers allow six HTTP/1.1 connections per origin. One connection per client
// carries every session it watches, so open chats cannot starve other requests.
export const createSessionStreamConnections = () => {
  const connections = new Map<string, SessionStreamConnection>();
  return {
    open(stream: SSEStreamingApi) {
      const id = crypto.randomUUID();
      const connection = { stream, subscriptions: new Map<string, AbortController>() };
      connections.set(id, connection);
      stream.onAbort(() => {
        connections.delete(id);
        for (const controller of connection.subscriptions.values()) controller.abort();
      });
      return id;
    },
    subscribe(connectionId: string, subscriptionId: string, run: (sink: SessionEventSink) => Promise<void>) {
      const connection = connections.get(connectionId);
      if (!connection) return false;
      connection.subscriptions.get(subscriptionId)?.abort();
      const controller = new AbortController();
      connection.subscriptions.set(subscriptionId, controller);
      const sink: SessionEventSink = {
        get aborted() {
          return controller.signal.aborted;
        },
        onAbort: (listener) => controller.signal.addEventListener("abort", listener, { once: true }),
        sleep: (ms) => Bun.sleep(ms),
        write: async (event, data) => {
          if (controller.signal.aborted) return;
          await connection.stream.writeSSE({ event, data: JSON.stringify({ subscription_id: subscriptionId, data }) });
        },
      };
      void run(sink).finally(() => {
        if (connection.subscriptions.get(subscriptionId) === controller)
          connection.subscriptions.delete(subscriptionId);
      });
      return true;
    },
    unsubscribe(connectionId: string, subscriptionId: string) {
      const connection = connections.get(connectionId);
      connection?.subscriptions.get(subscriptionId)?.abort();
      connection?.subscriptions.delete(subscriptionId);
    },
  };
};

export type SessionStreamConnections = ReturnType<typeof createSessionStreamConnections>;
