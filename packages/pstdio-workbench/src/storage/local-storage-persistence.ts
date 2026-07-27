import type {
  LastResourcePersistenceAdapter,
  LayoutPersistenceAdapter,
  PersistedTreeRendererStates,
  PersistedWorkbenchHistory,
  PersistedWorkbenchPanels,
  ResourceRef,
  TreeRendererPersistenceAdapter,
  WorkbenchHistoryPersistence,
  WorkbenchLayout,
  WorkbenchPanelsPersistenceAdapter,
  WorkbenchPersistenceAdapter,
} from "../core";
import { workbenchRegions } from "../core";

export interface WorkbenchStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export type WorkbenchStoragePersistenceKind =
  | "history"
  | "layout"
  | "layout-resource-index"
  | "panels"
  | "tree"
  | "last-resource";

interface PersistedWorkbenchLayoutV1 {
  version: 1;
  layout: WorkbenchLayout;
}

interface PersistedWorkbenchLayoutV2 {
  version: 2;
  layout: WorkbenchLayout;
}

type PersistedWorkbenchLayout = PersistedWorkbenchLayoutV1 | PersistedWorkbenchLayoutV2;

const WORKBENCH_LAYOUT_VERSION = 2 as const;
const WORKBENCH_LAYOUT_RESOURCE_INDEX_VERSION = 1 as const;
const WORKBENCH_LAYOUT_RESOURCE_LIMIT = 50;

interface PersistedWorkbenchLayoutResourceIndex {
  version: 1;
  scopes: string[];
}

interface CreateWorkbenchStoragePersistenceInput {
  debounceMs?: number;
  eventTarget?: {
    addEventListener(type: "pagehide", listener: () => void): void;
    removeEventListener(type: "pagehide", listener: () => void): void;
  };
  namespace: string;
  storage?: WorkbenchStorageLike;
}

export interface CreateLocalStoragePanelsPersistenceInput extends CreateWorkbenchStoragePersistenceInput {
  scope: string;
}

export interface CreateLocalStorageTreePersistenceInput extends CreateWorkbenchStoragePersistenceInput {
  scope?: string;
}

