import { createPreparationScope } from "pstdio-extensions";

export type CheckOwner = { scope: ReturnType<typeof createPreparationScope>; settled: boolean };
type PendingCheck = { completion: Promise<void>; owners: CheckOwner[] };

export const joinPreparationDependencies = <T>(
  caller: ReturnType<typeof createPreparationScope>,
  owners: CheckOwner[],
  work: Promise<T>,
) => {
  const leases = new Map<
    CheckOwner,
    { requested: boolean; continuations: typeof caller.continuations; release: () => void }
  >();
  const refresh = () => {
    const source = { requested: caller.requested, continuations: caller.continuations };
    for (const owner of owners) {
      const current = leases.get(owner);
      if (owner.settled || (!source.requested && !source.continuations.length)) {
        leases.delete(owner);
        current?.release();
      } else if (
        current?.requested !== source.requested ||
        current.continuations.length !== source.continuations.length ||
        current.continuations.some((continuation, index) => continuation !== source.continuations[index])
      ) {
        // Several continuations can wait through the same caller. Keep urgency through a lease transfer.
        leases.set(owner, { ...source, release: owner.scope.request(source) });
        current?.release();
      }
    }
  };
  const unsubscribe = caller.subscribe(refresh);
  refresh();
  return work.finally(() => {
    unsubscribe();
    for (const lease of leases.values()) lease.release();
  });
};

/** Runs preparation work under its own scope, so another caller that waits for it can lend it urgency. */
export const ownedPreparation = <T>(work: () => Promise<T>) => {
  const owner: CheckOwner = { scope: createPreparationScope(), settled: false };
  const settled = owner.scope.run(work).finally(() => {
    owner.settled = true;
    owner.scope.dispose();
  });
  return { owner, work: settled };
};

/** Waits for another caller's preparation work while lending it this caller's urgency. */
export const awaitOwnedPreparation = async <T>(owner: CheckOwner, work: T | Promise<T>) => {
  const caller = createPreparationScope();
  try {
    return await joinPreparationDependencies(caller, [owner], Promise.resolve(work));
  } finally {
    caller.dispose();
  }
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
  return { check, join, has: (id: string) => pending.has(id), clear: () => pending.clear() };
};
