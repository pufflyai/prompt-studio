interface BrowserStorage {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
}

const noopStorage = {
  getItem: () => null,
  removeItem: () => {},
  setItem: () => {},
} satisfies BrowserStorage;

const readLocalStorage = () => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

export const createBrowserStorage = (): BrowserStorage => {
  const storage = readLocalStorage();
  if (!storage) return noopStorage;

  return {
    getItem(key) {
      try {
        return storage.getItem(key);
      } catch {
        return null;
      }
    },
    removeItem(key) {
      try {
        storage.removeItem(key);
      } catch {}
    },
    setItem(key, value) {
      try {
        storage.setItem(key, value);
      } catch {}
    },
  };
};
