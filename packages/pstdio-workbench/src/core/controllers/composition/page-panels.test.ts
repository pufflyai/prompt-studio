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

test("pages without panel declarations accept tabs in both page panels", async () => {
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
  const moved = w.layout.getLayout().regions.side.widgets[0]!;
  expect(w.getPanelDestinations(moved.widgetId)).toEqual(expect.arrayContaining(["bottom", "aside"]));
  expect(w.shell.getPanelPolicy("bottom").open).toBe(false);
  expect(w.shell.getPanelPolicy("aside").open).toBe(false);
  w.movePanel(moved.widgetId, "aside");
  expect(w.shell.getPanelPolicy("aside").open).toBe(true);
  expect(w.layout.getLayout().regions.aside.widgets[0]).toMatchObject({
    widgetId: tab.widgetId,
    resource,
    placementIdentity: { kind: "page", pageId: "collection" },
  });
  w.movePanel(moved.widgetId, "bottom");
  expect(w.shell.getPanelPolicy("aside").open).toBe(false);
  expect(w.shell.getPanelPolicy("bottom").open).toBe(true);
  await w.dispose();
});

test("tabs in the page side stay with their page instance while mode Side follows navigation", async () => {
  const w = fixture();
  await w.navigation.openTarget({ kind: "page", page, resource });
  const tab = w.layout.getLayout().regions.bottom.widgets[0]!;
  w.movePanel(tab.widgetId, "aside");
  await w.navigation.openTarget({ kind: "page", page, resource: { ...resource, id: "two" } });
  expect(w.layout.getLayout().regions.aside.widgets).toEqual([]);
  const second = w.layout.getLayout().regions.bottom.widgets[0]!;
  w.movePanel(second.widgetId, "side");
  await w.navigation.openTarget({ kind: "page", page, resource });
  expect(w.layout.getLayout().regions.aside.widgets[0]).toMatchObject({ widgetId: tab.widgetId, resource });
  expect(w.layout.getLayout().regions.side.widgets[0]?.widgetId).toBe(second.widgetId);
  await w.dispose();
});

test("page side enforces independent permissions and restores its authored edge", async () => {
  const w = fixture();
  const overview = { kind: "page", extensionId: "test", id: "overview" } as const;
  w.pages.registerPage({
    id: "overview",
    ref: overview,
    path: "overview",
    modeId: "project",
    main: { kind: "panels", empty: { kind: "view", id: "files" } },
    slots: [],
    regionSettings: { aside: { edge: "left", acceptsTabs: false, resizable: false }, bottom: { edge: "top" } },
  });
  await w.navigation.openTarget({ kind: "page", page: overview });
  expect(w.layout.getLayout().regions.aside.edge).toBe("left");
  expect(w.layout.getLayout().regions.bottom.edge).toBe("top");
  await w.shell.setRegionOpen("aside", true);
  expect(w.shell.getPanelPolicy("aside").open).toBe(true);
  const tab = w.layout.getLayout().regions.main.widgets[0]!;
  expect(w.getPanelDestinations(tab.widgetId)).not.toContain("aside");
  expect(() => w.movePanel(tab.widgetId, "aside")).toThrow("Panel cannot move");
  expect(() => w.shell.setRegionSize("aside", 200)).toThrow("Panel cannot resize");
  await w.navigation.openTarget({ kind: "page", page, resource });
  expect(w.layout.getLayout().regions.aside.edge).toBe("right");
  await w.navigation.openTarget({ kind: "page", page: overview });
  expect(w.layout.getLayout().regions.aside.edge).toBe("left");
  await w.dispose();
});
