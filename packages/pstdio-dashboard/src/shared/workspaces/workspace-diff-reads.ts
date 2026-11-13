import { settleReadBatch } from "@pstdio/workbench";

/** Refill each available slot while retaining the four-read bound and actual-child drain. */
export const settleWorkspaceDiffReads = async <T>(
  reads: ((signal: AbortSignal) => Promise<T> | T)[],
  signal?: AbortSignal,
) => {
  const results = new Array<T>(reads.length);
  let next = 0;
  await settleReadBatch(
    Array.from({ length: Math.min(4, reads.length) }, () => async (signal) => {
      while (next < reads.length) {
        signal.throwIfAborted();
        const index = next++;
        results[index] = await reads[index]!(signal);
      }
    }),
    signal,
  );
  return results;
};
