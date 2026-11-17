import { runQueryCleanup } from "./query-cleanup";

/** Cache removal finishes before an abort callback may reopen that query identity. */
export const createQueryReadSignals = (retiring: () => boolean) => {
  const abortReads = new Set<() => void>();
  return {
    async read<T>(signal: AbortSignal, read: (signal: AbortSignal) => T | Promise<T>) {
      const controller = new AbortController();
      const abort = () => controller.abort(signal.reason);
      const forward = () => {
        if (!retiring()) abort();
      };
      abortReads.add(abort);
      signal.addEventListener("abort", forward, { once: true });
      try {
        if (signal.aborted) abort();
        return await read(controller.signal);
      } finally {
        signal.removeEventListener("abort", forward);
        abortReads.delete(abort);
      }
    },
    abort: () => runQueryCleanup([...abortReads]),
  };
};
