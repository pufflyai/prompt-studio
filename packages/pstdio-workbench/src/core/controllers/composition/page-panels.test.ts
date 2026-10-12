import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

const page = { kind: "page", extensionId: "test", id: "workspace" } as const;
const resource = { type: "workspace", id: "one", label: "Workspace 1" };
const fixture = () => {
  const w = createWorkbench();
  w.modes.registerMode({ id: "project", panels: ["main", "secondary", "side"], activate() {} });
  for (const id of ["files", "terminal", "inspector"])
    w.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
  w.pages.registerPage({
    id: "workspace",
    ref: page,
    path: "workspaces",
    modeId: "project",
    resource: { kinds: [{ kind: "resource-kind", id: "workspace" }] },
    main: { kind: "panels", empty: { kind: "view", id: "files" } },
    panelMenus: {
      left: { view: { kind: "view", id: "files" }, size: { defaultPx: 200 }, collapsible: true },
      right: { view: { kind: "view", id: "inspector" }, collapsible: false },
    },
    regionSettings: { bottom: { size: { defaultPx: 160 }, alwaysShowTabs: true } },
    slots: [
      {
        id: "terminal",
        region: "bottom",
        item: { kind: "view", view: { kind: "view", id: "terminal" }, presence: "open" },
      },
    ],
  });
  w.pageLocations.setProject("project");
  return w;
};

test("page slots open in their own bottom, separate from the mode Secondary", async () => {
  const w = fixture();
  await w.navigation.openTarget({ kind: "page", page, resource });
  expect(w.layout.getLayout().regions.bottom.widgets).toHaveLength(1);
  expect(w.layout.getLayout().regions.bottom.widgets[0]).toMatchObject({
    resource,
    placementIdentity: { kind: "page", pageId: "workspace", slotId: "terminal" },
  });
  expect(w.layout.getLayout().regions.secondary.widgets).toEqual([]);
  const tab = w.layout.getLayout().regions.bottom.widgets[0]!;
  expect(w.getPanelDestinations(tab.widgetId)).toContain("main");
  w.movePanel(tab.widgetId, "main");
  expect(w.getPanelDestinations(tab.widgetId)).toContain("bottom");
  w.movePanel(tab.widgetId, "bottom");
  expect(w.layout.getLayout().regions.bottom.activeWidgetId).toBe(tab.widgetId);
  await w.dispose();
});

test("page menus bind to the page and refuse tab moves", async () => {
  const w = fixture();
  await w.navigation.openTarget({ kind: "page", page, resource });
  const layout = w.layout.getLayout();
  const menu = layout.regions["main-right-menu"].widgets[0]!;
  expect(menu).toMatchObject({ role: "panel-menu", resource });
  expect(w.getPanelDestinations(menu.widgetId)).toEqual([]);
  expect(() => w.movePanel(menu.widgetId, "side")).toThrow("Panel cannot move");
  const tab = layout.regions.bottom.widgets[0]!;
  expect(w.getPanelDestinations(tab.widgetId)).not.toContain("main-right-menu");
  expect(() => w.movePanel(tab.widgetId, "main-right-menu" as never)).toThrow("Panel cannot move");
  w.movePanel(tab.widgetId, "side");
  expect(w.layout.getLayout().regions["main-right-menu"].widgets[0]).toMatchObject({ resource });
  expect(w.layout.getLayout().regions["main-left-menu"].widgets).toHaveLength(1);
  await w.dispose();
});

test("opening a closed page tool keeps its routed resource binding", async () => {
  const w = fixture();
  await w.navigation.openTarget({ kind: "page", page, resource });
  w.closePlacement(w.layout.getLayout().regions.bottom.widgets[0]!.placementIdentity!);
  const tool = w.composition.panelsFor("bottom").addable.find((panel) => panel.contribution.title === "terminal")!;
  await tool.open!(resource);
  expect(w.layout.getLayout().regions.bottom.widgets[0]).toMatchObject({ resource });
  await w.dispose();
});

test("collection menus clear the routed resource and unavailable page bottoms reject moves", async () => {
  const w = fixture();
  const collection = { kind: "page", extensionId: "test", id: "collection" } as const;
  w.pages.registerPage({
    id: "collection",
    ref: collection,
    path: "collection",
    modeId: "project",
    main: { kind: "panels", empty: { kind: "view", id: "files" } },
    slots: [],
    panelMenus: { right: { view: { kind: "view", id: "inspector" } } },
  });
  await w.navigation.openTarget({ kind: "page", page, resource });
  const tab = w.layout.getLayout().regions.bottom.widgets[0]!;
  w.movePanel(tab.widgetId, "side");
  await w.navigation.openTarget({ kind: "page", page: collection });
  expect(w.layout.getLayout().regions["main-right-menu"].widgets[0]?.resource).toBeUndefined();
  expect(w.getPanelDestinations(w.layout.getLayout().regions.main.widgets[0]!.widgetId)).not.toContain("bottom");
  await w.dispose();
});
