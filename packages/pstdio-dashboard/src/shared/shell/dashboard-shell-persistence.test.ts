import { describe, expect, it } from "bun:test";
import type { ShellLayout } from "pstdio-shell/core";
import {
  createDashboardShellLayoutPersistence,
  createDashboardShellPanelsPersistence,
  createDashboardShellPreferencePersistence,
  createDashboardShellTreePersistence,
  DASHBOARD_SHELL_STATE_VERSION,
  type DashboardShellStorage,
} from "./dashboard-shell-persistence";

const createStorage = (): DashboardShellStorage => {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
};

describe("dashboard shell persistence", () => {
  it("stores layout and preference values in project-scoped storage", () => {
    const storage = createStorage();
    const layoutPersistence = createDashboardShellLayoutPersistence({ projectId: "project-1", storage });
    const preferencePersistence = createDashboardShellPreferencePersistence({ projectId: "project-1", storage });
    const layout = {
      areas: {
        top: { id: "top", visible: true, widgets: [] },
        activityBar: { id: "activityBar", visible: true, widgets: [] },
        "left-header": { id: "left-header", visible: true, widgets: [] },
        left: { id: "left", visible: true, widgets: [] },
        "main-header": { id: "main-header", visible: true, widgets: [] },
        "main-left-header": { id: "main-left-header", visible: true, widgets: [] },
        "main-left": { id: "main-left", visible: true, widgets: [] },
        main: {
          id: "main",
          visible: true,
          activeWidgetId: "project.settings",
          widgets: [{ widgetId: "project.settings", contributionId: "project.settings" }],
        },
        "main-right-header": { id: "main-right-header", visible: true, widgets: [] },
        "main-right": { id: "main-right", visible: true, widgets: [] },
        "main-bottom-header": { id: "main-bottom-header", visible: true, widgets: [] },
        "main-bottom": { id: "main-bottom", visible: true, widgets: [] },
        status: { id: "status", visible: true, widgets: [] },
        overlay: { id: "overlay", visible: true, widgets: [] },
        "floating-header": { id: "floating-header", visible: true, widgets: [] },
        floating: { id: "floating", visible: true, widgets: [] },
      },
      activeWidgetId: "project.settings",
    } satisfies ShellLayout;

    layoutPersistence.setLayout(layout);
    preferencePersistence.setValue("dashboard.project.panelDensity", "compact", {
      scope: "project",
      scopeId: "project-1",
    });

    expect(createDashboardShellLayoutPersistence({ projectId: "project-1", storage }).getLayout()).toMatchObject({
      activeWidgetId: "project.settings",
    });
    expect(
      createDashboardShellPreferencePersistence({ projectId: "project-1", storage }).getValue(
        "dashboard.project.panelDensity",
        {
          scope: "project",
          scopeId: "project-1",
        },
      ),
    ).toBe("compact");
    expect(createDashboardShellLayoutPersistence({ projectId: "project-2", storage }).getLayout()).toBeUndefined();
  });

  it("persists versioned tree state and reads it back per project", () => {
    const storage = createStorage();
    const persistence = createDashboardShellTreePersistence({ projectId: "project-1", storage });

    persistence.setTreeStates({
      statesByViewId: {
        "settings.tree": {
          expandedNodeIds: ["repositories"],
          expandedSectionIds: ["templates"],
          selectedNodeId: "repositories",
        },
      },
    });

    const raw = JSON.parse(storage.getItem("pstdio.dashboard.shell.project-1.trees") ?? "null");
    expect(raw?.version).toBe(DASHBOARD_SHELL_STATE_VERSION);
    expect(
      createDashboardShellTreePersistence({ projectId: "project-1", storage }).getTreeStates()?.statesByViewId,
    ).toEqual({
      "settings.tree": {
        expandedNodeIds: ["repositories"],
        expandedSectionIds: ["templates"],
        selectedNodeId: "repositories",
      },
    });
    expect(createDashboardShellTreePersistence({ projectId: "project-2", storage }).getTreeStates()).toBeUndefined();
  });

  it("ignores tree state stored under an unknown version", () => {
    const storage = createStorage();
    storage.setItem(
      "pstdio.dashboard.shell.project-1.trees",
      JSON.stringify({
        version: 999,
        trees: { statesByViewId: { foo: { expandedNodeIds: ["x"], expandedSectionIds: [] } } },
      }),
    );

    expect(createDashboardShellTreePersistence({ projectId: "project-1", storage }).getTreeStates()).toBeUndefined();
  });

  it("persists versioned panel state and reads it back per project", () => {
    const storage = createStorage();
    const persistence = createDashboardShellPanelsPersistence({ projectId: "project-1", storage });

    persistence.setPanelStates({ openByAreaId: { left: false, "main-right": true } });

    const raw = JSON.parse(storage.getItem("pstdio.dashboard.shell.project-1.panels") ?? "null");
    expect(raw?.version).toBe(DASHBOARD_SHELL_STATE_VERSION);
    expect(
      createDashboardShellPanelsPersistence({ projectId: "project-1", storage }).getPanelStates()?.openByAreaId,
    ).toEqual({ left: false, "main-right": true });
    expect(createDashboardShellPanelsPersistence({ projectId: "project-2", storage }).getPanelStates()).toBeUndefined();
  });

  it("ignores panel state stored under an unknown version", () => {
    const storage = createStorage();
    storage.setItem(
      "pstdio.dashboard.shell.project-1.panels",
      JSON.stringify({ version: 999, panels: { openByAreaId: { left: false } } }),
    );

    expect(createDashboardShellPanelsPersistence({ projectId: "project-1", storage }).getPanelStates()).toBeUndefined();
  });

  it("removes legacy left navigation widgets when loading saved layouts", () => {
    const storage = createStorage();
    const layoutPersistence = createDashboardShellLayoutPersistence({ projectId: "project-1", storage });
    const layout = {
      areas: {
        top: { id: "top", visible: true, widgets: [] },
        activityBar: { id: "activityBar", visible: true, widgets: [] },
        "left-header": { id: "left-header", visible: true, widgets: [] },
        left: {
          id: "left",
          visible: true,
          activeWidgetId: "tickets.navigation",
          widgets: [
            { widgetId: "tickets.navigation", contributionId: "tickets.navigation" },
            { widgetId: "sessions.navigation", contributionId: "sessions.navigation" },
          ],
        },
        "main-header": { id: "main-header", visible: true, widgets: [] },
        "main-left-header": { id: "main-left-header", visible: true, widgets: [] },
        "main-left": { id: "main-left", visible: true, widgets: [] },
        main: { id: "main", visible: true, widgets: [] },
        "main-right-header": { id: "main-right-header", visible: true, widgets: [] },
        "main-right": { id: "main-right", visible: true, widgets: [] },
        "main-bottom-header": { id: "main-bottom-header", visible: true, widgets: [] },
        "main-bottom": { id: "main-bottom", visible: true, widgets: [] },
        status: { id: "status", visible: true, widgets: [] },
        overlay: { id: "overlay", visible: true, widgets: [] },
        "floating-header": { id: "floating-header", visible: true, widgets: [] },
        floating: { id: "floating", visible: true, widgets: [] },
      },
      activeWidgetId: "tickets.navigation",
    } satisfies ShellLayout;

    layoutPersistence.setLayout(layout);

    expect(createDashboardShellLayoutPersistence({ projectId: "project-1", storage }).getLayout()?.areas.left).toEqual({
      id: "left",
      visible: true,
      widgets: [],
    });
  });
});
