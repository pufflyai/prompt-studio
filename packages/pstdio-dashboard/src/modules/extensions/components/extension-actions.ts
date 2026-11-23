import {
  classifyApiWrite,
  type OperationRecovery,
  operationSubject,
  type ResourceRef,
  type WorkbenchOperations,
} from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import type { ExtensionActionState } from "./extension-action-feedback";
import { defaultExtensionFilters, type ExtensionFilters } from "./extension-filters";

export interface ExtensionUpgradeBatch {
  ids: string[];
  running: boolean;
  completed: number;
  failed: number;
}

const domain = "extension.inventory";
const unresolvedHint = "Inspect Extensions or discard this attempt in System activity.";

interface InventoryTracker {
  projectId: string;
  operations: WorkbenchOperations;
  isCurrent?(): boolean;
}

interface ActionOptions<T> {
  operation?: ExtensionActionState["operation"];
  enabled?: boolean;
  queuedLabel?: string;
  installedId?: (result: T) => string;
  draft?: unknown;
  source?: ResourceRef;
}

const marketplaceActionPrefix = "marketplace:";
export const marketplaceActionKey = (name: string) => `${marketplaceActionPrefix}${name}`;

const reclaimDraft = async (tracker: InventoryTracker | undefined, recovery?: OperationRecovery) => {
  if (!tracker || recovery?.draft === undefined) return true;
  const moved = await tracker.operations.transfer(recovery.id, () => true);
  return moved || !tracker.operations.getSnapshot().recovery.some((entry) => entry.id === recovery.id);
};

interface ActionSnapshot {
  filters: ExtensionFilters;
  installedIds: Record<string, string>;
  replacement: { name: string; retry: () => Promise<void> } | null;
  actions: Record<string, ExtensionActionState>;
  batch?: ExtensionUpgradeBatch;
}

export const createExtensionActions = (tracker?: InventoryTracker) => {
  let snapshot: ActionSnapshot = { actions: {}, installedIds: {}, replacement: null, filters: defaultExtensionFilters };
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
  const accept = (id: string, instanceId?: string) => {
    const actions = { ...snapshot.actions };
    delete actions[id];
    if (instanceId && !active.has(instanceId)) {
      delete actions[instanceId];
      retries.delete(instanceId);
    }
    publish({
      ...snapshot,
      actions,
      installedIds:
        instanceId && id.startsWith(marketplaceActionPrefix)
          ? { ...snapshot.installedIds, [id]: instanceId }
          : snapshot.installedIds,
    });
  };
  const run = async <T>(
    id: string,
    labels: { running: string; failed: string },
    work: (started: () => void) => Promise<T>,
    options: ActionOptions<T> = {},
  ) => {
    if (active.has(id) || tracker?.isCurrent?.() === false) return false;
    const subject = tracker && operationSubject("extension-inventory", tracker.projectId, id);
    const blocked = tracker?.operations
      .getSnapshot()
      .pending.some(
        (entry) => subject && entry.subjects.includes(subject) && ["unknown", "unconfirmed"].includes(entry.status),
      );
    const { operation, enabled, queuedLabel } = options;
    const unresolved = () =>
      setAction(id, {
        operation,
        status: "error",
        label: "Outcome unconfirmed",
        error: unresolvedHint,
        retryable: false,
      });
    if (blocked) {
      unresolved();
      return false;
    }
    active.add(id);
    retries.delete(id);
    const start = () => setAction(id, { operation, enabled, status: "running", label: labels.running });
    if (queuedLabel) setAction(id, { operation, status: "queued", label: queuedLabel });
    else start();
    let attemptId: symbol | undefined;
    try {
      const running =
        tracker && subject
          ? tracker.operations.submit({
              projectId: tracker.projectId,
              subjects: [subject],
              domain,
              title: labels.running,
              source: options.source,
              sourceCommand: { id: dashboardCommandIds.openExtensions },
              draft: options.draft,
              releaseOnDiscard: true,
              classify: classifyApiWrite,
              write: async (signal) => {
                signal.throwIfAborted();
                const result = await work(start);
                signal.throwIfAborted();
                return result;
              },
            })
          : undefined;
      attemptId = running?.id;
      const result = await (running?.result ?? work(start));
      accept(id, options.installedId?.(result));
      return true;
    } catch (error) {
      const recovery = tracker?.operations.getSnapshot().recovery.find((entry) => entry.id === attemptId);
      if (recovery && recovery.status !== "rejected") {
        unresolved();
        return false;
      }
      retries.set(id, async () => {
        if (active.has(id) || !(await reclaimDraft(tracker, recovery))) return false;
        return run(id, labels, work, options);
      });
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
    setFilters: (filters: ExtensionFilters) => publish({ ...snapshot, filters }),
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
export const getExtensionActions = (inventory: object, tracker?: InventoryTracker) => {
  let owner = owners.get(inventory);
  if (!owner) {
    owner = createExtensionActions(tracker);
    owners.set(inventory, owner);
  }
  return owner;
};
