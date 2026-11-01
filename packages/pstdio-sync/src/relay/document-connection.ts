import { createLiveConnection, type LiveConnection, type SubscribeDocument } from "./live";

/** Each sync owner has its own drain and cancellation; the project owns the socket. */
export const createDocumentRelayConnection = (input: {
  origin: string;
  projectId: string;
  access: () => Promise<{ token: string; expiresAt: string }>;
  signal: AbortSignal;
  live?: LiveConnection;
  synchronize: (signal: AbortSignal, subscribe: SubscribeDocument) => Promise<unknown>;
  onError?: () => void;
  onStatusChange?: () => void;
}) => {
  const live = input.live ?? createLiveConnection(input);
  const topics = new Map<string, () => void>();
  const subscribe: SubscribeDocument = (spaceOwner, documentId) => {
    if (input.signal.aborted) return;
    const key = JSON.stringify([spaceOwner, documentId]);
    if (!topics.has(key)) topics.set(key, live.subscribe({ spaceOwner, topic: documentId }));
  };
  let attempt = new AbortController();
  let attemptSignal = AbortSignal.any([attempt.signal, input.signal]);
  let dirty = false;
  let running: Promise<void> | undefined;
  let stopped = false;
  let failures = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const resetAttempt = () => {
    clearTimeout(retry);
    attempt.abort();
    attempt = new AbortController();
    attemptSignal = AbortSignal.any([attempt.signal, input.signal]);
  };
  const drain = async () => {
    const current = attempt;
    try {
      while (dirty && live.status().connected && !stopped && current === attempt && !current.signal.aborted) {
        dirty = false;
        const signal = attemptSignal;
        await input.synchronize(signal, subscribe);
        failures = 0;
      }
    } catch {
      if (!current.signal.aborted && current === attempt && !stopped) {
        input.onError?.();
        current.abort();
        retry = setTimeout(
          () => {
            resetAttempt();
            wake();
          },
          Math.min(1000 * 2 ** failures++, 30_000),
        );
      }
    } finally {
      running = undefined;
      input.onStatusChange?.();
      if (dirty && !stopped && live.status().connected && !attempt.signal.aborted) wake();
    }
  };
  const wake = () => {
    dirty = true;
    if (!running && !stopped && live.status().connected && !attempt.signal.aborted)
      running = Promise.resolve().then(drain);
  };
  const stopListening = live.listen((event) => {
    if (event.type === "disconnected") {
      attempt.abort();
      input.onStatusChange?.();
    }
    if (event.type === "ready") {
      resetAttempt();
      input.onStatusChange?.();
      wake();
    }
    // Discovery can introduce a document whose first content is a latest state (sequence zero).
    if (
      event.type === "discovered" ||
      (event.type === "changed" && topics.has(JSON.stringify([event.spaceOwner, event.documentId])))
    )
      wake();
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
    if (!input.live) live.close();
    void Promise.resolve(running).then(() => done.resolve());
  };
  input.signal.addEventListener("abort", close, { once: true });
  if (input.signal.aborted) close();
  else if (live.status().connected) wake();
  return {
    wake,
    subscribe,
    retry() {
      live.retry();
      if (attempt.signal.aborted) resetAttempt();
      wake();
    },
    done: done.promise.finally(() => input.signal.removeEventListener("abort", close)),
    status: () => ({ connected: live.status().connected, busy: dirty || !!running }),
  };
};
