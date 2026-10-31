import { createContext, type ReactNode, useContext, useState } from "react";
import { createJSONStorage } from "zustand/middleware";
import { createBrowserStorage } from "./browser-storage";

/** Storage the host supplies for saved component state, such as tree customizations and board settings. */
export interface HostStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

const StorageContext = createContext<HostStorage | undefined>(undefined);

interface HostStorageProviderProps {
  storage: HostStorage | undefined;
  children: ReactNode;
}

/** Hosts can keep saved component state outside the browser origin. Without a storage, components use `localStorage`. */
export const HostStorageProvider = (props: HostStorageProviderProps) => {
  const { storage, children } = props;
  return <StorageContext value={storage}>{children}</StorageContext>;
};

export const useHostStorage = () => useContext(StorageContext);

export const createHostPersistStorage = (storage: HostStorage | undefined) =>
  createJSONStorage(() =>
    storage
      ? {
          getItem: (key) => storage.getItem(key),
          setItem: (key, value) => storage.setItem(key, value),
          removeItem: (key) => storage.removeItem?.(key),
        }
      : createBrowserStorage(),
  );

// One store per host storage and key, so one host's saved state never leaks into another host's stores.
export const createHostStoreRegistry = <Store, Args extends unknown[]>(
  create: (storageKey: string, storage: HostStorage | undefined, ...args: Args) => Store,
) => {
  const hostRegistries = new WeakMap<HostStorage, Map<string, Store>>();
  const browserRegistry = new Map<string, Store>();

  return (storageKey: string, storage?: HostStorage, ...args: Args) => {
    let registry = storage ? hostRegistries.get(storage) : browserRegistry;
    if (!registry) {
      registry = new Map();
      hostRegistries.set(storage!, registry);
    }
    const existing = registry.get(storageKey);
    if (existing) return existing;

    const store = create(storageKey, storage, ...args);
    registry.set(storageKey, store);
    return store;
  };
};

const defaultHostStorage = createBrowserStorage();

export const HostStorageScope = (props: { scope?: string; children: ReactNode }) => {
  const { scope, children } = props;
  const storage = useHostStorage() ?? defaultHostStorage;
  const create = () => ({
    scope,
    storage,
    scoped: {
      getItem: (key: string) => storage.getItem(JSON.stringify([scope, key])),
      setItem: (key: string, value: string) => storage.setItem(JSON.stringify([scope, key]), value),
      removeItem: (key: string) => storage.removeItem?.(JSON.stringify([scope, key])),
    },
  });
  const [state, setState] = useState(create);
  if (state.scope !== scope || state.storage !== storage) setState(create());
  return <HostStorageProvider storage={scope ? state.scoped : storage}>{children}</HostStorageProvider>;
};
