import type { QueryClient } from "@tanstack/react-query";
import type { ExtensionActionState } from "./extension-action-feedback";
import { runExtensionUpgrades } from "./run-extension-upgrades";

export interface ExtensionUpgradeBatch {
  ids: string[];
  startedAt: number;
  finishedAt?: number;
  completed: number;
  failed: number;
}

interface ActionSnapshot {
  actions: Record<string, ExtensionActionState>;
  batch?: ExtensionUpgradeBatch;
}

export const createExtensionActions = () => {
  let snapshot: ActionSnapshot = { actions: {} };
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
  const run = async (
    id: string,
    labels: { running: string; success: string; failed: string },
    work: () => Promise<unknown>,
  ) => {
    if (active.has(id)) return false;
    active.add(id);
    retries.delete(id);
    const startedAt = Date.now();
    setAction(id, { status: "running", label: labels.running, startedAt });
    try {
      await work();
      setAction(id, { status: "success", label: labels.success, startedAt, finishedAt: Date.now() });
      return true;
    } catch (error) {
      retries.set(id, () => run(id, labels, work));
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
  const runBatch = async <T extends { id: string }>(
    targets: T[],
    queuedLabel: string,
    upgrade: (target: T) => Promise<unknown>,
  ) => {
    if (batchRunning) return;
    const pending = targets.filter(({ id }) => !active.has(id) && snapshot.actions[id]?.status !== "queued");
    if (!pending.length) return;
    batchRunning = true;
    const actions = { ...snapshot.actions };
    for (const { id } of pending) actions[id] = { status: "queued", label: queuedLabel };
    publish({ actions, batch: { ids: pending.map(({ id }) => id), startedAt: Date.now(), completed: 0, failed: 0 } });
    try {
      await runExtensionUpgrades(pending, async (target) => {
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
      });
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

// Page hosts have separate React trees. The project's query client owns their shared actions,
// including work that continues while a person moves between the list and a detail page.
const owners = new WeakMap<QueryClient, Map<string | undefined, ReturnType<typeof createExtensionActions>>>();
export const getExtensionActions = (client: QueryClient, projectId: string | undefined) => {
  let projects = owners.get(client);
  if (!projects) {
    projects = new Map();
    owners.set(client, projects);
  }
  let owner = projects.get(projectId);
  if (!owner) {
    owner = createExtensionActions();
    projects.set(projectId, owner);
  }
  return owner;
};

// Installs begin with a catalog name before an instance id exists. Every installed surface must
// resolve that same owner until its result is dismissed; retry must use the resolved key too.
export const resolveExtensionAction = (
  actions: Record<string, ExtensionActionState>,
  extension: { installName: string },
) => {
  const key = extension.installName;
  return { key, action: actions[key] };
};
