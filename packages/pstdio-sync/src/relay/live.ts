import {
  type LiveClientMessage,
  type LiveServerMessage,
  liveProtocolHeader,
  liveProtocolVersion,
  liveServerMessageSchema,
  syncErrorSchema,
  syncPath,
  syncProtocolHeader,
  syncProtocolVersion,
} from "pstdio-sync-contracts";
import { createRelaySocket } from "./connection";
import { serviceAddress, serviceUrl } from "./http";

export type LiveTopic = { spaceOwner: string | null; topic: string };
export type LiveEvent = LiveServerMessage | { type: "disconnected" };
const keyOf = (topic: LiveTopic) => JSON.stringify([topic.spaceOwner, topic.topic]);

// WebSocket errors hide HTTP bodies. Probe only failed handshakes to expose the R29 update message.
const unsupportedHandshake = async (
  input: { origin: string; projectId: string },
  token: string,
  signal: AbortSignal,
) => {
  const response = await fetch(
    serviceUrl(serviceAddress(input.origin), syncPath({ kind: "live", projectId: input.projectId })),
    {
      signal,
      headers: {
        authorization: `Bearer ${token}`,
        [syncProtocolHeader]: String(syncProtocolVersion),
        [liveProtocolHeader]: String(liveProtocolVersion),
      },
    },
  );
  if (response.status !== 426) {
    await response.body?.cancel();
    return false;
  }
  const error = syncErrorSchema.safeParse(await response.json());
  return error.success && error.data.error === "protocol-unsupported";
};

