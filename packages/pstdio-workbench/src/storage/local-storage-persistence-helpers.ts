export interface WorkbenchStorageLike {
  readonly length?: number;
  getItem(key: string): string | null;
  key?(index: number): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export type WorkbenchStoragePersistenceKind =
  | "layout"
  | "layout-compatibility"
  | "layout-generation"
  | "layout-resource-index"
  | "layout-scope-index"
  | "panel-menus"
  | "page-location"
  | "preferences"
  | "status-bar"
  | "tree";

export interface CreateWorkbenchStoragePersistenceInput {
  /** Stable project or workbench scope for independent view state. */
  scope?: string;
  debounceMs?: number;
  eventTarget?: {
    addEventListener(type: "pagehide", listener: () => void): void;
    removeEventListener(type: "pagehide", listener: () => void): void;
  };
  namespace: string;
  storage?: WorkbenchStorageLike;
}

export const workbenchStoragePersistenceKey = (
  namespace: string,
  kind: WorkbenchStoragePersistenceKind,
  scope: string | undefined,
) => `${namespace}:${kind}:${scope ?? "global"}`;

/** Preserve the legacy host key while keeping every explicit scope distinct. */
export const workbenchHostStorageKey = (
  namespace: string,
  kind: "status-bar" | "layout-generation",
  scope: string | undefined,
) =>
  scope === undefined
    ? workbenchStoragePersistenceKey(namespace, kind, undefined)
    : `${namespace}:${kind}:scope:${JSON.stringify(scope)}`;

const createMemoryStorage = (): WorkbenchStorageLike => {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
};

export const resolveStorage = (storage?: WorkbenchStorageLike): WorkbenchStorageLike => {
  if (storage) return storage;
  if (typeof localStorage !== "undefined") return localStorage;
  return createMemoryStorage();
};

export const readJson = <T>(storage: WorkbenchStorageLike, key: string): T | undefined => {
  const raw = storage.getItem(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
};
