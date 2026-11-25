import type { LiveConnection } from "./live";

export const trackDocumentRetry = (
  live: LiveConnection,
  restart: () => Promise<void>,
  wake: () => void,
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
  type Completion = ReturnType<typeof Promise.withResolvers<void>>;
  let pending:
    | { completion: Completion; mode: "restart" | "resume" | "observe"; startedAttempt?: AbortController }
    | undefined;
  const complete = (completion: Completion | undefined) => {
    if (!completion || pending?.completion !== completion) return;
    pending = undefined;
    completion.resolve();
  };
  const schedule = (mode: NonNullable<typeof pending>["mode"], work?: () => void | Promise<void>) => {
    if (stopped() || live.signal.aborted) return pending?.completion.promise ?? Promise.resolve();
    if (pending) {
      if ((mode === "restart" && pending.mode !== "restart") || (mode === "resume" && pending.mode === "observe")) {
        pending.mode = mode;
        live.retry();
        void work?.();
      }
      return pending.completion.promise;
    }
    const completion = Promise.withResolvers<void>();
    pending = { completion, mode };
    live.retry();
    void work?.();
    return completion.promise;
  };
  return {
    current: () => pending?.completion,
    beginPass(attempt: AbortController) {
      if (pending) pending.startedAttempt = attempt;
      return pending?.completion;
    },
    complete,
    cancel: () => complete(pending?.completion),
    start: () => {
      const state = progress();
      if (
        pending?.mode === "restart" &&
        pending.startedAttempt === state.attempt &&
        !state.attempt.signal.aborted &&
        !state.restarting &&
        !stopped() &&
        !live.signal.aborted
      ) {
        live.retry();
        void restart();
      }
      return schedule("restart", restart);
    },
    resume: (before?: () => void) =>
      schedule("resume", () => {
        before?.();
        wake();
      }),
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
        if (observed !== version || recovering || input?.current?.() === false)
          return settleDocumentWork(progress, () => schedule("observe"));
        input?.beforeRetry?.();
        return schedule("restart", restart);
      };
    },
  };
};

const settleDocumentWork = async (
  progress: () => {
    attempt: AbortController;
    dirty: boolean;
    running: Promise<void> | undefined;
    restarting: Promise<void> | undefined;
    targeted: Set<Promise<unknown>>;
  },
  queued: () => Promise<void>,
) => {
  const waiting = (work: ReturnType<typeof progress>) =>
    Boolean(work.restarting || (work.dirty && !work.running && !work.targeted.size));
  const observed = progress();
  if (waiting(observed)) return queued();
  await Promise.allSettled([observed.running, ...observed.targeted]);
  const next = progress();
  if (waiting(next)) return queued();
  if (observed.dirty || observed.attempt.signal.aborted) {
    await Promise.allSettled([next.running, ...next.targeted]);
    if (waiting(progress())) return queued();
  }
};
