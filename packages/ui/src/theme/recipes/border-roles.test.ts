import { describe, expect, test } from "bun:test";
import { globalCss } from "../global";
import { buttonRecipe } from "./button";
import { colorPickerSlotRecipe } from "./color-picker";
import { dividerRecipe } from "./divider";
import { inputRecipe } from "./input";
import { menuSlotRecipe } from "./menu";
import { numberInputSlotRecipe } from "./number-input";
import { textareaRecipe } from "./textarea";

describe("theme recipe border roles", () => {
  test("uses the accent-light border role for interactive input states", () => {
    const restingInputBorder = {
      borderColor: "border",
      _hover: { borderColor: "border.accent-light" },
      _focus: { borderColor: "border.accent-light" },
    };

    expect(inputRecipe.base).toMatchObject(restingInputBorder);
    expect(inputRecipe.variants?.variant?.outline).toMatchObject(restingInputBorder);
    expect(textareaRecipe.base).toMatchObject(restingInputBorder);
    expect(textareaRecipe.variants?.variant?.outline).toMatchObject(restingInputBorder);
    expect(colorPickerSlotRecipe.base?.control).toMatchObject({
      borderColor: "border",
      _hover: { borderColor: "border.accent-light" },
      _focusWithin: { borderColor: "border.accent-light" },
    });
    expect(numberInputSlotRecipe.base?.root).toMatchObject({
      "--number-input-border-color": "var(--chakra-colors-border)",
      "&:is(:hover, [data-hover])": {
        "--number-input-border-color": "var(--chakra-colors-border-accent-light)",
      },
      "&:focus-within": {
        "--number-input-border-color": "var(--chakra-colors-border-accent-light)",
      },
    });
  });

  test("uses the default border role for bordered buttons", () => {
    expect(buttonRecipe.base).toMatchObject({ borderColor: "border" });
    expect(buttonRecipe.variants?.variant?.outline).toMatchObject({ border: "border" });
    expect(buttonRecipe.variants?.variant?.subtle).toMatchObject({ border: "1px solid {border}" });
  });

  test("uses the subtle border role for hr and separators", () => {
    expect(globalCss).toMatchObject({ hr: { borderColor: "border.subtle" } });
    expect(dividerRecipe.base).toMatchObject({ borderColor: "border.subtle" });
    expect(menuSlotRecipe.base?.separator).toMatchObject({ borderColor: "border.subtle" });
  });
});
