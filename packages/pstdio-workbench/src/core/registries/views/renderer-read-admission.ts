import type { ScopedQuery, ScopedQueryClient } from "@pstdio/sdk/extensions";

type ReadQuery = Pick<ScopedQuery<unknown>, "cancel" | "invalidate" | "isDisposed">;

/** Every presentation of a query shares the barrier for accepted writes to that query. */
export const createRendererReadAdmission = () => {
  const listeners = new Set<() => void>();
  const queries = new Set<ReadQuery>();
  const prune = () => {
    for (const query of queries) if (query.isDisposed()) queries.delete(query);
  };
  let holds = 0;
  let pending = Promise.withResolvers<void>();
  pending.resolve();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    prune,
    register(query: ReadQuery) {
      prune();
      queries.add(query);
    },
    refresh(cancel = false) {
      prune();
      const errors: unknown[] = [];
      for (const query of [...queries]) {
        try {
          if (cancel) query.cancel();
          else query.invalidate();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length) throw new AggregateError(errors, "Native query invalidation failed");
    },
    held: () => holds > 0,
    active: () => listeners.size > 0,
    settled: () => pending.promise,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    hold() {
      if (!holds++) pending = Promise.withResolvers<void>();
      notify();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        if (--holds) return;
        pending.resolve();
        notify();
      };
    },
  };
};

const domains = new WeakMap<object, Map<string, ReturnType<typeof createRendererReadAdmission>>>();
export const rendererReadAdmissionFor = (
  client: ScopedQueryClient,
  authority: readonly unknown[],
  source: string,
  resource: string | undefined,
) => {
  let entries = domains.get(client);
  if (!entries) {
    entries = new Map();
    domains.set(client, entries);
    const current = entries;
    client.subscribeRetirement(() => {
      for (const admission of current.values()) admission.prune();
    });
  }
  const key = JSON.stringify([authority, source, resource]);
  const admission = entries.get(key) ?? createRendererReadAdmission();
  entries.delete(key);
  entries.set(key, admission);
  const inactive = [...entries].filter(([, entry]) => !entry.active() && !entry.held());
  for (const [key] of inactive.slice(0, Math.max(0, inactive.length - 128))) entries.delete(key);
  return admission;
};
