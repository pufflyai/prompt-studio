// Keep this helper local to dashboard tests so this package does not import
// packages/ui/src/* across package boundaries.
export const installMockLocalStorage = () => {
  const storage = new Map<string, string>();

  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
      get length() {
        return storage.size;
      },
      key: (index: number) => [...storage.keys()][index] ?? null,
    } satisfies Storage,
    configurable: true,
  });

  return globalThis.localStorage;
};
