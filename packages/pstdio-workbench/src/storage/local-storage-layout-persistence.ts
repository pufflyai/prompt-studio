import type { LayoutPersistenceAdapter, WorkbenchLayout } from "../core";
import { cacheLayoutData } from "../core/registries/layout/layout-tab-presentation";
import {
  type CreateWorkbenchStoragePersistenceInput,
  readJson,
  resolveStorage,
  type WorkbenchStorageLike,
  workbenchStoragePersistenceKey,
} from "./local-storage-persistence-helpers";

interface PersistedWorkbenchLayoutV5 {
  version: 5;
  layout: WorkbenchLayout;
}

type PersistedWorkbenchLayout = PersistedWorkbenchLayoutV5;

// Version 5 makes the side region's visibility the Side Panel's open state. Older
// layouts saved a side visibility that never meant open, so they are discarded.
// Only the layout cache changes; routed locations and independent preferences stay valid.
const WORKBENCH_LAYOUT_VERSION = 5 as const;
const WORKBENCH_LAYOUT_INDEX_VERSION = 1 as const;
const WORKBENCH_LAYOUT_RESOURCE_LIMIT = 50;

interface PersistedWorkbenchLayoutScopeIndex {
  version: 1;
  scopes: string[];
}

interface PersistedWorkbenchLayoutGeneration {
  version: 1;
  generation: number;
}

const readSavedLayout = (storage: WorkbenchStorageLike, namespace: string, scope: string | undefined) => {
  const saved = readJson<PersistedWorkbenchLayout>(storage, workbenchStoragePersistenceKey(namespace, "layout", scope));
  return saved?.version === WORKBENCH_LAYOUT_VERSION ? saved.layout : undefined;
};

const createLayoutRemoval = (
  storage: WorkbenchStorageLike,
  namespace: string,
  pending: { delete(key: string): boolean },
  notify: (scope: string | undefined, layout: WorkbenchLayout | undefined) => void,
) =>
  storage.removeItem
    ? (scope?: string) => {
        const key = workbenchStoragePersistenceKey(namespace, "layout", scope);
        const existed = pending.delete(key) || storage.getItem(key) !== null;
        storage.removeItem?.(key);
        if (existed) notify(scope, undefined);
      }
    : undefined;

