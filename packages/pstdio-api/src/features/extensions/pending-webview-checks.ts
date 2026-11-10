import { createPreparationScope } from "pstdio-extensions";

export type CheckOwner = { scope: ReturnType<typeof createPreparationScope>; settled: boolean };
type PendingCheck = { completion: Promise<void>; owners: CheckOwner[] };

export const joinPreparationDependencies = <T>(
  caller: ReturnType<typeof createPreparationScope>,
  owners: CheckOwner[],
  work: Promise<T>,
) => {
  const leases = new Map<CheckOwner, () => void>();
  const refresh = () => {
    for (const owner of owners) {
      if (caller.requested && !owner.settled && !leases.has(owner)) leases.set(owner, owner.scope.request());
      else if ((!caller.requested || owner.settled) && leases.has(owner)) {
        leases.get(owner)!();
        leases.delete(owner);
      }
    }
  };
  const unsubscribe = caller.subscribe(refresh);
  refresh();
  return work.finally(() => {
    unsubscribe();
    for (const release of leases.values()) release();
  });
};

// Refresh callers await their own work. Requests depend on every overlapping check,
// and lend urgency to all of those checks without repeating their inspection work.
export const createPendingWebviewChecks = (onChecked: (id: string, webviews: string[]) => void) => {
  const pending = new Map<string, PendingCheck>();
  const check = (id: string, run: () => Promise<string[] | null>) => {
    const previous = pending.get(id);
    const owner = { scope: createPreparationScope(), settled: false };
    const work = owner.scope.run(run).finally(() => {
      owner.settled = true;
      owner.scope.dispose();
    });
    const entry: PendingCheck = {
      owners: [...(previous?.owners.filter((item) => !item.settled) ?? []), owner],
      completion: Promise.allSettled([previous?.completion, work])
        .then(([earlier, current]) => {
          if (earlier.status === "rejected") throw earlier.reason;
          if (current.status === "rejected") throw current.reason;
          if (pending.get(id) === entry && current.value) onChecked(id, current.value);
        })
        .finally(() => {
          if (pending.get(id) === entry) pending.delete(id);
        }),
    };
    pending.set(id, entry);
    void entry.completion.catch(() => {});
    return work;
  };
  const join = (id: string) => {
    const entry = pending.get(id);
    if (!entry) return undefined;
    const caller = createPreparationScope();
    return joinPreparationDependencies(caller, entry.owners, entry.completion).finally(() => caller.dispose());
  };
  return { check, join, clear: () => pending.clear() };
};
