// Experimental finite read owner. No production code imports this module.
// Scope must include permission identity as well as owner, filter, sort and selected fields.
export const createWindowedQuery = <T>(input: { read(signal: AbortSignal): Promise<T>; windowMs: number }) => {
  const listeners = new Set<(value: T) => void>();
  let generation = 0;
  let accepted = -1;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: Promise<void> | undefined;
  let controller: AbortController | undefined;
  let disposed = false;
  let required = false;
  let failedGeneration = -1;
  let value: T | undefined;
  const waiting = new Set<{ resolve(value: T): void; reject(error: unknown): void }>();
  const metrics = { reads: 0, invalidations: 0, obsolete: 0, maximumOutstanding: 0, failures: 0 };

  const schedule = () => {
    // The first event sets a fixed deadline; later events never move it.
    if (
      disposed ||
      timer ||
      (!listeners.size && !required) ||
      accepted === generation ||
      failedGeneration === generation
    )
      return;
    timer = setTimeout(() => {
      timer = undefined;
      if (!active) void run();
    }, input.windowMs);
  };
  const run = () => {
    if (active) return active;
    if (disposed) return Promise.resolve();
    if (timer) clearTimeout(timer);
    timer = undefined;
    const issued = generation;
    metrics.reads++;
    metrics.maximumOutstanding = 1;
    controller = new AbortController();
    active = Promise.resolve()
      .then(() => input.read(controller!.signal))
      .then((next) => {
        if (disposed) return;
        if (issued !== generation) {
          metrics.obsolete++;
          return;
        }
        value = next;
        accepted = issued;
        required = false;
        for (const listener of listeners) listener(next);
        for (const waiter of waiting) waiter.resolve(next);
        waiting.clear();
      })
      .catch((error) => {
        if (disposed) return;
        if (issued !== generation) {
          metrics.obsolete++;
          return;
        }
        metrics.failures++;
        required = false;
        for (const waiter of waiting) waiter.reject(error);
        waiting.clear();
        // A failure waits for an explicit retry or a new invalidation.
        failedGeneration = generation;
      })
      .finally(() => {
        active = undefined;
        controller = undefined;
        if (accepted !== generation && !disposed) {
          if (required) void run();
          else schedule();
        }
      });
    return active;
  };
  return {
    metrics,
    subscribe(listener: (value: T) => void) {
      if (disposed) throw new Error("Query disposed");
      listeners.add(listener);
      if (accepted === generation && value !== undefined) listener(value);
      else if (!active) void run();
      return () => {
        listeners.delete(listener);
        if (!listeners.size && timer) {
          clearTimeout(timer);
          timer = undefined;
        }
      };
    },
    invalidate() {
      if (disposed) return;
      generation++;
      metrics.invalidations++;
      schedule();
    },
    read() {
      if (disposed) return Promise.reject(new Error("Query disposed"));
      if (accepted === generation) return Promise.resolve(value!);
      required = true;
      const pending = Promise.withResolvers<T>();
      waiting.add(pending);
      void run();
      return pending.promise;
    },
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
      listeners.clear();
      for (const waiter of waiting) waiter.reject(new Error("Query disposed"));
      waiting.clear();
    },
  };
};

export const createWindowedQueryPool = <T>(windowMs: number) => {
  const owners = new Map<string, ReturnType<typeof createWindowedQuery<T>>>();
  return {
    query(
      identity: { runtime: string; project: string; extension: string; permission: string; query: string },
      read: (signal: AbortSignal) => Promise<T>,
    ) {
      const key = JSON.stringify([
        identity.runtime,
        identity.project,
        identity.extension,
        identity.permission,
        identity.query,
      ]);
      let owner = owners.get(key);
      if (!owner) {
        owner = createWindowedQuery({ read, windowMs });
        owners.set(key, owner);
      }
      return owner;
    },
    dispose() {
      for (const owner of owners.values()) owner.dispose();
      owners.clear();
    },
  };
};