/** One shared project socket. Desired subscriptions survive reconnect; payloads never do. */
export const createLiveConnection = (input: {
  origin: string;
  projectId: string;
  access: () => Promise<{ token: string; expiresAt: string }>;
  signal: AbortSignal;
  onError?: () => void;
  onStatusChange?: () => void;
}) => {
  const controller = new AbortController();
  let protocolUnsupported = false;
  const unsupported = () => {
    protocolUnsupported = true;
    controller.abort();
    input.onStatusChange?.();
  };
  const desired = new Map<string, { message: LiveClientMessage; count: number }>();
  const listeners = new Set<(event: LiveEvent) => void>();
  const presence = new Map<string, Set<(active: boolean) => void>>();
  const calls = new Map<
    string,
    {
      resolve: (result: string) => void;
      reject: (error: Error) => void;
      partial?: (payload: string) => void;
      cleanup: () => void;
    }
  >();
  const handlers = new Map<
    string,
    (
      event: Extract<LiveServerMessage, { type: "invocation" }>,
      signal: AbortSignal,
      partial: (payload: string) => void,
    ) => Promise<string>
  >();
  const invocations = new Map<string, AbortController>();
  const disconnected = () => {
    for (const callbacks of presence.values()) for (const callback of callbacks) callback(false);
    for (const call of calls.values()) {
      call.cleanup();
      call.reject(new Error("Device disconnected"));
    }
    calls.clear();
    for (const invocation of invocations.values()) invocation.abort();
    invocations.clear();
    for (const listener of listeners) listener({ type: "disconnected" });
  };
  const result = (event: Extract<LiveServerMessage, { type: "result" | "call-error" }>) => {
    const call = calls.get(event.id);
    if (call) {
      if (event.type === "call-error" || event.done) {
        calls.delete(event.id);
        call.cleanup();
        if (event.type === "call-error") call.reject(new Error(`Device call ${event.error}`));
        else call.resolve(event.payload);
      } else call.partial?.(event.payload);
    }
  };
  const invoke = (event: Extract<LiveServerMessage, { type: "invocation" }>) => {
    const handler = handlers.get(JSON.stringify([event.spaceOwner, event.procedure]));
    if (!handler) transport.send({ type: "call-error", id: event.id, error: "unavailable" });
    else {
      const invocation = new AbortController();
      invocations.set(event.id, invocation);
      const partial = (payload: string) => {
        if (!invocation.signal.aborted) transport.send({ type: "result", id: event.id, payload, done: false });
      };
      void Promise.resolve()
        .then(() => handler(event, invocation.signal, partial))
        .then(
          (payload) => {
            if (!invocation.signal.aborted) transport.send({ type: "result", id: event.id, payload, done: true });
          },
          () => {
            if (!invocation.signal.aborted) transport.send({ type: "call-error", id: event.id, error: "failed" });
          },
        )
        .finally(() => invocations.delete(event.id));
    }
  };
  const updatePresence = (event: Extract<LiveServerMessage, { type: "subscribers" }>) => {
    for (const callback of presence.get(keyOf(event)) ?? []) callback(event.active);
  };
  const receive = (event: LiveServerMessage) => {
    if (event.type === "ready") {
      for (const { message } of desired.values()) transport.send(message);
    }
    if (event.type === "subscribers") updatePresence(event);
    if (event.type === "result" || event.type === "call-error") result(event);
    if (event.type === "cancelled") {
      invocations.get(event.id)?.abort();
      invocations.delete(event.id);
    }
    if (event.type === "invocation") invoke(event);
    for (const listener of listeners) listener(event);
  };
  const transport = createRelaySocket({
    ...input,
    signal: AbortSignal.any([input.signal, controller.signal]),
    path: syncPath({ kind: "live", projectId: input.projectId }),
    headers: { [syncProtocolHeader]: String(syncProtocolVersion), [liveProtocolHeader]: String(liveProtocolVersion) },
    message(body) {
      const event = liveServerMessageSchema.parse(body);
      // Mark ready before replaying subscriptions (send requires a ready socket).
      if (event.type === "ready") {
        if (event.protocolVersion !== liveProtocolVersion) {
          unsupported();
          return null;
        }
        queueMicrotask(() => receive(event));
        return "ready";
      }
      receive(event);
      return null;
    },
    synchronize: async () => {},
    onDisconnected: disconnected,
    async onHandshakeError(access, signal) {
      if (await unsupportedHandshake(input, access.token, signal)) unsupported();
    },
  });
  const retain = (key: string, message: LiveClientMessage, remove: LiveClientMessage) => {
    const entry = desired.get(key);
    if (entry) entry.count++;
    else {
      desired.set(key, { message, count: 1 });
      transport.send(message);
    }
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      const entry = desired.get(key);
      if (entry && --entry.count === 0) {
        desired.delete(key);
        transport.send(remove);
      }
    };
  };
  return {
    done: transport.done,
    status: () => ({ ...transport.status(), protocolUnsupported }),
    retry: transport.retry,
    reconnect: transport.reconnect,
    close: () => controller.abort(),
    listen(listener: (event: LiveEvent) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    subscribe(topic: LiveTopic) {
      return retain(`subscribe:${keyOf(topic)}`, { type: "subscribe", ...topic }, { type: "unsubscribe", ...topic });
    },
    discover(spaceOwner: string | null) {
      return retain(`discover:${spaceOwner}`, { type: "discover", spaceOwner }, { type: "undiscover", spaceOwner });
    },
    follow(topic: LiveTopic, callback: (active: boolean) => void) {
      const key = keyOf(topic);
      const callbacks = presence.get(key) ?? new Set();
      callbacks.add(callback);
      presence.set(key, callbacks);
      callback(false);
      const release = retain(`follow:${key}`, { type: "follow", ...topic }, { type: "unfollow", ...topic });
      // Request the current state even when another local follower already retains the subscription.
      transport.send({ type: "follow", ...topic });
      return () => {
        callbacks.delete(callback);
        if (!callbacks.size) presence.delete(key);
        release();
      };
    },
    publish(topic: LiveTopic, payload: string) {
      return transport.send({ type: "publish", ...topic, payload });
    },
    register(topic: LiveTopic, handler: NonNullable<ReturnType<typeof handlers.get>>) {
      const key = keyOf(topic);
      if (handlers.has(key)) throw new Error("Procedure already registered");
      handlers.set(key, handler);
      const release = retain(
        `register:${key}`,
        { type: "register", spaceOwner: topic.spaceOwner, procedure: topic.topic },
        { type: "unregister", spaceOwner: topic.spaceOwner, procedure: topic.topic },
      );
      return () => {
        handlers.delete(key);
        release();
      };
    },
    call(input: {
      deviceId: string;
      procedure: string;
      spaceOwner: string | null;
      payload: string;
      signal: AbortSignal;
      partial?: (payload: string) => void;
    }) {
      input.signal.throwIfAborted();
      const id = crypto.randomUUID();
      const result = Promise.withResolvers<string>();
      const cancel = () => {
        calls.delete(id);
        cleanup();
        transport.send({ type: "cancel", id });
        result.reject(input.signal.reason);
      };
      const cleanup = () => input.signal.removeEventListener("abort", cancel);
      calls.set(id, { ...result, cleanup, partial: input.partial });
      input.signal.addEventListener("abort", cancel, { once: true });
      if (
        !transport.send({
          type: "call",
          id,
          deviceId: input.deviceId,
          procedure: input.procedure,
          spaceOwner: input.spaceOwner,
          payload: input.payload,
        })
      ) {
        calls.delete(id);
        cleanup();
        result.reject(new Error("Device disconnected"));
      }
      return result.promise;
    },
  };
};
export type LiveConnection = ReturnType<typeof createLiveConnection>;
export type SubscribeDocument = (spaceOwner: string | null, documentId: string) => void;
