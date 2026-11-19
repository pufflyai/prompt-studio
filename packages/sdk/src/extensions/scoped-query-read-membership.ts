import { runQueryCleanup } from "./query-cleanup";
import type { ScopedQuerySnapshot } from "./scoped-query";

/** A signalled read owns an optional observation, never another caller's required read. */
export const readScopedQueryMembership = async <T>(
  query: {
    getSnapshot(): ScopedQuerySnapshot<T>;
    inspect(): { stale: boolean };
    isDisposed(): boolean;
    subscribe(listener: () => void): () => void;
    subscribeInvalidation(listener: () => void): () => void;
  },
  signal: AbortSignal,
) => {
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    let done = false;
    let stopSnapshot = () => {},
      stopInvalidation = () => {};
    const cleanup = () =>
      runQueryCleanup([
        () => signal.removeEventListener("abort", abort),
        () => {
          const stop = stopSnapshot;
          stopSnapshot = () => {};
          stop();
        },
        () => {
          const stop = stopInvalidation;
          stopInvalidation = () => {};
          stop();
        },
      ]);
    const settle = (result: { ok: true; value: T } | { ok: false; error: unknown }) => {
      if (done) return;
      done = true;
      let cleanupError: unknown;
      let cleanupFailed = false;
      try {
        cleanup();
      } catch (error) {
        cleanupError = error;
        cleanupFailed = true;
      }
      if (!result.ok) reject(result.error);
      else if (cleanupFailed) reject(cleanupError);
      else resolve(result.value);
    };
    const abort = () => settle({ ok: false, error: signal.reason });
    const changed = () => {
      if (done) return;
      if (query.isDisposed()) {
        settle({ ok: false, error: new Error("Query owner is disposed") });
        return;
      }
      const snapshot = query.getSnapshot();
      if (snapshot.fetching || query.inspect().stale) return;
      if (snapshot.error) settle({ ok: false, error: snapshot.error });
      else if (snapshot.data !== undefined) settle({ ok: true, value: snapshot.data });
    };
    signal.addEventListener("abort", abort, { once: true });
    try {
      stopInvalidation = query.subscribeInvalidation(changed);
      stopSnapshot = query.subscribe(changed);
      if (done) cleanup();
      else changed();
    } catch (error) {
      settle({ ok: false, error });
    }
  });
};
