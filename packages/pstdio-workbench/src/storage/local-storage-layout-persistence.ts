import type { LayoutPersistenceAdapter, WorkbenchLayout } from "../core";
import { workbenchRegions } from "../core";
import {
  type CreateWorkbenchStoragePersistenceInput,
  readJson,
  resolveStorage,
  type WorkbenchStorageLike,
  workbenchStoragePersistenceKey,
} from "./local-storage-persistence-core";

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

export interface LayoutWriteGuard {
  capture(scope: string | undefined): string | undefined;
  isCurrent(scope: string | undefined, writeFence: string | undefined): boolean;
}

interface PendingLayoutWrite {
  legacyPanelsKey?: string;
  raw: string;
  scope: string | undefined;
  writeFence?: string;
}

const storedLayoutScopes = (storage: WorkbenchStorageLike, namespace: string) => {
  if (storage.length === undefined || !storage.key) return [] as Array<string | undefined>;
  const prefix = `${namespace}:layout:`;
  const scopes = [] as Array<string | undefined>;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(prefix)) continue;
    const scope = key.slice(prefix.length);
    scopes.push(scope === "global" ? undefined : scope);
  }
  return scopes;
};

export const createLocalStorageLayoutPersistence = (input: CreateWorkbenchStoragePersistenceInput) => {
  const storage = resolveStorage(input.storage);
  const pending = new Map<string, PendingLayoutWrite>();
  const debounceMs = input.debounceMs ?? 250;
  let writeGuard: LayoutWriteGuard | undefined;
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
      if (writeGuard && !writeGuard.isCurrent(write.scope, write.writeFence)) continue;
      storage.setItem(workbenchStoragePersistenceKey(input.namespace, "layout", write.scope), write.raw);
      touchResourceScope(write.scope);
      if (write.legacyPanelsKey) storage.removeItem?.(write.legacyPanelsKey);
    }
  };

  const scheduleFlush = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  };

  const readLayout: LayoutPersistenceAdapter["getLayout"] = (scope) => {
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
      if (typeof open === "boolean" && regions[region]) regions[region] = { ...regions[region], visible: open };
    }
    const layout = { ...persisted.layout, regions };
    const migrated: PersistedWorkbenchLayoutV2 = { version: WORKBENCH_LAYOUT_VERSION, layout };
    pending.set(key, {
      legacyPanelsKey: storage.getItem(legacyPanelsKey) === null ? undefined : legacyPanelsKey,
      raw: JSON.stringify(migrated),
      scope,
      writeFence: writeGuard?.capture(scope),
    });
    scheduleFlush();
    return layout;
  };

  const writeLayout: LayoutPersistenceAdapter["setLayout"] = (layout, scope) => {
    const persisted: PersistedWorkbenchLayoutV2 = { version: WORKBENCH_LAYOUT_VERSION, layout };
    const key = workbenchStoragePersistenceKey(input.namespace, "layout", scope);
    const legacyPanelsKey = workbenchStoragePersistenceKey(input.namespace, "panels", scope);
    pending.delete(key);
    pending.set(key, {
      legacyPanelsKey: storage.getItem(legacyPanelsKey) === null ? undefined : legacyPanelsKey,
      raw: JSON.stringify(persisted),
      scope,
      writeFence: writeGuard?.capture(scope),
    });
    scheduleFlush();
  };

  eventTarget?.addEventListener("pagehide", flush);

  return {
    getLayout: readLayout,
    setLayout: writeLayout,
    updateLayouts: (
      update: (layout: WorkbenchLayout, scope: string | undefined) => WorkbenchLayout,
      matchesScope: (scope: string | undefined) => boolean = () => true,
    ) => {
      const scopes = new Map<string, string | undefined>();
      for (const scope of storedLayoutScopes(storage, input.namespace)) scopes.set(scope ?? "global", scope);
      for (const pendingLayout of pending.values()) scopes.set(pendingLayout.scope ?? "global", pendingLayout.scope);

      const updatedScopes: string[] = [];
      for (const scope of scopes.values()) {
        if (!matchesScope(scope)) continue;
        const layout = readLayout(scope);
        if (!layout) continue;
        const next = update(layout, scope);
        if (JSON.stringify(next) === JSON.stringify(layout)) continue;
        writeLayout(next, scope);
        updatedScopes.push(scope ?? "global");
      }
      if (updatedScopes.length > 0) flush();
      return { scopes: updatedScopes, updated: updatedScopes.length };
    },
    setWriteGuard(nextWriteGuard: LayoutWriteGuard) {
      writeGuard = nextWriteGuard;
    },
    flush,
    dispose() {
      flush();
      eventTarget?.removeEventListener("pagehide", flush);
    },
  };
};
