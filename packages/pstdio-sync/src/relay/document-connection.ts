import type { LiveServerMessage } from "pstdio-sync-contracts";
import { trackDocumentRetry } from "./document-retry";
import { createLiveConnection, type LiveConnection, type LiveTopic, type SubscribeDocument } from "./live";

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

const documentLiveConnection = (input: DocumentRelayConnectionInput) =>
  input.live ??
  createLiveConnection({
    origin: input.origin,
    projectId: input.projectId,
    access: input.access,
    signal: input.signal,
    onError: input.onError,
    onStatusChange: input.onStatusChange,
  });

const retainDocumentTopics = (live: LiveConnection, signal: AbortSignal) => {
  const topics = new Map<string, () => void>();
  const awaiting = new Set<string>();
  // Initial late admissions have their own catch-up rounds. Renewal also replays retained subscriptions.
  const renewalReplay = new Set<string>();
  const keyOf = (spaceOwner: string | null, topic: string) => JSON.stringify([spaceOwner, topic]);
  const subscribe: SubscribeDocument = (spaceOwner, documentId) => {
    if (signal.aborted) return;
    const key = keyOf(spaceOwner, documentId);
    if (!topics.has(key)) {
      awaiting.add(key);
      topics.set(key, live.subscribe({ spaceOwner, topic: documentId }));
    }
  };
  return {
    subscribe,
    has: (spaceOwner: string | null, topic: string) => topics.has(keyOf(spaceOwner, topic)),
    replay(renewing: boolean) {
      for (const key of topics.keys()) {
        awaiting.add(key);
        if (renewing) renewalReplay.add(key);
      }
    },
    admit(event: LiveTopic) {
      const key = keyOf(event.spaceOwner, event.topic);
      if (!awaiting.delete(key)) return;
      const replayed = renewalReplay.delete(key);
      return { replayed, drained: !awaiting.size || (replayed && !renewalReplay.size) };
    },
    replaying: () => renewalReplay.size > 0,
    clearReplay: () => renewalReplay.clear(),
    close() {
      for (const release of topics.values()) release();
      topics.clear();
      awaiting.clear();
      renewalReplay.clear();
    },
  };
};

const scheduleDocumentRetry = (restart: () => Promise<void>, failures: number) =>
  setTimeout(() => void restart(), Math.min(1000 * 2 ** failures, 30_000));

const routeDocumentChanges =
  (
    input: DocumentRelayConnectionInput,
    target: (work: (signal: AbortSignal) => Promise<boolean>) => void,
    wake: () => void,
  ) =>
  (change: Change) => {
    if (input.acceptsChange && !input.acceptsChange(change)) return;
    if (input.synchronizeChanged) target((signal) => input.synchronizeChanged!(change, signal));
    else wake();
  };

