interface PreviewStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const values = new Map<string, string>();
const memory: PreviewStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => {
    values.set(key, value);
  },
  removeItem: (key) => {
    values.delete(key);
  },
};
// Dashboard examples use this injectable store instead of browser persistence.
export const resolveDashboardStorage = (storage?: PreviewStorage) => storage ?? memory;
