import { expect, test } from "bun:test";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { createWorkbench } from "../../workbench-core";

const ref = (id: string) => ({ kind: "page" as const, extensionId: "example", id });
interface FixtureOptions {
  presentation?: "page" | "tabs";
  parentPanels?: boolean;
  cardinality?: "one" | "many";
  panelVersion?: boolean;
  viewerCardinality?: "one" | "many";
  saved?: Map<string | undefined, WorkbenchLayout>;
}
const fixture = (options: FixtureOptions = {}) => {
  const saved = options.saved ?? new Map<string | undefined, WorkbenchLayout>();
  const w = createWorkbench({
    layoutPersistence: {
      getLayout: (scope) => saved.get(scope),
      setLayout: (layout, scope) => saved.set(scope, structuredClone(layout)),
      removeLayout: (scope) => {
        saved.delete(scope);
      },
      listLayouts: () => [...saved].map(([scope, layout]) => ({ scope, layout })),
    },
  });
  w.modes.registerMode({ id: "project", activate() {} });
  for (const id of ["content", "landing", "tool"])
    w.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
  const viewer = { kind: "placement" as const, extensionId: "example", id: "viewer" };
  if (options.panelVersion)
    w.modePlacements.registerPlacement({
      id: "example.placement.viewer",
      ref: viewer,
      modeId: "project",
      region: "side",
      item: {
        kind: "binding",
        binding: {
          kinds: [{ kind: "resource-kind", id: "document" }],
          view: { kind: "view", id: "content" },
          cardinality: options.viewerCardinality ?? "many",
        },
      },
    });
  w.pages.registerPage({
    id: "home",
    ref: ref("home"),
    path: "home",
    modeId: "project",
    main: options.parentPanels
      ? { kind: "panels" }
      : {
          kind: "view",
          view: { kind: "view", id: "content" },
          cardinality: "one",
          presentation: options.presentation ?? "page",
        },
    slots: [],
  });
  w.pages.registerPage({
    id: "document",
    ref: ref("document"),
    path: "document",
    modeId: "project",
    parentId: "home",
    resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
    ...(options.panelVersion ? { panelView: viewer } : {}),
    main: {
      kind: "view",
      view: { kind: "view", id: "content" },
      cardinality: options.cardinality ?? "one",
      presentation: options.presentation ?? "page",
      empty: { kind: "view", id: "landing" },
    },
    slots: [],
  });
  w.pages.registerPage({
    id: "tabs",
    ref: ref("tabs"),
    path: "tabs",
    modeId: "project",
    main: { kind: "panels" },
    slots: [],
  });
  w.modePlacements.registerPlacement({
    id: "tool",
    ref: { kind: "placement", extensionId: "example", id: "tool" },
    modeId: "project",
    region: "side",
    item: { kind: "view", view: { kind: "view", id: "tool" }, presence: "open" },
  });
  w.pageLocations.setProject("project");
  const navigate = (id: string, resource?: string) =>
    w.pageLocations.navigate({
      kind: "page",
      page: ref(id),
      ...(resource ? { resource: { type: "document", id: resource } } : {}),
    });
  navigate("home");
  return { w, navigate, saved };
};

test("page-owned primary changes clear ordinary derived auxiliary resources", () => {
  const { w, navigate } = fixture();
  navigate("document", "a");
  w.layout.registerWidget({ id: "derived", rendererId: "derived", title: "Derived", region: "secondary" });
  w.layout.openWidget("derived", { resource: { type: "derived", id: "a-child" } });
  expect(w.layout.getLayout().regions.secondary.widgets).toHaveLength(1);
  navigate("document", "b");
  expect(w.layout.getLayout().regions.secondary.widgets).toEqual([]);
});

test("old page tabs moved to auxiliary panels become normal independent viewers", () => {
  const old = fixture({ presentation: "tabs", cardinality: "many", panelVersion: true });
  old.navigate("document", "a");
  old.w.movePanel(old.w.layout.getActivePanel("main")!.instanceId, "secondary");
  old.navigate("home");
  const next = fixture({ saved: old.saved, panelVersion: true });
  const viewer = next.w.layout.getActivePanel("secondary")!;
  expect(viewer?.resource?.id).toBe("a");
  expect(viewer?.placementIdentity?.kind).toBe("mode");
  expect(next.w.getPanelDestinations(viewer.instanceId)).toEqual(["secondary", "side"]);
  next.w.closePlacement(viewer.placementIdentity!);
  expect(next.w.layout.getLayout().regions.secondary.widgets).toEqual([]);
  expect(next.w.getOpenResources()).toEqual([]);
  const reload = fixture({ saved: old.saved, panelVersion: true });
  expect(reload.w.layout.getLayout().regions.secondary.widgets).toEqual([]);
});

