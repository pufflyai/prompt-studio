import { describe, expect, test } from "bun:test";
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
      resource: { kind: "ticket", uri: "pstdio://ticket/PS-1", id: "PS-1" },
    });

    const menus = layout.getLayout().regions["side-left-menu"].widgets;
    expect(menus.map((placement) => placement.contributionId)).toEqual(["lab.tools.actions"]);
    expect(menus[0]?.ownerResourceUri).toBe("pstdio://ticket/PS-1");
  });
});