export const createDocumentRelayConnection = (input: DocumentRelayConnectionInput) => {
  const live = documentLiveConnection(input);
  const topics = retainDocumentTopics(live, input.signal);
  let attempt = new AbortController();
  let attemptSignal = AbortSignal.any([attempt.signal, input.signal]);
  let dirty = false;
  let running: Promise<void> | undefined;
  let runningCompletion: ReturnType<typeof Promise.withResolvers<void>> | undefined;
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
    runningCompletion = manualRetry.current();
  };
  const failed = (current: AbortController, error: unknown, completion: typeof runningCompletion) => {
    if (current.signal.aborted || current !== attempt || stopped) return;
    input.onError?.(error);
    errorMessage = "Cloud source failed; retry scheduled";
    current.abort();
    retry = scheduleDocumentRetry(restart, failures++);
    manualRetry.complete(completion);
  };
  const completeTarget = (pending: Promise<unknown>, current: AbortController) => {
    targeted.delete(pending);
    if (current === attempt && !current.signal.aborted) manualRetry.advance();
    input.onStatusChange?.();
  };
  const target = (work: (signal: AbortSignal) => Promise<boolean>) => {
    if (stopped || restarting) return;
    if (!live.status().connected || attempt.signal.aborted) {
      wake();
      return;
    }
    const current = attempt;
    const completion = runningCompletion;
    manualRetry.advance();
    const pending = work(attemptSignal);
    if (targeted.has(pending)) return;
    targeted.add(pending);
    void pending
      .then(
        (handled) => {
          if (!handled && current === attempt && !current.signal.aborted) wake();
        },
        (error) => failed(current, error, completion),
      )
      .finally(() => completeTarget(pending, current));
    input.onStatusChange?.();
  };
  const admit = <T>(work: () => Promise<T>) => {
    if (stopped || restarting || attempt.signal.aborted) return Promise.reject(new Error("Cloud source is restarting"));
    const current = attempt;
    const completion = runningCompletion;
    manualRetry.advance();
    const pending = work();
    targeted.add(pending);
    void pending.catch((error) => failed(current, error, completion)).finally(() => completeTarget(pending, current));
    input.onStatusChange?.();
    return pending;
  };
  const drain = async () => {
    const current = attempt;
    let completion: typeof runningCompletion;
    try {
      while (dirty && live.status().connected && !stopped && current === attempt && !current.signal.aborted) {
        completion = manualRetry.current();
        runningCompletion = completion;
        dirty = false;
        await input.synchronize(attemptSignal, topics.subscribe);
        if (current.signal.aborted) break;
        failures = 0;
        errorMessage = undefined;
        manualRetry.advance();
        manualRetry.complete(completion);
      }
    } catch (error) {
      failed(current, error, completion);
    } finally {
      running = undefined;
      runningCompletion = undefined;
      input.onStatusChange?.();
      if (dirty && !stopped && live.status().connected && !attempt.signal.aborted) wake();
    }
  };
  const wake = () => {
    dirty = true;
    if (!running && !restarting && !stopped && live.status().connected && !attempt.signal.aborted) {
      manualRetry.advance();
      running = Promise.resolve().then(drain);
    }
  };
  const changed = routeDocumentChanges(input, target, wake);
  const restart = () => {
    if (restarting) return restarting;
    manualRetry.advance();
    clearTimeout(retry);
    attempt.abort();
    restarting = Promise.allSettled([running, ...targeted]).then(() => {
      restarting = undefined;
      if (stopped || live.signal.aborted) return;
      resetAttempt();
      errorMessage = undefined;
      input.onReady?.();
      wake();
      input.onStatusChange?.();
    });
    input.onStatusChange?.();
    return restarting;
  };
  const currentWork = () => ({ attempt, dirty, running, restarting, targeted });
  const manualRetry = trackDocumentRetry(live, restart, wake, () => stopped, currentWork);
  const ready = () => {
    topics.replay(renewing);
    if (restarting) return;
    if (!renewing || attempt.signal.aborted) resetAttempt();
    renewing = false;
    input.onReady?.();
    input.onStatusChange?.();
    wake();
  };
  const admitted = (event: LiveTopic) => {
    const admission = topics.admit(event);
    if (!admission) return;
    if (input.synchronizeChanged)
      changed({
        type: "changed",
        spaceOwner: event.spaceOwner,
        documentId: event.topic,
        lastSequence: 0,
        stateId: null,
      });
    else if (admission.drained) wake();
    if (admission.replayed) input.onStatusChange?.();
  };
  const stopListening = live.listen((event) => {
    if (event.type === "disconnected") {
      topics.clearReplay();
      renewing = event.reason === "renewal";
      dirty = dirty || !renewing;
      if (!renewing) attempt.abort();
      input.onDisconnect?.(event.reason);
      input.onStatusChange?.();
    }
    if (event.type === "ready") ready();
    if (event.type === "event") input.onLive?.(event);
    if (event.type === "subscribed") admitted(event);
    if (event.type === "changed" && topics.has(event.spaceOwner, event.documentId)) changed(event);
    if (event.type === "discovered" && (topics.has(event.spaceOwner, event.documentId) || !input.acceptsChange))
      changed({ ...event, type: "changed" });
  });
  const releaseDiscovery = live.discover(null);
  const done = Promise.withResolvers<void>();
  const closeTransport = () => {
    clearTimeout(retry);
    attempt.abort();
    void Promise.allSettled([running, ...targeted, restarting]).then(manualRetry.cancel);
  };
  const close = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(retry);
    attempt.abort();
    stopListening();
    live.signal.removeEventListener("abort", closeTransport);
    releaseDiscovery();
    topics.close();
    if (!input.live) live.close();
    void Promise.allSettled([running, ...targeted, restarting, input.live ? undefined : live.done]).then(() => {
      manualRetry.cancel();
      done.resolve();
    });
  };
  live.signal.addEventListener("abort", closeTransport, { once: true });
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
    subscribe: topics.subscribe,
    wakeDocument: (name: string) =>
      input.synchronizeDocument ? target((signal) => input.synchronizeDocument!(name, signal)) : wake(),
    retry: manualRetry.start,
    /** Queue a full pass without cancelling current work, and retain its completion. */
    resume: manualRetry.resume,
    prepareRetry: manualRetry.prepare,
    done: done.promise.finally(() => input.signal.removeEventListener("abort", close)),
    status: () => ({
      connected: live.status().connected,
      busy: dirty || !!running || targeted.size > 0 || !!restarting || topics.replaying(),
      error: errorMessage,
    }),
  };
};
