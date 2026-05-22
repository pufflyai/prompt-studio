import type {
  LayoutPersistenceAdapter,
  PersistedWorkbenchPanels,
  WorkbenchLayout,
  WorkbenchPanelsPersistenceAdapter,
} from "../core";

export interface WorkbenchStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type WorkbenchStoragePersistenceKind = "layout" | "panels";

interface CreateWorkbenchStoragePersistenceInput {
  namespace: string;
  storage?: WorkbenchStorageLike;
}

export interface CreateLocalStoragePanelsPersistenceInput extends CreateWorkbenchStoragePersistenceInput {
  scope: string;
}

export const workbenchStoragePersistenceKey = (
  namespace: string,
  kind: WorkbenchStoragePersistenceKind,
  scope: string | undefined,
) => `${namespace}:${kind}:${scope ?? "global"}`;

const createMemoryStorage = (): WorkbenchStorageLike => {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
};

const resolveStorage = (storage?: WorkbenchStorageLike): WorkbenchStorageLike => {
  if (storage) return storage;
  if (typeof localStorage !== "undefined") return localStorage;
  return createMemoryStorage();
};

const readJson = <T>(storage: WorkbenchStorageLike, key: string): T | undefined => {
  const raw = storage.getItem(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
};

export const createLocalStorageLayoutPersistence = (
  input: CreateWorkbenchStoragePersistenceInput,
): LayoutPersistenceAdapter => {
  const storage = resolveStorage(input.storage);
  return {
    getLayout: (scope) =>
      readJson<WorkbenchLayout>(storage, workbenchStoragePersistenceKey(input.namespace, "layout", scope)),
    setLayout: (layout, scope) => {
      storage.setItem(workbenchStoragePersistenceKey(input.namespace, "layout", scope), JSON.stringify(layout));
    },
  };
};

export const createLocalStoragePanelsPersistence = (
  input: CreateLocalStoragePanelsPersistenceInput,
): WorkbenchPanelsPersistenceAdapter => {
  const storage = resolveStorage(input.storage);
  const key = workbenchStoragePersistenceKey(input.namespace, "panels", input.scope);
  return {
    getPanelStates: () => readJson<PersistedWorkbenchPanels>(storage, key),
    setPanelStates: (state) => {
      storage.setItem(key, JSON.stringify(state));
    },
  };
};
