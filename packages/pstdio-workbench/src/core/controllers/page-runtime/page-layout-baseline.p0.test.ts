import { expect, test } from "bun:test";
import { defaultPageResourceCodec } from "pstdio-api-contracts";
import { createDefaultWorkbenchLayout, type WorkbenchLayout } from "../../registries/layout/layout-types";
import { pageResourceInstanceKey } from "../../registries/pages/page-resource-context";
import { createMemoryWorkbenchPageLocationPersistence } from "../page-location/page-location-memory";
import { modePanelFixture, pageRef } from "./mode-panel-state.fixture";
import { createWorkbenchLayoutCache } from "./workbench-layout-cache";

const mainScopes = (saved: Map<string | undefined, WorkbenchLayout>) =>
  [...saved.keys()].filter((key) => key?.startsWith("workbench-main:"));
const conversations = () =>
  modePanelFixture(undefined, true, [
    {
      id: "conversation",
      ref: pageRef("conversation"),
      path: "conversation",
      modeId: "alpha",
      parentId: "alpha",
      resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
      main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one" },
      slots: [],
    },
  ]);

test("default page tabs stop claiming resources when replaced, consistently across reload", () => {
  const s = conversations();
  s.navigate("conversation", "first");
  expect(s.w.getOpenResources().map((resource) => resource.id)).toContain("first");
  s.navigate("conversation", "second");
  expect(mainScopes(s.saved)).toEqual([]);
  expect(s.w.getOpenResources().map((resource) => resource.id)).toEqual(["second"]);
  const restored = modePanelFixture(s.saved, true, [s.w.pages.getPage("conversation")!]);
  restored.navigate("conversation", "second");
  expect(restored.w.getOpenResources().map((resource) => resource.id)).toEqual(["second"]);
});

test("explicitly opened tabs retain resources across navigation and reload until closed", () => {
  const s = conversations();
  s.navigate("conversation", "first");
  s.open("extra", "main", "pin");
  s.navigate("conversation", "second");
  expect(s.w.getOpenResources().map((resource) => resource.id)).toEqual(
    expect.arrayContaining(["first", "extra", "second"]),
  );
  const restored = modePanelFixture(s.saved, true, [s.w.pages.getPage("conversation")!]);
  restored.navigate("conversation", "second");
  expect(restored.w.getOpenResources().map((resource) => resource.id)).toEqual(
    expect.arrayContaining(["first", "extra", "second"]),
  );
  restored.navigate("conversation", "first");
  const extra = restored.w.layout.listPanelInstances("main").find((panel) => panel.resource?.id === "extra")!;
  restored.w.closePlacement(extra.placementIdentity!);
  restored.navigate("conversation", "second");
  expect(restored.w.getOpenResources().map((resource) => resource.id)).toEqual(["second"]);
});

test("booting the saved location rebuilds default Main tabs without treating geometry as an explicit closure", () => {
  const page = conversations().w.pages.getPage("conversation")!;
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const locations = createMemoryWorkbenchPageLocationPersistence();
  const first = modePanelFixture(saved, true, [page], "alpha", locations);
  first.navigate("conversation", "selected");
  expect(mainScopes(saved)).toEqual([]);
  const restored = modePanelFixture(saved, true, [page], "", locations);
  expect(restored.w.pageLocations.boot("project").ok).toBe(true);
  expect(restored.ids("main")).toEqual(["selected"]);
  expect(mainScopes(saved)).toEqual([]);
  restored.open("extra", "main", "pin");
  const custom = modePanelFixture(saved, true, [page], "", locations);
  expect(custom.w.pageLocations.boot("project").ok).toBe(true);
  expect(custom.ids("main")).toEqual(expect.arrayContaining(["selected", "extra"]));
});

test("a custom Main tray survives navigation and its override disappears after returning to baseline", () => {
  const s = conversations();
  s.navigate("conversation", "first");
  expect(mainScopes(s.saved)).toEqual([]);
  s.open("extra", "main", "pin");
  const extra = s.w.layout.listPanelInstances("main").find((panel) => panel.resource?.id === "extra")!;
  expect(mainScopes(s.saved)).toHaveLength(1);
  s.navigate("conversation", "second");
  expect(s.ids("main")).not.toContain("extra");
  s.navigate("conversation", "first");
  expect(s.ids("main")).toContain("extra");
  s.w.closePlacement(extra.placementIdentity!);
  expect(mainScopes(s.saved)).toEqual([]);
  s.navigate("conversation", "second");
  s.navigate("conversation", "first");
  expect(s.ids("main")).toEqual(["first"]);
});

