/** One write is active at a time. Under backpressure, the newest bounded snapshot replaces the pending one. */
export const createCheckpointWriter = <T extends { skippedCheckpoints: number }>(
  write: (value: T) => Promise<void>,
  onError: (error: unknown) => void,
) => {
  let pending: T | undefined;
  let active: Promise<void> | undefined;
  let failure: { error: unknown } | undefined;
  let stopped = false;
  let skipped = 0;
  const drain = async () => {
    while (pending && !stopped) {
      const value = pending;
      pending = undefined;
      await write(value);
    }
  };
  const start = () => {
    if (active || !pending || stopped) return;
    active = drain()
      .catch((error: unknown) => {
        failure = { error };
        stopped = true;
        pending = undefined;
        onError(error);
      })
      .finally(() => {
        active = undefined;
        start();
      });
  };
  return {
    queue(value: T) {
      if (failure) throw failure.error;
      if (stopped) return;
      if (pending) skipped++;
      value.skippedCheckpoints = skipped;
      pending = value;
      start();
    },
    async flush(signal: AbortSignal) {
      signal.throwIfAborted();
      const aborted = Promise.withResolvers<never>();
      const abort = () => aborted.reject(signal.reason);
      signal.addEventListener("abort", abort, { once: true });
      try {
        while (active) await Promise.race([active, aborted.promise]);
        if (failure) throw failure.error;
      } finally {
        signal.removeEventListener("abort", abort);
      }
    },
    stop() {
      stopped = true;
      pending = undefined;
    },
  };
};
