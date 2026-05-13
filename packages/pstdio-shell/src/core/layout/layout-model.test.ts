import { describe, expect, test } from "bun:test";
import { createLayoutModel, type ShellLayout } from "./layout-model";

describe("createLayoutModel", () => {
  test("opens widgets in their contributed area and tracks active resource state", () => {
    const layout = createLayoutModel();

    layout.registerWidget({
      id: "sessions.chat",
      title: "Session",
      area: "main-right",
      fallbackArea: "main",
      resourceKinds: ["session"],
      renderer: "react",
      rendererId: "sessions.chat",
    });

    const placement = layout.openWidget("sessions.chat", {
      resource: { kind: "session", uri: "pstdio://session/s1", label: "Session 1" },
    });

    expect(placement).toMatchObject({
      widgetId: "sessions.chat",
      contributionId: "sessions.chat",
      resource: { kind: "session", uri: "pstdio://session/s1", label: "Session 1" },
      resourceUri: "pstdio://session/s1",
      title: "Session 1",
    });
    expect(layout.getLayout().activeWidgetId).toBe("sessions.chat");
    expect(layout.getLayout().activeResourceUri).toBe("pstdio://session/s1");
    expect(layout.getLayout().areas["main-right"].activeWidgetId).toBe("sessions.chat");
  });

  test("reuses singleton widget placements instead of adding duplicates", () => {
    const layout = createLayoutModel();

    layout.registerWidget({
      id: "diagnostics.center",
      title: "Diagnostics",
      area: "main-bottom",
      singleton: true,
      renderer: "react",
    });

    layout.openWidget("diagnostics.center");
    layout.openWidget("diagnostics.center");

    expect(layout.getLayout().areas["main-bottom"].widgets).toHaveLength(1);
  });

  test("updates singleton placement resources when opened from a new resource", () => {
    const layout = createLayoutModel();

    layout.registerWidget({
      id: "project.workspace",
      title: "Workspace",
      area: "main",
      singleton: true,
      renderer: "react",
    });

    const firstPlacement = layout.openWidget("project.workspace", {
      resource: { kind: "workspace", uri: "pstdio://workspace/ps-266", label: "PS-266" },
    });
    const secondPlacement = layout.openWidget("project.workspace", {
      resource: { kind: "workspace", uri: "pstdio://workspace/ps-267", label: "PS-267" },
    });

    expect(secondPlacement).toBe(firstPlacement);
    expect(secondPlacement).toMatchObject({
      resource: { kind: "workspace", uri: "pstdio://workspace/ps-267", label: "PS-267" },
      resourceUri: "pstdio://workspace/ps-267",
      title: "PS-267",
    });
    expect(layout.getLayout().activeResourceUri).toBe("pstdio://workspace/ps-267");
    expect(layout.getLayout().areas.main.widgets).toHaveLength(1);
  });

  test("resolves area size from the active widget contribution", () => {
    const layout = createLayoutModel();

    layout.registerWidget({
      id: "project.outline",
      title: "Outline",
      area: "main-right",
      areaSize: { defaultPx: 280, minPx: 180, maxPx: 360 },
      renderer: "react",
    });
    layout.registerWidget({
      id: "project.preview",
      title: "Preview",
      area: "main-right",
      areaSize: { defaultPx: 420, minPx: 240, maxPx: 640 },
      renderer: "react",
    });

    const outline = layout.openWidget("project.outline");
    layout.openWidget("project.preview");

    expect(layout.getAreaSize("main-right")).toEqual({ defaultPx: 420, minPx: 240, maxPx: 640 });

    layout.activateWidget(outline.widgetId);

    expect(layout.getAreaSize("main-right")).toEqual({ defaultPx: 280, minPx: 180, maxPx: 360 });
  });

  test("resolves area collapsibility from the active widget contribution", () => {
    const layout = createLayoutModel();

    layout.registerWidget({
      id: "project.preview",
      title: "Preview",
      area: "main-bottom",
      areaCollapsible: true,
      renderer: "react",
    });
    layout.registerWidget({
      id: "project.console",
      title: "Console",
      area: "main-bottom",
      areaCollapsible: false,
      renderer: "react",
    });

    const preview = layout.openWidget("project.preview");
    layout.openWidget("project.console");

    expect(layout.getAreaCollapsible("main-bottom")).toBe(false);

    layout.activateWidget(preview.widgetId);

    expect(layout.getAreaCollapsible("main-bottom")).toBe(true);
  });

  test("activates an existing widget placement without adding a duplicate", () => {
    const layout = createLayoutModel();

    layout.registerWidget({
      id: "project.settings",
      title: "Project settings",
      area: "main",
      renderer: "react",
    });
    layout.registerWidget({
      id: "sessions.chat",
      title: "Session chat",
      area: "main",
      renderer: "react",
    });

    const settings = layout.openWidget("project.settings");
    layout.openWidget("sessions.chat");

    const activated = layout.activateWidget(settings.widgetId);

    expect(activated).toBe(settings);
    expect(layout.getLayout().activeWidgetId).toBe(settings.widgetId);
    expect(layout.getLayout().areas.main.activeWidgetId).toBe(settings.widgetId);
    expect(layout.getLayout().areas.main.widgets.map((placement) => placement.widgetId)).toEqual([
      "project.settings",
      "sessions.chat",
    ]);
  });

  test("replaces the active widget placement when requested", () => {
    const layout = createLayoutModel();

    layout.registerWidget({
      id: "project.tickets",
      title: "Tickets",
      area: "main",
      renderer: "react",
    });
    layout.registerWidget({
      id: "project.settings",
      title: "Project settings",
      area: "main",
      renderer: "react",
    });

    layout.openWidget("project.tickets", {
      resource: { kind: "dashboard-view", uri: "pstdio://dashboard/tickets", label: "Tickets" },
      closable: false,
    });
    const placement = layout.openWidget("project.settings", {
      resource: { kind: "settings", uri: "pstdio://settings/project", label: "Settings" },
      replaceActive: true,
    });

    expect(placement).toMatchObject({
      widgetId: "project.settings",
      contributionId: "project.settings",
      resourceUri: "pstdio://settings/project",
      title: "Settings",
    });
    expect(layout.getLayout().areas.main.widgets).toHaveLength(1);
    expect(layout.getLayout().areas.main.widgets[0]).toBe(placement);
    expect(layout.getLayout().activeWidgetId).toBe("project.settings");
  });

  test("removes placements when a widget contribution is disposed", () => {
    const layout = createLayoutModel();

    const disposable = layout.registerWidget({
      id: "mode.editor",
      title: "Editor",
      area: "main",
      renderer: "react",
    });

    layout.openWidget("mode.editor", {
      resource: { kind: "note", uri: "pstdio://note/1", label: "Note 1" },
    });

    expect(layout.getLayout().areas.main.widgets).toHaveLength(1);
    expect(layout.getLayout().activeWidgetId).toBe("mode.editor");

    disposable.dispose();

    expect(layout.getLayout().areas.main.widgets).toHaveLength(0);
    expect(layout.getLayout().areas.main.activeWidgetId).toBeUndefined();
    expect(layout.getLayout().activeWidgetId).toBeUndefined();
    expect(layout.getLayout().activeResourceUri).toBeUndefined();
  });
});

