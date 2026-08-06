import { describe, expect, test } from "bun:test";
import system from "../theme";
import { menuSlotRecipe } from "./menu";

describe("menuSlotRecipe", () => {
  // A portalled menu inherits its stacking order from the content slot: the popper copies
  // the content's computed z-index onto the positioner. Pinning it to a flat token drops the
  // dismissable-layer offset and buries menus opened from inside a dialog.
  test("keeps menu content on the layer above the dialog it was opened from", () => {
    const menuContent = system.getSlotRecipe("menu").base?.content;
    const dialogPositioner = system.getSlotRecipe("dialog").base?.positioner;

    expect(menuContent).toMatchObject({
      "--menu-z-index": "zIndex.popover",
      zIndex: "calc(var(--menu-z-index) + var(--layer-index, 0))",
    });
    expect(dialogPositioner).toMatchObject({
      "--dialog-z-index": "zIndex.popover",
      zIndex: "calc(var(--dialog-z-index) + var(--layer-index, 0))",
    });
  });

  test("uses a pointer cursor for selectable menu items", () => {
    expect(menuSlotRecipe.base?.item).toMatchObject({
      cursor: "pointer",
    });
  });

  test("sets menu item interaction backgrounds", () => {
    expect(menuSlotRecipe.base?.item).toMatchObject({
      _hover: { bg: "bg.menu-item.hover" },
      _highlighted: { bg: "bg.menu-item.hover" },
      _focusVisible: { bg: "bg.menu-item.focus" },
    });
  });
});
