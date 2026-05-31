import { describe, expect, test } from "bun:test";
import { createLayoutModel, type WorkbenchLayout } from "./layout-model";
import { registerTestWidget } from "./layout-model-test-utils";

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
      area: "secondary",
      singleton: true,
    });

    layout.openWidget("diagnostics.center");
    layout.openWidget("diagnostics.center");

    expect(layout.getLayout().areas.secondary.widgets).toHaveLength(1);
  });

  test("registers widgets as singleton by default", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.overview",
      title: "Project overview",
      area: "main",
    });

    expect(layout.getWidget("project.overview")?.singleton).toBe(true);

    layout.openWidget("project.overview");
    layout.openWidget("project.overview");

    expect(layout.getLayout().areas.main.widgets).toHaveLength(1);
  });

  test("opens non-singleton widgets as closable placements by default", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.singleton-panel",
      title: "Singleton panel",
      area: "main",
    });
    registerTestWidget(layout, {
      id: "project.tab",
      title: "Project tab",
      area: "main",
      singleton: false,
    });

    const panel = layout.openWidget("project.singleton-panel");
    const tab = layout.openWidget("project.tab");

    expect(panel.closable).toBe(false);
    expect(tab.closable).toBe(true);
  });

  test("keeps non-singleton widgets non-closable when they opt out", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.pinned-tab",
      title: "Pinned tab",
      area: "main",
      singleton: false,
      closable: false,
    });

    expect(layout.openWidget("project.pinned-tab").closable).toBe(false);
  });

  test("reuses matching resource placements by default", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.details",
      title: "Project details",
      area: "main",
      singleton: false,
      resourceKinds: ["project"],
    });

    const firstPlacement = layout.openWidget("project.details", {
      resource: { kind: "project", uri: "pstdio://project/p1", label: "Project 1" },
    });
    const secondPlacement = layout.openWidget("project.details", {
      resource: { kind: "project", uri: "pstdio://project/p1", label: "Project 1" },
      title: "Project 1 details",
    });

    expect(layout.getWidget("project.details")).toMatchObject({ singleton: false, reuse: "resource" });
    expect(secondPlacement.widgetId).toBe(firstPlacement.widgetId);
    expect(secondPlacement.title).toBe("Project 1 details");
    expect(layout.getLayout().areas.main.widgets).toHaveLength(1);
  });

  test("opens separate default placements for different resources", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.details",
      title: "Project details",
      area: "main",
      singleton: false,
      resourceKinds: ["project"],
    });

    const firstPlacement = layout.openWidget("project.details", {
      resource: { kind: "project", uri: "pstdio://project/p1", label: "Project 1" },
    });
    const secondPlacement = layout.openWidget("project.details", {
      resource: { kind: "project", uri: "pstdio://project/p2", label: "Project 2" },
    });

    expect(secondPlacement.widgetId).not.toBe(firstPlacement.widgetId);
    expect(layout.getLayout().areas.main.widgets.map((placement) => placement.resourceUri)).toEqual([
      "pstdio://project/p1",
      "pstdio://project/p2",
    ]);
  });

  test("reuses no-resource widget placements by default", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.settings",
      title: "Project settings",
      area: "main",
      singleton: false,
    });

    const firstPlacement = layout.openWidget("project.settings", { title: "Settings" });
    const secondPlacement = layout.openWidget("project.settings", { title: "Settings reopened" });

    expect(secondPlacement.widgetId).toBe(firstPlacement.widgetId);
    expect(secondPlacement.title).toBe("Settings reopened");
    expect(layout.getLayout().areas.main.widgets).toHaveLength(1);
  });

  test("opens duplicate placements when reuse is disabled", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "scratch",
      title: "Scratch",
      area: "main",
      singleton: false,
      reuse: "none",
    });

    const firstPlacement = layout.openWidget("scratch");
    const secondPlacement = layout.openWidget("scratch");

    expect(secondPlacement.widgetId).not.toBe(firstPlacement.widgetId);
    expect(layout.getLayout().areas.main.widgets).toHaveLength(2);
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
      area: "secondary",
      areaCollapsible: true,
    });
    registerTestWidget(layout, {
      id: "project.console",
      title: "Console",
      area: "secondary",
      areaCollapsible: false,
    });

    const preview = layout.openWidget("project.preview");
    layout.openWidget("project.console");

    expect(layout.getAreaCollapsible("secondary")).toBe(false);

    layout.activateWidget(preview.widgetId);

    expect(layout.getAreaCollapsible("secondary")).toBe(true);
  });
});