test("late page registration retires obsolete resources from an already loaded inventory", () => {
  const old = fixture({ presentation: "tabs", cardinality: "many" });
  old.navigate("document", "a");
  old.w.pinPlacement(old.w.layout.getActivePanel("main")!.placementIdentity!, true);
  old.navigate("document", "b");
  old.navigate("home");
  const w = createWorkbench({
    layoutPersistence: {
      getLayout: (scope) => old.saved.get(scope),
      setLayout: (layout, scope) => old.saved.set(scope, layout),
      listLayouts: () => [...old.saved].map(([scope, layout]) => ({ scope, layout })),
    },
  });
  expect(w.getOpenResources().some((resource) => resource.id === "a")).toBe(true);
  w.views.registerView({ id: "content", title: "Content", body: { kind: "react", render: () => null } });
  w.pages.registerPage({
    id: "document",
    ref: ref("document"),
    path: "document",
    modeId: "project",
    parentId: "home",
    resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
    main: { kind: "view", view: { kind: "view", id: "content" }, cardinality: "many", presentation: "page" },
    slots: [],
  });
  expect(w.getOpenResources()).toEqual([]);
});

test("migrating several old tabs to a one-instance viewer preserves one valid viewer", () => {
  const old = fixture({ presentation: "tabs", cardinality: "many", panelVersion: true });
  old.navigate("document", "a");
  old.w.movePanel(old.w.layout.getActivePanel("main")!.instanceId, "side");
  old.navigate("document", "b");
  old.w.movePanel(old.w.layout.getActivePanel("main")!.instanceId, "secondary");
  old.navigate("home");
  const next = fixture({ saved: old.saved, panelVersion: true, viewerCardinality: "one" });
  const viewers = Object.values(next.w.layout.getLayout().regions)
    .flatMap((region) => region.widgets)
    .filter((widget) => widget.resource);
  expect(viewers).toHaveLength(1);
});

test("migration keeps an already independent viewer when an old page tab shows the same resource", () => {
  const old = fixture({ presentation: "tabs", cardinality: "many", panelVersion: true });
  old.w.modePlacements.openPlacement({
    panel: { kind: "placement", extensionId: "example", id: "viewer" },
    resource: { type: "document", id: "a" },
    open: "pin",
  });
  old.navigate("document", "a");
  old.w.movePanel(old.w.layout.getActivePanel("main")!.instanceId, "secondary");
  old.navigate("home");
  for (const layout of old.saved.values()) {
    for (const region of Object.values(layout.regions)) {
      for (const widget of region.widgets) {
        if (widget.placementIdentity?.kind !== "mode" || widget.resource?.id !== "a") continue;
        const id = widget.widgetId;
        widget.widgetId = "saved-viewer";
        if (region.activeWidgetId === id) region.activeWidgetId = widget.widgetId;
        if (layout.activeWidgetId === id) layout.activeWidgetId = widget.widgetId;
        region.savedWidgetOrder = region.savedWidgetOrder?.map((value) => (value === id ? widget.widgetId : value));
      }
    }
  }
  const next = fixture({ saved: old.saved, panelVersion: true });
  expect(next.w.layout.getLayout().regions.side.widgets.filter((widget) => widget.resource?.id === "a")).toHaveLength(
    1,
  );
  expect(next.w.layout.getLayout().regions.secondary.widgets).toEqual([]);
  expect(next.w.layout.getLayout().regions.side.widgets.find((widget) => widget.resource?.id === "a")?.widgetId).toBe(
    "saved-viewer",
  );
});

test("a page view rejects Main tabs independently of its header and keeps auxiliary tabs available", () => {
  const { w, navigate } = fixture();
  const side = w.layout.getActivePanel("side")!;
  expect(w.shell.getPanelPolicy("main").acceptsTabs).toBe(false);
  expect(w.getPanelDestinations(side.instanceId)).toEqual(["secondary", "side"]);
  expect(w.composition.panelsFor("main").addable).toEqual([]);
  w.shell.setHeaderVisible("main", true);
  expect(w.shell.getPanelPolicy("main").acceptsTabs).toBe(false);
  expect(() => w.movePanel(side.instanceId, "main")).toThrow();
  expect(() =>
    w.modePlacements.openPlacement({
      panel: { kind: "placement", extensionId: "example", id: "tool" },
      region: "main",
    }),
  ).toThrow();
  expect(w.layout.getActivePanel("side")?.instanceId).toBe(side.instanceId);
  navigate("tabs");
  expect(w.shell.getPanelPolicy("main").acceptsTabs).toBe(true);
  w.movePanel(side.instanceId, "main");
  expect(w.layout.getActivePanel("main")?.instanceId).toBe(side.instanceId);
});

