import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";
import { openOwnedViewMenu } from "../panel-menus/open-view-menu";

const pageRef = (id: string) => ({ kind: "page" as const, extensionId: "test", id });

const setup = (presentation: "page" | "tabs", companions = false) => {
  const w = createWorkbench();
  w.modes.registerMode({ id: "project", activate() {} });
  for (const id of ["editor", "properties", "tool", "resources", "activity"])
    w.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
  w.viewMenus.registerViewMenu({
    id: "properties-menu",
    ownerViewId: "editor",
    viewId: "properties",
    side: "right",
    priority: 200,
  });
  if (companions) {
    w.viewMenus.registerViewMenu({
      id: "resources-menu",
      ownerViewId: "editor",
      viewId: "resources",
      side: "right",
      priority: 100,
    });
    w.viewMenus.registerViewMenu({
      id: "activity-menu",
      ownerViewId: "editor",
      viewId: "activity",
      side: "right",
      priority: 0,
    });
  }
  if (companions)
    w.pages.registerPage({
      id: "home",
      ref: pageRef("home"),
      path: "home",
      modeId: "project",
      main: { kind: "panels" },
      slots: [],
    });
  w.pages.registerPage({
    id: "record",
    ref: pageRef("record"),
    path: "record",
    modeId: "project",
    ...(companions
      ? { parentId: "home", resource: { kinds: [{ kind: "resource-kind" as const, id: "record" }] } }
      : {}),
    main: { kind: "view", presentation, view: { kind: "view", id: "editor" }, cardinality: "one" },
    slots: [],
  });
  w.pageLocations.setProject("project-1");
  w.pageLocations.navigate({
    kind: "page",
    page: pageRef("record"),
    ...(companions ? { resource: { type: "record", id: "A" } } : {}),
  });
  return w;
};

const rightMenus = (w: ReturnType<typeof createWorkbench>) =>
  w.layout.getLayout().regions["main-right-menu"].widgets.map((placement) => placement.viewId);

test.each(["page", "tabs"] as const)("Main view menus stay with their owner, presentation=%s", (presentation) => {
  const w = setup(presentation);
  expect(rightMenus(w)).toEqual(["properties"]);
  // Unrelated layout changes reconcile menu ownership without orphaning page-content menus.
  w.layout.reconcilePanelMenus();
  expect(rightMenus(w)).toEqual(["properties"]);
});

test.each([
  "page",
  "tabs",
] as const)("the highest-priority menu is the default without replacing a chosen menu, presentation=%s", (presentation) => {
  const w = setup(presentation, true);
  const active = () => {
    const region = w.layout.getLayout().regions["main-right-menu"];
    return region.widgets.find((item) => item.widgetId === region.activeWidgetId)?.viewId;
  };
  expect(active()).toBe("properties");
  const activity = w.layout.getLayout().regions["main-right-menu"].widgets.find((item) => item.viewId === "activity")!;
  openOwnedViewMenu(w, activity.menuOwnerWidgetId!, "activity-menu");
  expect(active()).toBe("activity");
  const navigate = (id: string) =>
    w.pageLocations.navigate({ kind: "page", page: pageRef("record"), resource: { type: "record", id } });
  navigate("A");
  expect(active()).toBe("activity");
  for (const id of ["B", "A"]) {
    navigate(id);
    expect(active()).toBe(presentation === "tabs" && id === "B" ? "properties" : "activity");
    const region = w.layout.getLayout().regions["main-right-menu"];
    expect(w.panelMenuState.isOpen(`panel-menu:${region.activeWidgetId}`)).toBe(true);
  }
  if (presentation === "tabs") {
    for (const id of ["B", "A"]) {
      const panel = w.layout.listPanelInstances("main").find((item) => item.resource?.id === id)!;
      w.layout.activatePanel(panel.instanceId);
      expect(active()).toBe(id === "B" ? "properties" : "activity");
      const region = w.layout.getLayout().regions["main-right-menu"];
      expect(w.panelMenuState.isOpen(`panel-menu:${region.activeWidgetId}`)).toBe(true);
    }
  }
  w.dispose();
});
