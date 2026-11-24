import { AsyncLocalStorage } from "node:async_hooks";

interface PreparationPriority {
  priority: "requested" | "background" | "restoration";
  jobs: Set<() => void>;
  continuing?: boolean;
  continuation?: PreparationPriority;
  continuations?: readonly PreparationPriority[];
  /** Whether this scope's work belongs to `owner`, inherited or lent. `continuation` only names the most urgent one. */
  includes?: (owner: PreparationPriority) => boolean;
}

/** Exact membership, independent of which continuation ranks first. */
export const preparationIncludes = (scope: PreparationPriority | undefined, owner: PreparationPriority) =>
  scope?.includes ? scope.includes(owner) : scope?.continuation === owner;
type ContinuationScope = Pick<PreparationPriority, "continuation" | "continuations">;
const liveContinuations = (scope?: ContinuationScope) =>
  scope?.continuations ?? (scope?.continuation?.continuing ? [scope.continuation] : []);

export const preparationPriority = new AsyncLocalStorage<PreparationPriority>();
// Background work inside a scope still belongs to everything that scope belongs to, including
// continuations lent to it later, and is refreshed when those loans change.
export const withBackgroundPreparation = <T>(work: () => T) => {
  const parent = preparationPriority.getStore();
  const scope: PreparationPriority = {
    priority: "background",
    jobs: parent?.jobs ?? new Set(),
    get continuation() {
      return parent?.continuation;
    },
    get continuations() {
      return liveContinuations(parent);
    },
    includes: (owner) => preparationIncludes(parent, owner),
  };
  return preparationPriority.run(scope, work);
};
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
  let foregroundLoans = 0;
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
    get continuations() {
      return [...new Set([...liveContinuations(parent), ...borrowed.keys()])].filter((owner) => owner.continuing);
    },
    get priority() {
      return (parent?.priority ?? "requested") === "requested" || foregroundLoans ? "requested" : "background";
    },
    includes: (owner) => (borrowed.has(owner) && owner.continuing === true) || preparationIncludes(parent, owner),
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
    get continuations() {
      return liveContinuations(scope);
    },
    subscribe: (listener: () => void) => {
      scope.jobs.add(listener);
      return () => scope.jobs.delete(listener);
    },
    get requested() {
      return scope.priority === "requested";
    },
    run: <T>(work: () => T) => preparationPriority.run(scope, work),
    request: (caller?: { requested: boolean } & ContinuationScope) => {
      const requested = caller?.requested ?? true;
      const loaned = liveContinuations(caller).filter((owner) => owner.continuing);
      if (!requested && !loaned.length) return () => {};
      if (requested) foregroundLoans++;
      for (const owner of loaned) {
        borrowed.set(owner, (borrowed.get(owner) ?? 0) + 1);
        if (owner.jobs !== parent?.jobs) owner.jobs.add(changed);
      }
      changed();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        if (requested) foregroundLoans--;
        for (const owner of loaned) {
          const remaining = (borrowed.get(owner) ?? 1) - 1;
          if (remaining) borrowed.set(owner, remaining);
          else {
            borrowed.delete(owner);
            if (owner.jobs !== parent?.jobs) owner.jobs.delete(changed);
          }
        }
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
    hasUrgentOtherThan: (owner?: PreparationPriority) =>
      [...owners.keys()].some((current) => current !== owner && current.priority !== "background"),
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
