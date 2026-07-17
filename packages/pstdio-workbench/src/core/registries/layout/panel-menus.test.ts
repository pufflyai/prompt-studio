import { describe, expect, test } from "bun:test";
import { classicFrame } from "./classic-frame";
import { createLayoutModel } from "./layout-model";
import { registerTestWidget } from "./layout-model-test-utils";
import { panelMenuOpenKey, partitionPanelMenus, slotSupportsPanelMenus } from "./panel-menus";

describe("slotSupportsPanelMenus", () => {
  test("lets every panel slot own left and right menus", () => {
    const panelSlots = Object.values(classicFrame.slots).filter((slot) => slot.role === "panels");
    expect(panelSlots.every((slot) => slotSupportsPanelMenus(classicFrame, slot.id))).toBe(true);
    expect(slotSupportsPanelMenus(classicFrame, "left")).toBe(false);
  });
});

describe("partitionPanelMenus", () => {
  test("separates menu placements from tabs and resolves only the active panel menus", () => {
    const layout = createLayoutModel();
    registerTestWidget(layout, { id: "editor", title: "Editor", area: "main" });
    registerTestWidget(layout, { id: "preview", title: "Preview", area: "main" });
    registerTestWidget(layout, {
      id: "editor.files",
      title: "Files",
      area: "main",
      menu: { host: "editor", side: "left", icon: "paperclip" },
    });
    registerTestWidget(layout, {
      id: "editor.properties",
      title: "Properties",
      area: "main",
      menu: { host: "editor", side: "right", icon: "sliders-horizontal" },
    });
    registerTestWidget(layout, {
      id: "preview.properties",
      title: "Preview properties",
      area: "main",
      menu: { host: "preview", side: "right", icon: "settings" },
    });

    layout.openWidget("editor");
    layout.openWidget("editor.files");
    layout.openWidget("editor.properties");
    layout.openWidget("preview");
    layout.openWidget("preview.properties");
    layout.activateWidget("editor");

    const closedKey = panelMenuOpenKey("main", "editor.properties");
    const result = partitionPanelMenus({
      areaId: "main",
      placements: layout.getLayout().areas.main?.widgets ?? [],
      widgets: layout.store.getState().widgets,
      activeWidgetId: layout.getLayout().areas.main?.activeWidgetId,
      isOpen: (key) => key !== closedKey,
    });

    expect(result.tabs.map((placement) => placement.contributionId)).toEqual(["editor", "preview"]);
    expect(result.activePanel?.contributionId).toBe("editor");
    expect(result.docked.left?.placement.contributionId).toBe("editor.files");
    expect(result.docked.right).toBeUndefined();
    expect(result.toggles.map((menu) => menu.placement.contributionId)).toEqual(["editor.properties"]);
    expect(result.toggles[0]?.key).toBe(closedKey);
  });

  test("falls back to the first tab when the stored active id is not a panel", () => {
    const layout = createLayoutModel();
    registerTestWidget(layout, { id: "editor", title: "Editor", area: "main" });
    registerTestWidget(layout, {
      id: "editor.properties",
      title: "Properties",
      area: "main",
      menu: { host: "editor", side: "right", icon: "sliders-horizontal" },
    });
    layout.openWidget("editor");
    layout.openWidget("editor.properties");

    const result = partitionPanelMenus({
      areaId: "main",
      placements: layout.getLayout().areas.main?.widgets ?? [],
      widgets: layout.store.getState().widgets,
      activeWidgetId: "missing",
      isOpen: () => true,
    });

    expect(result.activePanel?.contributionId).toBe("editor");
    expect(result.docked.right?.placement.contributionId).toBe("editor.properties");
  });
});

describe("menu widget activation", () => {
  test("opening a menu placement preserves its host as the active panel", () => {
    const layout = createLayoutModel();
    registerTestWidget(layout, { id: "editor", title: "Editor", area: "main" });
    registerTestWidget(layout, {
      id: "editor.properties",
      title: "Properties",
      area: "main",
      menu: { host: "editor", side: "right", icon: "sliders-horizontal" },
    });
    const resource = { kind: "ticket", uri: "pstdio://ticket/PS-170" };

    layout.openWidget("editor", { resource });
    const placement = layout.openWidget("editor.properties", { resource, replaceActive: true });

    expect(placement.resource).toEqual(resource);
    expect(layout.getLayout().areas.main?.widgets.map((widget) => widget.contributionId)).toEqual([
      "editor",
      "editor.properties",
    ]);
    expect(layout.getLayout().areas.main?.activeWidgetId).toBe("editor");
    expect(layout.getLayout().activeSlotId).toBe("main");
  });
});
