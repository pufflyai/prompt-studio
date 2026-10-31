const queues = new Map<string, Promise<void>>();

export const enqueueDefaultExtensionInstall = <T>(target: string, install: () => Promise<T>, signal?: AbortSignal) => {
  const queued = (queues.get(target) ?? Promise.resolve()).then(() => {
    signal?.throwIfAborted();
    return install();
  });
  const settled = queued.then(
    () => undefined,
    () => undefined,
  );
  queues.set(target, settled);
  void settled.then(() => {
    if (queues.get(target) === settled) queues.delete(target);
  });
  return queued;
};

// The caller may stop waiting, but the batch retains its shared source checkout until all
// installers stop. Aborting an individual queued install must not remove an active checkout.
export const waitForDefaultExtensionInstall = <T>(queued: Promise<T>, signal?: AbortSignal) => {
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
