/** Superseded background reads yield the host queue; required callers can resume them immediately. */
export const createQueryReadYield = (required: () => boolean, assertOpen: () => void) => {
  let resume: (() => void) | undefined;
  return {
    resume: () => resume?.(),
    async wait(signal?: AbortSignal) {
      signal?.throwIfAborted();
      if (!required())
        await new Promise<void>((resolve) => {
          const finish = () => {
            clearTimeout(timer);
            signal?.removeEventListener("abort", abort);
            resume = undefined;
            resolve();
          };
          const abort = finish;
          const timer = setTimeout(finish, 100);
          resume = finish;
          signal?.addEventListener("abort", abort, { once: true });
        });
      signal?.throwIfAborted();
      assertOpen();
    },
  };
};
