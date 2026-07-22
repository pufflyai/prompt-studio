import { describe, expect, test } from "bun:test";
import { createDefaultWorkbenchLayout, createLayoutModel, type WorkbenchLayout } from "./layout-model";
import { registerTestWidget } from "./layout-model-test-utils";

describe("updateWidgetPlacement", () => {
  test("updates a widget placement without activating it", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, { id: "tickets.editor", title: "Ticket", region: "main" });
    registerTestWidget(layout, { id: "left.scratch", title: "Scratch", region: "sidenav" });

    layout.openWidget("tickets.editor", {
      resource: { kind: "ticket", uri: "pstdio://ticket/1", label: "Old title" },
    });
    const scratch = layout.openWidget("left.scratch");

    const updated = layout.updateWidgetPlacement("tickets.editor", {
      resource: { kind: "ticket", uri: "pstdio://ticket/1", label: "New title" },
    });

    expect(updated.title).toBe("New title");
    expect(layout.getLayout().activeWidgetId).toBe(scratch.widgetId);
    expect(layout.getLayout().regions.main.activeWidgetId).toBe("tickets.editor");
    expect(layout.getLayout().regions.sidenav.activeWidgetId).toBe(scratch.widgetId);
  });
});

describe("createLayoutModel", () => {
  test("opens widgets in their contributed region and tracks active resource state", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "sessions.chat",
      title: "Session",
      region: "main-right-menu",
      fallbackRegion: "main",
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
    expect(layout.getLayout().regions["main-right-menu"].activeWidgetId).toBe("sessions.chat");
  });

  test("reuses singleton widget placements instead of adding duplicates", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "diagnostics.center",
      title: "Diagnostics",
      region: "secondary",
      singleton: true,
    });

    layout.openWidget("diagnostics.center");
    layout.openWidget("diagnostics.center");

    expect(layout.getLayout().regions.secondary.widgets).toHaveLength(1);
  });

  test("registers widgets as singleton by default", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.overview",
      title: "Project overview",
      region: "main",
    });

    expect(layout.getWidget("project.overview")?.singleton).toBe(true);

    layout.openWidget("project.overview");
    layout.openWidget("project.overview");

    expect(layout.getLayout().regions.main.widgets).toHaveLength(1);
  });

  test("opens non-singleton widgets as closable placements by default", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.singleton-panel",
      title: "Singleton panel",
      region: "main",
    });
    registerTestWidget(layout, {
      id: "project.tab",
      title: "Project tab",
      region: "main",
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
      region: "main",
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
      region: "main",
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
    expect(layout.getLayout().regions.main.widgets).toHaveLength(1);
  });

  test("opens separate default placements for different resources", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.details",
      title: "Project details",
      region: "main",
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
    expect(layout.getLayout().regions.main.widgets.map((placement) => placement.resourceUri)).toEqual([
      "pstdio://project/p1",
      "pstdio://project/p2",
    ]);
  });

  test("reuses no-resource widget placements by default", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.settings",
      title: "Project settings",
      region: "main",
      singleton: false,
    });

    const firstPlacement = layout.openWidget("project.settings", { title: "Settings" });
    const secondPlacement = layout.openWidget("project.settings", { title: "Settings reopened" });

    expect(secondPlacement.widgetId).toBe(firstPlacement.widgetId);
    expect(secondPlacement.title).toBe("Settings reopened");
    expect(layout.getLayout().regions.main.widgets).toHaveLength(1);
  });

  test("opens duplicate placements when reuse is disabled", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "scratch",
      title: "Scratch",
      region: "main",
      singleton: false,
      reuse: "none",
    });

    const firstPlacement = layout.openWidget("scratch");
    const secondPlacement = layout.openWidget("scratch");

    expect(secondPlacement.widgetId).not.toBe(firstPlacement.widgetId);
    expect(layout.getLayout().regions.main.widgets).toHaveLength(2);
  });

  test("updates singleton placement resources when opened from a new resource", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.workspace",
      title: "Workspace",
      region: "main",
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
    expect(layout.getLayout().regions.main.widgets).toHaveLength(1);
  });

  test("resolves region size from the active widget contribution", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.outline",
      title: "Outline",
      region: "main-right-menu",
      regionSize: { defaultPx: 280, minPx: 180, maxPx: 360 },
    });
    registerTestWidget(layout, {
      id: "project.preview",
      title: "Preview",
      region: "main-right-menu",
      regionSize: { defaultPx: 420, minPx: 240, maxPx: 640 },
    });

    const outline = layout.openWidget("project.outline");
    layout.openWidget("project.preview");

    expect(layout.getRegionSize("main-right-menu")).toEqual({ defaultPx: 420, minPx: 240, maxPx: 640 });

    layout.activateWidget(outline.widgetId);

    expect(layout.getRegionSize("main-right-menu")).toEqual({ defaultPx: 280, minPx: 180, maxPx: 360 });
  });

  test("resolves region collapsibility from the active widget contribution", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.preview",
      title: "Preview",
      region: "secondary",
      regionCollapsible: true,
    });
    registerTestWidget(layout, {
      id: "project.console",
      title: "Console",
      region: "secondary",
      regionCollapsible: false,
    });

    const preview = layout.openWidget("project.preview");
    layout.openWidget("project.console");

    expect(layout.getRegionCollapsible("secondary")).toBe(false);

    layout.activateWidget(preview.widgetId);

    expect(layout.getRegionCollapsible("secondary")).toBe(true);
  });
});

