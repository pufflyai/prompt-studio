import { expect, test } from "bun:test";
import { modePanelFixture, pageRef } from "./mode-panel-state.fixture";

test("collection navigation preserves an independent viewer moved to Secondary", () => {
  const s = modePanelFixture(undefined, true, [], "");
  const library = { kind: "placement", extensionId: "test", id: "library" } as const;
  const viewer = { kind: "placement", extensionId: "test", id: "viewer" } as const;
  s.w.modePlacements.registerPlacement({
    id: "library",
    ref: library,
    modeId: "alpha",
    region: "main",
    item: { kind: "view", view: { kind: "view", id: "document" }, presence: "closed" },
  });
  s.w.modePlacements.registerPlacement({
    id: "viewer",
    ref: viewer,
    modeId: "alpha",
    region: "main",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "document" }],
        view: { kind: "view", id: "document" },
        cardinality: "many",
      },
    },
  });
  s.w.pages.registerPage({
    id: "library",
    ref: pageRef("library"),
    path: "library",
    modeId: "alpha",
    main: { kind: "panels", landing: library },
    panelView: library,
    slots: [],
  });
  s.w.pages.registerPage({
    id: "library-detail",
    ref: pageRef("library-detail"),
    path: "library/view",
    modeId: "alpha",
    parentId: "library",
    resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
    main: { kind: "panels", landing: viewer },
    slots: [],
  });
  s.w.pages.registerPage({
    id: "sessions",
    ref: pageRef("sessions"),
    path: "sessions",
    modeId: "alpha",
    main: { kind: "view", presentation: "page", view: { kind: "view", id: "document" }, cardinality: "one" },
    slots: [],
  });
  s.navigate("library");
  s.navigate("library-detail", "a");
  const tab = s.w.layout.getActivePanel("main")!;
  s.w.movePanel(tab.instanceId, "secondary");
  expect(s.ids("secondary")).toEqual(["a"]);
  for (const destination of ["sessions", "library", "sessions", "library"]) {
    s.navigate(destination);
    expect(s.ids("secondary")).toEqual(["a"]);
    expect(s.ids("main")).toEqual([]);
    const layout = s.w.layout.getLayout();
    const widgets = Object.values(layout.regions).flatMap((region) => region.widgets);
    for (const id of [layout.activeWidgetId, layout.activeLocationWidgetId]) {
      if (id) expect(widgets.some((widget) => widget.widgetId === id)).toBe(true);
    }
    const active = widgets.find((widget) => widget.widgetId === layout.activeWidgetId);
    expect(layout.activeResourceKey).toBe(active?.resourceKey);
  }
});