export const createLocalStorageLayoutPersistence = (
  input: CreateWorkbenchStoragePersistenceInput,
): LayoutPersistenceAdapter => {
  const storage = resolveStorage(input.storage);
  const pending = new Map<string, { generation: number; raw: string; scope: string | undefined }>();
  const listeners = new Set<(scope: string | undefined, layout: WorkbenchLayout | undefined) => void>();
  const notify = (scope: string | undefined, layout: WorkbenchLayout | undefined) => {
    for (const listener of listeners) listener(scope, layout);
  };
  const savedLayout = (scope: string | undefined) => readSavedLayout(storage, input.namespace, scope);
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

  const generationKey = workbenchStoragePersistenceKey(input.namespace, "layout-generation", undefined);
  const getGeneration = () => {
    const persisted = readJson<unknown>(storage, generationKey);
    return typeof persisted === "object" &&
      persisted !== null &&
      "version" in persisted &&
      persisted.version === 1 &&
      "generation" in persisted &&
      typeof persisted.generation === "number"
      ? persisted.generation
      : 0;
  };

  const advanceGeneration = () => {
    const generation = getGeneration() + 1;
    const persisted: PersistedWorkbenchLayoutGeneration = { version: 1, generation };
    storage.setItem(generationKey, JSON.stringify(persisted));
    const cancelled = [...pending.values()];
    pending.clear();
    for (const write of cancelled) notify(write.scope, savedLayout(write.scope));
    return generation;
  };

  const resourceProjectId = (scope: string | undefined) =>
    scope?.match(/^project\/([^/]+)\/mode\/[^/]+\/resource\//)?.[1];
  const scopeProjectId = (scope: string | undefined) => scope?.match(/^project\/([^/]+)/)?.[1];

  const storedProjectScopes = (projectId: string) => {
    if (!storage.key) return [];
    const prefix = `${input.namespace}:layout:`;
    const scopes: string[] = [];
    for (let index = 0; index < (storage.length ?? 0); index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const scope = key.slice(prefix.length);
      if (scopeProjectId(scope) === projectId) scopes.push(scope);
    }
    return scopes;
  };

  const readScopes = (kind: "layout-resource-index" | "layout-scope-index", projectId: string) => {
    const persisted = readJson<unknown>(storage, workbenchStoragePersistenceKey(input.namespace, kind, projectId));
    return typeof persisted === "object" &&
      persisted !== null &&
      "version" in persisted &&
      persisted.version === WORKBENCH_LAYOUT_INDEX_VERSION &&
      "scopes" in persisted &&
      Array.isArray(persisted.scopes)
      ? persisted.scopes.filter(
          (scope): scope is string =>
            typeof scope === "string" &&
            storage.getItem(workbenchStoragePersistenceKey(input.namespace, "layout", scope)) !== null,
        )
      : [];
  };

  const writeScopes = (kind: "layout-resource-index" | "layout-scope-index", projectId: string, scopes: string[]) => {
    const next: PersistedWorkbenchLayoutScopeIndex = { version: WORKBENCH_LAYOUT_INDEX_VERSION, scopes };
    storage.setItem(workbenchStoragePersistenceKey(input.namespace, kind, projectId), JSON.stringify(next));
  };

  const touchProjectScope = (scope: string | undefined) => {
    const projectId = scopeProjectId(scope);
    if (!projectId || !scope) return;
    const scopes = readScopes("layout-scope-index", projectId).filter((candidate) => candidate !== scope);
    scopes.push(scope);
    writeScopes("layout-scope-index", projectId, scopes);
  };

  const touchResourceScope = (scope: string | undefined) => {
    const projectId = resourceProjectId(scope);
    if (!projectId || !scope) return;
    const scopes = readScopes("layout-resource-index", projectId).filter((candidate) => candidate !== scope);
    scopes.push(scope);
    for (const evictedScope of scopes.splice(0, Math.max(0, scopes.length - WORKBENCH_LAYOUT_RESOURCE_LIMIT))) {
      storage.removeItem?.(workbenchStoragePersistenceKey(input.namespace, "layout", evictedScope));
      storage.removeItem?.(workbenchStoragePersistenceKey(input.namespace, "panel-menus", evictedScope));
      notify(evictedScope, undefined);
    }
    writeScopes("layout-resource-index", projectId, scopes);
  };

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    const writes = [...pending.values()];
    pending.clear();
    const generation = getGeneration();
    for (const write of writes) {
      if (write.generation !== generation) {
        notify(write.scope, savedLayout(write.scope));
        continue;
      }
      storage.setItem(workbenchStoragePersistenceKey(input.namespace, "layout", write.scope), write.raw);
      touchProjectScope(write.scope);
      touchResourceScope(write.scope);
    }
  };

  const scheduleFlush = () => {
    if (debounceMs === 0) {
      flush();
      return;
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  };

  eventTarget?.addEventListener("pagehide", flush);

  return {
    getLayout: (scope) => {
      const key = workbenchStoragePersistenceKey(input.namespace, "layout", scope);
      const pendingWrite = pending.get(key);
      const persisted =
        pendingWrite && pendingWrite.generation === getGeneration()
          ? (JSON.parse(pendingWrite.raw) as PersistedWorkbenchLayout)
          : readJson<PersistedWorkbenchLayout>(storage, key);
      if (persisted?.version === WORKBENCH_LAYOUT_VERSION) return persisted.layout;
      return undefined;
    },
    setLayout: (layout, scope) => {
      const persisted: PersistedWorkbenchLayoutV5 = {
        version: WORKBENCH_LAYOUT_VERSION,
        layout: cacheLayoutData(layout),
      };
      const key = workbenchStoragePersistenceKey(input.namespace, "layout", scope);
      pending.delete(key);
      pending.set(key, {
        generation: getGeneration(),
        raw: JSON.stringify(persisted),
        scope,
      });
      notify(scope, persisted.layout);
      scheduleFlush();
    },
    onDidChangeLayout(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    removeLayout: createLayoutRemoval(storage, input.namespace, pending, notify),
    listLayouts() {
      const prefix = `${input.namespace}:layout:`;
      const keys = new Set(pending.keys());
      for (let index = 0; index < (storage.length ?? 0); index++) {
        const key = storage.key?.(index);
        if (key?.startsWith(prefix)) keys.add(key);
      }
      return [...keys].flatMap((key) => {
        const suffix = key.slice(prefix.length);
        const scope = suffix === "global" ? undefined : suffix;
        const layout = this.getLayout(scope);
        return layout ? [{ scope, layout }] : [];
      });
    },
    flush,
    listScopes(projectId) {
      return [
        ...new Set([
          ...readScopes("layout-scope-index", projectId),
          ...readScopes("layout-resource-index", projectId),
          ...storedProjectScopes(projectId),
        ]),
      ];
    },
    transformLayouts(projectId, transform) {
      flush();
      advanceGeneration();
      for (const scope of this.listScopes?.(projectId) ?? []) {
        const key = workbenchStoragePersistenceKey(input.namespace, "layout", scope);
        const persisted = readJson<PersistedWorkbenchLayout>(storage, key);
        if (persisted?.version !== WORKBENCH_LAYOUT_VERSION) continue;
        const layout = transform(persisted.layout, scope);
        if (!layout) {
          storage.removeItem?.(key);
          notify(scope, undefined);
          continue;
        }
        storage.setItem(
          key,
          JSON.stringify({ version: WORKBENCH_LAYOUT_VERSION, layout } satisfies PersistedWorkbenchLayoutV5),
        );
        notify(scope, layout);
      }
    },
    getCompatibilityMarker: (key) =>
      readJson<string>(storage, workbenchStoragePersistenceKey(input.namespace, "layout-compatibility", key)),
    setCompatibilityMarker: (key, value) => {
      advanceGeneration();
      storage.setItem(
        workbenchStoragePersistenceKey(input.namespace, "layout-compatibility", key),
        JSON.stringify(value),
      );
    },
    advanceWriteGeneration: advanceGeneration,
    dispose() {
      flush();
      eventTarget?.removeEventListener("pagehide", flush);
      listeners.clear();
    },
  };
};
