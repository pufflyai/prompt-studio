import type { LayoutPersistenceAdapter, WorkbenchLayout } from "../core";
import {
  type CreateWorkbenchStoragePersistenceInput,
  readJson,
  resolveStorage,
  workbenchStoragePersistenceKey,
} from "./local-storage-persistence-helpers";

interface PersistedWorkbenchLayoutV3 {
  version: 3;
  layout: WorkbenchLayout;
}

type PersistedWorkbenchLayout = PersistedWorkbenchLayoutV3;

// Version 3 is the composition-resolver layout model (PS-267). Layouts persisted by
// earlier versions carry replaced panel roles and bindings, so they are discarded
// rather than interpreted.
const WORKBENCH_LAYOUT_VERSION = 3 as const;
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

export const createLocalStorageLayoutPersistence = (
  input: CreateWorkbenchStoragePersistenceInput,
): LayoutPersistenceAdapter => {
  const storage = resolveStorage(input.storage);
  const pending = new Map<
    string,
    { generation: number; legacyPanelsKey?: string; raw: string; scope: string | undefined }
  >();
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
      storage.removeItem?.(workbenchStoragePersistenceKey(input.namespace, "panels", evictedScope));
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
      if (write.generation !== generation) continue;
      storage.setItem(workbenchStoragePersistenceKey(input.namespace, "layout", write.scope), write.raw);
      touchProjectScope(write.scope);
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
      const pendingWrite = pending.get(key);
      const persisted =
        pendingWrite && pendingWrite.generation === getGeneration()
          ? (JSON.parse(pendingWrite.raw) as PersistedWorkbenchLayout)
          : readJson<PersistedWorkbenchLayout>(storage, key);
      if (persisted?.version === WORKBENCH_LAYOUT_VERSION) return persisted.layout;
      return undefined;
    },
    setLayout: (layout, scope) => {
      const persisted: PersistedWorkbenchLayoutV3 = { version: WORKBENCH_LAYOUT_VERSION, layout };
      const key = workbenchStoragePersistenceKey(input.namespace, "layout", scope);
      const legacyPanelsKey = workbenchStoragePersistenceKey(input.namespace, "panels", scope);
      pending.delete(key);
      pending.set(key, {
        generation: getGeneration(),
        legacyPanelsKey: storage.getItem(legacyPanelsKey) === null ? undefined : legacyPanelsKey,
        raw: JSON.stringify(persisted),
        scope,
      });
      scheduleFlush();
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
          continue;
        }
        storage.setItem(
          key,
          JSON.stringify({ version: WORKBENCH_LAYOUT_VERSION, layout } satisfies PersistedWorkbenchLayoutV3),
        );
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
    },
  };
};