test("ten thousand default resource pages keep no full page snapshots", () => {
  const s = conversations();
  s.navigate("conversation", "template");
  const page = s.w.pages.getPage("conversation")!;
  const template = s.w.layout.getLayout();
  const original = template.regions.main.widgets[0];
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const cache = createWorkbenchLayoutCache({
    layoutPersistence: {
      getLayout: (scope) => saved.get(scope),
      setLayout: (layout, scope) => saved.set(scope, layout),
      removeLayout: (scope) => {
        saved.delete(scope);
      },
      listLayouts: () => [...saved].map(([scope, layout]) => ({ scope, layout })),
    },
  });
  for (let index = 0; index < 10_000; index++) {
    const resource = { ...original.resource!, id: `session-${index}` };
    const widgetId = `widget-${index}`;
    const widget = {
      ...original,
      widgetId,
      resource,
      placementIdentity: {
        kind: "page" as const,
        pageId: page.id,
        slotId: "$main",
        instanceKey: pageResourceInstanceKey(page, resource, defaultPageResourceCodec),
      },
    };
    const layout = {
      ...template,
      activeWidgetId: widgetId,
      activeLocationWidgetId: widgetId,
      regions: {
        ...template.regions,
        main: { ...template.regions.main, widgets: [widget], activeWidgetId: widgetId },
      },
    };
    cache.savePageMain({ projectId: "project", modeId: "alpha", pageId: page.id, resource }, layout, page);
  }
  expect(saved.size).toBe(0);
  expect(cache.listResources(createDefaultWorkbenchLayout())).toHaveLength(0);
});

test("closing the outgoing default preview during navigation does not create an empty override", () => {
  const s = modePanelFixture();
  s.navigate("document", "first");
  s.navigate("document", "second");
  expect(mainScopes(s.saved)).toEqual([]);
  expect(s.w.getOpenResources().some((resource) => resource.id === "first")).toBe(false);
});

test("closed default panels and a changed selection are overrides until the original tray returns", () => {
  const s = modePanelFixture(undefined, true, [
    {
      id: "with-tools",
      ref: pageRef("with-tools"),
      path: "with-tools",
      modeId: "alpha",
      main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one" },
      slots: [
        {
          id: "tools",
          region: "main",
          item: { kind: "view", view: { kind: "view", id: "document" }, presence: "open" },
        },
      ],
    },
  ]);
  s.navigate("with-tools");
  expect(mainScopes(s.saved)).toEqual([]);
  const primary = s.w.layout.getLayout().regions.main.widgets.find((widget) => widget.role === "location")!;
  const tools = s.w.layout.getLayout().regions.main.widgets.find((widget) => widget.role === "sub-panel")!;
  s.w.layout.activatePanel(tools.widgetId);
  expect(mainScopes(s.saved)).toHaveLength(1);
  s.navigate("alpha");
  s.navigate("with-tools");
  expect(s.w.layout.getLayout().regions.main.activeWidgetId).toBe(tools.widgetId);
  s.w.closePlacement(tools.placementIdentity!);
  expect(mainScopes(s.saved)).toHaveLength(1);
  s.w.pages.openSlot({ pageId: "with-tools", slotId: "tools" });
  s.w.layout.setRegionActiveWidget("main", primary.widgetId);
  expect(mainScopes(s.saved)).toEqual([]);
});

test("pinning the default resource preview creates an override", () => {
  const s = modePanelFixture();
  s.navigate("document", "first");
  expect(mainScopes(s.saved)).toEqual([]);
  const primary = s.w.layout.getLayout().regions.main.widgets[0];
  s.w.pages.pinPlacement(primary.placementIdentity!);
  expect(mainScopes(s.saved)).toHaveLength(1);
  s.navigate("document", "second");
  s.navigate("document", "first");
  expect(s.w.layout.getLayout().regions.main.widgets[0].tabRetention).toBe("persistent");
  s.w.pages.pinPlacement(primary.placementIdentity!, "preview");
  expect(mainScopes(s.saved)).toEqual([]);
});

test("header choices do not retain baseline resources and follow the page across resources", () => {
  const s = conversations();
  s.navigate("conversation", "first");
  s.w.shell.setHeaderVisible("main", false);
  s.navigate("conversation", "second");
  expect(s.w.getOpenResources().map((resource) => resource.id)).toEqual(["second"]);
  expect(s.w.shell.getPanelPolicy("main").showHeader).toBe(false);
  expect(mainScopes(s.saved)).toEqual([]);
});
