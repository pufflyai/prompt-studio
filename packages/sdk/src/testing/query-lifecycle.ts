import type { ScopedQueryDescriptor } from "../extensions/scoped-query";

/** A finite source for exercising the same lifecycle through SDK or host adapters. No timers or network. */
export const createQueryLifecycleFixture = <T>(initial: T, identity: { id?: string; resourceKey?: string } = {}) => {
  let value = initial;
  let closed = false;
  const listeners = new Set<() => void>();
  const reads: { value: T; signal: AbortSignal; observing: boolean }[] = [];
  const pending: {
    entered: ReturnType<typeof Promise.withResolvers<AbortSignal>>;
    released: ReturnType<typeof Promise.withResolvers<void>>;
  }[] = [];
  const holds = new Set<(typeof pending)[number]>();
  const descriptor: ScopedQueryDescriptor<T> = {
    id: identity.id ?? "contract-source",
    resourceKey: identity.resourceKey,
    read: async (signal) => {
      const captured = value;
      reads.push({ value: captured, signal, observing: listeners.size > 0 });
      const held = pending.shift();
      if (held) {
        held.entered.resolve(signal);
        // Deliberately remain entered after abort so adapters must count the actual child.
        await held.released.promise;
        holds.delete(held);
      }
      signal.throwIfAborted();
      return captured;
    },
    subscribe: (invalidate) => {
      if (closed) throw new Error("Query fixture is closed");
      listeners.add(invalidate);
      return () => {
        listeners.delete(invalidate);
      };
    },
  };
  return {
    descriptor,
    change(next: T) {
      value = next;
      for (const listener of [...listeners]) listener();
    },
    holdNext() {
      const held = { entered: Promise.withResolvers<AbortSignal>(), released: Promise.withResolvers<void>() };
      pending.push(held);
      holds.add(held);
      return { entered: held.entered.promise, release: () => held.released.resolve() };
    },
    inspect: () => ({ reads: [...reads], subscribers: listeners.size }),
    close() {
      closed = true;
      for (const held of holds) held.released.resolve();
      holds.clear();
      pending.length = 0;
      listeners.clear();
    },
  };
};
