import type {
  LayoutPersistenceAdapter,
  PersistedShellPanels,
  PersistedTreeViewStates,
  PreferencePersistenceAdapter,
  PreferenceScopeRef,
  PreferenceValue,
  ShellLayout,
  ShellPanelsPersistenceAdapter,
  TreeViewPersistenceAdapter,
} from "pstdio-shell/core";

export interface DashboardShellStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface DashboardShellPersistenceInput {
  projectId: string;
  storage?: DashboardShellStorage;
}

export const DASHBOARD_SHELL_STATE_VERSION = 1;

export interface PersistedDashboardShellTreeState {
  version: number;
  trees: PersistedTreeViewStates;
}

export interface PersistedDashboardShellPanelsState {
  version: number;
  panels: PersistedShellPanels;
}

const layoutStorageKey = (projectId: string) => `pstdio.dashboard.shell.${projectId}.layout`;
const treeStorageKey = (projectId: string) => `pstdio.dashboard.shell.${projectId}.trees`;
const panelsStorageKey = (projectId: string) => `pstdio.dashboard.shell.${projectId}.panels`;
const legacyLeftNavigationWidgetIds = new Set([
  "tickets.navigation",
  "ticket.details.navigation",
  "sessions.navigation",
]);

const preferenceStorageKey = (projectId: string, name: string, scope: PreferenceScopeRef) =>
  `pstdio.dashboard.shell.${projectId}.preference.${scope.scope}.${scope.scopeId ?? "default"}.${name}`;

const getBrowserStorage = () => {
  if (typeof window === "undefined") return undefined;

  return window.localStorage;
};

const removeLegacyLeftNavigationWidgets = (layout: ShellLayout): ShellLayout => {
  const left = layout.areas.left;
  const { activeWidgetId, ...leftWithoutActiveWidgetId } = left;
  const widgets = left.widgets.filter((widget) => !legacyLeftNavigationWidgetIds.has(widget.contributionId));
  const nextActiveWidgetId = widgets.some((widget) => widget.widgetId === activeWidgetId) ? activeWidgetId : undefined;

  return {
    ...layout,
    areas: {
      ...layout.areas,
      left: {
        ...leftWithoutActiveWidgetId,
        widgets,
        ...(nextActiveWidgetId ? { activeWidgetId: nextActiveWidgetId } : {}),
      },
    },
    activeWidgetId: legacyLeftNavigationWidgetIds.has(layout.activeWidgetId ?? "") ? undefined : layout.activeWidgetId,
  };
};

export const createDashboardShellLayoutPersistence = (
  input: DashboardShellPersistenceInput,
): LayoutPersistenceAdapter => {
  const storage = input.storage ?? getBrowserStorage();

  return {
    getLayout() {
      const stored = storage?.getItem(layoutStorageKey(input.projectId));

      return stored ? removeLegacyLeftNavigationWidgets(JSON.parse(stored) as ShellLayout) : undefined;
    },

    setLayout(layout) {
      storage?.setItem(layoutStorageKey(input.projectId), JSON.stringify(layout));
    },
  };
};

export const createDashboardShellPreferencePersistence = (
  input: DashboardShellPersistenceInput,
): PreferencePersistenceAdapter => {
  const storage = input.storage ?? getBrowserStorage();

  return {
    getValue(name, scope) {
      const stored = storage?.getItem(preferenceStorageKey(input.projectId, name, scope));

      return stored ? (JSON.parse(stored) as PreferenceValue) : undefined;
    },

    setValue(name, value, scope) {
      storage?.setItem(preferenceStorageKey(input.projectId, name, scope), JSON.stringify(value));
    },
  };
};

const parsePersistedTreeState = (raw: string): PersistedTreeViewStates | undefined => {
  const parsed = JSON.parse(raw) as PersistedDashboardShellTreeState | PersistedTreeViewStates;
  if (parsed && typeof parsed === "object" && "version" in parsed) {
    if (parsed.version === DASHBOARD_SHELL_STATE_VERSION) return parsed.trees;
    return undefined;
  }
  return parsed as PersistedTreeViewStates;
};

export const createDashboardShellTreePersistence = (
  input: DashboardShellPersistenceInput,
): TreeViewPersistenceAdapter => {
  const storage = input.storage ?? getBrowserStorage();

  return {
    getTreeStates() {
      const stored = storage?.getItem(treeStorageKey(input.projectId));
      return stored ? parsePersistedTreeState(stored) : undefined;
    },

    setTreeStates(states) {
      const payload: PersistedDashboardShellTreeState = {
        version: DASHBOARD_SHELL_STATE_VERSION,
        trees: states,
      };
      storage?.setItem(treeStorageKey(input.projectId), JSON.stringify(payload));
    },
  };
};

const parsePersistedPanelsState = (raw: string): PersistedShellPanels | undefined => {
  const parsed = JSON.parse(raw) as PersistedDashboardShellPanelsState;
  if (!parsed || typeof parsed !== "object" || !("version" in parsed)) return undefined;
  if (parsed.version !== DASHBOARD_SHELL_STATE_VERSION) return undefined;
  return parsed.panels;
};

export const createDashboardShellPanelsPersistence = (
  input: DashboardShellPersistenceInput,
): ShellPanelsPersistenceAdapter => {
  const storage = input.storage ?? getBrowserStorage();

  return {
    getPanelStates() {
      const stored = storage?.getItem(panelsStorageKey(input.projectId));
      return stored ? parsePersistedPanelsState(stored) : undefined;
    },

    setPanelStates(state) {
      const payload: PersistedDashboardShellPanelsState = {
        version: DASHBOARD_SHELL_STATE_VERSION,
        panels: state,
      };
      storage?.setItem(panelsStorageKey(input.projectId), JSON.stringify(payload));
    },
  };
};