describe("createLayoutModel placeholders", () => {
  test("registers placeholders outside the widget placement list", () => {
    const layout = createLayoutModel();

    const disposable = layout.registerPlaceholder({
      id: "main.empty",
      title: "Empty main",
      region: "main",
      rendererId: "main.empty",
      regionSize: { defaultPx: 360, minPx: 240 },
      regionCollapsible: false,
    });

    expect(layout.getPlaceholder("main")).toMatchObject({
      id: "main.empty",
      title: "Empty main",
      region: "main",
      rendererId: "main.empty",
    });
    expect(layout.store.getState().placeholders.main).toMatchObject({
      id: "main.empty",
      region: "main",
    });
    expect(layout.getLayout().regions.main.widgets).toEqual([]);
    expect(layout.getRegionSize("main")).toEqual({ defaultPx: 360, minPx: 240 });
    expect(layout.getRegionCollapsible("main")).toBe(false);

    disposable.dispose();

    expect(layout.getPlaceholder("main")).toBeUndefined();
    expect(layout.getRegionSize("main")).toBeUndefined();
    expect(layout.getRegionCollapsible("main")).toBe(true);
  });

  test("uses active widgets instead of the placeholder while widgets are open", () => {
    const layout = createLayoutModel();

    layout.registerPlaceholder({
      id: "main.empty",
      title: "Empty main",
      region: "main",
      rendererId: "main.empty",
      regionSize: { defaultPx: 360, minPx: 240 },
      regionCollapsible: false,
    });
    registerTestWidget(layout, {
      id: "project.preview",
      title: "Preview",
      region: "main",
      regionSize: { defaultPx: 480, minPx: 320 },
      regionCollapsible: true,
      closable: true,
    });

    const preview = layout.openWidget("project.preview");

    expect(layout.getRegionSize("main")).toEqual({ defaultPx: 480, minPx: 320 });
    expect(layout.getRegionCollapsible("main")).toBe(true);

    layout.closeWidget(preview.widgetId);

    expect(layout.getLayout().regions.main.widgets).toEqual([]);
    expect(layout.getRegionSize("main")).toEqual({ defaultPx: 360, minPx: 240 });
    expect(layout.getRegionCollapsible("main")).toBe(false);
  });
});

