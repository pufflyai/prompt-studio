import type {
  LayoutPersistenceAdapter,
  PreferencePersistenceAdapter,
  PreferenceScopeRef,
  PreferenceValue,
  ShellLayout,
} from "pstdio-shell/core";

export interface DashboardShellStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface DashboardShellPersistenceInput {
  projectId: string;
  storage?: DashboardShellStorage;
}

const layoutStorageKey = (projectId: string) => `pstdio.dashboard.shell.${projectId}.layout`;
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