describe("createLayoutModel placeholders", () => {
  test("registers placeholders outside the widget placement list", () => {
    const layout = createLayoutModel();

    const disposable = layout.registerPlaceholder({
      id: "main.empty",
      title: "Empty main",
      area: "main",
      rendererId: "main.empty",
      areaSize: { defaultPx: 360, minPx: 240 },
      areaCollapsible: false,
    });

    expect(layout.getPlaceholder("main")).toMatchObject({
      id: "main.empty",
      title: "Empty main",
      area: "main",
      rendererId: "main.empty",
    });
    expect(layout.store.getState().placeholders.main).toMatchObject({
      id: "main.empty",
      area: "main",
    });
    expect(layout.getLayout().areas.main.widgets).toEqual([]);
    expect(layout.getAreaSize("main")).toEqual({ defaultPx: 360, minPx: 240 });
    expect(layout.getAreaCollapsible("main")).toBe(false);

    disposable.dispose();

    expect(layout.getPlaceholder("main")).toBeUndefined();
    expect(layout.getAreaSize("main")).toBeUndefined();
    expect(layout.getAreaCollapsible("main")).toBe(true);
  });

  test("uses active widgets instead of the placeholder while widgets are open", () => {
    const layout = createLayoutModel();

    layout.registerPlaceholder({
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

describe("createLayoutModel persistence", () => {
  test("fills in missing areas when loading a layout persisted before new areas existed", () => {
    const partialLayout = {
      areas: {
        main: { id: "main", visible: true, widgets: [] },
      },
    } as unknown as WorkbenchLayout;
    const persistence = {
      getLayout: () => partialLayout,
      setLayout: () => undefined,
    };

    const layout = createLayoutModel({ persistence });

    expect(layout.getLayout().areas["left-header"]).toBeDefined();
    expect(layout.getLayout().areas["secondary-header"]).toBeDefined();
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
    const savedLayouts: WorkbenchLayout[] = [];
    const persistence = {
      getLayout: () => savedLayouts.at(-1),
      setLayout: (layoutState: WorkbenchLayout) => {
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

  test("can unregister ephemeral widgets without persisting placement removal", () => {
    const savedLayouts: WorkbenchLayout[] = [];
    const persistence = {
      getLayout: () => savedLayouts.at(-1),
      setLayout: (layoutState: WorkbenchLayout) => {
        savedLayouts.push(structuredClone(layoutState));
      },
    };
    const layout = createLayoutModel({ persistence });
    registerTestWidget(layout, {
      id: "session-chat-bubble",
      title: "Session chat bubble",
      area: "floating",
      singleton: true,
    });
    layout.openWidget("session-chat-bubble");

    layout.unregisterWidget("session-chat-bubble", { removePlacements: false, persist: false });

    expect(layout.getWidget("session-chat-bubble")).toBeUndefined();
    expect(layout.getLayout().areas.floating.widgets.map((widget) => widget.widgetId)).toEqual(["session-chat-bubble"]);
    expect(savedLayouts.at(-1)?.areas.floating.widgets.map((widget) => widget.widgetId)).toEqual([
      "session-chat-bubble",
    ]);
  });

  test("rotates persisted state per scope and flushes synchronously on switch", () => {
    const saved = new Map<string, WorkbenchLayout>();
    const persistence = {
      getLayout: (scope?: string) => saved.get(scope ?? "__global__"),
      setLayout: (layoutState: WorkbenchLayout, scope?: string) => {
        saved.set(scope ?? "__global__", structuredClone(layoutState));
      },
    };
    const layout = createLayoutModel({ persistence });

    layout.setPersistenceScope("project:a");
    layout.setAreaVisible("left", false);
    layout.setAreaSize("left", 200);

    layout.setPersistenceScope("project:b");
    layout.setAreaSize("left", 360);

    layout.setPersistenceScope("project:a");
    expect(layout.getLayout().areas.left.visible).toBe(false);
    expect(layout.getLayout().areas.left.size).toBe(200);

    layout.setPersistenceScope("project:b");
    expect(layout.getLayout().areas.left.visible).toBe(true);
    expect(layout.getLayout().areas.left.size).toBe(360);
  });

  test("scope === undefined falls back to global behavior", () => {
    const saved = new Map<string, WorkbenchLayout>();
    const persistence = {
      getLayout: (scope?: string) => saved.get(scope ?? "__global__"),
      setLayout: (layoutState: WorkbenchLayout, scope?: string) => {
        saved.set(scope ?? "__global__", structuredClone(layoutState));
      },
    };
    const layout = createLayoutModel({ persistence });

    expect(layout.getPersistenceScope()).toBeUndefined();
    layout.setAreaSize("left", 280);
    expect(saved.get("__global__")?.areas.left.size).toBe(280);
  });

  test("persists area visibility and resize state through the layout model", () => {
    const savedLayouts: WorkbenchLayout[] = [];
    const persistence = {
      getLayout: () => savedLayouts.at(-1),
      setLayout: (layoutState: WorkbenchLayout) => {
        savedLayouts.push(structuredClone(layoutState));
      },
    };
    const layout = createLayoutModel({ persistence });

    layout.setAreaVisible("left", false);
    layout.setAreaSize("left", 312);
    layout.setAreaSize("secondary", 280);

    const rehydrated = createLayoutModel({ persistence });

    expect(rehydrated.getLayout().areas.left.visible).toBe(false);
    expect(rehydrated.getLayout().areas.left.size).toBe(312);
    expect(rehydrated.getAreaSize("left")?.defaultPx).toBe(312);
    expect(rehydrated.getLayout().areas.secondary.size).toBe(280);
  });
});