describe("createLayoutModel persistence", () => {
  test("uses host visibility defaults for every unpersisted scope", () => {
    const layout = createLayoutModel({ defaultRegionVisibility: { secondary: false } });

    expect(layout.getLayout().regions.secondary.visible).toBe(false);

    layout.setRegionVisible("secondary", true);
    layout.setPersistenceScope("project:one");

    expect(layout.getLayout().regions.secondary.visible).toBe(false);
  });

  test("notifies scope listeners after the incoming layout is hydrated", () => {
    const globalLayout = createDefaultWorkbenchLayout();
    const projectLayout = createDefaultWorkbenchLayout();
    projectLayout.regions.secondary.visible = false;
    const layouts = new Map<string | undefined, WorkbenchLayout>([
      [undefined, globalLayout],
      ["project:one", projectLayout],
    ]);
    const layout = createLayoutModel({
      persistence: {
        getLayout: (scope) => layouts.get(scope),
        setLayout: (state, scope) => layouts.set(scope, structuredClone(state)),
      },
    });
    const observedVisibility: boolean[] = [];
    layout.onDidChangePersistenceScope(() => {
      observedVisibility.push(layout.getLayout().regions.secondary.visible);
    });

    layout.setPersistenceScope("project:one");

    expect(observedVisibility).toEqual([false]);
  });

  test("fills in missing regions when loading a layout persisted before new regions existed", () => {
    const partialLayout = {
      regions: {
        main: { id: "main", visible: true, widgets: [] },
      },
    } as unknown as WorkbenchLayout;
    const persistence = {
      getLayout: () => partialLayout,
      setLayout: () => undefined,
    };

    const layout = createLayoutModel({ persistence });

    expect(layout.getLayout().regions["sidenav-header"]).toBeDefined();
    expect(layout.getLayout().regions["secondary-header"]).toBeDefined();
    expect(layout.getLayout().regions["side-header"]).toBeDefined();
    expect(layout.getLayout().regions["sidenav-header"].widgets).toEqual([]);
    expect(layout.getLayout().regions["side-header"].widgets).toEqual([]);
  });

  test("exposes a store that notifies subscribers when the layout changes", () => {
    const layout = createLayoutModel();
    registerTestWidget(layout, {
      id: "project.settings",
      title: "Project settings",
      region: "main",
    });

    const activeIds: Array<string | undefined> = [];
    const unsubscribe = layout.store.subscribeSelector(
      (state) => state.layout.activeWidgetId,
      (id) => activeIds.push(id),
    );

    layout.openWidget("project.settings");
    layout.clearRegion("main");

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
      region: "main",
    });

    layout.openWidget("project.settings", {
      resource: { kind: "project", uri: "pstdio://project/project-1", label: "Prompt Studio" },
    });

    expect(savedLayouts.at(-1)?.activeWidgetId).toBe("project.settings");
    expect(savedLayouts.at(-1)?.activeResourceUri).toBe("pstdio://project/project-1");

    const rehydrated = createLayoutModel({ persistence });

    expect(rehydrated.getLayout().activeWidgetId).toBe("project.settings");
    expect(rehydrated.getLayout().regions.main.widgets[0]?.resourceUri).toBe("pstdio://project/project-1");
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
      region: "side",
      singleton: true,
    });
    layout.openWidget("session-chat-bubble");

    layout.unregisterWidget("session-chat-bubble", { removePlacements: false, persist: false });

    expect(layout.getWidget("session-chat-bubble")).toBeUndefined();
    expect(layout.getLayout().regions.side.widgets.map((widget) => widget.widgetId)).toEqual(["session-chat-bubble"]);
    expect(savedLayouts.at(-1)?.regions.side.widgets.map((widget) => widget.widgetId)).toEqual(["session-chat-bubble"]);
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
    layout.setRegionVisible("sidenav", false);
    layout.setRegionSize("sidenav", 200);

    layout.setPersistenceScope("project:b");
    layout.setRegionSize("sidenav", 360);

    layout.setPersistenceScope("project:a");
    expect(layout.getLayout().regions.sidenav.visible).toBe(false);
    expect(layout.getLayout().regions.sidenav.size).toBe(200);

    layout.setPersistenceScope("project:b");
    expect(layout.getLayout().regions.sidenav.visible).toBe(true);
    expect(layout.getLayout().regions.sidenav.size).toBe(360);
  });

  test("keeps pinned workbench chrome mounted when the persistence scope changes", () => {
    const saved = new Map<string, WorkbenchLayout>();
    const persistence = {
      getLayout: (scope?: string) => saved.get(scope ?? "__global__"),
      setLayout: (layoutState: WorkbenchLayout, scope?: string) => {
        saved.set(scope ?? "__global__", structuredClone(layoutState));
      },
    };
    const layout = createLayoutModel({ persistence });
    registerTestWidget(layout, {
      id: "dashboard.sidenav-header",
      title: "Project selector",
      region: "sidenav-header",
    });
    registerTestWidget(layout, {
      id: "dashboard.project-content",
      title: "Project content",
      region: "sidenav",
    });

    layout.openWidget("dashboard.sidenav-header", { pinned: true });
    layout.openWidget("dashboard.project-content");
    layout.setPersistenceScope("project:a");

    expect(layout.getLayout().regions["sidenav-header"].widgets).toEqual([
      expect.objectContaining({ contributionId: "dashboard.sidenav-header", pinned: true }),
    ]);
    expect(layout.getLayout().regions.sidenav.widgets).toEqual([]);

    layout.setPersistenceScope("project:b");
    expect(layout.getLayout().regions["sidenav-header"].widgets).toHaveLength(1);
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
    layout.setRegionSize("sidenav", 280);
    expect(saved.get("__global__")?.regions.sidenav.size).toBe(280);
  });

  test("persists region visibility and resize state through the layout model", () => {
    const savedLayouts: WorkbenchLayout[] = [];
    const persistence = {
      getLayout: () => savedLayouts.at(-1),
      setLayout: (layoutState: WorkbenchLayout) => {
        savedLayouts.push(structuredClone(layoutState));
      },
    };
    const layout = createLayoutModel({ persistence });

    layout.setRegionVisible("sidenav", false);
    layout.setRegionSize("sidenav", 312);
    layout.setRegionSize("secondary", 280);

    const rehydrated = createLayoutModel({ persistence });

    expect(rehydrated.getLayout().regions.sidenav.visible).toBe(false);
    expect(rehydrated.getLayout().regions.sidenav.size).toBe(312);
    expect(rehydrated.getRegionSize("sidenav")?.defaultPx).toBe(312);
    expect(rehydrated.getLayout().regions.secondary.size).toBe(280);
  });
});
