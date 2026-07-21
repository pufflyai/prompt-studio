import { describe, expect, test } from "bun:test";
import { createDefaultWorkbenchLayout, workbenchPanelMenuRegions, workbenchRegions } from "./layout-types";
import { getSurface } from "./surface-map";

describe("Panel menu regions", () => {
  test("gives every Panel an independent left and right menu", () => {
    expect(workbenchPanelMenuRegions).toEqual({
      main: { left: "main-left-menu", right: "main-right-menu" },
      secondary: { left: "secondary-left-menu", right: "secondary-right-menu" },
      side: { left: "side-left-menu", right: "side-right-menu" },
    });

    const layout = createDefaultWorkbenchLayout();
    for (const menus of Object.values(workbenchPanelMenuRegions)) {
      expect(layout.regions[menus.left]).toBeDefined();
      expect(layout.regions[menus.right]).toBeDefined();
      expect(workbenchRegions).toContain(menus.left);
      expect(workbenchRegions).toContain(menus.right);
    }
  });

  test("projects each menu from the anchor owned by its Panel", () => {
    expect(getSurface("main-left-menu")).toMatchObject({ reads: ["primary"] });
    expect(getSurface("main-right-menu")).toMatchObject({ reads: ["primary"] });
    expect(getSurface("secondary-left-menu")).toMatchObject({ reads: ["secondary"] });
    expect(getSurface("secondary-right-menu")).toMatchObject({ reads: ["secondary"] });
    expect(getSurface("side-left-menu")).toMatchObject({ reads: ["attached"] });
    expect(getSurface("side-right-menu")).toMatchObject({ reads: ["attached"] });
  });
});