test("a page view under a tabbed collection retires old Main resource tabs and preserves the collection's tool", () => {
  const old = fixture({ presentation: "tabs", parentPanels: true, cardinality: "many" });
  const tool = old.w.layout.getActivePanel("side")!;
  old.w.movePanel(tool.instanceId, "main");
  old.navigate("document", "a");
  old.navigate("document", "b");
  old.navigate("tabs");
  const next = fixture({ saved: old.saved, parentPanels: true, cardinality: "many" });
  expect(next.w.layout.listPanelInstances("main").map((tab) => tab.instanceId)).toEqual([tool.instanceId]);
  next.navigate("document", "b");
  expect(next.w.layout.listPanelInstances("main")).toEqual([]);
  expect(next.w.pages.getContent()?.resource?.id).toBe("b");
  expect(next.w.getOpenResources().map((resource) => resource.id)).toEqual(["b"]);
  next.navigate("document", "c");
  expect(next.w.pages.getContent()?.resource?.id).toBe("c");
  expect(next.w.layout.listPanelInstances("main")).toEqual([]);
  next.navigate("home");
  expect(next.w.layout.getActivePanel("main")?.instanceId).toBe(tool.instanceId);
  expect(next.w.pages.getContent()).toBeUndefined();
  expect(next.w.getOpenResources()).toEqual([]);
});

test("page-owned resource focus publishes changes without a Main tab", () => {
  const { w, navigate } = fixture();
  const changed: (string | undefined)[] = [];
  const subscription = w.onDidChangeActiveResource((resource) => changed.push(resource?.id));
  navigate("document", "a");
  navigate("document", "b");
  navigate("document");
  expect(changed).toEqual(["a", "b", undefined]);
  subscription.dispose();
});

test("page content has no tab actions or move destinations", () => {
  const { w } = fixture();
  const content = w.pages.getContent()!;
  expect(w.layout.getLayout().regions.main.widgets).toEqual([]);
  expect(w.getPanelDestinations(content.widgetId)).toEqual([]);
  expect(() => w.closePlacement(content.placementIdentity!)).toThrow();
  expect(w.pageLocations.closePlacement(content.placementIdentity!).ok).toBe(false);
  expect(() => w.pinPlacement(content.placementIdentity!, false)).toThrow();
  expect(w.pages.getContent()).toBe(content);
  expect(w.host.getOpenPlacementIds().has(content.widgetId)).toBe(true);
});

test("compound opening validates the destination page presentation before publishing", async () => {
  const { w, navigate } = fixture();
  navigate("tabs");
  const openTool = {
    kind: "panel",
    panel: { kind: "placement", extensionId: "example", id: "tool" },
    region: "main",
  } as const;
  await expect(
    w.navigation.openTarget({ kind: "compound", targets: [{ kind: "page", page: ref("home") }, openTool] }),
  ).rejects.toThrow();
  expect(w.pages.store.getState().activePageId).toBe("tabs");
  navigate("home");
  await w.navigation.openTarget({ kind: "compound", targets: [{ kind: "page", page: ref("tabs") }, openTool] });
  expect(w.pages.store.getState().activePageId).toBe("tabs");
  expect(w.layout.getActivePanel("main")?.viewId).toBe("tool");
});

test("resource navigation replaces the single page view and can show its declared landing", () => {
  const { w, navigate } = fixture();
  expect(navigate("document", "a").ok).toBe(true);
  expect(navigate("document", "b").ok).toBe(true);
  expect(w.layout.listPanelInstances("main")).toEqual([]);
  expect(w.pages.getContent()?.resource?.id).toBe("b");
  expect(w.getPrimaryResource()?.id).toBe("b");
  expect(w.getActiveResource()?.id).toBe("b");
  expect(w.getOpenResources().map((resource) => resource.id)).toContain("b");
  expect(navigate("document").ok).toBe(true);
  expect(w.layout.listPanelInstances("main")).toEqual([]);
  expect(w.pages.getContent()).toBeUndefined();
  expect(w.getPrimaryResource()).toBeUndefined();
  expect(w.pages.store.getState().activePageId).toBe("document");
});
