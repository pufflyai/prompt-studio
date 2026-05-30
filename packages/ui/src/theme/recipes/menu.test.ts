import { describe, expect, test } from "bun:test";
import { menuSlotRecipe } from "./menu";

describe("menuSlotRecipe", () => {
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
