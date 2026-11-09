export const closeSessionMetadata = (actions: readonly (() => void)[]) => {
  const errors: unknown[] = [];
  for (const action of actions) {
    try {
      action();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) throw new AggregateError(errors, "Session metadata cleanup failed");
};

/** Stop waiting immediately; the owner still retains and cleans up a late source installation. */
export const waitForSessionMetadata = (ready: Promise<void>, signals: (AbortSignal | undefined)[]) => {
  const active = signals.filter((signal): signal is AbortSignal => Boolean(signal));
  if (!active.length) return ready;
  return new Promise<void>((resolve, reject) => {
    const release = () => {
      for (const signal of active) signal.removeEventListener("abort", aborted);
    };
    const aborted = () => {
      release();
      reject(active.find((signal) => signal.aborted)?.reason);
    };
    ready.then(
      () => {
        release();
        resolve();
      },
      (error) => {
        release();
        reject(error);
      },
    );
    for (const signal of active) signal.addEventListener("abort", aborted, { once: true });
    if (active.some((signal) => signal.aborted)) aborted();
  });
};
