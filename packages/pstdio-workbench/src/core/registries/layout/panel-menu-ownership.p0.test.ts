import { describe, expect, test } from "bun:test";
import { resourceKey } from "@pstdio/sdk/extensions";
import { createLayoutModel } from "./layout-model";

const registerPanelWithMenus = (layout: ReturnType<typeof createLayoutModel>) => {
  layout.registerPanel({
    id: "lab.tools",
    title: "Tools",
    region: "side",
    rendererId: "lab.tools",
    panelMenus: [
      { id: "lab.tools.actions", title: "Actions", side: "left", rendererId: "lab.tools.actions" },
      { id: "lab.tools.filters", title: "Filters", side: "right", rendererId: "lab.tools.filters" },
    ],
  });
};
describe("panel menu ownership", () => {
  test("retains separate companion menus for two live resources", () => {
    const layout = createLayoutModel();
    layout.registerPanel({
      id: "documents",
      title: "Documents",
      region: "main",
      rendererId: "documents",
      singleton: false,
      panelMenus: [{ id: "document.files", title: "Files", side: "left", rendererId: "files" }],
    });
    const first = layout.openWidget("documents", { resource: { type: "document", id: "a" }, pinned: true });
    const firstMenu = layout.getLayout().regions["main-left-menu"].widgets[0];
    const second = layout.openWidget("documents", { resource: { type: "document", id: "b" }, pinned: true });
    const menus = layout.getLayout().regions["main-left-menu"].widgets;
    expect(menus).toHaveLength(2);
    expect(menus.find((menu) => menu.widgetId === firstMenu?.widgetId)?.resource?.id).toBe("a");
    layout.activateWidget(first.widgetId);
    layout.openWidget("documents", { resource: { type: "document", id: "b" }, region: "side" });
    expect(layout.getLayout().regions["main-left-menu"].widgets[0]?.widgetId).toBe(firstMenu?.widgetId);
    expect(layout.getLayout().regions["side-left-menu"].widgets[0]?.resource?.id).toBe("b");
    expect(layout.getLayout().regions.side.widgets[0]?.widgetId).toBe(second.widgetId);
  });
  test("bottom menus follow the same owner when it moves", () => {
    const layout = createLayoutModel();
    layout.registerPanel({
      id: "document",
      title: "Document",
      region: "main",
      rendererId: "document",
      panelMenus: [{ id: "activity", title: "Activity", side: "bottom", rendererId: "activity" }],
    });
    layout.openWidget("document", { resource: { type: "document", id: "a" } });
    const menu = layout.getLayout().regions["main-bottom-menu"].widgets[0];
    expect(menu?.viewId).toBe("activity");
    layout.openWidget("document", { region: "side", resource: { type: "document", id: "a" } });
    expect(layout.getLayout().regions["main-bottom-menu"].widgets).toEqual([]);
    expect(layout.getLayout().regions["side-bottom-menu"].widgets[0]?.widgetId).toBe(menu?.widgetId);
  });
  test("menus follow their panel instance when it moves to another allowed region", () => {
    const layout = createLayoutModel();
    registerPanelWithMenus(layout);
    layout.openWidget("lab.tools", { closable: true });
    layout.openWidget("lab.tools.actions");
    layout.openWidget("lab.tools.filters");
    expect(layout.getLayout().regions["side-left-menu"].widgets.map((placement) => placement.contributionId)).toEqual([
      "lab.tools.actions",
    ]);
    const menuWidgetId = layout.getLayout().regions["side-left-menu"].widgets[0]?.widgetId;
    layout.openWidget("lab.tools", { region: "secondary" });
    const moved = layout.getLayout();
    expect(moved.regions.side.widgets).toEqual([]);
    expect(moved.regions["side-left-menu"].widgets).toEqual([]);
    expect(moved.regions["side-right-menu"].widgets).toEqual([]);
    expect(moved.regions["secondary-left-menu"].widgets.map((placement) => placement.contributionId)).toEqual([
      "lab.tools.actions",
    ]);
    expect(moved.regions["secondary-right-menu"].widgets.map((placement) => placement.contributionId)).toEqual([
      "lab.tools.filters",
    ]);
    // The menu moved as the same instance; no second placement was created.
    expect(moved.regions["secondary-left-menu"].widgets[0]?.widgetId).toBe(menuWidgetId);
  });
  test("orphan menus are removed when their owner has no placement", () => {
    const layout = createLayoutModel();
    registerPanelWithMenus(layout);
    layout.openWidget("lab.tools", { closable: true });
    layout.openWidget("lab.tools.actions");
    layout.closeWidget(layout.getLayout().regions.side.widgets[0]?.widgetId ?? "");
    layout.reconcilePanelMenus();
    expect(layout.getLayout().regions["side-left-menu"].widgets).toEqual([]);
  });
  test("keeps one menu instance when its panel is reopened for a resource", () => {
    const layout = createLayoutModel();
    registerPanelWithMenus(layout);
    layout.openWidget("lab.tools");
    layout.openWidget("lab.tools.actions");
    // A resource presenter reopens the same panel bound to a resource. The menu must
    // follow its owner instead of leaving an unbound copy behind.
    layout.openWidget("lab.tools", {
      resource: {
        type: "ticket",
        id: "PS-1",
      },
    });
    const menus = layout.getLayout().regions["side-left-menu"].widgets;
    expect(menus.map((placement) => placement.contributionId)).toEqual(["lab.tools.actions"]);
    expect(menus[0]?.ownerResourceKey).toBe(resourceKey({ type: "ticket", id: "PS-1" }));
  });
});

test("a resource menu follows the active owner tab instead of the first tab", () => {
  const layout = createLayoutModel();
  layout.registerPanel({
    id: "sessions",
    title: "Sessions",
    region: "side",
    rendererId: "sessions",
    singleton: false,
    panelMenus: [{ id: "links", title: "Links", side: "right", rendererId: "links" }],
  });
  const first = layout.openWidget("sessions", { resource: { type: "session", id: "first" }, pinned: true });
  layout.openWidget("sessions", { resource: { type: "session", id: "second" }, pinned: true });
  const menu = () =>
    layout
      .getLayout()
      .regions["side-right-menu"].widgets.find(
        (menu) => menu.menuOwnerWidgetId === layout.getLayout().regions.side.activeWidgetId,
      );
  expect(layout.getLayout().regions.side.widgets).toHaveLength(2);
  expect(menu()?.resource?.id).toBe("second");
  layout.activateWidget(first.widgetId);
  expect(menu()?.resource?.id).toBe("first");
});
