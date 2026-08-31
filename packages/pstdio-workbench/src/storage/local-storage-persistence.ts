import type { PageLocation } from "@pstdio/sdk/extensions";
import type {
  LastResourcePersistenceAdapter,
  PersistedTreeRendererStates,
  PersistedWorkbenchHistory,
  PersistedWorkbenchPanels,
  ResourceRef,
  TreeRendererPersistenceAdapter,
  WorkbenchHistoryPersistence,
  WorkbenchPageLocationPersistence,
  WorkbenchPanelsPersistenceAdapter,
  WorkbenchPersistenceAdapter,
  WorkbenchPlacementState,
  WorkbenchPlacementStatePersistence,
  WorkbenchSidePanelMode,
  WorkbenchSidePanelPersistenceAdapter,
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

export interface CreateLocalStoragePanelsPersistenceInput extends CreateWorkbenchStoragePersistenceInput {
  scope: string;
}

export interface CreateLocalStorageTreePersistenceInput extends CreateWorkbenchStoragePersistenceInput {
  scope?: string;
}

export interface CreateLocalStorageWorkbenchPersistenceInput extends CreateWorkbenchStoragePersistenceInput {
  scope?: string;
}

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

interface PersistedWorkbenchPageLocation {
  version: 1;
  location: PageLocation;
}

const WORKBENCH_PAGE_LOCATION_VERSION = 1 as const;

export const createLocalStoragePageLocationPersistence = (
  input: CreateWorkbenchStoragePersistenceInput,
): WorkbenchPageLocationPersistence => {
  const storage = resolveStorage(input.storage);
  return {
    load: (projectId) => {
      const persisted = readJson<PersistedWorkbenchPageLocation>(
        storage,
        workbenchStoragePersistenceKey(input.namespace, "page-location", projectId),
      );
      return persisted?.version === WORKBENCH_PAGE_LOCATION_VERSION ? persisted.location : undefined;
    },
    save: (projectId, location) => {
      const persisted: PersistedWorkbenchPageLocation = {
        version: WORKBENCH_PAGE_LOCATION_VERSION,
        location,
      };
      storage.setItem(
        workbenchStoragePersistenceKey(input.namespace, "page-location", projectId),
        JSON.stringify(persisted),
      );
    },
  };
};

interface PersistedWorkbenchPlacementState {
  version: 1;
  state: WorkbenchPlacementState;
}

const WORKBENCH_PLACEMENT_STATE_VERSION = 1 as const;

export const createLocalStoragePlacementStatePersistence = (
  input: CreateWorkbenchStoragePersistenceInput,
): WorkbenchPlacementStatePersistence => {
  const storage = resolveStorage(input.storage);
  return {
    load: (projectId) => {
      const persisted = readJson<PersistedWorkbenchPlacementState>(
        storage,
        workbenchStoragePersistenceKey(input.namespace, "placement-state", projectId),
      );
      return persisted?.version === WORKBENCH_PLACEMENT_STATE_VERSION ? persisted.state : undefined;
    },
    save: (projectId, state) => {
      const persisted: PersistedWorkbenchPlacementState = {
        version: WORKBENCH_PLACEMENT_STATE_VERSION,
        state,
      };
      storage.setItem(
        workbenchStoragePersistenceKey(input.namespace, "placement-state", projectId),
        JSON.stringify(persisted),
      );
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

interface PersistedWorkbenchSidePanel {
  version: 1;
  mode: WorkbenchSidePanelMode;
}

const WORKBENCH_SIDE_PANEL_VERSION = 1 as const;
const sidePanelModes: readonly WorkbenchSidePanelMode[] = ["attached", "closed", "floating"];

export interface CreateLocalStorageSidePanelPersistenceInput extends CreateWorkbenchStoragePersistenceInput {
  scope?: string;
}

export const createLocalStorageSidePanelPersistence = (
  input: CreateLocalStorageSidePanelPersistenceInput,
): WorkbenchSidePanelPersistenceAdapter => {
  const storage = resolveStorage(input.storage);
  const key = workbenchStoragePersistenceKey(input.namespace, "side-panel", input.scope);
  return {
    getMode: () => {
      const persisted = readJson<PersistedWorkbenchSidePanel>(storage, key);
      if (persisted?.version !== WORKBENCH_SIDE_PANEL_VERSION) return undefined;
      return sidePanelModes.includes(persisted.mode) ? persisted.mode : undefined;
    },
    setMode: (mode) => {
      const persisted: PersistedWorkbenchSidePanel = { version: WORKBENCH_SIDE_PANEL_VERSION, mode };
      storage.setItem(key, JSON.stringify(persisted));
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
    historyPersistence: createLocalStorageHistoryPersistence({ namespace: input.namespace, storage }),
    layoutPersistence,
    panelsPersistence: createLocalStoragePanelsPersistence({
      namespace: input.namespace,
      scope: input.scope ?? "global",
      storage,
    }),
    pageLocationPersistence: createLocalStoragePageLocationPersistence({ namespace: input.namespace, storage }),
    placementStatePersistence: createLocalStoragePlacementStatePersistence({
      namespace: input.namespace,
      storage,
    }),
    treePersistence: createLocalStorageTreePersistence({ namespace: input.namespace, scope: input.scope, storage }),
    lastResourcePersistence: createLocalStorageLastResourcePersistence({
      namespace: input.namespace,
      scope: input.scope,
      storage,
    }),
    sidePanelPersistence: createLocalStorageSidePanelPersistence({
      namespace: input.namespace,
      scope: input.scope,
      storage,
    }),
  };
};
