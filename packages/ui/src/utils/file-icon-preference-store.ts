import { createBrowserStorage } from "./browser-storage";

const storageKey = "file-icon-theme-preference";
const stores = new WeakMap<Window, ReturnType<typeof createFileIconPreferenceStore>>();

/** The global choice belongs to the window; registries only decide which fallback to display. */
export const createFileIconPreferenceStore = (storage: Pick<Storage, "getItem" | "setItem">) => {
  let choice = storage.getItem(storageKey);
  const listeners = new Set<() => void>();
  const update = (next: string | null) => {
    if (choice === next) return;
    choice = next;
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => choice,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setChoice(next: string) {
      update(next);
      storage.setItem(storageKey, next);
    },
    onStorage(event: StorageEvent) {
      if (event.key === storageKey) update(event.newValue);
      else if (event.key === null) update(null);
    },
  };
};

export const getFileIconPreferenceStore = () => {
  if (typeof window === "undefined") return null;
  let store = stores.get(window);
  if (!store) {
    const created = createFileIconPreferenceStore(createBrowserStorage());
    store = created;
    stores.set(window, created);
    // Keep listening between provider mounts so a remount cannot revive an obsolete choice.
    window.addEventListener?.("storage", (event) => {
      if (event.storageArea === window.localStorage) created.onStorage(event);
    });
  }
  return store;
};
