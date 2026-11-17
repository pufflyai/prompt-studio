import { createBrowserStorage } from "./browser-storage";
import { createPreferenceChoiceStore } from "./preference-choice-store";

const storageKey = "file-icon-theme-preference";
const stores = new WeakMap<Window, ReturnType<typeof createFileIconPreferenceStore>>();

/** The global choice belongs to the window; registries only decide which fallback to display. */
export const createFileIconPreferenceStore = (storage: Pick<Storage, "getItem" | "setItem">) => {
  const store = createPreferenceChoiceStore(storage, storageKey);
  const update = store.update;
  return {
    ...store,
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
