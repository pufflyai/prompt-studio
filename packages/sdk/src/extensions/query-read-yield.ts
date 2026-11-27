/** Superseded background reads yield the host queue; required callers can resume them immediately. */
export const createQueryReadYield = (required: () => boolean, assertOpen: () => void, initial: () => boolean) => {
  let correctedInitial = false;
  let resume: (() => void) | undefined;
  return {
    resume: () => resume?.(),
    async wait(signal?: AbortSignal) {
      signal?.throwIfAborted();
      if (!required()) {
        // A panel with no data should reconcile once promptly; recurring changes still yield.
        const delay = initial() && !correctedInitial ? 0 : 100;
        correctedInitial = true;
        await new Promise<void>((resolve) => {
          const finish = () => {
            clearTimeout(timer);
            signal?.removeEventListener("abort", abort);
            resume = undefined;
            resolve();
          };
          const abort = finish;
          const timer = setTimeout(finish, delay);
          resume = finish;
          signal?.addEventListener("abort", abort, { once: true });
        });
      }
      signal?.throwIfAborted();
      assertOpen();
    },
  };
};
