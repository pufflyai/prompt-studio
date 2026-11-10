import { AsyncLocalStorage } from "node:async_hooks";

interface PreparationPriority {
  priority: "requested" | "background";
  jobs: Set<() => void>;
}
export const preparationPriority = new AsyncLocalStorage<PreparationPriority>();
export const withBackgroundPreparation = <T>(work: () => T) =>
  preparationPriority.run({ priority: "background", jobs: new Set() }, work);
export const withRequestedPreparation = <T>(work: () => T) =>
  preparationPriority.run({ priority: "requested", jobs: new Set() }, work);
// A foreground dependency lends urgency only while its queued caller still needs it.
export const createPreparationScope = () => {
  const parent = preparationPriority.getStore();
  let owners = 0;
  const scope: PreparationPriority = {
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
