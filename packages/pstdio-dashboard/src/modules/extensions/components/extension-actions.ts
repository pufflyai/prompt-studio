import type { ExtensionActionState } from "./extension-action-feedback";

export interface ExtensionUpgradeBatch {
  ids: string[];
  running: boolean;
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
    if (expected?.status !== "error" || snapshot.actions[id] !== expected || active.has(id)) return;
    retries.delete(id);
    const actions = { ...snapshot.actions };
    delete actions[id];
    publish({ ...snapshot, actions });
  };
  const run = async <T>(
    id: string,
    labels: { running: string; failed: string },
    work: (started: () => void) => Promise<T>,
    options: {
      operation?: ExtensionActionState["operation"];
      queuedLabel?: string;
      installedId?: (result: T) => string;
    } = {},
  ) => {
    if (active.has(id)) return false;
    active.add(id);
    retries.delete(id);
    const { operation, queuedLabel } = options;
    const start = () => setAction(id, { operation, status: "running", label: labels.running });
    if (queuedLabel) setAction(id, { operation, status: "queued", label: queuedLabel });
    else start();
    try {
      const result = await work(start);
      const instanceId = options.installedId?.(result);
      const actions = { ...snapshot.actions };
      delete actions[id];
      if (instanceId && !active.has(instanceId)) {
        delete actions[instanceId];
        retries.delete(instanceId);
      }
      publish({
        ...snapshot,
        actions,
        installedIds: instanceId ? { ...snapshot.installedIds, [id]: instanceId } : snapshot.installedIds,
      });
      return true;
    } catch (error) {
      retries.set(id, () => run(id, labels, work, options));
      setAction(id, {
        operation,
        status: "error",
        label: labels.failed,
        error: error instanceof Error ? error.message : String(error),
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
      batch: { ids: pending.map(({ id }) => id), running: true, completed: 0, failed: 0 },
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
      const batch = snapshot.batch!;
      publish({ ...snapshot, batch: batch.failed ? { ...batch, running: false } : undefined });
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
