import type { ResourceActivityAttachment } from "@pstdio/sdk/extensions";
import type { WorkbenchCore } from "../../core";

export interface ActivityDraft {
  body: string;
  key: string;
  attachments: ResourceActivityAttachment[];
}
export const emptyActivityDraft = (): ActivityDraft => ({ body: "", key: crypto.randomUUID(), attachments: [] });
const caches = new WeakMap<WorkbenchCore, Map<string, ReturnType<typeof createDraft>>>();
const createDraft = () => {
  let value = emptyActivityDraft();
  const listeners = new Set<() => void>();
  let pending: { id: string; upload?: string } | undefined;
  let error: string | undefined;
  const notify = () => {
    value = { ...value };
    for (const listener of listeners) listener();
  };
  return {
    get: () => value,
    busy: () => Boolean(pending),
    uploading: () => pending?.upload,
    error: () => error,
    setError: (next?: string) => {
      if (error === next) return;
      error = next;
      notify();
    },
    begin: (upload?: string) => {
      if (pending) return;
      pending = { id: crypto.randomUUID(), upload };
      notify();
      return pending.id;
    },
    finish: (id: string) => {
      if (pending?.id === id) {
        pending = undefined;
        notify();
      }
    },
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
