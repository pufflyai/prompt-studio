import type {
  LayoutPersistenceAdapter,
  LayoutScope,
  PersistedWorkbenchPanels,
  WorkbenchLayout,
  WorkbenchPanelsPersistenceAdapter,
} from "pstdio-workbench/core";

// Layout and panel state persist per project so each project keeps its own
// workbench arrangement. The layout model is scoped through `setPersistenceScope`,
// the panels controller is bound to a scope at creation time.
export const PERSISTENCE_NAMESPACE = "pstdio-dashboard-workbench";

export const projectLayoutScope = (projectId: string): LayoutScope => `project:${projectId}`;

export const persistenceStorageKey = (kind: "layout" | "panels", scope: string | undefined) =>
  `${PERSISTENCE_NAMESPACE}:${kind}:${scope ?? "global"}`;

interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const createMemoryStore = (): KeyValueStore => {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
};

const resolveStore = (store?: KeyValueStore): KeyValueStore => {
  if (store) return store;
  if (typeof localStorage !== "undefined") return localStorage;
  return createMemoryStore();
};

const readJson = <T>(store: KeyValueStore, key: string): T | undefined => {
  const raw = store.getItem(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
};

export const createDashboardLayoutPersistence = (store?: KeyValueStore): LayoutPersistenceAdapter => {
  const kv = resolveStore(store);
  return {
    getLayout: (scope) => readJson<WorkbenchLayout>(kv, persistenceStorageKey("layout", scope)),
    setLayout: (layout, scope) => {
      kv.setItem(persistenceStorageKey("layout", scope), JSON.stringify(layout));
    },
  };
};

export const createDashboardPanelsPersistence = (
  scope: string,
  store?: KeyValueStore,
): WorkbenchPanelsPersistenceAdapter => {
  const kv = resolveStore(store);
  const key = persistenceStorageKey("panels", scope);
  return {
    getPanelStates: () => readJson<PersistedWorkbenchPanels>(kv, key),
    setPanelStates: (state) => {
      kv.setItem(key, JSON.stringify(state));
    },
  };
};
