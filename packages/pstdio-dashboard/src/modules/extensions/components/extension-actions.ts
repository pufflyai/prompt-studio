import type { ExtensionActionState } from "./extension-action-feedback";

export interface ExtensionUpgradeBatch {
  ids: string[];
  startedAt: number;
  finishedAt?: number;
  completed: number;
  failed: number;
}

export const marketplaceActionKey = (name: string) => `marketplace:${name}`;

interface ActionSnapshot {
  installedIds: Record<string, string>;
  replacement: { name: string; retry: () => Promise<void> } | null;
  actions: Record<string, ExtensionActionState>;
  batch?: ExtensionUpgradeBatch;
}

export const createExtensionActions = () => {
  let snapshot: ActionSnapshot = { actions: {}, installedIds: {}, replacement: null };
  const listeners = new Set<() => void>();
  const active = new Set<string>();
  const retries = new Map<string, () => Promise<boolean>>();
  let batchRunning = false;
  const publish = (next: ActionSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  const setAction = (id: string, action: ExtensionActionState) =>
    publish({ ...snapshot, actions: { ...snapshot.actions, [id]: action } });
  const dismiss = (id: string, expected = snapshot.actions[id]) => {
    if (snapshot.actions[id] !== expected) return;
    if (active.has(id) || snapshot.actions[id]?.status === "queued") return;
    retries.delete(id);
    const actions = { ...snapshot.actions };
    delete actions[id];
    publish({ ...snapshot, actions });
  };
  const run = async <T>(
    id: string,
    labels: { running: string; success: string; failed: string },
    work: (started: () => void) => Promise<T>,
    options: { queuedLabel?: string; installedId?: (result: T) => string } = {},
  ) => {
    if (active.has(id)) return false;
    active.add(id);
    retries.delete(id);
    let startedAt: number | undefined;
    const start = () => {
      startedAt = Date.now();
      setAction(id, { status: "running", label: labels.running, startedAt });
    };
    if (options.queuedLabel) setAction(id, { status: "queued", label: options.queuedLabel });
    else start();
    try {
      const result = await work(start);
      const action = { status: "success", label: labels.success, startedAt, finishedAt: Date.now() } as const;
      const instanceId = options.installedId?.(result);
      if (instanceId) {
        const actions = { ...snapshot.actions };
        delete actions[id];
        if (!active.has(instanceId)) {
          retries.delete(instanceId);
          actions[instanceId] = action;
        }
        publish({ ...snapshot, actions, installedIds: { ...snapshot.installedIds, [id]: instanceId } });
      } else setAction(id, action);
      return true;
    } catch (error) {
      retries.set(id, () => run(id, labels, work, options));
      setAction(id, {
        status: "error",
        label: labels.failed,
        error: error instanceof Error ? error.message : String(error),
        startedAt,
        finishedAt: Date.now(),
      });
      return false;
    } finally {
      active.delete(id);
    }
  };
  const runBatch = async <T extends { id: string }>(targets: T[], upgrade: (target: T) => Promise<unknown>) => {
    if (batchRunning) return;
    const pending = targets.filter(({ id }) => !active.has(id));
    if (!pending.length) return;
    batchRunning = true;
    publish({
      ...snapshot,
      batch: { ids: pending.map(({ id }) => id), startedAt: Date.now(), completed: 0, failed: 0 },
    });
    try {
      await Promise.all(
        pending.map(async (target) => {
          let failed = false;
          try {
            failed = (await upgrade(target)) === false;
          } catch {
            failed = true;
          } finally {
            const batch = snapshot.batch!;
            publish({
              ...snapshot,
              batch: { ...batch, completed: batch.completed + 1, failed: batch.failed + Number(failed) },
            });
          }
        }),
      );
    } finally {
      batchRunning = false;
      publish({ ...snapshot, batch: { ...snapshot.batch!, finishedAt: Date.now() } });
    }
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dismiss,
    setReplacement: (replacement: ActionSnapshot["replacement"]) => publish({ ...snapshot, replacement }),
    dismissBatch: (expected = snapshot.batch) => {
      if (batchRunning || snapshot.batch !== expected) return;
      publish({ ...snapshot, batch: undefined });
    },
    run,
    runBatch,
    retry: (id: string) => {
      void retries.get(id)?.();
    },
  };
};

// Both pages observe the same inventory. A new project or runtime gets a new owner.
const owners = new WeakMap<object, ReturnType<typeof createExtensionActions>>();
export const getExtensionActions = (inventory: object) => {
  let owner = owners.get(inventory);
  if (!owner) {
    owner = createExtensionActions();
    owners.set(inventory, owner);
  }
  return owner;
};

export const resolveExtensionAction = (actions: Record<string, ExtensionActionState>, extension: { id: string }) => ({
  key: extension.id,
  action: actions[extension.id],
});
