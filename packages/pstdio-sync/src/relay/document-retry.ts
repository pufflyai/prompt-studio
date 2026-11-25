import type { LiveConnection } from "./live";

export const trackDocumentRetry = (
  live: LiveConnection,
  restart: () => Promise<void>,
  stopped: () => boolean,
  progress: () => {
    attempt: AbortController;
    dirty: boolean;
    running: Promise<void> | undefined;
    restarting: Promise<void> | undefined;
    targeted: Set<Promise<unknown>>;
  },
) => {
  let version = 0;
  let pending: ReturnType<typeof Promise.withResolvers<void>> | undefined;
  const complete = (completion: typeof pending) => {
    if (!completion || pending !== completion) return;
    pending = undefined;
    completion.resolve();
  };
  const start = () => {
    if (pending) return pending.promise;
    if (stopped() || live.signal.aborted) return Promise.resolve();
    const completion = Promise.withResolvers<void>();
    pending = completion;
    live.retry();
    void restart();
    return completion.promise;
  };
  return {
    current: () => pending,
    complete,
    cancel: () => complete(pending),
    start,
    advance: () => {
      version++;
    },
    prepare(input?: { current?(): boolean; beforeRetry?(): void }) {
      const observed = version;
      return () => {
        if (stopped() || live.signal.aborted) return Promise.resolve();
        const state = progress();
        const recovering =
          !state.attempt.signal.aborted && Boolean(state.running || state.restarting || state.targeted.size);
        if (observed !== version || recovering || input?.current?.() === false) return settleDocumentWork(progress);
        input?.beforeRetry?.();
        return start();
      };
    },
  };
};

const settleDocumentWork = async (
  progress: () => {
    dirty: boolean;
    running: Promise<void> | undefined;
    restarting: Promise<void> | undefined;
    targeted: Set<Promise<unknown>>;
  },
) => {
  const observed = progress();
  await Promise.allSettled([observed.running, observed.restarting, ...observed.targeted]);
  if (observed.restarting || observed.dirty) {
    const next = progress();
    await Promise.allSettled([next.running, ...next.targeted]);
  }
};
