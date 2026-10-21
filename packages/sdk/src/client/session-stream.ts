import {
  type ClientOptions,
  createRequestHeaders,
  PstdioApiError,
  type RequestFn,
  resolveBaseUrl,
  resolveClientUrl,
  resolveFetch,
  responseError,
} from "./request";
import { isSessionStreamRejection } from "./session-stream-errors";
import { removeSessionStreamSubscription } from "./session-stream-removal";
import { readSseStream } from "./sse";

export interface SessionStreamListener {
  onEvent(event: string, data: unknown): void;
  onError(error: unknown): void;
}

export type ClientStreamSubscription =
  | { retain_session_id: string }
  | { session_id: string }
  | { command: { project_id: string; command_id: string; body: import("pstdio-api-contracts").CommandExecuteBody } };

interface Subscription extends SessionStreamListener {
  input: ClientStreamSubscription;
  started?: Promise<void>;
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

  const subscribe = (connectionId: string, id: string, subscription: Subscription) => {
    subscription.started = request(`/v1/session-stream/${connectionId}/subscriptions`, {
      method: "POST",
      body: { subscription_id: id, ...subscription.input },
    }).then(
      () => {},
      (error: unknown) => {
        if (subscriptions.get(id) !== subscription) return;
        if (isSessionStreamRejection(error) && error.code === "SESSION_STREAM_NOT_FOUND") {
          if (connection) fail(connection, new Error("Session stream no longer exists", { cause: error }));
          return;
        }
        // A failed response can still have created the server subscription.
        // A definitive rejection cannot, so it needs no compensating DELETE.
        release(id, !isSessionStreamRejection(error));
        subscription.onError(error);
      },
    );
  };

  const release = (id: string, notifyServer: boolean) => {
    const started = subscriptions.get(id)?.started;
    subscriptions.delete(id);
    if (!connection) return;
    if (subscriptions.size === 0) {
      connection.controller.abort();
      connection = undefined;
      return;
    }
    if (!notifyServer || !started) return;
    // Subscribe and unsubscribe can travel on different HTTP connections. An
    // unsubscribe that overtook its subscribe would leave a run nobody stops.
    const path = `/v1/session-stream/${connection.id}/subscriptions/${id}`;
    const { signal } = connection.controller;
    void started.then(() => removeSessionStreamSubscription(request, path, signal));
  };

  const dispatch = (current: Connection, event: string, payload: Envelope) => {
    if (connection !== current) return;
    if (event === "connected") {
      current.id = payload.connection_id;
      for (const [id, subscription] of subscriptions) subscribe(current.id!, id, subscription);
      return;
    }
    const subscription = subscriptions.get(payload.subscription_id ?? "");
    if (!subscription) return;
    if (event === "end" || event === "error") release(payload.subscription_id!, false);
    if (event === "error")
      subscription.onError(
        Object.assign(new Error((payload.data as { message: string }).message), {
          code: (payload.data as { code?: string }).code,
        }),
      );
    else subscription.onEvent(event, payload.data);
  };

  const fail = (current: Connection, error: unknown) => {
    if (connection !== current) return;
    connection = undefined;
    current.controller.abort();
    const failed = [...subscriptions.values()];
    subscriptions.clear();
    const failure =
      error instanceof PstdioApiError
        ? error
        : new Error(error instanceof Error ? error.message : String(error), { cause: error });
    for (const subscription of failed) subscription.onError(failure);
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
      if (!response.ok) throw await responseError(response);
      if (!response.body) throw new Error("Session stream response has no body");
      await readSseStream(response.body, ({ event, data }) => dispatch(current, event, JSON.parse(data)), { signal });
      throw new Error("Session stream closed");
    };
    void read().catch((error: unknown) => {
      if (!signal.aborted) fail(current, error);
    });
    return current;
  };

  return {
    subscribe(input: string | ClientStreamSubscription, listener: SessionStreamListener) {
      const id = crypto.randomUUID();
      const subscription = { ...listener, input: typeof input === "string" ? { session_id: input } : input };
      subscriptions.set(id, subscription);
      const current = connection ?? open();
      if (current.id) subscribe(current.id, id, subscription);
      return {
        close: () => {
          if (subscriptions.get(id) === subscription) release(id, true);
        },
      };
    },
  };
};
