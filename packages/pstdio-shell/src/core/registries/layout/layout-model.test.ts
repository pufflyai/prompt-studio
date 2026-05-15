import { describe, expect, test } from "bun:test";
import { createLayoutModel, type ShellLayout, type WidgetContribution } from "./layout-model";

const registerTestWidget = (
  layout: ReturnType<typeof createLayoutModel>,
  widget: Omit<WidgetContribution, "rendererId"> & Partial<Pick<WidgetContribution, "rendererId">>,
) => layout.registerWidget({ rendererId: widget.id, ...widget });

describe("createLayoutModel", () => {
  test("opens widgets in their contributed area and tracks active resource state", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "sessions.chat",
      title: "Session",
      area: "main-right",
      fallbackArea: "main",
      resourceKinds: ["session"],
      rendererId: "sessions.chat",
      config: { density: "compact" },
    });

    expect(layout.getWidget("sessions.chat")?.config).toEqual({ density: "compact" });

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

    registerTestWidget(layout, {
      id: "diagnostics.center",
      title: "Diagnostics",
      area: "main-bottom",
      singleton: true,
    });

    layout.openWidget("diagnostics.center");
    layout.openWidget("diagnostics.center");

    expect(layout.getLayout().areas["main-bottom"].widgets).toHaveLength(1);
  });

  test("updates singleton placement resources when opened from a new resource", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.workspace",
      title: "Workspace",
      area: "main",
      singleton: true,
    });

    const firstPlacement = layout.openWidget("project.workspace", {
      resource: { kind: "workspace", uri: "pstdio://workspace/ps-266", label: "PS-266" },
    });
    const secondPlacement = layout.openWidget("project.workspace", {
      resource: { kind: "workspace", uri: "pstdio://workspace/ps-267", label: "PS-267" },
    });

    expect(secondPlacement.widgetId).toBe(firstPlacement.widgetId);
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

    registerTestWidget(layout, {
      id: "project.outline",
      title: "Outline",
      area: "main-right",
      areaSize: { defaultPx: 280, minPx: 180, maxPx: 360 },
    });
    registerTestWidget(layout, {
      id: "project.preview",
      title: "Preview",
      area: "main-right",
      areaSize: { defaultPx: 420, minPx: 240, maxPx: 640 },
    });

    const outline = layout.openWidget("project.outline");
    layout.openWidget("project.preview");

    expect(layout.getAreaSize("main-right")).toEqual({ defaultPx: 420, minPx: 240, maxPx: 640 });

    layout.activateWidget(outline.widgetId);

    expect(layout.getAreaSize("main-right")).toEqual({ defaultPx: 280, minPx: 180, maxPx: 360 });
  });

  test("resolves area collapsibility from the active widget contribution", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.preview",
      title: "Preview",
      area: "main-bottom",
      areaCollapsible: true,
    });
    registerTestWidget(layout, {
      id: "project.console",
      title: "Console",
      area: "main-bottom",
      areaCollapsible: false,
    });

    const preview = layout.openWidget("project.preview");
    layout.openWidget("project.console");

    expect(layout.getAreaCollapsible("main-bottom")).toBe(false);

    layout.activateWidget(preview.widgetId);

    expect(layout.getAreaCollapsible("main-bottom")).toBe(true);
  });

  test("resolves header border bottom from the active widget contribution", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.context",
      title: "Project context",
      area: "main-header",
    });
    registerTestWidget(layout, {
      id: "project.toolbar",
      title: "Project toolbar",
      area: "main-header",
      headerBorderBottom: false,
    });

    const context = layout.openWidget("project.context");
    layout.openWidget("project.toolbar");

    expect(layout.getAreaHeaderBorderBottom("main-header")).toBe(false);

    layout.activateWidget(context.widgetId);

    expect(layout.getAreaHeaderBorderBottom("main-header")).toBe(true);
  });
});

