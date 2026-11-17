import type { ScopedQuery, ScopedQuerySnapshot } from "@pstdio/sdk/extensions";

const publication = <T>(snapshot: ScopedQuerySnapshot<T>, applied: T | undefined, fallback: () => T | undefined) => {
  const coldFailure = snapshot.error !== undefined && snapshot.data === undefined;
  return {
    value: snapshot.data ?? (coldFailure ? (applied ?? fallback()) : undefined),
    complete: !snapshot.fetching && (!snapshot.error || coldFailure),
  };
};

/** Registration lifetime observes the canonical query without owning a second request queue/cache. */
export const createExtensionQueryObservation = <T>(input: {
  query(projectId: string): ScopedQuery<T>;
  isAvailable(): boolean;
  apply(projectId: string, value: T): void;
  fallback(): T | undefined;
  onComplete?(projectId: string): void;
  onPending?(projectId: string): void;
  onRetire?(projectId: string): void;
}) => {
  let current: { projectId: string; query: ScopedQuery<T>; stop(): void } | undefined;
  const clear = () => {
    current?.stop();
    current = undefined;
  };
  const observe = (projectId: string, invalidate: boolean) => {
    if (!input.isAvailable()) {
      clear();
      if (invalidate) input.query(projectId).invalidate();
      return;
    }
    if (current?.projectId === projectId && !current.query.isDisposed()) {
      if (invalidate) current.query.invalidate();
      return;
    }
    clear();
    const query = input.query(projectId);
    let applied: T | undefined;
    let appliedRevision = -1;
    let active = true;
    const applySnapshot = (snapshot: ScopedQuerySnapshot<T>) => {
      if (snapshot.fetching) input.onPending?.(projectId);
      const { value, complete } = publication(snapshot, applied, input.fallback);
      const revision = query.inspect().revision;
      const settledRefresh = complete && !snapshot.error && appliedRevision !== revision;
      if (value !== undefined && (value !== applied || settledRefresh)) {
        applied = value;
        appliedRevision = revision;
        input.apply(projectId, value);
      }
      if (complete && value !== undefined) input.onComplete?.(projectId);
    };
    const update = () => {
      if (!active) return;
      if (!input.isAvailable()) {
        clear();
        return;
      }
      if (query.isDisposed()) {
        clear();
        input.onRetire?.(projectId);
        observe(projectId, false);
        return;
      }
      applySnapshot(query.getSnapshot());
    };
    let stop = () => {};
    current = {
      projectId,
      query,
      stop: () => {
        active = false;
        stop();
        if (!query.active() && query.getSnapshot().fetching) query.cancel();
      },
    };
    stop = query.subscribe(update);
    if (!active) stop();
    else update();
  };
  return {
    clear,
    refresh: (projectId: string) => observe(projectId, true),
    resume: (projectId: string) => observe(projectId, false),
    value: () => current?.query.getSnapshot().data,
  };
};