export interface CreateLocalStorageWorkbenchPersistenceInput extends CreateWorkbenchStoragePersistenceInput {
  scope?: string;
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
    removeItem: (key) => {
      map.delete(key);
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
  const pending = new Map<string, { legacyPanelsKey?: string; raw: string; scope: string | undefined }>();
  const debounceMs = input.debounceMs ?? 250;
  const eventTarget =
    input.eventTarget ??
    (typeof window !== "undefined"
      ? {
          addEventListener: (type: "pagehide", listener: () => void) => window.addEventListener(type, listener),
          removeEventListener: (type: "pagehide", listener: () => void) => window.removeEventListener(type, listener),
        }
      : undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const resourceProjectId = (scope: string | undefined) =>
    scope?.match(/^project\/([^/]+)\/mode\/[^/]+\/resource\//)?.[1];

  const touchResourceScope = (scope: string | undefined) => {
    const projectId = resourceProjectId(scope);
    if (!projectId || !scope) return;

    const indexKey = workbenchStoragePersistenceKey(input.namespace, "layout-resource-index", projectId);
    const persisted = readJson<unknown>(storage, indexKey);
    const scopes =
      typeof persisted === "object" &&
      persisted !== null &&
      "version" in persisted &&
      persisted.version === WORKBENCH_LAYOUT_RESOURCE_INDEX_VERSION &&
      "scopes" in persisted &&
      Array.isArray(persisted.scopes)
        ? persisted.scopes.filter(
            (candidate): candidate is string =>
              typeof candidate === "string" &&
              candidate !== scope &&
              storage.getItem(workbenchStoragePersistenceKey(input.namespace, "layout", candidate)) !== null,
          )
        : [];
    scopes.push(scope);

    for (const evictedScope of scopes.splice(0, Math.max(0, scopes.length - WORKBENCH_LAYOUT_RESOURCE_LIMIT))) {
      storage.removeItem?.(workbenchStoragePersistenceKey(input.namespace, "layout", evictedScope));
      storage.removeItem?.(workbenchStoragePersistenceKey(input.namespace, "panels", evictedScope));
    }

    const next: PersistedWorkbenchLayoutResourceIndex = {
      version: WORKBENCH_LAYOUT_RESOURCE_INDEX_VERSION,
      scopes,
    };
    storage.setItem(indexKey, JSON.stringify(next));
  };

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    const writes = [...pending.values()];
    pending.clear();
    for (const write of writes) {
      storage.setItem(workbenchStoragePersistenceKey(input.namespace, "layout", write.scope), write.raw);
      touchResourceScope(write.scope);
      if (write.legacyPanelsKey) storage.removeItem?.(write.legacyPanelsKey);
    }
  };

  const scheduleFlush = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  };

  eventTarget?.addEventListener("pagehide", flush);

  return {
    getLayout: (scope) => {
      const key = workbenchStoragePersistenceKey(input.namespace, "layout", scope);
      const persisted = pending.has(key)
        ? (JSON.parse(pending.get(key)!.raw) as PersistedWorkbenchLayout)
        : readJson<PersistedWorkbenchLayout>(storage, key);
      if (persisted?.version === WORKBENCH_LAYOUT_VERSION) return persisted.layout;
      if (persisted?.version !== 1) return undefined;

      const legacyPanelsKey = workbenchStoragePersistenceKey(input.namespace, "panels", scope);
      const panels = readJson<unknown>(storage, legacyPanelsKey);
      const openByRegionId =
        typeof panels === "object" &&
        panels !== null &&
        "openByRegionId" in panels &&
        typeof panels.openByRegionId === "object" &&
        panels.openByRegionId !== null
          ? panels.openByRegionId
          : {};
      const regions = { ...persisted.layout.regions };
      for (const region of workbenchRegions) {
        const open = (openByRegionId as Record<string, unknown>)[region];
        if (typeof open === "boolean" && regions[region]) {
          regions[region] = { ...regions[region], visible: open };
        }
      }
      const layout = { ...persisted.layout, regions };
      const migrated: PersistedWorkbenchLayoutV2 = { version: WORKBENCH_LAYOUT_VERSION, layout };
      pending.set(key, {
        legacyPanelsKey: storage.getItem(legacyPanelsKey) === null ? undefined : legacyPanelsKey,
        raw: JSON.stringify(migrated),
        scope,
      });
      scheduleFlush();
      return layout;
    },
    setLayout: (layout, scope) => {
      const persisted: PersistedWorkbenchLayoutV2 = { version: WORKBENCH_LAYOUT_VERSION, layout };
      const key = workbenchStoragePersistenceKey(input.namespace, "layout", scope);
      const legacyPanelsKey = workbenchStoragePersistenceKey(input.namespace, "panels", scope);
      pending.delete(key);
      pending.set(key, {
        legacyPanelsKey: storage.getItem(legacyPanelsKey) === null ? undefined : legacyPanelsKey,
        raw: JSON.stringify(persisted),
        scope,
      });
      scheduleFlush();
    },
    flush,
    dispose() {
      flush();
      eventTarget?.removeEventListener("pagehide", flush);
    },
  };
};

export const createLocalStorageHistoryPersistence = (
  input: CreateWorkbenchStoragePersistenceInput,
): WorkbenchHistoryPersistence => {
  const storage = resolveStorage(input.storage);
  return {
    getHistory: (scope) =>
      readJson<PersistedWorkbenchHistory>(storage, workbenchStoragePersistenceKey(input.namespace, "history", scope)),
    setHistory: (history, scope) => {
      storage.setItem(workbenchStoragePersistenceKey(input.namespace, "history", scope), JSON.stringify(history));
    },
  };
};

export const createLocalStoragePanelsPersistence = (
  input: CreateLocalStoragePanelsPersistenceInput,
): WorkbenchPanelsPersistenceAdapter => {
  const storage = resolveStorage(input.storage);
  return {
    getPanelStates: (scope) =>
      readJson<PersistedWorkbenchPanels>(
        storage,
        workbenchStoragePersistenceKey(input.namespace, "panels", scope ?? input.scope),
      ),
    setPanelStates: (state, scope) => {
      const key = workbenchStoragePersistenceKey(input.namespace, "panels", scope ?? input.scope);
      storage.setItem(key, JSON.stringify(state));
    },
  };
};

export const createLocalStorageTreePersistence = (
  input: CreateLocalStorageTreePersistenceInput,
): TreeRendererPersistenceAdapter => {
  const storage = resolveStorage(input.storage);
  const key = workbenchStoragePersistenceKey(input.namespace, "tree", input.scope);
  return {
    getTreeStates: () => readJson<PersistedTreeRendererStates>(storage, key),
    setTreeStates: (state) => {
      storage.setItem(key, JSON.stringify(state));
    },
  };
};

export interface CreateLocalStorageLastResourcePersistenceInput extends CreateWorkbenchStoragePersistenceInput {
  scope?: string;
}

const isResourceRef = (value: unknown): value is ResourceRef =>
  Boolean(value) && typeof (value as ResourceRef).kind === "string" && typeof (value as ResourceRef).uri === "string";

export const createLocalStorageLastResourcePersistence = (
  input: CreateLocalStorageLastResourcePersistenceInput,
): LastResourcePersistenceAdapter => {
  const storage = resolveStorage(input.storage);
  const key = workbenchStoragePersistenceKey(input.namespace, "last-resource", input.scope);
  return {
    getLastResource: () => {
      const parsed = readJson<unknown>(storage, key);
      return isResourceRef(parsed) ? parsed : undefined;
    },
    setLastResource: (resource) => {
      if (!resource) {
        storage.removeItem?.(key);
        return;
      }
      storage.setItem(key, JSON.stringify(resource));
    },
  };
};

export const createLocalStorageWorkbenchPersistence = (input: CreateLocalStorageWorkbenchPersistenceInput) => {
  const storage = resolveStorage(input.storage);
  const layoutPersistence = createLocalStorageLayoutPersistence({
    debounceMs: input.debounceMs,
    eventTarget: input.eventTarget,
    namespace: input.namespace,
    storage,
  });
  const snapshotPersistence: WorkbenchPersistenceAdapter = {
    getSnapshot: (scope) => {
      const layout = layoutPersistence.getLayout(scope);
      return layout ? { layout } : undefined;
    },
    setSnapshot: (snapshot, scope) => layoutPersistence.setLayout(snapshot.layout, scope),
    flush: layoutPersistence.flush,
    dispose: layoutPersistence.dispose,
  };

  return {
    snapshotPersistence,
    historyPersistence: createLocalStorageHistoryPersistence({
      namespace: input.namespace,
      storage,
    }),
    layoutPersistence,
    panelsPersistence: createLocalStoragePanelsPersistence({
      namespace: input.namespace,
      scope: input.scope ?? "global",
      storage,
    }),
    treePersistence: createLocalStorageTreePersistence({
      namespace: input.namespace,
      scope: input.scope,
      storage,
    }),
    lastResourcePersistence: createLocalStorageLastResourcePersistence({
      namespace: input.namespace,
      scope: input.scope,
      storage,
    }),
  };
};
