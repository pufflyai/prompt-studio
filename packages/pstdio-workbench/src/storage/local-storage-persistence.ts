import type {
  LastResourcePersistenceAdapter,
  LayoutPersistenceAdapter,
  PersistedTreeRendererStates,
  PersistedWorkbenchPanels,
  ResourceRef,
  TreeRendererPersistenceAdapter,
  WorkbenchLayout,
  WorkbenchPanelsPersistenceAdapter,
} from "../core";
import { layoutScopeKey } from "../core/registries/layout/layout-scope";

export interface WorkbenchStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export type WorkbenchStoragePersistenceKind = "layout" | "panels" | "tree" | "last-resource";

interface CreateWorkbenchStoragePersistenceInput {
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

export const workbenchStoragePersistenceKey = (namespace: string, kind: WorkbenchStoragePersistenceKind) =>
  `${namespace}:${kind}`;

const MAX_SCOPED_LAYOUTS = 50;
const MAX_SERIALIZED_BYTES = 1_000_000;

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
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return undefined;
  }
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
};

const serializeWithinLimit = (value: unknown) => {
  try {
    const serialized = JSON.stringify(value);
    return new TextEncoder().encode(serialized).byteLength <= MAX_SERIALIZED_BYTES ? serialized : undefined;
  } catch {
    return undefined;
  }
};

const writeJson = (storage: WorkbenchStorageLike, key: string, value: unknown) => {
  const serialized = serializeWithinLimit(value);
  if (!serialized) return;
  try {
    storage.setItem(key, serialized);
  } catch {
    // Persistence is best-effort when the browser denies access or exhausts quota.
  }
};

const removeItem = (storage: WorkbenchStorageLike, key: string) => {
  try {
    storage.removeItem?.(key);
  } catch {
    // Persistence is best-effort when the browser denies access.
  }
};

type ScopedValues<T> = Record<string, T>;

const readScopedValue = <T>(storage: WorkbenchStorageLike, key: string, scope: string) =>
  readJson<ScopedValues<T>>(storage, key)?.[scope];

const writeScopedValue = <T>(storage: WorkbenchStorageLike, key: string, scope: string, value: T) => {
  const values = readJson<ScopedValues<T>>(storage, key) ?? {};
  writeJson(storage, key, { ...values, [scope]: value });
};

const removeScopedValue = <T>(storage: WorkbenchStorageLike, key: string, scope: string) => {
  const values = readJson<ScopedValues<T>>(storage, key);
  if (!values?.[scope]) return;
  const { [scope]: _removed, ...remaining } = values;
  if (Object.keys(remaining).length > 0) writeJson(storage, key, remaining);
  else removeItem(storage, key);
};

interface PersistedLayoutEntry {
  layout: WorkbenchLayout;
  lastUsedAt: number;
}

const trimLayoutEntries = (entries: ScopedValues<PersistedLayoutEntry>) => {
  const trimmed = { ...entries };
  while (Object.keys(trimmed).length > MAX_SCOPED_LAYOUTS) {
    const oldestResourceScope = Object.entries(trimmed)
      .filter(([scope]) => scope.includes(":resource:"))
      .sort((left, right) => left[1].lastUsedAt - right[1].lastUsedAt)[0]?.[0];
    if (!oldestResourceScope) break;
    delete trimmed[oldestResourceScope];
  }
  return trimmed;
};

const nextLastUsedAt = (entries: ScopedValues<PersistedLayoutEntry>) =>
  Math.max(Date.now(), ...Object.values(entries).map((entry) => entry.lastUsedAt + 1));

export const createLocalStorageLayoutPersistence = (
  input: CreateWorkbenchStoragePersistenceInput,
): LayoutPersistenceAdapter => {
  const storage = resolveStorage(input.storage);
  const key = workbenchStoragePersistenceKey(input.namespace, "layout");
  return {
    getLayout: (scope) => {
      const entries = readJson<ScopedValues<PersistedLayoutEntry>>(storage, key) ?? {};
      const scopeKey = layoutScopeKey(scope);
      const entry = entries[scopeKey];
      if (!entry) return undefined;
      writeJson(storage, key, { ...entries, [scopeKey]: { ...entry, lastUsedAt: nextLastUsedAt(entries) } });
      return entry.layout;
    },
    setLayout: (layout, scope) => {
      const entries = readJson<ScopedValues<PersistedLayoutEntry>>(storage, key) ?? {};
      const next = {
        ...entries,
        [layoutScopeKey(scope)]: { layout, lastUsedAt: nextLastUsedAt(entries) },
      };
      writeJson(storage, key, trimLayoutEntries(next));
    },
  };
};

export const createLocalStoragePanelsPersistence = (
  input: CreateLocalStoragePanelsPersistenceInput,
): WorkbenchPanelsPersistenceAdapter => {
  const storage = resolveStorage(input.storage);
  const key = workbenchStoragePersistenceKey(input.namespace, "panels");
  return {
    getPanelStates: () => readScopedValue<PersistedWorkbenchPanels>(storage, key, input.scope),
    setPanelStates: (state) => {
      writeScopedValue(storage, key, input.scope, state);
    },
  };
};

export const createLocalStorageTreePersistence = (
  input: CreateLocalStorageTreePersistenceInput,
): TreeRendererPersistenceAdapter => {
  const storage = resolveStorage(input.storage);
  const key = workbenchStoragePersistenceKey(input.namespace, "tree");
  const scope = input.scope ?? "global";
  return {
    getTreeStates: () => readScopedValue<PersistedTreeRendererStates>(storage, key, scope),
    setTreeStates: (state) => {
      writeScopedValue(storage, key, scope, state);
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
  const key = workbenchStoragePersistenceKey(input.namespace, "last-resource");
  const scope = input.scope ?? "global";
  return {
    getLastResource: () => {
      const parsed = readScopedValue<unknown>(storage, key, scope);
      return isResourceRef(parsed) ? parsed : undefined;
    },
    setLastResource: (resource) => {
      if (!resource) {
        removeScopedValue(storage, key, scope);
        return;
      }
      writeScopedValue(storage, key, scope, resource);
    },
  };
};

export const createLocalStorageWorkbenchPersistence = (input: CreateLocalStorageWorkbenchPersistenceInput) => {
  const storage = resolveStorage(input.storage);

  return {
    layoutPersistence: createLocalStorageLayoutPersistence({
      namespace: input.namespace,
      storage,
    }),
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
