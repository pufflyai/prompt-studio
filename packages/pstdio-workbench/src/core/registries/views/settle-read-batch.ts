// Every issued child must settle before its parent's counted read slot is free.
export const settleReadBatch = async <T>(tasks: ((signal: AbortSignal) => Promise<T> | T)[], signal?: AbortSignal) => {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  let firstError: unknown;
  try {
    const results = await Promise.allSettled(
      tasks.map(async (load) => {
        try {
          controller.signal.throwIfAborted();
          return await load(controller.signal);
        } catch (error) {
          firstError ??= error;
          controller.abort(error);
          throw error;
        }
      }),
    );
    if (firstError !== undefined) throw firstError;
    signal?.throwIfAborted();
    return results.map((result) => {
      if (result.status === "rejected") throw result.reason;
      return result.value;
    });
  } finally {
    signal?.removeEventListener("abort", abort);
  }
};
