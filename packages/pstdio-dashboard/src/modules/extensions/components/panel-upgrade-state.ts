import { useSyncExternalStore } from "react";
import { getProjectExtensionQueries } from "@/shared/extensions/project-extension-queries";

type Status = "queued" | "running";
const createState = () => {
  let snapshot: ReadonlyMap<string, Status> = new Map();
  const listeners = new Set<() => void>();
  const set = (id: string, status?: Status) => {
    const next = new Map(snapshot);
    if (status) next.set(id, status);
    else next.delete(id);
    snapshot = next;
    for (const listener of listeners) listener();
  };
  return {
    set,
    claim(id: string) {
      if (snapshot.has(id)) return false;
      set(id, "queued");
      return true;
    },
    read: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

// A project inventory belongs to one connected runtime. Both pages observe the same operations.
const states = new WeakMap<object, ReturnType<typeof createState>>();
export const usePanelUpgradeState = (projectId: string | undefined) => {
  const inventory = getProjectExtensionQueries(projectId).extensions;
  let state = states.get(inventory);
  if (!state) {
    state = createState();
    states.set(inventory, state);
  }
  const snapshot = useSyncExternalStore(state.subscribe, state.read, state.read);
  return { state, snapshot };
};