describe("createLayoutModel persistence", () => {
  test("fills in missing areas when loading a layout persisted before new areas existed", () => {
    const partialLayout = {
      areas: {
        main: { id: "main", visible: true, widgets: [] },
      },
    } as unknown as ShellLayout;
    const persistence = {
      getLayout: () => partialLayout,
      setLayout: () => undefined,
    };

    const layout = createLayoutModel({ persistence });

    expect(layout.getLayout().areas["left-header"]).toBeDefined();
    expect(layout.getLayout().areas["main-bottom-header"]).toBeDefined();
    expect(layout.getLayout().areas["floating-header"]).toBeDefined();
    expect(layout.getLayout().areas["left-header"].widgets).toEqual([]);
    expect(layout.getLayout().areas["floating-header"].widgets).toEqual([]);
  });

  test("persists layout state through an injected adapter", () => {
    const savedLayouts: ShellLayout[] = [];
    const persistence = {
      getLayout: () => savedLayouts.at(-1),
      setLayout: (layoutState: ShellLayout) => {
        savedLayouts.push(structuredClone(layoutState));
      },
    };
    const layout = createLayoutModel({ persistence });

    layout.registerWidget({
      id: "project.settings",
      title: "Project settings",
      area: "main",
      renderer: "react",
    });

    layout.openWidget("project.settings", {
      resource: { kind: "project", uri: "pstdio://project/project-1", label: "Prompt Studio" },
    });

    expect(savedLayouts.at(-1)?.activeWidgetId).toBe("project.settings");
    expect(savedLayouts.at(-1)?.activeResourceUri).toBe("pstdio://project/project-1");

    const rehydrated = createLayoutModel({ persistence });

    expect(rehydrated.getLayout().activeWidgetId).toBe("project.settings");
    expect(rehydrated.getLayout().areas.main.widgets[0]?.resourceUri).toBe("pstdio://project/project-1");
  });
});
