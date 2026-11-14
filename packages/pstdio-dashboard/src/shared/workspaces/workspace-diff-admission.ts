/** Three optional reads leave one finite HTTP/1.1 slot beside the two event streams. */
export const createWorkspaceDiffAdmission = () => {
  let active = 0;
  const waiting = new Set<() => void>();
  const acquire = (signal: AbortSignal) =>
    new Promise<() => void>((resolve, reject) => {
      const aborted = () => {
        waiting.delete(enter);
        reject(signal.reason);
      };
      const enter = () => {
        if (signal.aborted) return aborted();
        if (active >= 3) {
          waiting.add(enter);
          return;
        }
        waiting.delete(enter);
        signal.removeEventListener("abort", aborted);
        active++;
        resolve(() => {
          active--;
          waiting.values().next().value?.();
        });
      };
      signal.addEventListener("abort", aborted, { once: true });
      enter();
    });
  return async <T>(signal: AbortSignal, read: () => Promise<T>) => {
    const release = await acquire(signal);
    try {
      signal.throwIfAborted();
      return await read();
    } finally {
      release();
    }
  };
};
