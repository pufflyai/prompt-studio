import type { LiveServerMessage } from "pstdio-sync-contracts";
import { createLiveConnection, type LiveConnection, type SubscribeDocument } from "./live";

type Change = Extract<LiveServerMessage, { type: "changed" | "discovered" }>;

/** Each sync owner has its own drain and cancellation; the project owns the socket. */
interface DocumentRelayConnectionInput {
  origin: string;
  projectId: string;
  access: () => Promise<{ token: string; expiresAt: string }>;
  signal: AbortSignal;
  live?: LiveConnection;
  synchronize: (signal: AbortSignal, subscribe: SubscribeDocument) => Promise<unknown>;
  onError?: (error?: unknown) => void;
  acceptsChange?: (change: Change) => boolean;
  synchronizeChanged?: (change: Change, signal: AbortSignal) => Promise<boolean>;
  synchronizeDocument?: (name: string, signal: AbortSignal) => Promise<boolean>;
  onReady?: () => void;
  onDisconnect?: (reason: "renewal" | "offline") => void;
  onLive?: (message: Extract<LiveServerMessage, { type: "event" }>) => void;
  onStatusChange?: () => void;
}

export const createDocumentRelayConnection = (input: DocumentRelayConnectionInput) => {
  const live =
    input.live ??
    createLiveConnection({
      origin: input.origin,
      projectId: input.projectId,
      access: input.access,
      signal: input.signal,
      onError: input.onError,
      onStatusChange: input.onStatusChange,
    });
  const topics = new Map<string, () => void>();
  const awaiting = new Set<string>();
  const subscribe: SubscribeDocument = (spaceOwner, documentId) => {
    if (input.signal.aborted) return;
    const key = JSON.stringify([spaceOwner, documentId]);
    if (!topics.has(key)) {
      awaiting.add(key);
      topics.set(key, live.subscribe({ spaceOwner, topic: documentId }));
    }
  };
  let attempt = new AbortController();
  let attemptSignal = AbortSignal.any([attempt.signal, input.signal]);
  let dirty = false;
  let running: Promise<void> | undefined;
  let stopped = false;
  let failures = 0;
  let errorMessage: string | undefined;
  let restarting: Promise<void> | undefined;
  let renewing = live.status().renewing;
  const targeted = new Set<Promise<unknown>>();
  let retry: ReturnType<typeof setTimeout> | undefined;
  const resetAttempt = () => {
    clearTimeout(retry);
    attempt.abort();
    attempt = new AbortController();
    attemptSignal = AbortSignal.any([attempt.signal, input.signal]);
  };
  const failed = (current: AbortController, error: unknown) => {
    if (current.signal.aborted || current !== attempt || stopped) return;
    input.onError?.(error);
    errorMessage = "Cloud source failed; retry scheduled";
    current.abort();
    retry = setTimeout(
      () => {
        void restart();
      },
      Math.min(1000 * 2 ** failures++, 30_000),
    );
  };
  const target = (work: (signal: AbortSignal) => Promise<boolean>) => {
    if (stopped || restarting) return;
    if (!live.status().connected || attempt.signal.aborted) {
      wake();
      return;
    }
    const current = attempt;
    const pending = work(attemptSignal);
    if (targeted.has(pending)) return;
    targeted.add(pending);
    void pending
      .then(
        (handled) => {
          if (!handled && current === attempt && !current.signal.aborted) wake();
        },
        (error) => failed(current, error),
      )
      .finally(() => {
        targeted.delete(pending);
        input.onStatusChange?.();
      });
    input.onStatusChange?.();
  };
  const admit = <T>(work: () => Promise<T>) => {
    if (stopped || restarting || attempt.signal.aborted) return Promise.reject(new Error("Cloud source is restarting"));
    const current = attempt;
    const pending = work();
    targeted.add(pending);
    void pending
      .catch((error) => failed(current, error))
      .finally(() => {
        targeted.delete(pending);
        input.onStatusChange?.();
      });
    input.onStatusChange?.();
    return pending;
  };
  const changed = (change: Change) => {
    if (input.acceptsChange && !input.acceptsChange(change)) return;
    if (input.synchronizeChanged) target((signal) => input.synchronizeChanged!(change, signal));
    else wake();
  };
  const drain = async () => {
    const current = attempt;
    try {
      while (dirty && live.status().connected && !stopped && current === attempt && !current.signal.aborted) {
        dirty = false;
        const signal = attemptSignal;
        await input.synchronize(signal, subscribe);
        failures = 0;
        errorMessage = undefined;
      }
    } catch (error) {
      failed(current, error);
    } finally {
      running = undefined;
      input.onStatusChange?.();
      if (dirty && !stopped && live.status().connected && !attempt.signal.aborted) wake();
    }
  };
  const wake = () => {
    dirty = true;
    if (!running && !restarting && !stopped && live.status().connected && !attempt.signal.aborted)
      running = Promise.resolve().then(drain);
  };
  const restart = () => {
    if (restarting) return restarting;
    clearTimeout(retry);
    attempt.abort();
    restarting = Promise.allSettled([running, ...targeted]).then(() => {
      restarting = undefined;
      if (stopped) return;
      resetAttempt();
      errorMessage = undefined;
      input.onReady?.();
      wake();
      input.onStatusChange?.();
    });
    input.onStatusChange?.();
    return restarting;
  };
  const ready = () => {
    for (const key of topics.keys()) awaiting.add(key);
    if (restarting) return;
    if (!renewing || attempt.signal.aborted) resetAttempt();
    renewing = false;
    input.onReady?.();
    input.onStatusChange?.();
    wake();
  };
  const admitted = (event: { spaceOwner: string | null; topic: string }) => {
    if (!awaiting.delete(JSON.stringify([event.spaceOwner, event.topic]))) return;
    if (input.synchronizeChanged)
      changed({
        type: "changed",
        spaceOwner: event.spaceOwner,
        documentId: event.topic,
        lastSequence: 0,
        stateId: null,
      });
    else if (!awaiting.size) wake();
  };
  const stopListening = live.listen((event) => {
    if (event.type === "disconnected") {
      renewing = event.reason === "renewal";
      if (!renewing) attempt.abort();
      input.onDisconnect?.(event.reason);
      input.onStatusChange?.();
    }
    if (event.type === "ready") ready();
    if (event.type === "event") input.onLive?.(event);
    if (event.type === "subscribed") admitted(event);
    if (event.type === "changed" && topics.has(JSON.stringify([event.spaceOwner, event.documentId]))) changed(event);
    if (
      event.type === "discovered" &&
      (topics.has(JSON.stringify([event.spaceOwner, event.documentId])) || !input.acceptsChange)
    )
      changed({ ...event, type: "changed" });
  });
  const releaseDiscovery = live.discover(null);
  const done = Promise.withResolvers<void>();
  const close = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(retry);
    attempt.abort();
    stopListening();
    releaseDiscovery();
    for (const release of topics.values()) release();
    topics.clear();
    awaiting.clear();
    if (!input.live) live.close();
    void Promise.allSettled([running, ...targeted, restarting, input.live ? undefined : live.done]).then(() =>
      done.resolve(),
    );
  };
  input.signal.addEventListener("abort", close, { once: true });
  if (input.signal.aborted) close();
  else if (live.status().connected)
    queueMicrotask(() => {
      if (!stopped) {
        input.onReady?.();
        wake();
      }
    });
  return {
    wake,
    admit,
    restart,
    subscribe,
    wakeDocument: (name: string) =>
      input.synchronizeDocument ? target((signal) => input.synchronizeDocument!(name, signal)) : wake(),
    retry() {
      live.retry();
      void restart();
    },
    done: done.promise.finally(() => input.signal.removeEventListener("abort", close)),
    status: () => ({
      connected: live.status().connected,
      busy: dirty || !!running || targeted.size > 0 || !!restarting,
      error: errorMessage,
    }),
  };
};
