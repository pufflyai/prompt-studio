import { AsyncLocalStorage } from "node:async_hooks";

interface PreparationPriority {
  priority: "requested" | "background" | "restoration";
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
export const withContinuingPreparation = <T>(
  work: () => T,
  priority: "requested" | "background" | "restoration" = "requested",
) => {
  const scope: PreparationPriority = { priority, jobs: new Set(), continuing: true };
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
export const withRequestedPreparation = <T>(work: () => T) => withContinuingPreparation(work);
// A foreground dependency lends urgency only while its queued caller still needs it.
export const createPreparationScope = () => {
  const parent = preparationPriority.getStore();
  let owners = 0;
  const borrowed = new Map<PreparationPriority, number>();
  const ownerRank = (owner: PreparationPriority) => {
    if (owner.priority === "restoration") return 0;
    return owner.priority === "requested" ? 1 : 2;
  };
  const scope: PreparationPriority = {
    get continuation() {
      return [parent?.continuation, ...borrowed.keys()]
        .filter((owner): owner is PreparationPriority => owner?.continuing === true)
        .sort((a, b) => ownerRank(a) - ownerRank(b))[0];
    },
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
    dispose: () => {
      parent?.jobs.delete(changed);
      for (const owner of borrowed.keys()) owner.jobs.delete(changed);
      borrowed.clear();
    },
    get continuation() {
      return scope.continuation;
    },
    subscribe: (listener: () => void) => {
      scope.jobs.add(listener);
      return () => scope.jobs.delete(listener);
    },
    get requested() {
      return scope.priority === "requested";
    },
    run: <T>(work: () => T) => preparationPriority.run(scope, work),
    request: (caller?: { requested: boolean; continuation?: PreparationPriority }) => {
      const background = caller && !caller.requested;
      const owner = background ? caller.continuation : undefined;
      if (background && !owner?.continuing) return () => {};
      if (owner) {
        borrowed.set(owner, (borrowed.get(owner) ?? 0) + 1);
        owner.jobs.add(changed);
      } else owners++;
      changed();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        if (owner) {
          const remaining = (borrowed.get(owner) ?? 1) - 1;
          if (remaining) borrowed.set(owner, remaining);
          else {
            borrowed.delete(owner);
            owner.jobs.delete(changed);
          }
        } else owners--;
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
    get restoring() {
      return [...owners.keys()].some((owner) => owner.priority === "restoration");
    },
    hasOtherThan: (owner?: PreparationPriority) => [...owners.keys()].some((current) => current !== owner),
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
