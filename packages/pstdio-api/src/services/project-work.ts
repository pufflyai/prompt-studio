import { AsyncLocalStorage } from "node:async_hooks";

export class ProjectRemovalInProgress extends Error {
  constructor() {
    super("This device is removing its copy of the project");
  }
}

/** A gate for work whose lifetime extends beyond a project lookup. */
export const createProjectWork = () => {
  const suspended = new Set<string>();
  const hidden = new Set<string>();
  const cleanup = new AsyncLocalStorage<{ id: string; active: boolean }>();
  const active = new Map<string, Map<AbortController, Promise<unknown>>>();
  const assertAvailable = (id: string) => {
    if (suspended.has(id)) throw new ProjectRemovalInProgress();
  };
  return {
    blocked: (id: string) => suspended.has(id),
    hidden: (id: string) => hidden.has(id),
    hide: (id: string) => hidden.add(id),
    canRead: (id: string) => {
      const owner = cleanup.getStore();
      return !hidden.has(id) || (owner?.id === id && owner.active);
    },
    async readDuringCleanup<T>(id: string, task: () => Promise<T>) {
      const owner = { id, active: true };
      try {
        return await cleanup.run(owner, task);
      } finally {
        owner.active = false;
      }
    },
    assertAvailable,
    suspend(id: string) {
      suspended.add(id);
      for (const controller of active.get(id)?.keys() ?? []) controller.abort(new ProjectRemovalInProgress());
    },
    release(id: string) {
      suspended.delete(id);
      hidden.delete(id);
    },
    async drain(id: string) {
      await Promise.allSettled(active.get(id)?.values() ?? []);
    },
    async run<T>(id: string, task: (signal: AbortSignal) => Promise<T>, upstream?: AbortSignal) {
      assertAvailable(id);
      const controller = new AbortController();
      const signal = upstream ? AbortSignal.any([upstream, controller.signal]) : controller.signal;
      const leases = active.get(id) ?? new Map<AbortController, Promise<unknown>>();
      active.set(id, leases);
      const running = Promise.resolve().then(() => {
        signal.throwIfAborted();
        return task(signal);
      });
      leases.set(controller, running);
      try {
        return await running;
      } finally {
        leases.delete(controller);
        if (!leases.size) active.delete(id);
      }
    },
  };
};
