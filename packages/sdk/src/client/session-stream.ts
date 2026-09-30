import {
  type ClientOptions,
  createRequestHeaders,
  type RequestFn,
  resolveBaseUrl,
  resolveClientUrl,
  resolveFetch,
} from "./request";
import { readSseStream } from "./sse";

export interface SessionStreamListener {
  onEvent(event: string, data: unknown): void;
  onError(error: unknown): void;
}

interface Subscription extends SessionStreamListener {
  sessionId: string;
}

interface Connection {
  controller: AbortController;
  id?: string;
}

type Envelope = { connection_id?: string; subscription_id?: string; data?: unknown };

// Browsers allow six HTTP/1.1 connections per origin. Every open session shares
// one connection, so a client holds at most the sync stream and this stream.
export const createSessionStreamTransport = (request: RequestFn, clientOptions: ClientOptions) => {
  const subscriptions = new Map<string, Subscription>();
  let connection: Connection | undefined;

  const subscribe = (connectionId: string, id: string, subscription: Subscription) =>
    request(`/v1/session-stream/${connectionId}/subscriptions`, {
      method: "POST",
      body: { subscription_id: id, session_id: subscription.sessionId },
    }).catch((error: unknown) => {
      if (subscriptions.get(id) !== subscription) return;
      release(id, false);
      subscription.onError(error);
    });

  const release = (id: string, notifyServer: boolean) => {
    subscriptions.delete(id);
    if (!connection) return;
    if (subscriptions.size === 0) {
      connection.controller.abort();
      connection = undefined;
      return;
    }
    // A failed unsubscribe only leaves events the client already ignores.
    if (notifyServer && connection.id) {
      void request(`/v1/session-stream/${connection.id}/subscriptions/${id}`, { method: "DELETE" }).catch(() => {});
    }
  };

  const dispatch = (current: Connection, event: string, payload: Envelope) => {
    if (event === "connected") {
      current.id = payload.connection_id;
      for (const [id, subscription] of subscriptions) void subscribe(current.id!, id, subscription);
      return;
    }
    const subscription = subscriptions.get(payload.subscription_id ?? "");
    if (!subscription) return;
    if (event === "end" || event === "error") release(payload.subscription_id!, false);
    if (event === "error") subscription.onError(new Error((payload.data as { message: string }).message));
    else subscription.onEvent(event, payload.data);
  };

  const fail = (current: Connection, error: unknown) => {
    if (connection !== current) return;
    connection = undefined;
    const failed = [...subscriptions.values()];
    subscriptions.clear();
    for (const subscription of failed) subscription.onError(error);
  };

  const open = () => {
    const current: Connection = { controller: new AbortController() };
    const { signal } = current.controller;
    connection = current;
    const read = async () => {
      const response = await resolveFetch(clientOptions)(
        resolveClientUrl(resolveBaseUrl(clientOptions), "/v1/session-stream"),
        { headers: Object.fromEntries(createRequestHeaders(clientOptions).entries()), signal },
      );
      if (!response.ok || !response.body) throw new Error(`Connection failed: ${response.status}`);
      await readSseStream(response.body, ({ event, data }) => dispatch(current, event, JSON.parse(data)), { signal });
      throw new Error("Session stream closed");
    };
    void read().catch((error: unknown) => {
      if (!signal.aborted) fail(current, error);
    });
    return current;
  };

  return {
    subscribe(sessionId: string, listener: SessionStreamListener) {
      const id = crypto.randomUUID();
      const subscription = { ...listener, sessionId };
      subscriptions.set(id, subscription);
      const current = connection ?? open();
      if (current.id) void subscribe(current.id, id, subscription);
      return {
        close: () => {
          if (subscriptions.get(id) === subscription) release(id, true);
        },
      };
    },
  };
};
