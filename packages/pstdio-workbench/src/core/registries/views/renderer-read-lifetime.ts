/** Optional projections close admission synchronously and drain entered children before their core releases resources. */
export const createRendererReadLifetime = (finish: () => void) => {
  const releases = new Set<() => void>();
  const jobs = new Set<Promise<unknown>>();
  let closed = false;
  let disposal: Promise<void> | undefined;
  const assertOpen = () => {
    if (closed) throw new DOMException("Renderer read cache is retired", "AbortError");
  };
  return {
    assertOpen,
    isDisposed: () => closed,
    onDispose(release: () => void) {
      if (closed) {
        release();
        return () => {};
      }
      releases.add(release);
      return () => {
        releases.delete(release);
      };
    },
    track(job: Promise<unknown>) {
      assertOpen();
      jobs.add(job);
      void job.then(
        () => jobs.delete(job),
        () => jobs.delete(job),
      );
    },
    dispose() {
      if (disposal) return disposal;
      closed = true;
      const settled = Promise.withResolvers<void>();
      disposal = settled.promise;
      const errors: unknown[] = [];
      for (const release of [...releases]) {
        try {
          release();
        } catch (error) {
          errors.push(error);
        }
      }
      releases.clear();
      void Promise.allSettled([...jobs]).then(() => {
        try {
          finish();
        } catch (error) {
          errors.push(error);
        }
        if (errors.length) settled.reject(new AggregateError(errors, "Renderer query disposal failed"));
        else settled.resolve();
      });
      return disposal;
    },
  };
};
