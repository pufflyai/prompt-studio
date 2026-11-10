import { AsyncLocalStorage } from "node:async_hooks";

interface PreparationPriority {
  priority: "requested" | "background";
  jobs: Set<() => void>;
  continuing?: boolean;
  continuation?: PreparationPriority;
}
export const preparationPriority = new AsyncLocalStorage<PreparationPriority>();
export const withBackgroundPreparation = <T>(work: () => T) =>
  preparationPriority.run(
    { priority: "background", jobs: new Set(), continuation: preparationPriority.getStore()?.continuation },
    work,
  );
export const withRequestedPreparation = <T>(work: () => T) => {
  const scope: PreparationPriority = { priority: "requested", jobs: new Set(), continuing: true };
  scope.continuation = scope;
  const finish = () => {
    scope.continuing = false;
    for (const refresh of scope.jobs) refresh();
  };
  try {
    const result = preparationPriority.run(scope, work);
    if (result instanceof Promise) return result.finally(finish) as T;
    finish();
    return result;
  } catch (error) {
    finish();
    throw error;
  }
};
// A foreground dependency lends urgency only while its queued caller still needs it.
export const createPreparationScope = () => {
  const parent = preparationPriority.getStore();
  let owners = 0;
  const scope: PreparationPriority = {
    continuation: parent?.continuation,
    get priority() {
      return (parent?.priority ?? "requested") === "requested" || owners ? "requested" : "background";
    },
    jobs: new Set(),
  };
  const changed = () => {
    for (const refresh of scope.jobs) refresh();
  };
  parent?.jobs.add(changed);
  return {
    dispose: () => parent?.jobs.delete(changed),
    subscribe: (listener: () => void) => {
      scope.jobs.add(listener);
      return () => scope.jobs.delete(listener);
    },
    get requested() {
      return scope.priority === "requested";
    },
    run: <T>(work: () => T) => preparationPriority.run(scope, work),
    request: () => {
      owners++;
      changed();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        owners--;
        changed();
      };
    },
  };
};

export const createPreparationContinuations = (resume: () => void) => {
  const owners = new Map<PreparationPriority, () => void>();
  return {
    get size() {
      return owners.size;
    },
    retain: (scope?: PreparationPriority) => {
      const owner = scope?.continuation;
      if (!owner?.continuing || owners.has(owner)) return;
      const finished = () => {
        if (owner.continuing) return;
        owners.delete(owner);
        owner.jobs.delete(finished);
        resume();
      };
      owners.set(owner, finished);
      owner.jobs.add(finished);
    },
    clear: () => {
      for (const [owner, finished] of owners) owner.jobs.delete(finished);
      owners.clear();
    },
  };
};
