import type { PreferenceScope, PreferenceValueChange } from "../core/registries/preferences/preference-registry";
import { createWorkbenchStore, observeWorkbenchStoreTransitions } from "../core/shared/store/workbench-store";
import type { WorkbenchStorageLike } from "./local-storage-persistence-helpers";

type PreferenceStorageEvent = Pick<StorageEvent, "key" | "oldValue" | "newValue" | "storageArea">;
export interface PreferenceStorageEvents {
  addEventListener(type: "storage", listener: (event: PreferenceStorageEvent) => void): void;
  removeEventListener(type: "storage", listener: (event: PreferenceStorageEvent) => void): void;
}

const scopes: readonly string[] = ["default", "user", "project", "repo", "workspace", "extension", "session"];
const changesFromStorage = (event: PreferenceStorageEvent): PreferenceValueChange[] => {
  if (event.key === null) return [{}];
  try {
    const before = JSON.parse(event.oldValue ?? "{}") ?? {};
    const after = JSON.parse(event.newValue ?? "{}") ?? {};
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap((key) => {
      if (JSON.stringify(before[key]) === JSON.stringify(after[key])) return [];
      const [name, scope, scopeId] = JSON.parse(key);
      if (typeof name !== "string" || !scopes.includes(scope) || (scopeId != null && typeof scopeId !== "string"))
        return [{}];
      return [{ name, scope: { scope: scope as PreferenceScope, scopeId: scopeId ?? undefined } }];
    });
  } catch {
    return [{}];
  }
};

const createSource = (storage: WorkbenchStorageLike, key: string, events?: PreferenceStorageEvents) => {
  const store = createWorkbenchStore<{ change: PreferenceValueChange }>({
    name: "workbench.preferenceStorage",
    initialState: { change: {} },
  });
  const publish = (change: PreferenceValueChange) => store.setState({ change });
  const changed = (event: PreferenceStorageEvent) => {
    if ((event.key !== null && event.key !== key) || (event.storageArea && event.storageArea !== storage)) return;
    for (const change of changesFromStorage(event)) publish(change);
  };
  events?.addEventListener("storage", changed);
  return {
    store,
    publish,
    observers: 0,
    dispose() {
      events?.removeEventListener("storage", changed);
      store.dispose();
    },
  };
};
const sources = new WeakMap<WorkbenchStorageLike, Map<string, ReturnType<typeof createSource>>>();

export const publishPreferenceStorageChange = (
  storage: WorkbenchStorageLike,
  key: string,
  change: PreferenceValueChange,
) => sources.get(storage)?.get(key)?.publish(change);

/** A single event bridge exists only while a registry observes this storage key. */
export const observePreferenceStorage = (
  storage: WorkbenchStorageLike,
  key: string,
  listener: (change: PreferenceValueChange) => void,
  events: PreferenceStorageEvents | undefined = typeof window === "undefined" ? undefined : window,
) => {
  let owner = sources.get(storage);
  if (!owner) {
    owner = new Map();
    sources.set(storage, owner);
  }
  let source = owner.get(key);
  if (!source) {
    source = createSource(storage, key, events);
    owner.set(key, source);
  }
  const current = source;
  current.observers++;
  const stop = observeWorkbenchStoreTransitions(current.store, () => listener(current.store.getState().change));
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    stop();
    if (--current.observers) return;
    current.dispose();
    owner.delete(key);
    if (!owner.size) sources.delete(storage);
  };
};
