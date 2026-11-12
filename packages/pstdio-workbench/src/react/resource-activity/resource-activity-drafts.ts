import type { WorkbenchCore } from "../../core";

export interface ActivityDraft {
  body: string;
  key: string;
  attachmentIds: string[];
  target?: { harnessId: string; modelId: string };
}
export const emptyActivityDraft = (): ActivityDraft => ({ body: "", key: crypto.randomUUID(), attachmentIds: [] });
const caches = new WeakMap<WorkbenchCore, Map<string, ReturnType<typeof createDraft>>>();
const createDraft = () => {
  let value = emptyActivityDraft();
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next: ActivityDraft) => {
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
/** Pending operations notify any remounted consumer of the same complete resource identity. */
export const resourceActivityDraft = (workbench: WorkbenchCore, identity: string) => {
  let cache = caches.get(workbench);
  if (!cache) {
    cache = new Map();
    caches.set(workbench, cache);
  }
  let draft = cache.get(identity);
  if (!draft) {
    draft = createDraft();
    cache.set(identity, draft);
  }
  return draft;
};
