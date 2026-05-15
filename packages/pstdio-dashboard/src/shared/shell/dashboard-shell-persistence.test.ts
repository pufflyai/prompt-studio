import { describe, expect, it } from "bun:test";
import type { ShellLayout } from "pstdio-shell/core";
import {
  createDashboardShellLayoutPersistence,
  createDashboardShellPreferencePersistence,
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
