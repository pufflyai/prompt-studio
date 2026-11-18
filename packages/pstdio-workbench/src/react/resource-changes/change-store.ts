import type { PstdioClient } from "@pstdio/sdk/client";
import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext } from "../../core";
import type { RegisterWorkbenchExtensionContributionsInput } from "../../extensions/host/workbench-extension-host-types";

type Api = PstdioClient["resourceChanges"];

type Listener = () => void;
type Entry = { ref: ResourceRef; listeners: Set<Listener>; changed: boolean; generation: number };
const kindKey = (owner: string | undefined, type: string) => JSON.stringify([owner, type]);
const stores = new WeakMap<object, ReturnType<typeof createChangeStore>>();
const registryListeners = new WeakMap<object, Set<Listener>>();
export const subscribeResourceChanges = (owner: object, listener: Listener) => {
  const listeners = registryListeners.get(owner) ?? new Set<Listener>();
  registryListeners.set(owner, listeners);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const notifyRegistration = (owner: object) => {
  for (const listener of registryListeners.get(owner) ?? []) listener();
};
export const resourceChangesFor = (workbench: Pick<WorkbenchModuleContext, "resources">) =>
  stores.get(workbench.resources.store);

export const createChangeStore = (projectId: string, api: Api, providers: { extensionId: string; type: string }[]) => {
  const kinds = new Set(providers.map((k) => kindKey(k.extensionId, k.type)));
  const entries = new Map<string, Entry>();
  const dirty = new Set<string>();
  const controller = new AbortController();
  let running = false;
  const defaultOwners = new Map<string, string | undefined>();
  for (const p of providers) defaultOwners.set(p.type, defaultOwners.has(p.type) ? undefined : p.extensionId);
  const normalize = (ref: ResourceRef) => ({
    ...ref,
    projectId: ref.projectId ?? projectId,
    extensionId: ref.extensionId ?? defaultOwners.get(ref.type),
  });
  const keyOf = (ref: ResourceRef) => resourceKey(normalize(ref));
  const publish = (entry: Entry, changed: boolean) => {
    if (entry.changed === changed) return;
    entry.changed = changed;
    for (const listener of entry.listeners) listener();
  };
  const takePage = () => {
    const page = [];
    for (const key of dirty) {
      dirty.delete(key);
      const entry = entries.get(key);
      if (entry) page.push({ key, entry, generation: entry.generation });
      if (page.length === 50) break;
    }
    return page;
  };
  const drain = async () => {
    try {
      while (dirty.size && !controller.signal.aborted) {
        const page = takePage();
        if (!page.length) continue;
        try {
          const result = await api.query(
            projectId,
            page.map(({ entry }) => entry.ref),
            controller.signal,
          );
          const changed = new Set(result.filter((r) => r.changedSinceSeen).map((r) => keyOf(r.resource)));
          for (const { key, entry, generation } of page)
            if (entries.get(key) === entry && entry.generation === generation) publish(entry, changed.has(key));
        } catch {
          /* Keep the last snapshot until the next source invalidation or reconnect. */
        }
      }
    } finally {
      running = false;
    }
  };
  const schedule = () => {
    if (running || controller.signal.aborted) return;
    running = true;
    queueMicrotask(() => void drain());
  };
  const refresh = (match: (key: string, ref: ResourceRef) => boolean = () => true) => {
    for (const [key, entry] of entries)
      if (match(key, entry.ref)) {
        entry.generation++;
        dirty.add(key);
      }
    schedule();
  };
  return {
    tracks(ref?: ResourceRef) {
      return (
        !!ref &&
        (!ref.projectId || ref.projectId === projectId) &&
        kinds.has(kindKey(normalize(ref).extensionId, ref.type))
      );
    },
    changed: (ref: ResourceRef) => entries.get(keyOf(ref))?.changed ?? false,
    subscribe(ref: ResourceRef, listener: Listener) {
      const key = keyOf(ref);
      let entry = entries.get(key);
      if (!entry) {
        entry = { ref: normalize(ref), listeners: new Set(), changed: false, generation: 0 };
        entries.set(key, entry);
        dirty.add(key);
        schedule();
      }
      entry.listeners.add(listener);
      return () => {
        entry.listeners.delete(listener);
        if (!entry.listeners.size) {
          entries.delete(key);
          dirty.delete(key);
        }
      };
    },
    refresh,
    async observe(ref: ResourceRef, receipt: string, signal: AbortSignal) {
      signal = AbortSignal.any([signal, controller.signal]);
      const resource = normalize(ref);
      signal.throwIfAborted();
      await api.acknowledge(projectId, receipt, signal, resource);
      refresh((key) => key === resourceKey(resource));
    },
    dispose() {
      controller.abort();
      for (const entry of entries.values()) publish(entry, false);
      entries.clear();
      dirty.clear();
    },
  };
};

type Registration = Pick<
  RegisterWorkbenchExtensionContributionsInput,
  "projectId" | "workbench" | "resourceChanges" | "subscribeRefreshEvents" | "subscribeRefreshReset"
> & {
  metadata: Pick<RegisterWorkbenchExtensionContributionsInput["metadata"], "resourceChangeProviders">;
};
export const installResourceChanges = (input: Registration) => {
  if (!input.resourceChanges) return { dispose() {} };
  const providers = input.metadata.resourceChangeProviders ?? [];
  const refreshEvents = new Map(providers.map((k) => [kindKey(k.extensionId, k.type), new Set(k.refreshEvents)]));
  const owner = input.workbench.resources.store;
  const store = createChangeStore(input.projectId, input.resourceChanges, providers);
  stores.set(owner, store);
  notifyRegistration(owner);
  const events = input.subscribeRefreshEvents?.((event) => {
    const seen = event.id === "pstdio.event.resource-seen-changed";
    if (!seen && !providers.some((k) => k.refreshEvents.includes(event.id))) return;
    const keys = event.resourceKeys ?? (event.resourceKey ? [event.resourceKey] : undefined);
    const ids = event.resourceIds;
    store.refresh((key, ref) => {
      if ((keys && !keys.includes(key)) || (ids && !ids.includes(ref.id))) return false;
      if (seen) return true;
      return refreshEvents.get(kindKey(ref.extensionId, ref.type))?.has(event.id) ?? false;
    });
  });
  const reset = input.subscribeRefreshReset?.(() => store.refresh());
  return {
    dispose() {
      events?.dispose();
      reset?.dispose();
      store.dispose();
      if (stores.get(owner) === store) {
        stores.delete(owner);
        notifyRegistration(owner);
      }
    },
  };
};
