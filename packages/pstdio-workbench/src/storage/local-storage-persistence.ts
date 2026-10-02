import type {
  PersistedTreeRendererStates,
  PersistedWorkbenchPageLocation,
  PersistedWorkbenchPanelMenuState,
  TreeRendererPersistenceAdapter,
  WorkbenchPageLocationPersistence,
  WorkbenchPanelMenuStatePersistenceAdapter,
  WorkbenchPersistenceAdapter,
} from "../core";
import { createLocalStorageLayoutPersistence } from "./local-storage-layout-persistence";
import {
  type CreateWorkbenchStoragePersistenceInput,
  readJson,
  resolveStorage,
  workbenchStoragePersistenceKey,
} from "./local-storage-persistence-helpers";

export type {
  WorkbenchStorageLike,
  WorkbenchStoragePersistenceKind,
} from "./local-storage-persistence-helpers";
export { createLocalStorageLayoutPersistence, workbenchStoragePersistenceKey };

export interface CreateLocalStoragePanelMenuStatePersistenceInput extends CreateWorkbenchStoragePersistenceInput {
  scope: string;
}

export interface CreateLocalStorageTreePersistenceInput extends CreateWorkbenchStoragePersistenceInput {
  scope?: string;
}

export interface CreateLocalStorageWorkbenchPersistenceInput extends CreateWorkbenchStoragePersistenceInput {
  scope?: string;
}

type StoredWorkbenchPageLocation = PersistedWorkbenchPageLocation & { version: 1 };

const WORKBENCH_PAGE_LOCATION_VERSION = 1 as const;

export const createLocalStoragePageLocationPersistence = (
  input: CreateWorkbenchStoragePersistenceInput,
): WorkbenchPageLocationPersistence => {
  const storage = resolveStorage(input.storage);
  return {
    load: (projectId) => {
      const stored = readJson<StoredWorkbenchPageLocation>(
        storage,
        workbenchStoragePersistenceKey(input.namespace, "page-location", projectId),
      );
      if (stored?.version !== WORKBENCH_PAGE_LOCATION_VERSION) return undefined;
      return { location: stored.location, ...(stored.rootLevel ? { rootLevel: stored.rootLevel } : {}) };
    },
    save: (projectId, persisted) => {
      const stored: StoredWorkbenchPageLocation = { version: WORKBENCH_PAGE_LOCATION_VERSION, ...persisted };
      storage.setItem(
        workbenchStoragePersistenceKey(input.namespace, "page-location", projectId),
        JSON.stringify(stored),
      );
    },
  };
};
export const createLocalStoragePanelMenuStatePersistence = (
  input: CreateLocalStoragePanelMenuStatePersistenceInput,
): WorkbenchPanelMenuStatePersistenceAdapter => {
  const storage = resolveStorage(input.storage);
  return {
    getMenuStates: (scope) =>
      readJson<PersistedWorkbenchPanelMenuState>(
        storage,
        workbenchStoragePersistenceKey(input.namespace, "panel-menus", scope ?? input.scope),
      ),
    setMenuStates: (state, scope) => {
      const key = workbenchStoragePersistenceKey(input.namespace, "panel-menus", scope ?? input.scope);
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
    layoutPersistence,
    panelMenuStatePersistence: createLocalStoragePanelMenuStatePersistence({
      namespace: input.namespace,
      scope: input.scope ?? "global",
      storage,
    }),
    pageLocationPersistence: createLocalStoragePageLocationPersistence({ namespace: input.namespace, storage }),
    treePersistence: createLocalStorageTreePersistence({ namespace: input.namespace, scope: input.scope, storage }),
  };
};
