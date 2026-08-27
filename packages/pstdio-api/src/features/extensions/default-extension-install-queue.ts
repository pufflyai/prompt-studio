let defaultExtensionInstallQueue: Promise<void> = Promise.resolve();

export const enqueueDefaultExtensionInstall = <T>(install: () => Promise<T>, signal?: AbortSignal) => {
  const queued = defaultExtensionInstallQueue.then(() => {
    signal?.throwIfAborted();
    return install();
  });
  defaultExtensionInstallQueue = queued.then(
    () => undefined,
    () => undefined,
  );
  if (!signal) return queued;

  const abort = Promise.withResolvers<never>();
  const onAbort = () => abort.reject(signal.reason);
  if (signal.aborted) {
    onAbort();
  } else {
    signal.addEventListener("abort", onAbort, { once: true });
  }
  return Promise.race([queued, abort.promise]).finally(() => signal.removeEventListener("abort", onAbort));
};
