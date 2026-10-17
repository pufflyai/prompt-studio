export const createAssetOperations = (ready: () => Promise<void>, shutdown: () => Promise<void>) => {
  const controllers = new Set<AbortController>();
  const pending = new Set<Promise<unknown>>();
  let closing: Promise<void> | undefined;
  const abort = (reason: unknown) => {
    for (const controller of controllers) controller.abort(reason);
  };
  return {
    abort,
    run<T>(
      action: (controller: AbortController) => Promise<T>,
      signal?: AbortSignal,
      release?: () => Promise<unknown>,
    ) {
      if (closing) return Promise.reject(new Error("Asset owner is closed")).finally(release);
      const controller = new AbortController();
      const interrupted = Promise.withResolvers<never>();
      const stop = () => controller.abort(signal?.reason);
      const reject = () => interrupted.reject(controller.signal.reason);
      controller.signal.addEventListener("abort", reject, { once: true });
      signal?.addEventListener("abort", stop, { once: true });
      if (signal?.aborted) stop();
      controllers.add(controller);
      const operation = (async () => {
        await Promise.race([ready(), interrupted.promise]);
        controller.signal.throwIfAborted();
        return action(controller);
      })().finally(async () => {
        try {
          await release?.();
        } finally {
          controllers.delete(controller);
          pending.delete(operation);
          signal?.removeEventListener("abort", stop);
          controller.signal.removeEventListener("abort", reject);
        }
      });
      pending.add(operation);
      return operation;
    },
    close() {
      if (closing) return closing;
      const result = Promise.withResolvers<void>();
      closing = result.promise;
      abort(new Error("Asset owner is closed"));
      void Promise.allSettled([...pending])
        .then(shutdown)
        .then(result.resolve, result.reject);
      return closing;
    },
  };
};