describe("createLayoutModel area placeholders", () => {
  test("registers area placeholders outside the widget placement list", () => {
    const layout = createLayoutModel();

    const disposable = layout.registerAreaPlaceholder({
      id: "main.empty",
      title: "Empty main",
      area: "main",
      rendererId: "main.empty",
      areaSize: { defaultPx: 360, minPx: 240 },
      areaCollapsible: false,
    });

    expect(layout.getAreaPlaceholder("main")).toMatchObject({
      id: "main.empty",
      title: "Empty main",
      area: "main",
      rendererId: "main.empty",
    });
    expect(layout.getLayout().areas.main.widgets).toEqual([]);
    expect(layout.getAreaSize("main")).toEqual({ defaultPx: 360, minPx: 240 });
    expect(layout.getAreaCollapsible("main")).toBe(false);

    disposable.dispose();

    expect(layout.getAreaPlaceholder("main")).toBeUndefined();
    expect(layout.getAreaSize("main")).toBeUndefined();
    expect(layout.getAreaCollapsible("main")).toBe(true);
  });

  test("uses active widgets instead of the area placeholder while widgets are open", () => {
    const layout = createLayoutModel();

    layout.registerAreaPlaceholder({
      id: "main.empty",
      title: "Empty main",
      area: "main",
      rendererId: "main.empty",
      areaSize: { defaultPx: 360, minPx: 240 },
      areaCollapsible: false,
    });
    registerTestWidget(layout, {
      id: "project.preview",
      title: "Preview",
      area: "main",
      areaSize: { defaultPx: 480, minPx: 320 },
      areaCollapsible: true,
      closable: true,
    });

    const preview = layout.openWidget("project.preview");

    expect(layout.getAreaSize("main")).toEqual({ defaultPx: 480, minPx: 320 });
    expect(layout.getAreaCollapsible("main")).toBe(true);

    layout.closeWidget(preview.widgetId);

    expect(layout.getLayout().areas.main.widgets).toEqual([]);
    expect(layout.getAreaSize("main")).toEqual({ defaultPx: 360, minPx: 240 });
    expect(layout.getAreaCollapsible("main")).toBe(false);
  });
});

describe("createLayoutModel widget placement", () => {
  test("activates an existing widget placement without adding a duplicate", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.settings",
      title: "Project settings",
      area: "main",
    });
    registerTestWidget(layout, {
      id: "sessions.chat",
      title: "Session chat",
      area: "main",
    });

    const settings = layout.openWidget("project.settings");
    layout.openWidget("sessions.chat");

    const activated = layout.activateWidget(settings.widgetId);

    expect(activated.widgetId).toBe(settings.widgetId);
    expect(layout.getLayout().activeWidgetId).toBe(settings.widgetId);
    expect(layout.getLayout().areas.main.activeWidgetId).toBe(settings.widgetId);
    expect(layout.getLayout().areas.main.widgets.map((placement) => placement.widgetId)).toEqual([
      "project.settings",
      "sessions.chat",
    ]);
  });

  test("replaces the active widget placement when requested", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.tickets",
      title: "Tickets",
      area: "main",
    });
    registerTestWidget(layout, {
      id: "project.settings",
      title: "Project settings",
      area: "main",
    });

    layout.openWidget("project.tickets", {
      resource: { kind: "dashboard-view", uri: "pstdio://dashboard/tickets", label: "Tickets" },
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
    expect(layout.getLayout().areas.main.widgets[0]).toEqual(placement);
    expect(layout.getLayout().activeWidgetId).toBe("project.settings");
  });

  test("closes closable widget placements", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.tickets",
      title: "Tickets",
      area: "main",
    });
    registerTestWidget(layout, {
      id: "project.settings",
      title: "Project settings",
      area: "main",
      closable: true,
    });

    const tickets = layout.openWidget("project.tickets");
    const settings = layout.openWidget("project.settings");

    layout.closeWidget(settings.widgetId);

    expect(layout.getLayout().areas.main.widgets).toEqual([tickets]);
    expect(layout.getLayout().areas.main.activeWidgetId).toBe(tickets.widgetId);
    expect(layout.getLayout().activeWidgetId).toBe(tickets.widgetId);
    expect(() => layout.closeWidget(tickets.widgetId)).toThrow("Widget cannot be closed: project.tickets");
  });

  test("removes placements when a widget contribution is disposed", () => {
    const layout = createLayoutModel();

    const disposable = registerTestWidget(layout, {
      id: "mode.editor",
      title: "Editor",
      area: "main",
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

  test("clears an area and active shell selection", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.tickets",
      title: "Tickets",
      area: "main",
    });
    registerTestWidget(layout, {
      id: "project.settings",
      title: "Project settings",
      area: "main",
    });

    layout.openWidget("project.tickets");
    layout.openWidget("project.settings", {
      resource: { kind: "project", uri: "pstdio://project/project-1", label: "Project" },
    });

    layout.clearArea("main");

    expect(layout.getLayout().areas.main.widgets).toEqual([]);
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

  test("exposes a store that notifies subscribers when the layout changes", () => {
    const layout = createLayoutModel();
    registerTestWidget(layout, {
      id: "project.settings",
      title: "Project settings",
      area: "main",
    });

    const activeIds: Array<string | undefined> = [];
    const unsubscribe = layout.store.subscribeSelector(
      (state) => state.layout.activeWidgetId,
      (id) => activeIds.push(id),
    );

    layout.openWidget("project.settings");
    layout.clearArea("main");

    expect(activeIds).toEqual(["project.settings", undefined]);

    unsubscribe();
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

    registerTestWidget(layout, {
      id: "project.settings",
      title: "Project settings",
      area: "main",
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
